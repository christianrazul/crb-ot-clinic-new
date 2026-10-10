import { addWeeks, format, parseISO } from "date-fns";

import { eligibleStaff, hourLabel } from "@/lib/booking";
import { fromManilaLocal, manilaWeekday } from "@/lib/dates";
import type { AppointmentFixture } from "@/lib/fixtures/appointments";

import { byId, displayName } from "./selectors";
import type { DemoState } from "./state";

/** Recurring bookings are materialized this far ahead (the daily job in Milestone 7). */
export const RECURRING_HORIZON_WEEKS = 8;

export type BookingInput = {
  branchId: string;
  /** An existing patient, or null with newPatientName to add one. */
  patientId: string | null;
  newPatientName?: string;
  staffId: string;
  sessionTypeId: string;
  /** yyyy-MM-dd in clinic time */
  date: string;
  hour: number;
  recurring: boolean;
  /** Set when rescheduling: the original appointment becomes "rescheduled". */
  rescheduleFromId?: string;
};

/** Statuses that hold a slot. Cancelled and rescheduled ones free it. */
const HOLDS_SLOT = new Set(["scheduled", "checked_in", "attended", "no_show"]);

export function occurrenceDates(input: Pick<BookingInput, "date" | "recurring">): string[] {
  if (!input.recurring) return [input.date];
  return Array.from({ length: RECURRING_HORIZON_WEEKS }, (_, week) =>
    format(addWeeks(parseISO(input.date), week), "yyyy-MM-dd"),
  );
}

function slotStart(date: string, hour: number): Date {
  return fromManilaLocal(date, `${String(hour).padStart(2, "0")}:00`);
}

const shortDate = (date: string) => format(parseISO(date), "EEE, MMM d");

/**
 * Checks a booking against the business rules. Returns a message the desk can
 * act on, or null when it is fine. The reducer runs this again before saving,
 * just as the server will.
 */
export function validateBooking(state: DemoState, input: BookingInput): string | null {
  const branch = byId(state.branches, input.branchId);
  const staff = byId(state.staff, input.staffId);
  const type = byId(state.sessionTypes, input.sessionTypeId);
  if (!branch || !type) return "Choose a session type.";
  if (!staff) return "Choose a therapist.";

  const patient = byId(state.patients, input.patientId);
  if (!patient && !input.newPatientName?.trim()) return "Choose a patient.";
  if (patient && (patient.status !== "active" || patient.deletedAt)) {
    return `${displayName(patient)} is inactive and can't be booked. Set them active in settings first.`;
  }

  if (!eligibleStaff([staff], type.allowedRateClassIds).length) {
    const rateClass = byId(state.rateClasses, staff.rateClassId);
    return `${staff.displayName} (${rateClass?.name ?? "this role"}) can't run ${type.name.toLowerCase()}s. Pick another therapist.`;
  }

  if (input.hour < branch.opensAtHour || input.hour + 1 > branch.closesAtHour) {
    return `Sessions at ${branch.name} run from ${hourLabel(branch.opensAtHour)} to ${hourLabel(branch.closesAtHour - 1)}.`;
  }

  const ignore = input.rescheduleFromId;
  for (const date of occurrenceDates(input)) {
    const startsAt = slotStart(date, input.hour);
    if (!branch.openDays.includes(manilaWeekday(startsAt))) {
      return `${branch.name} is closed on ${format(parseISO(date), "EEEE")}s. Pick another day.`;
    }
    const iso = startsAt.toISOString();
    const clash = (a: AppointmentFixture) =>
      a.startsAt === iso && HOLDS_SLOT.has(a.status) && a.id !== ignore;
    if (state.appointments.some((a) => clash(a) && a.staffId === staff.id)) {
      return `${staff.surname} already has a session at ${hourLabel(input.hour)} on ${shortDate(date)}. Pick another time or therapist.`;
    }
    if (patient && state.appointments.some((a) => clash(a) && a.patientId === patient.id)) {
      return `${displayName(patient)} already has a session at ${hourLabel(input.hour)} on ${shortDate(date)}.`;
    }
  }
  return null;
}
