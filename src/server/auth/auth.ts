import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/env";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";

import { sendEmail } from "./email";

const SESSION_DAYS = 7;

/**
 * Better Auth with email and password, database sessions and our own `role`.
 * Self sign-up is off: the clinic owner creates accounts (services/users.ts).
 */
export const auth = betterAuth({
  appName: "CRB OT Clinic",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    usePlural: true,
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
      rateLimits: schema.rateLimits,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your CRB OT Clinic password",
        text: `Hi ${user.name},\n\nUse this link within the hour to choose a new password:\n${url}\n\nIf you did not ask for this, ignore this email; your password stays the same.`,
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "therapist" },
      active: { type: "boolean", input: false, defaultValue: true },
    },
  },
  session: {
    expiresIn: SESSION_DAYS * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
    },
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [nextCookies()],
});
