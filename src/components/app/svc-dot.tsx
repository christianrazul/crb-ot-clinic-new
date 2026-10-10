import { SERVICE_BG, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

/** Small colored dot identifying a service. Decorative; pair it with a text label. */
export function SvcDot({ service, className }: { service: ServiceKey | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        SERVICE_BG[service ?? "none"],
        className,
      )}
    />
  );
}
