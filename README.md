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

1. **Record.** One script tag captures DOM mutations (the rrweb
   technique — events, not pixels), buffers them in memory, and flushes
   every ~5 seconds plus once more on page unload via `sendBeacon`.
2. **Mask.** Inputs are masked in the visitor's browser before anything
   goes on the wire. Password and card fields can never be unmasked.
   What was never captured can't leak.
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

The recorder, the shared wire schema, the ingest API and the metadata
store exist so far; the dashboard and demo shop are still to come.

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

The ingest integration tests boot the built server against the compose
stack, so have `docker compose up -d` running before `pnpm test`.

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
filtered view is a shareable link. Fernwood, the demo shop, generates
believable sessions with believable failures. The player behaves like a
real video player: 1×/2×/4×, skip-idle, a scrubber with markers riding
the track, space and arrow keys, click the footage to pause. Next: the
"report a bug" button in the SDK.
