// Next.js standalone output does not include static assets. Copy them next to
// server.js so `pnpm start` (and the Docker image) serves CSS, JS and images.
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) {
  cpSync("public", `${standalone}/public`, { recursive: true });
}
