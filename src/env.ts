import "server-only";

import { parseEnv } from "./env.schema";

/**
 * Validated environment for server code. Importing this module throws if any
 * variable is missing or malformed; `instrumentation.ts` imports it so a
 * misconfigured server fails at boot rather than on the first request.
 *
 * Client components cannot import this file. If the browser needs a public
 * value, read it in a Server Component and pass it down as a prop.
 */
export const env = parseEnv(process.env);
