import { addDays, format, parseISO } from "date-fns";

import type { AppointmentStatus } from "@/lib/appointment-status";
import { fromManilaLocal } from "@/lib/dates";

import { DEMO_NOW, DEMO_TODAY } from "./demo-clock";
import { PATIENTS } from "./patients";
import { SESSION_TYPES } from "./session-types";

export type AppointmentFixture = {
  id: string;
  branchId: string;
  patientId: string;
  staffId: string;
  sessionTypeId: string;
  seriesId: string | null;
  /** ISO timestamps in UTC. */
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  /** Snapshot of the session type rate when booked. */
  feeCentavos: number;
  isMakeUp: boolean;
  rescheduledToId: string | null;
  /** Name of who last changed the status, and when (ISO). Null while untouched. */
  statusChangedBy: string | null;
  statusChangedAt: string | null;
};

type Slot = { hour: number; patient: string; staff: string; type: string };

const P = Object.fromEntries(PATIENTS.map((p) => [`${p.firstName} ${p.lastName}`, p.id]));

// Saturday template, the mockup's day grid for "today".
const SATURDAY: Slot[] = [
  { hour: 9, patient: "Liam Santos", staff: "stf_delarosa", type: "st_ot" },
  { hour: 11, patient: "Franco Lee", staff: "stf_delarosa", type: "st_ot" },
  { hour: 13, patient: "Althea Mendoza", staff: "stf_delarosa", type: "st_ot" },
  { hour: 10, patient: "Gab Torres", staff: "stf_tan", type: "st_ot" },
  { hour: 12, patient: "Caleb Uy", staff: "stf_tan", type: "st_ot" },
  { hour: 14, patient: "Iggy Navarro", staff: "stf_tan", type: "st_ot" },
  { hour: 9, patient: "Enzo Dela Peña", staff: "stf_ramos", type: "st_ot" },
  { hour: 11, patient: "Elle Bautista", staff: "stf_ramos", type: "st_ot" },
  { hour: 14, patient: "Kian Velasco", staff: "stf_ramos", type: "st_ot" },
  { hour: 10, patient: "Amara Cruz", staff: "stf_lim", type: "st_speech" },
  { hour: 12, patient: "Nina Pascual", staff: "stf_lim", type: "st_speech" },
  { hour: 15, patient: "Bea Aquino", staff: "stf_lim", type: "st_speech" },
  { hour: 9, patient: "Sofia Reyes", staff: "stf_garcia", type: "st_sped" },
  { hour: 13, patient: "Diego Ramos", staff: "stf_garcia", type: "st_sped" },
];

// Monday to Friday template, the mockup's week grid. Index 0 is Monday.
const WEEKDAYS: Slot[][] = [
  [
    { hour: 9, patient: "Liam Santos", staff: "stf_delarosa", type: "st_ot" },
    { hour: 9, patient: "Amara Cruz", staff: "stf_lim", type: "st_speech" },
    { hour: 10, patient: "Enzo Dela Peña", staff: "stf_ramos", type: "st_ot" },
    { hour: 10, patient: "Sofia Reyes", staff: "stf_garcia", type: "st_sped" },
    { hour: 12, patient: "Nina Pascual", staff: "stf_lim", type: "st_speech" },
    { hour: 14, patient: "Gab Torres", staff: "stf_tan", type: "st_ot" },
  ],
  [
    { hour: 9, patient: "Althea Mendoza", staff: "stf_delarosa", type: "st_ot" },
    { hour: 11, patient: "Gab Torres", staff: "stf_tan", type: "st_ot" },
    { hour: 11, patient: "Nina Pascual", staff: "stf_lim", type: "st_speech" },
    { hour: 13, patient: "Kian Velasco", staff: "stf_ramos", type: "st_ot" },
    { hour: 15, patient: "Diego Ramos", staff: "stf_garcia", type: "st_sped" },
  ],
  [
    { hour: 10, patient: "Liam Santos", staff: "stf_delarosa", type: "st_ot" },
    { hour: 10, patient: "Sofia Reyes", staff: "stf_garcia", type: "st_sped" },
    { hour: 11, patient: "Kian Velasco", staff: "stf_ramos", type: "st_ot" },
    { hour: 14, patient: "Amara Cruz", staff: "stf_lim", type: "st_speech" },
    { hour: 14, patient: "Gab Torres", staff: "stf_tan", type: "st_ot" },
  ],
  [
    { hour: 9, patient: "Enzo Dela Peña", staff: "stf_ramos", type: "st_ot" },
    { hour: 12, patient: "Althea Mendoza", staff: "stf_delarosa", type: "st_ot" },
    { hour: 12, patient: "Nina Pascual", staff: "stf_lim", type: "st_speech" },
    { hour: 13, patient: "Sofia Reyes", staff: "stf_garcia", type: "st_sped" },
    { hour: 15, patient: "Hana Sy", staff: "stf_lim", type: "st_speech" },
  ],
  [
    { hour: 10, patient: "Gab Torres", staff: "stf_tan", type: "st_ot" },
    { hour: 11, patient: "Diego Ramos", staff: "stf_garcia", type: "st_sped" },
    { hour: 11, patient: "Franco Lee", staff: "stf_delarosa", type: "st_ot" },
    { hour: 14, patient: "Kian Velasco", staff: "stf_ramos", type: "st_ot" },
  ],
];

/** Weeks generated around the demo date, as Monday dates. */
const WEEK_MONDAYS = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];

/** Past sessions these patients missed, matching the dashboard's frequent no-shows. */
const NO_SHOWS = new Set([
  "2026-08-03|Enzo Dela Peña",
  "2026-08-13|Enzo Dela Peña",
  "2026-08-17|Enzo Dela Peña",
  "2026-08-11|Althea Mendoza",
  "2026-08-15|Althea Mendoza",
]);

function statusFor(date: string, slot: Slot, startsAt: Date): AppointmentStatus {
  if (NO_SHOWS.has(`${date}|${slot.patient}`)) return "no_show";
  if (date !== DEMO_TODAY) return startsAt < DEMO_NOW ? "attended" : "scheduled";
  // Today at 10:20: the 9:00 sessions are done, the 10:00 ones are in progress.
  if (slot.hour === 9) return "attended";
  if (slot.hour === 10) return "checked_in";
  return "scheduled";
}

function buildAppointments(): AppointmentFixture[] {
  const rate = Object.fromEntries(SESSION_TYPES.map((t) => [t.id, t.rateCentavos]));
  const rows: AppointmentFixture[] = [];

  for (const monday of WEEK_MONDAYS) {
    const days = [...WEEKDAYS, SATURDAY];
    days.forEach((slots, dayIndex) => {
      const date = format(addDays(parseISO(monday), dayIndex), "yyyy-MM-dd");
      for (const slot of slots) {
        const patientId = P[slot.patient];
        if (!patientId) throw new Error(`Unknown fixture patient ${slot.patient}`);
        const hh = String(slot.hour).padStart(2, "0");
        const startsAt = fromManilaLocal(date, `${hh}:00`);
        rows.push({
          id: `apt_${date.replaceAll("-", "")}_${hh}_${slot.staff.replace("stf_", "")}`,
          branchId: "br_bangkal",
          patientId,
          staffId: slot.staff,
          sessionTypeId: slot.type,
          // A series is one weekday at one time ("every Saturday at 9:00").
          seriesId: `ser_${patientId}_${slot.staff.replace("stf_", "")}_${(dayIndex + 1) % 7}_${hh}`,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
          status: statusFor(date, slot, startsAt),
          feeCentavos: rate[slot.type] ?? 0,
          isMakeUp: false,
          rescheduledToId: null,
          statusChangedBy: date === DEMO_TODAY && slot.hour <= 10 ? "Jo Lauron" : null,
          statusChangedAt:
            date === DEMO_TODAY && slot.hour <= 10
              ? fromManilaLocal(date, `${hh}:00`).toISOString()
              : null,
        });
      }
    });
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const APPOINTMENTS: AppointmentFixture[] = buildAppointments();
