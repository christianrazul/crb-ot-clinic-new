import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_META, type AppointmentStatus } from "@/lib/appointment-status";

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const meta = APPOINTMENT_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}
