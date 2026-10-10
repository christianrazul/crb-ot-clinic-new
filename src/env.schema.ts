import { z } from "zod";

/**
 * Environment schema. Kept separate from `env.ts` so it can be unit tested
 * without the `server-only` guard. Add every new variable here and to
 * `.env.example`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .url()
    .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
      message: "must be a postgres:// or postgresql:// connection string",
    }),
  NEXT_PUBLIC_APP_URL: z.url(),
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
