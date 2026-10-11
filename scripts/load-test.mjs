#!/usr/bin/env node
/**
 * Small load test with no dependencies: N concurrent signed-in users hit the
 * busiest screens for a fixed time, then it prints latency percentiles.
 *
 *   node scripts/load-test.mjs --url http://localhost:3000 \
 *     --state tests/e2e/.auth/secretary.json --users 20 --seconds 30
 *
 * --state is a Playwright storage state (the e2e setup writes one per role),
 * or pass --cookie "name=value". Run it against a production build
 * (`pnpm build && pnpm start`), never against the live clinic.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    state: { type: "string" },
    cookie: { type: "string" },
    users: { type: "string", default: "20" },
    seconds: { type: "string", default: "30" },
    paths: { type: "string", default: "/today,/schedule,/schedule?view=week,/patients,/billing" },
    // Fail (exit 1) if p95 goes over this many milliseconds.
    "max-p95": { type: "string", default: "800" },
  },
});

function cookieHeader() {
  if (values.cookie) return values.cookie;
  if (!values.state) throw new Error("Pass --state <storage.json> or --cookie 'name=value'.");
  const state = JSON.parse(readFileSync(values.state, "utf8"));
  return state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

const cookie = cookieHeader();
const paths = values.paths.split(",");
const deadline = Date.now() + Number(values.seconds) * 1000;
const timings = new Map(paths.map((p) => [p, []]));
let errors = 0;

async function user(index) {
  let i = index;
  while (Date.now() < deadline) {
    const path = paths[i++ % paths.length];
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, values.url), {
        headers: { cookie },
        redirect: "manual",
      });
      await response.arrayBuffer();
      if (response.status !== 200) errors++;
      else timings.get(path).push(performance.now() - started);
    } catch {
      errors++;
    }
  }
}

const pct = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

await Promise.all(Array.from({ length: Number(values.users) }, (_, i) => user(i)));

let worstP95 = 0;
let total = 0;
console.log(`${values.users} users for ${values.seconds}s against ${values.url}\n`);
console.log(
  "path".padEnd(24),
  "requests".padStart(9),
  "p50".padStart(7),
  "p95".padStart(7),
  "p99".padStart(7),
);
for (const [path, list] of timings) {
  const sorted = list.sort((a, b) => a - b);
  total += sorted.length;
  if (!sorted.length) continue;
  const p95 = pct(sorted, 95);
  worstP95 = Math.max(worstP95, p95);
  console.log(
    path.padEnd(24),
    String(sorted.length).padStart(9),
    `${Math.round(pct(sorted, 50))}ms`.padStart(7),
    `${Math.round(p95)}ms`.padStart(7),
    `${Math.round(pct(sorted, 99))}ms`.padStart(7),
  );
}
console.log(
  `\n${total} ok, ${errors} errors, ${(total / Number(values.seconds)).toFixed(1)} req/s`,
);
if (errors || worstP95 > Number(values["max-p95"])) {
  console.error(
    `Failed: ${errors} errors, worst p95 ${Math.round(worstP95)}ms (limit ${values["max-p95"]}ms).`,
  );
  process.exit(1);
}
