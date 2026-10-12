import { z } from "zod";

const pesos = z.number().int("Use whole pesos.").min(0, "Can't be negative.").max(1_000_000);

/** Shared by the settings forms and their Server Actions. */
export const rateClassesInput = z
  .array(
    z.object({
      id: z.string().min(1),
      /** The share of each session's fee the therapist earns. */
      therapistSharePct: z.number().int().min(0, "0 to 100.").max(100, "0 to 100."),
    }),
  )
  .min(1);

export const sessionTypeInput = z.object({
  name: z.string().trim().min(2, "Enter a name for the session type.").max(60),
  ratePesos: pesos,
});

export const staffInput = z.object({
  displayName: z.string().trim().min(2, "Enter the full name.").max(80),
  rateClassId: z.string().min(1, "Pick a role."),
  /** Optional: create a login and email a link to set the password. */
  loginEmail: z.email("Enter a valid email address.").or(z.literal("")).default(""),
});

export const staffEditInput = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().trim().min(2, "Enter the full name.").max(80),
  rateClassId: z.string().min(1, "Pick a role."),
});

export const branchInput = z.object({
  name: z.string().trim().min(2, "Enter the branch name.").max(60),
  location: z.string().trim().max(80).default(""),
});

export const hoursInput = z
  .object({
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day."),
    opensAtHour: z.number().int().min(0).max(23),
    closesAtHour: z.number().int().min(1).max(24),
  })
  .refine((v) => v.closesAtHour > v.opensAtHour, {
    message: "Closing time must be after opening time.",
    path: ["closesAtHour"],
  });
