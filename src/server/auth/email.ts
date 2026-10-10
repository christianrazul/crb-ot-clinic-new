import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/env";

type Email = { to: string; subject: string; text: string };

/**
 * Sends a transactional email. In development, with no SMTP_URL, the email is
 * printed to the server console instead (the brief's password reset rule).
 * Production refuses to boot without SMTP_URL (see env.schema.ts).
 */
export async function sendEmail(email: Email) {
  if (!env.SMTP_URL) {
    console.info(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    return;
  }
  const transport = nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.EMAIL_FROM, ...email });
}
