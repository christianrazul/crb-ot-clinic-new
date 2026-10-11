# Decisions

A running log of decisions and assumptions. Newest last. Each entry says what was decided, why, and when to revisit it.

## Milestone 0: repository and tooling

### D-001: Version policy

All dependencies are pinned to exact versions, with no `^` or `~`. Each version is the newest stable release that was at least two weeks old when it was added. Canary, beta and rc releases are not used. Upgrades are deliberate changes, made one at a time.

### D-002: TypeScript 5.9, not 7.0

TypeScript 7.0 (the native port) and 6.0 are out. `typescript-eslint` 8.70 supports only TypeScript `>=4.8.4 <6.1.0`, so we use 5.9.3. Revisit when typescript-eslint supports 7.x.

### D-003: ESLint 9, not 10, despite 9 being end of life

ESLint 9.39.5 is marked as no longer supported on npm. We tried ESLint 10.11.0: `eslint-config-next` 16.3.6 crashes on load, because its `eslint-plugin-react` 7.37.5 calls `context.getFilename()`, which ESLint 10 removed. `eslint-plugin-import` and `eslint-plugin-jsx-a11y` also don't declare ESLint 10 support, and Next 16.4 uses the same plugins.

ESLint is a development and CI tool and never ships to production, so the end-of-life status carries little risk. Revisit when `eslint-config-next` supports ESLint 10.

### D-004: Next.js 16.3.6, not 16.4.0

16.4.0 was four days old at the time (see D-001).

### D-005: Everything under `src/`

The brief mixes `app/...` with `src/server/...` and `src/env.ts`. To keep one convention, all application code lives under `src/`: `src/app`, `src/components`, `src/server` and `src/lib`. The import alias `@/*` maps to `src/*`.

### D-006: Plain Zod for environment validation

We use plain Zod instead of `@t3-oss/env-nextjs`, which means one less dependency, and it's easy to read.

- `src/env.schema.ts` holds the schema and a pure `parseEnv()`, so it can be unit tested.
- `src/env.ts` is marked `server-only` and exports the parsed `env`.
- `src/instrumentation.node.ts` imports it at server start and exits with code 1 if anything is invalid. Without the explicit exit, Next logs the error but keeps serving a broken server.
- Client components don't read env. If the browser needs a public value, a Server Component passes it down as a prop.

### D-007: Displaying money

The mockup rounds every amount to whole pesos (`₱7,000`). Amounts are stored in centavos, so rounding could hide real money. `formatPeso()` shows whole amounts without decimals (`₱7,000`) and any other amount with two decimals (`₱7,000.50`). Negative amounts use a true minus sign (`−₱500`). `pesosToCentavos()` parses user input as text rather than with floating-point maths, and rejects more than two decimal places.

### D-008: `date-fns-tz` for timezones

We follow the brief and use `date-fns-tz` 3.2.0, which supports date-fns 4. The official `@date-fns/tz` is the modern alternative if we ever need it. Unit tests run with `TZ=America/Los_Angeles`, so any accidental use of the machine's local time fails them.

### D-009: Dev database on host port 5433

Postgres is often already installed locally on 5432; on the original development machine, Homebrew Postgres 17 is. The dev container publishes `127.0.0.1:5433`, bound to localhost only. The Compose project has a fixed name (`crb-ot-clinic`), so the data volume name doesn't depend on the folder the repo was cloned into.

### D-010: Standalone output from day one

`output: "standalone"` is set now, for the Milestone 13 Docker image. `next start` doesn't support standalone output, so:

- `pnpm build` copies `.next/static` (and `public/`, if it exists) next to `server.js`.
- `pnpm start` runs `node --env-file-if-exists=.env .next/standalone/server.js`. Variables already set in the environment take precedence over `.env`.

`outputFileTracingRoot` and `turbopack.root` are pinned to the project folder, so a stray lockfile in a parent directory is never used as the root.

### D-011: Vitest without `vite-tsconfig-paths`

Vite 8 resolves tsconfig paths natively (`resolve.tsconfigPaths: true`), so we don't need the plugin. Vitest needs `vite` as a peer dependency, so it is installed explicitly.

### D-012: Playwright runs against a production build, and not in CI yet

`pnpm test:e2e` builds the app and starts it on port 3100, in two projects: Desktop Chrome and Pixel 7. Tests run with timezone `Asia/Manila` and locale `en-PH`. The Milestone 0 pipeline runs only lint, typecheck, unit tests and build, as the brief specifies. An e2e job comes in Milestone 2, when there are screens to smoke-test.

### D-013: `unrs-resolver` build script is ignored

`eslint-import-resolver-typescript` depends on `unrs-resolver`, whose install script is only a fallback for platforms without a prebuilt binary. Every platform we use (macOS arm64, Linux x64 and arm64) ships a prebuilt binary, so the script is listed under `pnpm.ignoredBuiltDependencies`.

### D-014: `AGENTS.md` is committed

`next dev` writes `AGENTS.md`, which points AI coding agents at the Next.js docs bundled in `node_modules`, and re-creates it if deleted. It is committed and excluded from Prettier, so it doesn't churn.

## Milestone 1: design system and app shell

### D-015: shadcn components generated, then restyled to the mockup

The components were generated with the shadcn CLI 4.21.0 in the `new-york` style on Radix, which is the closest to the mockup. They were then rewritten with the mockup's exact classes from `crb-mockup/src/ui.jsx`. We kept shadcn's file-per-component layout, `data-slot` attributes and `radix-ui` imports. The mockup is the visual spec, so its sizes win: 36px buttons, 14px cards, 6px badges, and so on. Milestone 2 can paste mockup markup without surprises.

Extras the mockup defines are kept: `InputGroup`, `DialogBody`, `Kbd`, the `segment` toggle variant, and badge variants `success`, `danger`, `warning`, `info` and `muted`. Dialogs use the mockup's `hideClose` prop instead of shadcn's `showCloseButton`.

### D-016: `clsx` and `tailwind-merge`, not the `cn` package

The CLI now installs a package named `cn` (version 0.4.0, from the shadcn maintainers) and imports from it. It is new and pre-1.0. We use the established `clsx` and `tailwind-merge` in `src/lib/utils.ts`, which is what the mockup uses too. After running `shadcn add`, change `from "cn"` to `from "@/lib/utils"`.

### D-017: Tokens as `hsl()` colors, dark mode only via `data-theme`

The mockup's HSL triplets are wrapped in `hsl()`, the Tailwind v4 convention, so opacity modifiers such as `bg-primary/90` work. Light and dark rendered colors were checked against the mockup and match exactly.

`next-themes` uses `attribute="data-theme"` and `defaultTheme="light"`, and stores the choice in `localStorage` (`crb-theme`). It resolves "system" itself and sets the attribute in an inline script before first paint, so the CSS has no `prefers-color-scheme` block. The `dark:` variant targets `[data-theme="dark"]`.

When strict CSP lands in Milestone 12, that inline script will need a nonce.

### D-018: Own sidebar state instead of the shadcn `Sidebar` component

shadcn's `Sidebar` pads its inset variant and adds width when collapsed, which doesn't match the mockup's 256px expanded and 56px collapsed widths with an 8px gap. We render the mockup's markup and use a small `ShellProvider` (`src/components/app/shell/shell-context.tsx`) for:

- collapsed state, saved in a `crb-sidebar` cookie that the server reads, so a reload renders the right width with no jump
- Ctrl/Cmd+B and Ctrl/Cmd+K
- the mobile sheet, which uses shadcn's `Sheet`

The breakpoint is 768px (`md`), as in the mockup.

### D-019: Role preview, branch and routes before auth exists

We pulled a small piece of Milestone 2 forward, because navigation per role can't be checked without it. Until Milestone 4:

- The previewed role (`crb-preview-role`) and the selected branch (`crb-branch`) are httpOnly cookies set by Server Actions in `src/app/(app)/actions.ts`.
- The server reads them in `src/server/session/preview.ts`.
- `previewAsRole` refuses to run unless `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`, checked on the server.
- The flag reaches the client as a prop, never through `process.env` in client code (D-006).

Routes are `/dashboard`, `/today` (front desk), `/my-day` (therapist), `/schedule`, `/patients`, `/billing`, `/payroll` and `/settings`. `/` redirects to the role's home, and visiting a screen outside your navigation redirects home.

This is a UI convenience, not security. Real authorization comes in Milestone 4.

### D-020: Shortcut labels per platform

The brief says Ctrl/Cmd. Shortcut hints show "⌘" on Apple devices and "Ctrl+" elsewhere. The server renders "Ctrl+" and the client corrects it through `useSyncExternalStore`, so there is no hydration error.

### D-021: Static header content until its features exist

- Notifications are the mockup's three items, linking by patient id (`/patients?patient=pat_05`), never by name.
- The command palette lists the sixteen fixture patients.
- "New session" and "Record advance payment" show an info toast until their dialogs are built in Milestone 2.

### D-022: `react-day-picker` 10 and `recharts` 3.8

The shadcn registry's `calendar` targets react-day-picker 10, so we pinned 10.0.1. 10.0.2 was under two weeks old (D-001). Its `chart` targets recharts 3.8.0, pinned exactly. An `.npmrc` with `save-exact=true` stops `pnpm add` from writing `^` ranges.

### D-023: Primary color darkened for contrast

The brief and the mockup both specify the primary clay color as `hsl(21 70% 45%)`. It measured 4.19:1 for button text (primary-foreground on primary) and 4.35:1 for primary-colored text on white, both below the 4.5:1 that WCAG AA requires for normal text, which the brief makes a hard requirement.

The owner chose to darken it two lightness points, to `hsl(21 70% 43%)` (`#ba5721`). It now measures 4.52:1 and 4.70:1. `--ring` follows it. Dark mode was already AA and is unchanged. This is the one intentional color difference from the mockup.

## Milestone 2: every screen with static data

### D-024: A frozen demo clock

The mockup is frozen at Saturday, August 22, 2026, 10:20 AM Manila time, and so is the static front end (`src/lib/fixtures/demo-clock.ts`). Fixtures, the now line, "Up next" and the billing day all use it, so the demo looks the same whenever it runs.

The mockup's dashboard says "Sunday, August 23", but the clinic is closed on Sundays and every other screen says Saturday the 22nd, so we treat that as a typo in the mockup. The real clock replaces the demo clock when screens move to the database (Milestones 5 to 9).

### D-025: One coherent dataset instead of the mockup's separate lists

The mockup hard-codes separate lists that contradict each other: the day grid, the week grid, the check-in queue, the billing rows, the therapist's day and "Up next". The week grid even names two patients (Kyla Aquino, Marco Villar) who aren't among the sixteen.

We kept the mockup's patients, staff, ledgers and figures, and generated appointments for five weeks from its day grid (Saturdays) and week grid (Monday to Friday), with Kyla and Marco replaced by roster patients. Every other screen derives from that one set. Checking a patient in on Today shows on the schedule, collecting a payment marks billing, and a therapist's note clears "Notes due". Layout and behavior match the mockup; some sample rows differ.

Today's sessions at 10:20 are set up so the desk has something to do:

- 9:00 sessions are attended
- 10:00 sessions are checked in
- later sessions are scheduled
- some of the morning is already paid

Enzo Dela Peña and Althea Mendoza have the past no-shows behind "Frequent no-shows".

### D-026: A demo store shaped like the future database

All screens read and change one in-memory store (`src/components/app/demo/demo-store.tsx`), driven by a pure reducer (`src/lib/demo/reducer.ts`). Its slices mirror the planned tables: appointments with fee snapshots, payments, the credit ledger, append-only notes, and soft-deleted patients. Its actions mirror the future Server Actions.

The reducer enforces the brief's rules and is unit tested:

- no double booking of staff or patients
- open days and hours only
- therapists filtered by rate class
- inactive patients cannot be booked
- 8-week recurring series
- "this and all future" cancellation
- rescheduling into a linked make-up session
- one payment per appointment
- credit deducted in the same step as the payment
- gapless receipt numbers
- references required for non-cash methods
- rate changes never touch existing fees

The booking rules live in `validateBooking()`, which the dialog calls to show a message and the reducer calls again before saving, just as the server will. The store resets on reload; that is expected until the database lands.

### D-027: Business maths in pure, tested functions

`quotePayment()` (credit up to min(balance, due), cash change, short by, references), `payrollLine()` (the clinic keeps the rounding remainder, so the shares always add up to the gross), `creditBalance()` (always the sum of the ledger) and the booking helpers are plain functions in `src/lib`. Milestones 7 to 10 call the same functions on the server.

### D-028: Small departures from the mockup, on purpose

- **Ages:** computed from date of birth, so Caleb Uy shows 5 and Elle Bautista 2, where the mockup hard-coded 6 and 3.
- **Payments need a reference:** for non-cash methods, as the brief requires. The mockup allowed a blank one.
- **Billing lists only sessions that have started:** checked in or attended, because the desk collects after each session. Listing all 14 of the day's sessions showed "Pending" for sessions hours away.
- **Therapists never see money:** no "owes" amounts, no Credit tab, no balance sort, and only patients where they are primary or backup. The mockup showed therapists every patient and their balances.
- **The therapist note dialog shows the two most recent notes,** as the mockup does. Showing more made the dialog taller than the screen and scrolled the session facts out of view.
- **Session type names follow the brief:** "SPED Tutoring", not the mockup's "SPED session".
- **Actions for later milestones show an info toast:** editing patient details, assigning a backup, editing staff and editing branches.

### D-029: URL state, by id only

The selected patient and tab (`/patients?patient=pat_05&tab=credit`) and the settings section (`/settings?tab=rates`) live in the URL, so notifications, the command palette and dashboard links open the right place. URLs carry ids, never names (brief: no patient data in URLs). Schedule view and date stay in local state.

### D-030: Tailwind v4 differences from the mockup's v3

The mockup is Tailwind v3, and three v4 differences showed up as layout bugs.

1. **Inherited line-height:** v3's `text-sm` sets a fixed 20px line-height that children inherit, while v4 sets a ratio. Text with an arbitrary size such as `text-[13px]` came out about 1.4px shorter per line. The body now sets `line-height: 1.25rem`, and measured text positions match the mockup to the pixel.
2. **Dividers:** `divide-x` clashed with per-column border rules in the stat strip, so we use explicit borders.
3. **Breakpoint sorting:** arbitrary breakpoints in px (`min-[1400px]`) don't sort after rem breakpoints (`xl`). We write them in rem (`min-[87.5rem]`).

### D-031: Charts clip their first frame

Recharts first renders at 320px before measuring its container. On a 360px phone that widened the page by 50px for a moment, which a flaky end-to-end test caught. The chart container now has `min-w-0 overflow-hidden`; a per-frame probe confirmed the overflow went from 50px to 0.

### D-032: End-to-end tests in CI

The pipeline gains an `e2e` job: Node 24, Chromium installed with `--with-deps`, and the browser cached by Playwright version. Next's standalone server binds to `$HOSTNAME`, which Docker sets to the container id, so the test server sets `HOSTNAME=0.0.0.0`. The production image in Milestone 13 needs the same.

## Milestone 3: database schema, migrations and seed

### D-033: Text primary keys, readable in seed data

Every table uses a text primary key. New rows get `crypto.randomUUID()`, and seed rows keep the fixture ids (`pat_01`, `apt_20260822_09_delarosa`), so tests, URLs and the Milestone 2 screens line up. Better Auth also uses text ids. The audit log uses a bigint identity, because it only ever grows and is ordered.

### D-034: Better Auth tables now, configured in Milestone 4

`users`, `sessions`, `accounts`, `verifications` and `rate_limits` use the field names Better Auth expects, so one migration history covers everything. `users` adds our `role`, `active`, `failed_login_count` and `locked_until`. Branch membership is the `user_branches` join table.

### D-035: Hours, not times, for opening hours and series

Sessions are one hour and start on the hour, so `branches.opens_at_hour`, `closes_at_hour` and `appointment_series.start_hour` are small integers, and `open_days` is a `smallint[]` (0 = Sunday). A check constraint keeps appointments on the hour. Asia/Manila has a whole-hour offset, so checking minute 0 in UTC is enough.

### D-036: Rules Postgres enforces

These are written in a hand-maintained migration (`drizzle/0001_integrity.sql`), next to the generated one:

- `btree_gist` exclusion constraints stop overlapping appointments per staff member and per patient, ignoring cancelled and rescheduled ones.
- A trigger function refuses `UPDATE` and `DELETE` on `session_notes`, `payments`, `credit_ledger` and `audit_log`. Corrections are new rows: a superseding note (`supersedes_id`, `version`) or an `adjustment` ledger entry. `TRUNCATE` is still allowed, so seeding and tests can reset.

### D-037: Payroll snapshot columns on appointments

`appointments.fee_centavos` is the session type rate at booking. `payroll_rate_centavos` and `payroll_share_pct` are the rate class's rate and share when the session is marked attended; a check constraint requires them on every attended appointment. Payroll for past periods therefore never changes when settings do (brief and Milestone 6).

### D-038: Gapless receipts with a locked counter row

`receipt_counters` holds one row per branch. `takeReceiptNumber()` increments it inside the payment's transaction. The row lock serializes concurrent payments, and a rollback returns the number, so there are no gaps. Prefixes are per branch: `CRB-1100` for Bangkal, `CRBP-1` for Panabo.

### D-039: Staff belong to one home branch

The brief gives staff no branch. The schedule is per branch, so `staff.branch_id` is the staff member's home branch. If therapists start splitting weeks across branches, it becomes a join table.

### D-040: Seeds come from the fixtures

`pnpm db:seed` builds its rows from the Milestone 2 fixtures (`src/server/db/seed/seed-data.ts`), so the seeded app shows the same data the static one did. It migrates first, truncates every table, inserts everything in one transaction, and refuses to run with `NODE_ENV=production` unless `--force` is passed.

Fixture series are now one weekday at one time, as the brief defines a series. Staff and rate classes get a `sort_order`, so the schedule keeps the mockup's column order.

### D-041: Database tests against a real Postgres

The brief asks for real Postgres, not mocks. Vitest has two projects: `unit` and `db`. The `db` project's global setup drops and recreates `crb_test` on the dev server (or `TEST_DATABASE_URL`), migrates and seeds it once. Tests that write data run inside a transaction that is always rolled back, and constraint tests use savepoints to check the Postgres error code (`23P01` for an exclusion violation, for example).

We chose this over Testcontainers to avoid a dependency and to reuse the dev server. CI runs a `postgres:16-alpine` service.

### D-042: Scripts run Node with the react-server condition

Server modules start with `import "server-only"`, which throws outside React Server Components. The `db:*` scripts run `node --conditions=react-server --import tsx`, which turns that import into a no-op, and Vitest aliases it to an empty module.

## Milestone 4: authentication and authorization

### D-043: scrypt, Better Auth's default, for password hashing

The brief asks for argon2id, "or the auth library's default if it is equivalent". Better Auth hashes with scrypt, which OWASP recommends alongside argon2id: it is memory-hard and resists GPU attacks. Keeping the default means no native module to build in the Docker image. If the clinic wants argon2id specifically, `emailAndPassword.password.hash` and `verify` take a custom pair.

### D-044: Our own sign-in wrapper for rate limiting and lockout

Sign-in goes through a Server Action, which calls `signInWithPassword()` (`src/server/auth/sign-in.ts`). It enforces:

- a database-backed rate limit of 10 tries per 15 minutes per IP and email, so it holds across restarts and instances
- a lockout of 15 minutes after 5 wrong passwords in a row (`users.failed_login_count`, `locked_until`)
- refusal for inactive users
- an audit entry for every success and failure

Messages never reveal whether an email has an account. Better Auth's own rate limiter also guards its HTTP endpoints (5 sign-ins a minute).

### D-045: Sessions and cookies

Sessions are database-backed: 7 days, refreshed daily, revoked everywhere on password reset. Cookies are httpOnly and SameSite=Lax, and Secure in production. Passwords need at least 12 characters, and reset links expire after an hour.

### D-046: One permissions module, checked inside services

`src/server/auth/permissions.ts` maps every action to the roles allowed. A resource can add `branchId` (the actor must belong to that branch) and `ownedByActor` (a therapist's own patient or session).

Services call `assertCan` themselves and take the database as a parameter, so the tests call exactly what the Server Actions call, with the actor the server builds from the session. A therapist asking for another therapist's patient gets "not found", the same as a missing record, so ids cannot be probed.

### D-047: The actor is always built on the server

`getActor()` (`src/server/auth/session.ts`) reads the Better Auth session, then loads the user (who must be active), their branches and their linked staff record from the database. Nothing about role, branch or staff comes from the client. The branch cookie is only a preference, honoured when the user belongs to that branch.

### D-048: Optimistic proxy, real checks everywhere

Next 16 renamed `middleware` to `proxy`. `src/proxy.ts` only checks that a session cookie exists and sends everyone else to `/login`. Pages call `requireActor()` and `requireScreen()`, and Server Actions and services check again.

### D-049: The role switcher signs in as the seed accounts

In development, "Preview as" signs out and signs in as the seeded account for that role, using `SEED_PASSWORD`. The env schema refuses `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` in production, and the layout hides the switcher there, so production builds never have it.

### D-050: Email in development and in tests

With no `SMTP_URL`, password reset emails are printed to the server console. Production refuses to boot without `SMTP_URL`. The end-to-end suite runs a production build, so it sets `E2E_TEST_MODE=true`, which only relaxes that one rule. Never set it on a server.

### D-051: End-to-end tests sign in for real

Playwright's global setup recreates a `crb_e2e` database and seeds it, so tests never touch dev data. A `setup` project then signs in once per role through `/api/auth/sign-in/email` and saves the sessions, and tests pick a role with `test.use({ storageState: storageFor("secretary") })`. Tests for logging in and out use a fresh, empty session.

### D-052: Accounts are created by the owner, with no known password

`createAccount()` creates the user, a credential account with a random password, branch memberships, and an optional link to a staff record, and writes an audit entry. The new user sets their own password through "Forgot password". The settings screen for this arrives in Milestone 6.

## Milestone 5: patients and guardians

### D-053: A clinic clock, pinned in development and tests

Server code asks `clinicNow()` and `clinicToday()` (`src/server/clock.ts`) for the date, never `new Date()`. `DEMO_NOW` pins the clock to the seeded demo Saturday in `.env`, the database tests and the end-to-end suite. Production refuses `DEMO_NOW` (unless `E2E_TEST_MODE`) and uses the real clock.

### D-054: Balances owed are computed, not stored

What a patient owes is the sum of their attended sessions before today that have no payment (`owedByPatient`). Today's unpaid sessions count as "pending" at the desk, not owed. Attendance is attended out of attended plus no-show, computed the same way.

To make those numbers real, the seed now records cash payments for every past attended session, except the ones that produce the mockup's balances: Enzo ₱1,400, Althea ₱3,500, Elle ₱700 and Kian ₱1,400. Historic receipts use their own `CRB-H` series, so they never collide with the gapless counter.

### D-055: Pages read through loaders; mutations go through `runAction`

App code may not import the database (lint rule). Pages call loaders in `src/server/loaders/`, which call services with the actor.

Every Server Action goes through `runAction()` (`src/server/actions/run-action.ts`), which:

- builds the actor from the session
- runs the service in one transaction, so a change and its audit entry are written together or not at all
- turns permission, validation and Postgres errors (overlaps, duplicates) into messages that say what to do
- logs unknown errors by class and code only, never with patient data

### D-056: The patients list is server-driven through the URL

Search (`q`), service, status, sort, page, the selected patient and the tab live in the URL; the page renders on the server from them. Typing searches 300ms after the last keystroke.

Name and age sorts run in SQL. Attendance and balance sorts are computed, so they load the branch's patients and sort in memory; a branch has hundreds of patients, not millions. Therapists can't sort by balance and never receive balances or credit.

### D-057: One Zod schema for the patient form

`src/lib/validation/patient.ts` validates in the browser (react-hook-form with `zodResolver`) and again in the service. It also rejects a primary therapist listed as a backup, and a date of birth after enrollment. Dates of birth use the native date field rather than the calendar popover, because scrolling a month calendar back eight years is slow at the desk.

### D-058: Patient search for the palette and booking

`searchPatients()` serves the command palette (all patients the actor may see) and the booking dialog (active only, so inactive patients disappear from booking). Both call it 200ms after typing stops. Therapists only find their own patients.

The palette now matches every typed word as a substring, in any order, instead of cmdk's fuzzy matching, which ranked "Billing & payments" above "Liam Santos" for "liam".

### D-059: Soft delete with a confirmation

Removing a patient sets `deleted_at` after a confirmation that explains sessions, notes and payments stay on record, and offers "set inactive" as the gentler option. Deleted patients leave every list and search.

### D-060 (temporary): Booking and billing still use the demo store

Patients now live in the database, but booking, the schedule, billing and the dialogs that change them still run on the Milestone 2 demo store until Milestones 7 to 9. Seed patients exist in both, so those screens keep working. A patient created in the database can't be booked yet: the booking dialog finds them, but the demo store rejects the booking. This resolves in Milestone 7.

## Milestone 6: settings

### D-061: Settings are owner-only and audit logged

Every settings change goes through `src/server/services/settings.ts`, which asserts `settings:manage` and writes an audit entry with the before and after values. That covers:

- rates and splits
- session types: add, change the rate, remove, restore
- staff: add, set active or inactive
- branches: add
- operating hours

### D-062: Rate changes only affect future snapshots

A rate class's rate and share are copied onto an appointment when it is marked attended (D-037), and a session type's rate is copied when it is booked. Changing either in settings never rewrites past payroll or booked fees. A database test checks this: total payroll before today is identical after a rate change, and the next session marked attended carries the new rate.

### D-063: Removing a session type hides it

Removed types keep their row (`active = false`), so past sessions still show their type. Adding a type with the same name brings the old one back. At least one type must stay active.

### D-064: Staff load is computed from appointments

Sessions are the attended sessions this month. Patients are distinct patients booked this month. Utilization is booked hours this month divided by the branch's open hours this month (open days × hours per day). The demo data covers a few weeks, so the numbers are lower than the mockup's illustrative ones.

### D-065: Staff logins from the staff screen

Adding a staff member with a login email creates a therapist account linked to that staff record (D-052). After the transaction commits, it emails a link to set a password, so a rolled-back save never sends one.

### D-066: New branches get a receipt counter and the owner's membership

A new branch gets the next code (`B3`), its own receipt prefix (`CRBT` for Toril) and counter, and the owner who adds it as a member, so it shows in their branch switcher. Editing a branch's name or location isn't in the mockup's flows and is left out.

### D-067: Hours apply to new bookings only

Changing opening days or hours never moves or cancels existing bookings. The booking rules (Milestone 7) read the branch's hours when a session is booked.

## Milestone 7: scheduling

### D-068: Booking rules in the service, overlaps backed by Postgres

`bookAppointment()` (`src/server/services/scheduling.ts`) checks, in order, and stops at the first problem with a message that says what to do:

- the session type is offered
- the therapist is at this branch, active, and in an allowed rate class
- the hour is within opening hours
- the patient is active and at this branch
- the date isn't in the past
- every occurrence falls on an open day
- no occurrence clashes with the therapist's or the patient's other sessions

If two people book the same slot at the same moment, both pass the checks, and the exclusion constraint stops the second insert. `runAction` turns that into "That time is already taken".

### D-069: Series and the daily job

A recurring booking creates an `appointment_series` row (one weekday at one time) and its first 8 weeks of appointments. `materializeSeries()` extends every open series to 8 weeks past today. It skips series whose session type was removed or whose patient is inactive or removed. Slots already taken are skipped and counted, never double-booked. Running it twice in a day does nothing.

It runs from `POST /api/jobs/materialize` with `Authorization: Bearer $CRON_SECRET` (compared in constant time; without `CRON_SECRET` set, the endpoint refuses everything), or from `pnpm jobs:materialize`. Cron setup is in Milestone 13.

### D-070: "This and all future sessions"

Cancelling that way sets the series' `ends_on` to the day before the chosen session, and cancels that session and every later scheduled or checked-in one in the series. Past sessions are untouched, and the job never brings cancelled ones back. "This session only" is a normal status change.

### D-071: Rescheduling frees the old slot first

A reschedule marks the original `rescheduled`, inserts the make-up session (`is_make_up`), then links the original to it (`rescheduled_to_id`). The original is released before the insert, so a make-up at the same hour with another therapist works. A database test caught the opposite order failing. Nothing is deleted, and a moved session can't have its status changed.

### D-072: The schedule reads the database through the URL

`/schedule?view=day|week&date=yyyy-mm-dd` renders on the server. Therapists get only their own column and sessions, can't book, and never receive fees.

The booking and session dialogs load their data from Server Actions when they open. The booking date defaults to the next open day after today, as in the mockup; empty-slot clicks and walk-ins pass their own date.

### D-073: Today reads the same appointments

The check-in queue (sessions starting in the next two hours) and the "Collect payments" list on Today come from the same day schedule as the schedule screen, so a check-in shows on both at once.

### D-060 (updated): What still runs on the demo store

Billing, payments and advance credit (Milestone 9), the therapist's My day and notes (Milestone 8), payroll (Milestone 10) and the dashboard (Milestone 11) still use the demo store. The "Collect" button on Today opens the demo payment dialog until Milestone 9.

## Milestone 8: session notes and history

### D-074: Notes are append-only and versioned

A note is never changed. Editing inserts a new row with `version + 1` and `supersedes_id` pointing at the old one, and the trigger from D-036 refuses `UPDATE` and `DELETE`. Lists and dialogs show only the latest version: no other note supersedes it. An edited note shows an "Edited" badge. Only the author can edit, and only the latest version. Every new note and edit writes an audit entry.

### D-075: Who writes and reads notes

- **Therapists** write notes only on their own sessions, and only once the session is checked in or attended. A scheduled session says "ask the desk to check the patient in first".
- **The owner and the desk** read notes for patients at their branches.
- **Therapists** read notes only for their own patients. Anything else returns "not found", as with patients.

### D-076: Notes due within 24 hours

"Notes due" lists the therapist's attended sessions from the last 30 days that have no note, oldest first. A note is on time within 24 hours of the session ending ("Due today"). After that it shows "N days late", counted in calendar days.

### D-077: My day earnings come from payroll snapshots

The therapist's earnings this month are the sum of the therapist share on each attended session, using its payroll snapshot (D-037). The weekly bars group by week of the month (days 1–7, 8–14 and so on). This is the same source payroll will use in Milestone 10.

### D-060 (updated): What still runs on the demo store

Billing, payments and advance credit (Milestone 9), payroll (Milestone 10) and the dashboard (Milestone 11).

## Milestone 9: Billing and payments

### D-078: One transaction per payment, locked rows

`collectPayment` locks the appointment row, then the patient row (`SELECT … FOR UPDATE`), checks there is no payment yet, quotes the payment with the same `quotePayment` the dialog uses, takes a receipt number, and writes the payment, the credit deduction and the audit entry in one transaction. Two desks pressing Collect at the same moment: the second waits on the lock and then sees the first payment. The unique constraint on `payments.appointment_id` is the last guard. A DB test runs two real transactions in parallel and checks only one charge lands.

### D-079: Credit spent is a ledger row linked to the payment

Applying credit inserts a negative `deduction` row in `credit_ledger` with `related_payment_id`. The balance is always the sum of the ledger; there is no stored balance column to drift.

### D-080: Receipt numbers

Payments and advance top-ups share the branch's gapless counter (D-040). On an advance, the desk can type the number from a paper receipt book; blank takes the next number. Typed numbers do not move the counter.

### D-081: What the billing day shows

A day lists sessions that are checked in or attended, plus any session that has a payment, so the desk sees what to collect next and what was paid. "Outstanding" is attended sessions before that day with no payment (D-043); "Credit on file" is every patient in the branch with a positive balance.

### D-082: Low credit reminders

The owner sets the reminder amount in Settings → Rates (default ₱1,000, stored in `clinic_settings`, audited). A patient with credit above zero and under it shows in the header notifications, and the desk gets a warning toast when a payment leaves the balance under it. Notifications are computed on each page load; there is no notifications table yet. Notes overdue and no-shows show there too.

### D-083: Non-cash needs a reference

GCash, Maya, bank transfer and card payments, and advances paid that way, need a reference number. Cash needs the amount received, which must cover what's due; change is shown and not stored separately.

### D-060 (updated): What still runs on the demo store

Payroll (Milestone 10) and the dashboard (Milestone 11), plus the shell's `viewer`.
