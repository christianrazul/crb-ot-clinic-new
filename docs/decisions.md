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
