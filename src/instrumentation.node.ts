/**
 * Validates the environment at boot. Invalid configuration stops the process
 * immediately, instead of leaving a server running that fails on every request.
 * Then, on an empty production database, creates the owner's account.
 */
try {
  await import("./env");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { env } = await import("./env");
if (env.BOOTSTRAP_OWNER_EMAIL && env.BOOTSTRAP_OWNER_NAME && env.BOOTSTRAP_BRANCH_NAME) {
  const { bootstrapClinic } = await import("./server/bootstrap");
  const { getDb } = await import("./server/db/client");
  const email = await bootstrapClinic(getDb(), {
    ownerEmail: env.BOOTSTRAP_OWNER_EMAIL,
    ownerName: env.BOOTSTRAP_OWNER_NAME,
    branchName: env.BOOTSTRAP_BRANCH_NAME,
    branchLocation: env.BOOTSTRAP_BRANCH_LOCATION,
  });
  if (email) {
    try {
      const { auth } = await import("./server/auth/auth");
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset-password` },
        headers: new Headers(),
      });
      console.info(
        `Created the owner account (${email}) and sent a link to set a password. If it does not arrive, check the SMTP settings and use "Forgot password" on the login page.`,
      );
    } catch (error) {
      console.error(
        `Created the owner account (${email}) but the email failed; use "Forgot password" on the login page.`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export {};
