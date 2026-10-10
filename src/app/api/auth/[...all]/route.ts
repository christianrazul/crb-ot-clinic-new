import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

/** Better Auth's HTTP endpoints (sign-in API, password reset callback). */
export const { GET, POST } = toNextJsHandler(auth);
