"use client";

import { AlertTriangle } from "lucide-react";

import { Page } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown when a screen fails to load. Production errors carry only a digest
 * (the server log has the details), never the message or patient data.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Page>
      <Card className="mx-auto mt-8 grid max-w-md justify-items-center gap-3 p-8 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger-strong">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">This screen didn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong on our side. Try again; if it keeps happening, tell the clinic owner
          {error.digest ? (
            <>
              {" "}
              and mention code <span className="font-mono text-foreground">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
        <Button onClick={() => retry()}>Try again</Button>
      </Card>
    </Page>
  );
}
