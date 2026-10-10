import type { BadgeVariant } from "@/components/ui/badge";

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "checked_in",
  "attended",
  "no_show",
  "cancelled",
  "rescheduled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; short: string; variant: BadgeVariant }
> = {
  scheduled: { label: "Scheduled", short: "Booked", variant: "muted" },
  checked_in: { label: "Checked in", short: "Checked in", variant: "info" },
  attended: { label: "Attended", short: "Done", variant: "success" },
  no_show: { label: "No-show", short: "No-show", variant: "danger" },
  cancelled: { label: "Cancelled", short: "Cancelled", variant: "muted" },
  rescheduled: { label: "Rescheduled", short: "Moved", variant: "warning" },
};
