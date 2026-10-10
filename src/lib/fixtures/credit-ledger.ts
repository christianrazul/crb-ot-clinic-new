import { fromManilaLocal } from "@/lib/dates";

import type { PaymentMethod } from "@/lib/payment-methods";

export type CreditEntryType = "top_up" | "deduction" | "adjustment";

export type CreditEntryFixture = {
  id: string;
  patientId: string;
  type: CreditEntryType;
  /** Positive for top-ups, negative for deductions. */
  amountCentavos: number;
  description: string;
  method: PaymentMethod | null;
  referenceNo: string | null;
  receiptNo: string;
  notes: string | null;
  createdAt: string;
};

const at = (date: string) => fromManilaLocal(date, "09:00").toISOString();

let seq = 0;
const entry = (
  patientId: string,
  date: string,
  type: CreditEntryType,
  amountPesos: number,
  description: string,
  receiptNo: string,
  extra: Partial<Pick<CreditEntryFixture, "method" | "referenceNo" | "notes">> = {},
): CreditEntryFixture => ({
  id: `crd_${String(++seq).padStart(4, "0")}`,
  patientId,
  type,
  amountCentavos: amountPesos * 100,
  description,
  method: extra.method ?? null,
  referenceNo: extra.referenceNo ?? null,
  receiptNo,
  notes: extra.notes ?? null,
  createdAt: at(date),
});

/** The three advance-credit ledgers from the mockup. Balances are always the sum of rows. */
export const CREDIT_LEDGER: CreditEntryFixture[] = [
  entry("pat_01", "2026-08-01", "top_up", 7000, "10-session OT package", "CRB-0981", {
    method: "gcash",
    referenceNo: "0029 8841 552",
    notes: "Paid via GCash by mother (Maricel). Requested receipt by email.",
  }),
  entry("pat_01", "2026-08-05", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-0994"),
  entry("pat_01", "2026-08-08", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-1003"),
  entry("pat_01", "2026-08-12", "deduction", -700, "OT session, M. Tan, OTRP", "CRB-1019"),
  entry("pat_01", "2026-08-15", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-1031"),

  entry("pat_03", "2026-07-04", "top_up", 7000, "10-session OT package", "CRB-0842", {
    method: "cash",
    notes: "Cash, received by Jo Lauron.",
  }),
  entry("pat_03", "2026-07-08", "deduction", -700, "OT session, K. Ramos, OT Aide", "CRB-0855"),
  entry("pat_03", "2026-07-15", "deduction", -700, "OT session, K. Ramos, OT Aide", "CRB-0871"),
  entry("pat_03", "2026-08-01", "deduction", -700, "OT session, K. Ramos, OT Aide", "CRB-0980"),

  entry("pat_05", "2026-06-20", "top_up", 5000, "Advance payment", "CRB-0714", {
    method: "bank_transfer",
    referenceNo: "8812 4410 097",
    notes: "Bank transfer, BPI. Guardian asked to be reminded when balance falls under ₱1,000.",
  }),
  entry(
    "pat_05",
    "2026-06-27",
    "deduction",
    -1500,
    "OT evaluation, J. Dela Rosa, OTRP",
    "CRB-0729",
  ),
  entry("pat_05", "2026-07-04", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-0843"),
  entry("pat_05", "2026-07-18", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-0874"),
  entry("pat_05", "2026-08-01", "deduction", -700, "OT session, J. Dela Rosa, OTRP", "CRB-0979"),
  entry("pat_05", "2026-08-08", "deduction", -700, "OT session, M. Tan, OTRP", "CRB-1004"),
];

/** Balance below which the desk is reminded to ask for a top-up. */
export const LOW_CREDIT_THRESHOLD_CENTAVOS = 100_000;
