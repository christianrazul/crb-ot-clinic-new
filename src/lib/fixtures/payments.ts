import { fromManilaLocal } from "@/lib/dates";
import type { PaymentMethod } from "@/lib/payment-methods";

export type PaymentFixture = {
  id: string;
  appointmentId: string;
  patientId: string;
  amountCentavos: number;
  creditAppliedCentavos: number;
  /** Null when credit covered the whole fee. */
  method: PaymentMethod | null;
  referenceNo: string | null;
  cashReceivedCentavos: number | null;
  receiptNo: string;
  receivedByUserId: string;
  createdAt: string;
};

/** Payments already taken at the desk this morning. */
export const PAYMENTS: PaymentFixture[] = [
  {
    id: "pay_0001",
    appointmentId: "apt_20260822_09_delarosa",
    patientId: "pat_01",
    amountCentavos: 70_000,
    creditAppliedCentavos: 0,
    method: "cash",
    referenceNo: null,
    cashReceivedCentavos: 100_000,
    receiptNo: "CRB-1097",
    receivedByUserId: "usr_desk",
    createdAt: fromManilaLocal("2026-08-22", "09:58").toISOString(),
  },
  {
    id: "pay_0002",
    appointmentId: "apt_20260822_09_garcia",
    patientId: "pat_04",
    amountCentavos: 50_000,
    creditAppliedCentavos: 0,
    method: "cash",
    referenceNo: null,
    cashReceivedCentavos: 50_000,
    receiptNo: "CRB-1098",
    receivedByUserId: "usr_desk",
    createdAt: fromManilaLocal("2026-08-22", "10:02").toISOString(),
  },
  {
    id: "pay_0003",
    appointmentId: "apt_20260822_10_lim",
    patientId: "pat_02",
    amountCentavos: 100_000,
    creditAppliedCentavos: 0,
    method: "gcash",
    referenceNo: "0031 2207 448",
    cashReceivedCentavos: null,
    receiptNo: "CRB-1099",
    receivedByUserId: "usr_desk",
    createdAt: fromManilaLocal("2026-08-22", "09:55").toISOString(),
  },
];

/** Next receipt number per branch (gapless, Milestone 9 makes this a database counter). */
export const NEXT_RECEIPT_NO = 1100;
