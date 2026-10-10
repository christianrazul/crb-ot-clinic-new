import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Date helpers. Timestamps are stored in UTC; everything users see is in the
 * clinic's timezone. Never format a Date with plain `date-fns` `format()` for
 * display, because that uses the timezone of whichever machine runs the code.
 */

export const CLINIC_TIME_ZONE = "Asia/Manila";

/** Display formats used across the app (they match the mockup copy). */
export const DATE_FORMATS = {
  /** Mon, Oct 12 */
  shortDay: "EEE, MMM d",
  /** Monday, October 12, 2026 */
  longDay: "EEEE, MMMM d, yyyy",
  /** Monday, Oct 12, 2026 */
  weekdayDate: "EEEE, MMM d, yyyy",
  /** Monday, Oct 12 */
  weekdayDay: "EEEE, MMM d",
  /** Monday, October 12 */
  weekdayDayLong: "EEEE, MMMM d",
  /** Oct 12, 2026 */
  date: "MMM d, yyyy",
  /** 9:00 AM */
  time: "h:mm a",
  /** 2026-10-12, for inputs and URL params */
  isoDate: "yyyy-MM-dd",
} as const;

export type DateFormat = keyof typeof DATE_FORMATS;

/** Formats a UTC instant as clinic-local wall-clock text. */
export function formatManila(
  instant: Date,
  pattern: DateFormat,
  timeZone: string = CLINIC_TIME_ZONE,
): string {
  return formatInTimeZone(instant, timeZone, DATE_FORMATS[pattern]);
}

/**
 * Converts a clinic-local wall-clock date and time ("2026-10-12", "09:00") to
 * the UTC instant to store.
 */
export function fromManilaLocal(
  isoDate: string,
  time: string,
  timeZone: string = CLINIC_TIME_ZONE,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new RangeError(`Expected yyyy-MM-dd and HH:mm, got "${isoDate}" "${time}"`);
  }
  return fromZonedTime(`${isoDate}T${time}:00`, timeZone);
}

/** The clinic-local calendar date of an instant, as yyyy-MM-dd. */
export function toManilaIsoDate(instant: Date, timeZone: string = CLINIC_TIME_ZONE): string {
  return formatManila(instant, "isoDate", timeZone);
}

/** UTC instant of midnight (start of day) in the clinic timezone. */
export function startOfManilaDay(instant: Date, timeZone: string = CLINIC_TIME_ZONE): Date {
  return fromManilaLocal(toManilaIsoDate(instant, timeZone), "00:00", timeZone);
}

/** Clinic-local weekday, 0 = Sunday ... 6 = Saturday. */
export function manilaWeekday(instant: Date, timeZone: string = CLINIC_TIME_ZONE): number {
  // ISO weekday "i" is 1 = Monday ... 7 = Sunday.
  return Number(formatInTimeZone(instant, timeZone, "i")) % 7;
}

/** Clinic-local hour of day, 0 to 23. */
export function manilaHour(instant: Date, timeZone: string = CLINIC_TIME_ZONE): number {
  return Number(formatInTimeZone(instant, timeZone, "H"));
}
