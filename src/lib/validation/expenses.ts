import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Supplies",
  "Salaries",
  "Maintenance",
  "Other",
] as const;

export const expenseInput = z.object({
  category: z.enum(EXPENSE_CATEGORIES, "Choose a category."),
  amountCentavos: z.number().int().min(100, "Enter the amount spent.").max(100_000_000),
  spentOn: z.iso.date("Choose the date it was spent."),
  description: z.string().trim().max(200).default(""),
});
export type ExpenseInput = z.input<typeof expenseInput>;
