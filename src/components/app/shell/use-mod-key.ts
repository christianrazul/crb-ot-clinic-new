"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** "⌘" on Apple devices, "Ctrl" elsewhere. Renders "Ctrl" on the server, then corrects. */
export function useModKeyLabel(): string {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+"),
    () => "Ctrl+",
  );
}
