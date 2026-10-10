import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker or type yyyy-mm-dd.");
const optionalText = (max: number) => z.string().trim().max(max).default("");

/** One schema for the patient form, used by the browser and by the Server Action. */
export const patientFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter the first name.").max(80),
    lastName: z.string().trim().min(1, "Enter the last name.").max(80),
    dateOfBirth: isoDate.or(z.literal("")).default(""),
    gender: z.enum(["male", "female", "unspecified"]).default("unspecified"),
    diagnosis: optionalText(200),
    service: z.enum(["ot", "speech", "sped"]),
    enrolledOn: isoDate,
    primaryStaffId: z.string().default(""),
    backupStaffIds: z.array(z.string()).max(3).default([]),
    goalsNotes: optionalText(2000),
    guardianName: optionalText(120),
    guardianRelationship: optionalText(40),
    guardianPhone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+()\s-]*$/, "Use digits, spaces, + or -.")
      .default(""),
    guardianEmail: z.email("Enter a valid email address.").or(z.literal("")).default(""),
  })
  .refine((v) => !v.primaryStaffId || !v.backupStaffIds.includes(v.primaryStaffId), {
    message: "The primary therapist can't also be a backup.",
    path: ["backupStaffIds"],
  })
  .refine((v) => !v.dateOfBirth || v.dateOfBirth <= v.enrolledOn, {
    message: "Date of birth must be before enrollment.",
    path: ["dateOfBirth"],
  });

export type PatientFormInput = z.input<typeof patientFormSchema>;
export type PatientFormValues = z.output<typeof patientFormSchema>;

/** Filters on the patients list, read from the URL. Unknown values fall back to defaults. */
export const patientListParams = z.object({
  q: z.string().trim().max(80).catch(""),
  service: z.enum(["all", "ot", "speech", "sped"]).catch("all"),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  sort: z.enum(["name", "age", "attendance", "balance"]).catch("name"),
  page: z.coerce.number().int().min(0).max(10_000).catch(0),
  patient: z.string().max(64).optional().catch(undefined),
  tab: z.enum(["overview", "sessions", "credit"]).catch("overview"),
});
export type PatientListParams = z.output<typeof patientListParams>;
