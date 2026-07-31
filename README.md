# Hindcast

![ci](https://github.com/haneenpk/hindcast/actions/workflows/ci.yml/badge.svg?branch=dev)

Self-hosted session replay. Meteorologists reconstruct a storm by running
their models backwards over recorded data — they call it a hindcast. This
is that, for your frontend: Hindcast records what a real user did on your
site — every click, scroll, input and navigation — and when something
breaks, plays it back like video. A JavaScript error stops being a bare
stack trace; it's the thirty seconds of footage that led up to it.

GlitchTip is self-hosted Sentry. Hindcast is self-hosted LogRocket.
Sessions never leave your infrastructure.

## How it works

1. **Record.** One async `<script>` tag loads a single ~60 KB (gzipped)
   `r.js` that captures DOM mutations (the rrweb technique — events, not
   pixels), buffers them in memory, and flushes every ~5 seconds plus
   once more on page unload via `sendBeacon`. Single-page route changes
   are tracked, so each page a visitor lands on is its own chunk.
2. **Mask.** Inputs are masked in the visitor's browser before anything
   goes on the wire. Password and card fields can never be unmasked —
   no allowlist, attribute or config reaches them, and their mask is
   fixed-length so it can't leak how long a secret is. Mark any element
   `data-private` and it records as a same-size placeholder block; opt
   harmless fields out with `data-hc-unmask` or `privacy.unmask`
   selectors. What was never captured can't leak.
3. **Store.** The ingest API authenticates by project key, gzips event
   chunks into S3-compatible storage, and keeps only metadata in
   Postgres: sessions, errors, failed requests, and where each chunk
   lives.
4. **Replay.** The dashboard plays a session back with a synced timeline
   of console errors and failed network requests underneath. Click an
   error, land on the exact moment it fired.

## Layout

    packages/db      Prisma schema + client — the metadata store
    packages/sdk     browser recorder that sites embed
    packages/shared  zod schemas shared by SDK and ingest
    apps/ingest      ingestion API
    apps/web         dashboard + replay player
    apps/demo        small storefront with planted bugs, the demo stage

All of it exists and runs; the remaining work is hardening, polish and
packaging.

## Running locally

Needs Node 20+, pnpm 10 and Docker.

```sh
docker compose up -d      # postgres, redis, minio (+ events bucket)
pnpm install
cp packages/db/.env.example packages/db/.env
pnpm db:migrate
```

`pnpm db:studio` opens Prisma Studio if you want to poke at the tables.
If the default ports clash with services you already run, copy
`.env.example` to `.env` and move them.

To take batches from a recorder, run the ingest API:

```sh
cp apps/ingest/.env.example apps/ingest/.env
pnpm --filter @hindcast/ingest start:dev    # listens on :4100
```

And the dashboard:

```sh
cp apps/web/.env.example apps/web/.env     # set ADMIN_SECRET
pnpm --filter @hindcast/web dev            # listens on :3000
```

The dashboard is locked behind the one `ADMIN_SECRET` — there are no
user accounts to manage on a self-hosted single-team install.

To generate sessions worth watching, run Fernwood, the demo shop:

```sh
cp apps/demo/.env.example apps/demo/.env   # paste a project key
pnpm --filter @hindcast/demo dev           # listens on :5173
```

Fernwood ships with three planted bugs — a coupon code that throws, a
stock check that fails, and a newsletter signup nobody catches — so
there is always something worth replaying.

Or skip the recording and populate the dashboard with realistic,
replayable demo data:

```sh
cp packages/seed/.env.example packages/seed/.env   # mirror your ports
pnpm seed
```

The ingest integration tests boot the built server against the compose
stack, so have `docker compose up -d` running before `pnpm test`.

## Self-hosting

Hindcast is four moving parts and three backing services, all in the
`docker-compose.yml`:

- **`apps/ingest`** — the public endpoint the recorder posts to. Expose
  this one to the internet. It authenticates every batch by project key,
  rate-limits per key, and writes gzipped chunks to object storage.
- **`apps/web`** — the dashboard and landing page. Behind your own
  network or auth; the app itself is gated by a single `ADMIN_SECRET`.
- **Postgres** — session, error, network and chunk metadata.
- **Object storage** (MinIO or any S3-compatible bucket) — the gzipped
  event chunks themselves; nothing sensitive, but where the bulk lives.
- **Redis** — backs the BullMQ retention jobs that delete expired
  sessions.

Each app reads its configuration from environment variables — see the
`.env.example` next to each one. Point the recorder's `data-endpoint` at
your ingest host, set a real `ADMIN_SECRET`, give each service its
`DATABASE_URL` and `S3_*` credentials, and it runs. A one-command
compose deployment and a hosted demo are on the way.

## Status

The pipeline is closed and the dashboard is open: the recorder batches
rrweb events and ships them every five seconds (plus one last
`sendBeacon` as the tab dies); ingest authenticates the project key,
gzips each chunk into object storage, and indexes the session in
Postgres; the dashboard manages projects, hands out install snippets,
lists recorded sessions, and plays them back — click a session and
watch it. The recorder captures uncaught errors, unhandled rejections
and console.error with timestamps, and sessions that broke wear a red
dot in the list. It also records every fetch and XHR outcome — method,
url, status, duration; never bodies — including requests that got no
answer at all. Errors and failed requests sit on the player's timeline
as markers, and console and network lanes under the player carry the
detail — click a row for the full stack or request, then jump the
replay to that moment. The session list filters by errors, device, page
and duration, searches across ids and urls, and paginates — every
filtered view is a shareable link. The player behaves like a real video
player: 1×/2×/4×, skip-idle, a scrubber with markers riding the track,
space and arrow keys, click the footage to pause. Sites can wear a
floating "report a bug" button (or call `report()` directly), so
sessions arrive flagged with the visitor's own words — an amber dot in
the list, the comment above the player. Fernwood, the demo shop,
generates believable sessions with believable failures. Masking is a
tested system now — the never-unmaskable rules, the allowlist and the
data-private blocks are pinned by unit tests, and a real-browser audit
grepped the stored bytes for planted secrets. Each project sets how long
its sessions are kept; a BullMQ worker sweeps the expired ones — rows
and stored objects alike — and the settings page shows the storage each
project is using. The projects home is a place to start the day: a
cross-project feed of whatever broke or got reported most recently,
above cards for every site. The ingest endpoint is hardened for the open
internet: oversized bodies get a 413, each project key is rate-limited
per minute (fail-open, so a Redis blip never drops recordings), keys
rotate from settings, and CORS is open to all origins but credential-free
by design. The SDK ships two ways — the `@hindcast/sdk` npm package
(`npm i @hindcast/sdk`) and a single self-contained `r.js` embed (rrweb
bundled in, ~60 KB gzipped, under a
budget CI enforces) — tracks SPA route changes, and never breaks the
host page. `pnpm seed` fills a fresh install with 45 replayable sample
sessions across three projects, built from real recorded journeys, so
the dashboard opens to a product rather than empty states. The player
goes fullscreen (button or the `f` key) and refits the replay to any
viewport. A public landing page fronts the dashboard, and the self-host
guide above lays out the pieces. Next: one-command self-host and a
deploy.
