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
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 and log in with one of the seeded accounts. The password is `SEED_PASSWORD` from `.env` (`crb-demo-password` by default):

| Role         | Email                    |
| ------------ | ------------------------ |
| Clinic owner | `camelia@crbclinic.test` |
| Front desk   | `jo@crbclinic.test`      |
| Therapist    | `jolyn@crbclinic.test`   |

In development the sidebar's "Preview as" switcher signs you in as each of these. Password reset emails are printed in the dev server console.

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

| Variable                        | Example                                  | Purpose                                                                                       |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | `postgres://crb:crb@localhost:5433/crb`  | Postgres connection string                                                                    |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`                  | Public URL of the app                                                                         |
| `BETTER_AUTH_SECRET`            | `openssl rand -base64 32`                | Signs sessions and tokens (32+ characters)                                                    |
| `SMTP_URL`                      | `smtps://user:pass@smtp.example.com:465` | Sends password reset emails. Required in production; unset in development logs emails instead |
| `EMAIL_FROM`                    | `CRB OT Clinic <no-reply@example.com>`   | Sender for those emails                                                                       |
| `SEED_PASSWORD`                 | `crb-demo-password`                      | Password for the seeded demo accounts                                                         |
| `E2E_TEST_MODE`                 | `true`                                   | End-to-end suite only: allows logging emails in a production build. Never set on a server     |
| `NEXT_PUBLIC_DEV_ROLE_SWITCHER` | `true`                                   | Shows the "Preview as" role switcher in the sidebar. Development only; defaults to `false`.   |

## Project layout

```
src/
  app/(auth)/        login and password reset pages
  app/(app)/         the signed-in app
  components/ui/     shadcn/ui primitives, restyled to match the mockup
  components/app/    app-specific components (shell, SvcDot, StatusBadge, PatientAvatar)
  server/db/         Drizzle schema, client and queries (server only)
  server/services/   business logic; every permission check lives here
  server/auth/       Better Auth setup
  lib/               shared helpers (money, dates, services) that are safe on client and server
  lib/fixtures/      static demo data used until the database lands (Milestone 3)
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

## Sign-in and permissions

Better Auth handles email and password sign-in with database sessions in httpOnly, SameSite=Lax cookies (Secure in production). There is no self sign-up; the clinic owner creates accounts (`src/server/services/users.ts`).

- Sign-in is rate limited (10 tries per 15 minutes per IP and email). Five wrong passwords in a row lock the account for 15 minutes.
- `src/proxy.ts` sends signed-out visitors to `/login`. That is only a first filter: every page, Server Action and endpoint checks the session again on the server.
- All permissions live in `src/server/auth/permissions.ts` (`can` and `assertCan`). Services call them on every read and write, scoped to the actor's branches. Therapists only ever get their own patients and sessions.

## Database

Postgres 16 with Drizzle ORM. The schema lives in `src/server/db/schema/`, migrations in `drizzle/`, and read queries in `src/server/db/queries/`. Some rules are enforced by Postgres itself (`drizzle/0001_integrity.sql`):

- No double booking: exclusion constraints on staff and on patients over `tstzrange(starts_at, ends_at)`. Cancelled and rescheduled appointments free their slot.
- Session notes, payments, the credit ledger and the audit log are append-only. Triggers refuse updates and deletes.
- Check constraints for on-the-hour sessions, payroll snapshots on attended sessions, cash covering the amount due, references on non-cash payments, and ledger signs.

`pnpm test` also runs the database tests (`tests/db/`). They create a throwaway `crb_test` database next to the dev one, so Postgres must be running (`pnpm db:up`). Set `TEST_DATABASE_URL` to point somewhere else.

To change the schema, edit `src/server/db/schema/`, run `pnpm db:generate`, review the SQL in `drizzle/`, then `pnpm db:migrate`.

## Demo data

The app runs on typed fixtures in `src/lib/fixtures/`, frozen at Saturday, August 22, 2026, 10:20 AM Manila time: two branches, five staff, sixteen patients, five weeks of sessions, three credit ledgers and this morning's payments. All the data is at CRB Bangkal; switch to Panabo to see the empty states.

Every screen reads and changes an in-memory demo store (`src/components/app/demo/demo-store.tsx`). Booking, check-in, payments, notes and settings all work, and **everything resets when you reload the page**. Use the "Preview as" switcher in the sidebar to see each role.

## UI components

Components in `src/components/ui` were generated with the shadcn CLI (`new-york` style, Radix) and then restyled with the mockup's classes. To add another one:

```bash
pnpm dlx shadcn@4.21.0 add <component>
```

The CLI currently imports `cn` from a separate `cn` npm package. Change that import to `@/lib/utils`, remove `cn` from `package.json`, and match the classes to the mockup. Design tokens live in `src/app/globals.css`. Service colors are Tailwind colors (`bg-svc-ot`, `bg-svc-ot-soft`, `text-svc-ot-strong`, and so on); pick them through the maps in `src/lib/services.ts` rather than building class names from strings.

## Keyboard shortcuts

| Shortcut     | Action                                                    |
| ------------ | --------------------------------------------------------- |
| Ctrl/Cmd + K | Open the command palette                                  |
| Ctrl/Cmd + B | Collapse or expand the sidebar (opens the menu on mobile) |

## Continuous integration

`.gitlab-ci.yml` runs lint and format check, typecheck and unit tests in parallel, then a production build.
