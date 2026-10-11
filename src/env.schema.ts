import { z } from "zod";

/**
 * Environment schema. Kept separate from `env.ts` so it can be unit tested
 * without the `server-only` guard. Add every new variable here and to
 * `.env.example`.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Set by Next.js while building; production-only rules wait for the running server. */
    NEXT_PHASE: z.string().optional(),
    DATABASE_URL: z
      .url()
      .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
        message: "must be a postgres:// or postgresql:// connection string",
      }),
    NEXT_PUBLIC_APP_URL: z.url(),
    /** Signs session cookies and tokens. Generate with: openssl rand -base64 32 */
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters (openssl rand -base64 32)"),
    /** SMTP connection for password reset emails, e.g. smtps://user:pass@smtp.example.com:465 */
    SMTP_URL: z.url().optional(),
    EMAIL_FROM: z.string().default("CRB OT Clinic <no-reply@crbclinic.test>"),
    /** Shows the "Preview as" switcher, which signs in as the seed users. Development only. */
    NEXT_PUBLIC_DEV_ROLE_SWITCHER: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /**
     * Freezes the clinic clock, e.g. 2026-08-22T10:20:00+08:00, so the seeded
     * demo week is "today". Development and tests only; production uses the real clock.
     */
    DEMO_NOW: z.iso.datetime({ offset: true }).optional(),
    /** Bearer token for scheduled jobs (POST /api/jobs/materialize). Generate: openssl rand -base64 32 */
    CRON_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
    /**
     * First start of an empty production database: creates the main branch
     * and the owner's account, and emails them a link to set a password.
     * Ignored once any account exists. See docs/deploy.md.
     */
    BOOTSTRAP_OWNER_EMAIL: z.email().optional(),
    BOOTSTRAP_OWNER_NAME: z.string().trim().min(1).max(120).optional(),
    BOOTSTRAP_BRANCH_NAME: z.string().trim().min(1).max(80).optional(),
    BOOTSTRAP_BRANCH_LOCATION: z.string().trim().max(120).default(""),
    /** Password for the seeded demo accounts (pnpm db:seed). */
    SEED_PASSWORD: z.string().min(12).optional(),
    /**
     * For the end-to-end suite only, which runs a production build: lets it
     * log emails instead of requiring SMTP. Never set this on a real server.
     */
    E2E_TEST_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.BOOTSTRAP_OWNER_EMAIL && (!env.BOOTSTRAP_OWNER_NAME || !env.BOOTSTRAP_BRANCH_NAME)) {
      ctx.addIssue({
        code: "custom",
        path: ["BOOTSTRAP_OWNER_EMAIL"],
        message: "needs BOOTSTRAP_OWNER_NAME and BOOTSTRAP_BRANCH_NAME too",
      });
    }
    if (env.NODE_ENV !== "production" || env.NEXT_PHASE === "phase-production-build") return;
    if (env.NEXT_PUBLIC_DEV_ROLE_SWITCHER) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_DEV_ROLE_SWITCHER"],
        message: "must be false in production; it signs in as demo accounts",
      });
    }
    if (env.DEMO_NOW && !env.E2E_TEST_MODE) {
      ctx.addIssue({
        code: "custom",
        path: ["DEMO_NOW"],
        message: "must not be set in production; it freezes the clock",
      });
    }
    if (!env.E2E_TEST_MODE && !env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_APP_URL"],
        message: "must be an https:// URL in production; session cookies are Secure",
      });
    }
    if (!env.CRON_SECRET && !env.E2E_TEST_MODE) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "is required in production so the daily scheduling job can run",
      });
    }
    if (!env.SMTP_URL && !env.E2E_TEST_MODE) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "is required in production so password reset emails can be sent",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables. Copy .env.example to .env and fix:\n${issues}`);
  }
  return result.data;
}
