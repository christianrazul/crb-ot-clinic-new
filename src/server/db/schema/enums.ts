import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["superadmin", "secretary", "therapist"]);

/** Clinical service. "aide" is the OT Aide rate class colour; patients never have it. */
export const serviceEnum = pgEnum("service", ["ot", "speech", "sped", "aide"]);
export const patientServiceEnum = pgEnum("patient_service", ["ot", "speech", "sped"]);

export const patientStatusEnum = pgEnum("patient_status", ["active", "inactive"]);
export const genderEnum = pgEnum("gender", ["male", "female", "unspecified"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "checked_in",
  "attended",
  "no_show",
  "cancelled",
  "rescheduled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "gcash",
  "maya",
  "bank_transfer",
  "card",
]);
export const creditEntryTypeEnum = pgEnum("credit_entry_type", [
  "top_up",
  "deduction",
  "adjustment",
]);
