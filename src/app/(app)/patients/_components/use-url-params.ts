"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/** Updates query parameters without a full reload. Empty or default values are dropped. */
export function useUrlParams(defaults: Record<string, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const hrefWith = React.useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const text = value === undefined ? "" : String(value);
        if (!text || text === defaults[key]) next.delete(key);
        else next.set(key, text);
      }
      const query = next.toString();
      return (query ? `${pathname}?${query}` : pathname) as Route;
    },
    [defaults, pathname, searchParams],
  );

  const setParams = React.useCallback(
    (patch: Record<string, string | number | undefined>) =>
      startTransition(() => router.replace(hrefWith(patch), { scroll: false })),
    [hrefWith, router],
  );

  return { setParams, hrefWith, pending };
}
