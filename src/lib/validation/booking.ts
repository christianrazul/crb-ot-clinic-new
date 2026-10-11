import { z } from "zod";

export const bookingInput = z
  .object({
    /** An existing patient, or null with newPatientName to add one at the desk. */
    patientId: z.string().min(1).nullable(),
    newPatientName: z.string().trim().max(120).optional(),
    staffId: z.string().min(1, "Choose a therapist."),
    sessionTypeId: z.string().min(1, "Choose a session type."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    hour: z.number().int().min(0).max(23),
    recurring: z.boolean().default(false),
    /** Rescheduling: the original becomes "rescheduled" and links to the new make-up session. */
    rescheduleFromId: z.string().min(1).optional(),
  })
  .refine((v) => v.patientId || v.newPatientName, {
    message: "Choose a patient.",
    path: ["patientId"],
  });

export type BookingInput = z.input<typeof bookingInput>;
