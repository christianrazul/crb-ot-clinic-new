import { APPOINTMENTS, type AppointmentFixture } from "@/lib/fixtures/appointments";
import { BRANCHES, type BranchFixture } from "@/lib/fixtures/branches";
import { CREDIT_LEDGER, type CreditEntryFixture } from "@/lib/fixtures/credit-ledger";
import { PATIENTS, type PatientFixture } from "@/lib/fixtures/patients";
import { NEXT_RECEIPT_NO, PAYMENTS, type PaymentFixture } from "@/lib/fixtures/payments";
import { RATE_CLASSES, type RateClassFixture } from "@/lib/fixtures/rate-classes";
import { SESSION_NOTES, type SessionNoteFixture } from "@/lib/fixtures/session-notes";
import { SESSION_TYPES, type SessionTypeFixture } from "@/lib/fixtures/session-types";
import { STAFF, type StaffFixture } from "@/lib/fixtures/staff";

export type DemoBranch = BranchFixture & {
  opensAtHour: number;
  closesAtHour: number;
  /** 0 = Sunday ... 6 = Saturday */
  openDays: number[];
};

export type DemoPatient = PatientFixture & { branchId: string; deletedAt: string | null };

/**
 * Everything the static front end can change. Lives in memory and resets on
 * reload. Each slice mirrors a future database table so screens can switch to
 * server data one milestone at a time.
 */
export type DemoState = {
  branches: DemoBranch[];
  patients: DemoPatient[];
  staff: StaffFixture[];
  rateClasses: RateClassFixture[];
  sessionTypes: SessionTypeFixture[];
  appointments: AppointmentFixture[];
  payments: PaymentFixture[];
  creditLedger: CreditEntryFixture[];
  notes: SessionNoteFixture[];
  nextReceiptNo: number;
  /** Counter for ids created in the demo. */
  seq: number;
};

export function initialDemoState(): DemoState {
  return {
    branches: BRANCHES.map((b) => ({
      ...b,
      opensAtHour: 9,
      closesAtHour: 17,
      openDays: [1, 2, 3, 4, 5, 6],
    })),
    patients: PATIENTS.map((p) => ({ ...p, branchId: "br_bangkal", deletedAt: null })),
    staff: STAFF.map((s) => ({ ...s })),
    rateClasses: RATE_CLASSES.map((r) => ({ ...r })),
    sessionTypes: SESSION_TYPES.map((t) => ({ ...t })),
    appointments: APPOINTMENTS.map((a) => ({ ...a })),
    payments: PAYMENTS.map((p) => ({ ...p })),
    creditLedger: CREDIT_LEDGER.map((c) => ({ ...c })),
    notes: SESSION_NOTES.map((n) => ({ ...n })),
    nextReceiptNo: NEXT_RECEIPT_NO,
    seq: 1,
  };
}
