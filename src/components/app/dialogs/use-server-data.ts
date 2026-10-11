"use client";

import * as React from "react";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Loads data from a Server Action once when a dialog opens. */
export function useServerData<T>(load: () => Promise<Result<T>>) {
  const [state, setState] = React.useState<{ data: T | null; error: string | null }>({
    data: null,
    error: null,
  });
  const loadRef = React.useRef(load);
  React.useEffect(() => {
    let cancelled = false;
    loadRef.current().then((result) => {
      if (cancelled) return;
      setState(
        result.ok ? { data: result.data, error: null } : { data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
