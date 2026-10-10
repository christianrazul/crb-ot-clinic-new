import { differenceInYears, parseISO } from "date-fns";

/** Whole years between a yyyy-MM-dd birth date and a yyyy-MM-dd reference date. */
export function ageOn(dateOfBirth: string, onDate: string): number {
  return differenceInYears(parseISO(onDate), parseISO(dateOfBirth));
}
