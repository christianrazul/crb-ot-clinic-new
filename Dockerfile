# syntax=docker/dockerfile:1
# Production image. Targets:
#   runner  (default) the Next.js standalone server, as the unprivileged `node` user
#   migrate one-off: applies database migrations, then exits
ARG NODE_IMAGE=node:24.21.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    corepack install && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Placeholders so env validation passes during the build. Real values come at
# runtime from the server's .env; nothing secret is baked into the image.
ENV NODE_ENV=production
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    NEXT_PUBLIC_APP_URL=https://build.invalid \
    BETTER_AUTH_SECRET=build-only-placeholder-not-a-real-secret \
    pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    corepack install && pnpm install --frozen-lockfile --prod --ignore-scripts

FROM ${NODE_IMAGE} AS migrate
WORKDIR /app
ENV NODE_ENV=production
# The runner needs only drizzle-orm and postgres (neither has dependencies),
# at the exact versions pinned in package.json.
COPY --from=prod-deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=prod-deps /app/node_modules/postgres ./node_modules/postgres
COPY drizzle ./drizzle
COPY scripts/migrate.mjs ./scripts/migrate.mjs
USER node
CMD ["node", "scripts/migrate.mjs"]

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker sets HOSTNAME to the container id; bind to every interface instead.
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
