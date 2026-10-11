"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/** Light by default; the choice (light, dark or system) persists in localStorage. */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="crb-theme"
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
