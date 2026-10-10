/**
 * Validates the environment at boot. Invalid configuration stops the process
 * immediately, instead of leaving a server running that fails on every request.
 */
try {
  await import("./env");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export {};
