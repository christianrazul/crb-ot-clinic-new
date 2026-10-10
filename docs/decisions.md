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
