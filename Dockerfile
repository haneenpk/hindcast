# One image for the whole Hindcast backend. The ingest API and the web
# dashboard both run from it — docker-compose gives each its own command.
# Debian (not alpine) so Prisma's engine and OpenSSL just work.
FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /repo

# The whole monorepo — host node_modules/dist/.next are excluded by
# .dockerignore, so everything is built fresh and for this platform.
COPY . .

# Install (dev deps included — they build the apps), generate the Prisma
# client, then build db + shared + the two apps. The "..." closures pull in
# each app's workspace dependencies and skip demo/sdk/seed.
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @hindcast/db generate \
  && pnpm --filter "@hindcast/web..." --filter "@hindcast/ingest..." build

ENV NODE_ENV=production
EXPOSE 3000 4100

# Overridden per service in docker-compose (ingest / web / migrate).
CMD ["node", "apps/ingest/dist/main.js"]
