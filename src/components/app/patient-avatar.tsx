import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/initials";
import { SERVICE_SOFT, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

/** Initials on the patient's service tint. The name is read out for screen readers. */
export function PatientAvatar({
  name,
  service,
  className,
}: {
  name: string;
  service: ServiceKey | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8", className)} aria-hidden>
      <AvatarFallback className={cn("text-[11px]", SERVICE_SOFT[service ?? "none"])}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
