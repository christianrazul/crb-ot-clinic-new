import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/payment-methods";

const centavos = z.number().int().min(0).max(100_000_000);
/** The day the money was received (yyyy-MM-dd). Blank means now; past days backlog a payment. */
const receivedOn = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the payment was received.")
  .optional();

export const collectPaymentInput = z.object({
  appointmentId: z.string().min(1),
  useCredit: z.boolean(),
  /** Credit the desk typed in; null means as much as possible. */
  creditRequestedCentavos: centavos.nullable(),
  method: z.enum(PAYMENT_METHODS),
  cashReceivedCentavos: centavos.nullable(),
  referenceNo: z.string().trim().max(60).default(""),
  receivedOn,
});

export const topUpInput = z
  .object({
    patientId: z.string().min(1, "Select a patient."),
    amountCentavos: z.number().int().min(100, "Enter the amount received.").max(100_000_000),
    method: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(60).default(""),
    /** Blank takes the next receipt number automatically. */
    receiptNo: z.string().trim().max(30).default(""),
    notes: z.string().trim().max(500).default(""),
    receivedOn,
  })
  .refine((v) => v.method === "cash" || v.referenceNo.length > 0, {
    message: "Enter the reference number for GCash, Maya, bank and card payments.",
    path: ["referenceNo"],
  });

export const lowCreditThresholdInput = z.number().int().min(0).max(10_000_000);
