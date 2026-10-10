import { describe, expect, it } from "vitest";

import { APPOINTMENTS } from "@/lib/fixtures/appointments";
import { DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { PATIENTS } from "@/lib/fixtures/patients";
import { PAYMENTS } from "@/lib/fixtures/payments";
import { SESSION_NOTES } from "@/lib/fixtures/session-notes";
import { STAFF } from "@/lib/fixtures/staff";
import { manilaWeekday, toManilaIsoDate } from "@/lib/dates";

// The fixtures stand in for the database until Milestone 3, so they must obey
// the same rules the database will enforce.
describe("fixtures", () => {
  const overlaps = (key: (a: (typeof APPOINTMENTS)[number]) => string) => {
    const seen = new Set<string>();
    return APPOINTMENTS.filter((a) => {
      const k = `${key(a)}|${a.startsAt}`;
      const dup = seen.has(k);
      seen.add(k);
      return dup;
    });
  };

  it("no staff member is double-booked", () => {
    expect(overlaps((a) => a.staffId)).toEqual([]);
  });

  it("no patient is double-booked", () => {
    expect(overlaps((a) => a.patientId)).toEqual([]);
  });

  it("every reference points at a real record", () => {
    const patientIds = new Set(PATIENTS.map((p) => p.id));
    const staffIds = new Set(STAFF.map((s) => s.id));
    const appointmentIds = new Set(APPOINTMENTS.map((a) => a.id));
    for (const a of APPOINTMENTS) {
      expect(patientIds.has(a.patientId)).toBe(true);
      expect(staffIds.has(a.staffId)).toBe(true);
    }
    for (const p of PAYMENTS) expect(appointmentIds.has(p.appointmentId)).toBe(true);
    for (const n of SESSION_NOTES) expect(appointmentIds.has(n.appointmentId)).toBe(true);
  });

  it("there are 14 sessions on the demo day, none on Sundays", () => {
    expect(
      APPOINTMENTS.filter((a) => toManilaIsoDate(new Date(a.startsAt)) === DEMO_TODAY),
    ).toHaveLength(14);
    expect(APPOINTMENTS.filter((a) => manilaWeekday(new Date(a.startsAt)) === 0)).toEqual([]);
  });
});
