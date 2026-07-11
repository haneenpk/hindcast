# Hindcast

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

Only `packages/db` exists so far; the rest lands roughly in that order.

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

## Status

Early. Local infrastructure and the data model are in place; the
recorder SDK is next.
