/** Staff who may run a session type, based on its allowed rate classes. */
export function eligibleStaff<S extends { rateClassId: string; active: boolean }>(
  staff: S[],
  allowedRateClassIds: string[] | null,
): S[] {
  return staff.filter(
    (member) =>
      member.active &&
      (allowedRateClassIds === null || allowedRateClassIds.includes(member.rateClassId)),
  );
}

/**
 * Start hours for one-hour sessions on the hour: opening 9 and closing 17
 * gives 9 to 16, so the last session ends at closing time.
 */
export function bookableHours(opensAtHour: number, closesAtHour: number): number[] {
  const hours: number[] = [];
  for (let hour = opensAtHour; hour + 1 <= closesAtHour; hour++) hours.push(hour);
  return hours;
}

/** "9:00 AM", "1:00 PM". */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${suffix}`;
}

/** "9", "1 PM": compact label for calendar gutters, as in the mockup ("9 AM"). */
export function hourGutterLabel(hour: number): string {
  return hourLabel(hour).replace(":00", "");
}

/** Session lengths a type can have, in minutes. */
export const SESSION_DURATIONS = [30, 60] as const;

/** "30 min", "1 hour". */
export function durationLabel(minutes: number): string {
  return minutes === 60 ? "1 hour" : `${minutes} min`;
}

/** A start time as minutes since midnight: 9:30 is 570. */
export const toMinutes = (hour: number, minute = 0) => hour * 60 + minute;

/** "9:30 AM" from minutes since midnight. */
export function minutesLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

/**
 * Start times (minutes since midnight) on the hour and half hour for a session
 * of the given length, so the last one ends at closing time.
 */
export function bookableStarts(
  opensAtHour: number,
  closesAtHour: number,
  durationMinutes: number,
): number[] {
  const starts: number[] = [];
  for (let m = opensAtHour * 60; m + durationMinutes <= closesAtHour * 60; m += 30) starts.push(m);
  return starts;
}
