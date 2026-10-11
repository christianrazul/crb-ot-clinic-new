import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="text-sm text-muted-foreground">
          The link may be old, or the record was moved. Head back to your home screen.
        </p>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
