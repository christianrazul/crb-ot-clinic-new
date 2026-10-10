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
