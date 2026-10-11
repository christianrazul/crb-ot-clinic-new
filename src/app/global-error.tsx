"use client";

import "./globals.css";

/** Replaces the root layout when it fails. Keeps to plain markup so it can't fail itself. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <title>Something went wrong · CRB OT Clinic</title>
        <main className="grid max-w-sm justify-items-center gap-3 text-center">
          <h1 className="text-lg font-semibold">CRB OT Clinic is having trouble</h1>
          <p className="text-sm text-muted-foreground">
            Please try again in a moment.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
