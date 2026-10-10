# CRB OT Clinic

Clinic management web app for CRB OT Clinic (occupational therapy, speech therapy and SPED tutoring), with branches in Bangkal, Davao City and Panabo City.

Built with Next.js (App Router), TypeScript, Tailwind CSS, PostgreSQL 16, Drizzle ORM and Better Auth. See [docs/decisions.md](docs/decisions.md) for why things are the way they are.

## Prerequisites

- Node.js 24 (`nvm use` reads `.nvmrc`)
- pnpm 10, through Corepack: `corepack enable`
- Docker Desktop (or any Docker engine with Compose v2), **running**. If `pnpm db:up` says it "cannot connect to the Docker daemon", start Docker (`open -a Docker` on macOS) and try again.

## Setup (about five minutes)

```bash
git clone <repo-url> crb-ot-clinic && cd crb-ot-clinic
corepack enable
pnpm install
cp .env.example .env
pnpm db:up
pnpm dev
```

Open http://localhost:3000.

`pnpm db:up` starts Postgres 16 in Docker on **localhost:5433**. It uses 5433, not 5432, so it doesn't clash with a Postgres you may already have installed. Data lives in the `crb-ot-clinic_crb-db-data` volume and survives restarts. `pnpm db:down` stops the database and keeps the data.

To run end-to-end tests, install the browser once:

```bash
pnpm exec playwright install chromium
```

## Scripts

| Script              | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server on port 3000                                     |
| `pnpm build`        | Production build (standalone output, static assets copied alongside)  |
| `pnpm start`        | Run the production build, reading `.env` if present                   |
| `pnpm lint`         | ESLint, zero warnings allowed                                         |
| `pnpm typecheck`    | Generate route types and run `tsc --noEmit`                           |
| `pnpm format`       | Format everything with Prettier                                       |
| `pnpm format:check` | Check formatting without writing (used in CI)                         |
| `pnpm test`         | Unit tests (Vitest)                                                   |
| `pnpm test:watch`   | Unit tests in watch mode                                              |
| `pnpm test:e2e`     | End-to-end tests (Playwright); builds and starts the app on port 3100 |
| `pnpm db:up`        | Start the dev database and wait until it is healthy                   |
| `pnpm db:down`      | Stop the dev database (data is kept)                                  |

A pre-commit hook (Husky and lint-staged) lints and formats staged files.

## Environment variables

Every variable is validated at boot by [src/env.schema.ts](src/env.schema.ts). If one is missing or malformed, the server prints which one and exits. Server code reads values from `env` in [src/env.ts](src/env.ts), never from `process.env` directly.

| Variable              | Example                                 | Purpose                    |
| --------------------- | --------------------------------------- | -------------------------- |
| `DATABASE_URL`        | `postgres://crb:crb@localhost:5433/crb` | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`                 | Public URL of the app      |

## Project layout

```
src/
  app/(auth)/        login and password reset pages
  app/(app)/         the signed-in app
  components/ui/     shadcn/ui primitives
  components/app/    app-specific components
  server/db/         Drizzle schema, client and queries (server only)
  server/services/   business logic; every permission check lives here
  server/auth/       Better Auth setup
  lib/               shared helpers (money, dates) that are safe on client and server
  env.ts             validated environment (server only)
tests/
  unit/              Vitest
  e2e/               Playwright
```

Rules that keep this layout safe:

- Components and `lib/` never import the database. ESLint enforces this with `no-restricted-imports`.
- Every server-only module starts with `import "server-only"`.
- Money is always integer centavos. Use `formatPeso()` from `lib/money` to display it.
- Timestamps are stored in UTC. Display them with the helpers in `lib/dates`, which use `Asia/Manila`.

## Continuous integration

`.gitlab-ci.yml` runs lint and format check, typecheck and unit tests in parallel, then a production build.
