import { ageOn } from "@/lib/age";
import { creditBalance } from "@/lib/credit";
import { toManilaIsoDate } from "@/lib/dates";
import type { AppointmentFixture } from "@/lib/fixtures/appointments";
import { DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { patientName } from "@/lib/fixtures/patients";
import type { Role } from "@/lib/roles";
import type { ServiceKey } from "@/lib/services";

import type { DemoPatient, DemoState } from "./state";

export const byId = <T extends { id: string }>(rows: T[], id: string | null | undefined) =>
  id ? rows.find((row) => row.id === id) : undefined;

export function patientAge(patient: DemoPatient): number {
  return ageOn(patient.dateOfBirth, DEMO_TODAY);
}

export function creditBalanceOf(state: DemoState, patientId: string): number {
  return creditBalance(state.creditLedger.filter((entry) => entry.patientId === patientId));
}

export function paymentFor(state: DemoState, appointmentId: string) {
  return state.payments.find((payment) => payment.appointmentId === appointmentId);
}

export function appointmentsOn(state: DemoState, isoDate: string, branchId: string) {
  return state.appointments
    .filter((a) => a.branchId === branchId && toManilaIsoDate(new Date(a.startsAt)) === isoDate)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Patients a role may see. Therapists only get their own (primary or backup). */
export function visiblePatients(
  state: DemoState,
  role: Role,
  staffId: string | null,
  branchId: string,
): DemoPatient[] {
  return state.patients.filter(
    (p) =>
      p.deletedAt === null &&
      p.branchId === branchId &&
      (role !== "therapist" || p.primaryStaffId === staffId || p.backupStaffId === staffId),
  );
}

/** The service color for an appointment: the staff member's rate class (OT Aide is pink). */
export function appointmentService(state: DemoState, appointment: AppointmentFixture): ServiceKey {
  const type = byId(state.sessionTypes, appointment.sessionTypeId);
  if (!type?.service) return "none";
  const staff = byId(state.staff, appointment.staffId);
  const rateClass = byId(state.rateClasses, staff?.rateClassId);
  return rateClass?.service === "aide" ? "aide" : type.service;
}

export function displayName(patient: DemoPatient): string {
  return patientName(patient);
}

/** Every appointment in the same series on or after the given one. */
export function seriesFrom(state: DemoState, appointment: AppointmentFixture) {
  if (!appointment.seriesId) return [appointment];
  return state.appointments.filter(
    (a) => a.seriesId === appointment.seriesId && a.startsAt >= appointment.startsAt,
  );
}
