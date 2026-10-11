import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { headers } from "next/headers";

import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Variable font: one file covers the 400 to 700 weights the design uses.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CRB OT Clinic", template: "%s · CRB OT Clinic" },
  description: "Clinic management for CRB OT Clinic",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c0b" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Set per request by src/proxy.ts, for the theme script under the strict CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // next-themes sets data-theme before React hydrates, so the attribute differs from the server.
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider nonce={nonce}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
