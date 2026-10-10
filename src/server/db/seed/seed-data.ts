import "server-only";

import { initialDemoState } from "@/lib/demo/state";
import { USERS } from "@/lib/fixtures/users";
import { toManilaIsoDate, manilaHour, manilaWeekday } from "@/lib/dates";

/** Seed accounts, one per role. Passwords are set in Milestone 4. */
export const SEED_USERS = [
  { ...USERS.superadmin, email: "camelia@crbclinic.test", branchIds: ["br_bangkal", "br_panabo"] },
  { ...USERS.secretary, email: "jo@crbclinic.test", branchIds: ["br_bangkal"] },
  { ...USERS.therapist, email: "jolyn@crbclinic.test", branchIds: ["br_bangkal"] },
];

const USER_BY_NAME = Object.fromEntries(SEED_USERS.map((u) => [u.name, u.id]));

/**
 * Turns the Milestone 2 fixtures into database rows. The fixtures stay the
 * single source of demo data, so the seeded app matches the static one.
 */
export function buildSeedRows() {
  const state = initialDemoState();
  const rateClassById = Object.fromEntries(state.rateClasses.map((r) => [r.id, r]));
  const staffById = Object.fromEntries(state.staff.map((s) => [s.id, s]));
  const deskUserId = USERS.secretary.id;

  const series = new Map<
    string,
    {
      id: string;
      branchId: string;
      patientId: string;
      staffId: string;
      sessionTypeId: string;
      weekday: number;
      startHour: number;
      startsOn: string;
      endsOn: null;
      materializedUntil: string;
    }
  >();
  for (const a of state.appointments) {
    if (!a.seriesId) continue;
    const start = new Date(a.startsAt);
    const date = toManilaIsoDate(start);
    const existing = series.get(a.seriesId);
    if (existing) {
      existing.materializedUntil =
        date > existing.materializedUntil ? date : existing.materializedUntil;
      existing.startsOn = date < existing.startsOn ? date : existing.startsOn;
    } else {
      series.set(a.seriesId, {
        id: a.seriesId,
        branchId: a.branchId,
        patientId: a.patientId,
        staffId: a.staffId,
        sessionTypeId: a.sessionTypeId,
        weekday: manilaWeekday(start),
        startHour: manilaHour(start),
        startsOn: date,
        endsOn: null,
        materializedUntil: date,
      });
    }
  }

  return {
    branches: state.branches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      location: b.location,
      isMain: b.isMain,
      opensAtHour: b.opensAtHour,
      closesAtHour: b.closesAtHour,
      openDays: b.openDays,
      receiptPrefix: b.isMain ? "CRB" : "CRBP",
    })),
    users: SEED_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: true,
    })),
    userBranches: SEED_USERS.flatMap((u) =>
      u.branchIds.map((branchId) => ({ userId: u.id, branchId })),
    ),
    rateClasses: state.rateClasses.map((r, index) => ({ ...r, sortOrder: index })),
    staff: state.staff.map((s, index) => ({
      sortOrder: index,
      id: s.id,
      userId: s.userId,
      branchId: "br_bangkal",
      displayName: s.displayName,
      shortName: s.shortName,
      surname: s.surname,
      rateClassId: s.rateClassId,
      active: s.active,
    })),
    sessionTypes: state.sessionTypes.map((t, index) => ({
      id: t.id,
      name: t.name,
      service: t.service === "none" ? null : t.service,
      rateCentavos: t.rateCentavos,
      anyRateClass: t.allowedRateClassIds === null,
      active: t.active,
      sortOrder: index,
    })),
    sessionTypeRateClasses: state.sessionTypes.flatMap((t) =>
      (t.allowedRateClassIds ?? []).map((rateClassId) => ({ sessionTypeId: t.id, rateClassId })),
    ),
    patients: state.patients.map((p) => ({
      id: p.id,
      branchId: p.branchId,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth || null,
      gender: p.gender,
      diagnosis: p.diagnosis,
      enrolledOn: p.enrolledOn,
      service: p.service,
      primaryStaffId: p.primaryStaffId || null,
      status: p.status,
      recurringSlot: p.recurringSlot,
      goalsNotes: p.goalsNotes,
    })),
    patientBackupStaff: state.patients
      .filter((p) => p.backupStaffId)
      .map((p) => ({ patientId: p.id, staffId: p.backupStaffId! })),
    guardians: state.patients
      .filter((p) => p.guardian.name)
      .map((p) => ({
        id: `grd_${p.id.replace("pat_", "")}`,
        patientId: p.id,
        ...p.guardian,
        isPrimary: true,
      })),
    series: [...series.values()],
    appointments: state.appointments.map((a) => {
      const rateClass = rateClassById[staffById[a.staffId]!.rateClassId]!;
      const attended = a.status === "attended";
      return {
        id: a.id,
        branchId: a.branchId,
        patientId: a.patientId,
        staffId: a.staffId,
        sessionTypeId: a.sessionTypeId,
        seriesId: a.seriesId,
        startsAt: new Date(a.startsAt),
        endsAt: new Date(a.endsAt),
        status: a.status,
        rescheduledToId: a.rescheduledToId,
        isMakeUp: a.isMakeUp,
        feeCentavos: a.feeCentavos,
        payrollRateCentavos: attended ? rateClass.rateCentavos : null,
        payrollSharePct: attended ? rateClass.therapistSharePct : null,
        statusChangedByUserId: a.statusChangedBy ? (USER_BY_NAME[a.statusChangedBy] ?? null) : null,
        statusChangedAt: a.statusChangedAt ? new Date(a.statusChangedAt) : null,
      };
    }),
    sessionNotes: state.notes.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })),
    payments: state.payments.map((p) => ({
      ...p,
      branchId: "br_bangkal",
      createdAt: new Date(p.createdAt),
    })),
    creditLedger: state.creditLedger.map((c) => ({
      ...c,
      createdByUserId: deskUserId,
      createdAt: new Date(c.createdAt),
    })),
    receiptCounters: [
      { branchId: "br_bangkal", nextNumber: state.nextReceiptNo },
      { branchId: "br_panabo", nextNumber: 1 },
    ],
  };
}
