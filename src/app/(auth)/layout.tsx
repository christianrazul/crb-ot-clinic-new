import { LogoMark } from "@/components/app/shell/logo-mark";

/** Centered card on the sidebar tint, the same look as the app shell. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark className="size-10" />
        <div className="grid leading-tight">
          <span className="text-base font-semibold">CRB OT Clinic</span>
          <span className="text-xs text-muted-foreground">Occupational, speech and SPED</span>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xs">
        {children}
      </div>
    </main>
  );
}
