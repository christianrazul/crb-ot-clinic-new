import { describe, expect, it } from "vitest";

import {
  formatManila,
  fromManilaLocal,
  manilaHour,
  manilaWeekday,
  startOfManilaDay,
  toManilaIsoDate,
} from "@/lib/dates";

// Manila is UTC+8 with no daylight saving time.
// 2026-10-12T01:00:00Z is Monday, October 12, 2026 at 9:00 AM in Manila.
const mondayNineAm = new Date("2026-10-12T01:00:00Z");
// 2026-10-11T17:30:00Z is already Monday 1:30 AM in Manila, but still Sunday in UTC.
const justAfterManilaMidnight = new Date("2026-10-11T17:30:00Z");

describe("formatManila", () => {
  it("formats in Manila time regardless of the machine timezone", () => {
    expect(formatManila(mondayNineAm, "shortDay")).toBe("Mon, Oct 12");
    expect(formatManila(mondayNineAm, "longDay")).toBe("Monday, October 12, 2026");
    expect(formatManila(mondayNineAm, "date")).toBe("Oct 12, 2026");
    expect(formatManila(mondayNineAm, "time")).toBe("9:00 AM");
    expect(formatManila(mondayNineAm, "isoDate")).toBe("2026-10-12");
  });

  it("formats afternoon times", () => {
    expect(formatManila(new Date("2026-10-12T08:00:00Z"), "time")).toBe("4:00 PM");
  });
});

describe("fromManilaLocal", () => {
  it("converts Manila wall-clock time to a UTC instant", () => {
    expect(fromManilaLocal("2026-10-12", "09:00").toISOString()).toBe("2026-10-12T01:00:00.000Z");
    expect(fromManilaLocal("2026-10-12", "00:00").toISOString()).toBe("2026-10-11T16:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => fromManilaLocal("12/10/2026", "09:00")).toThrow(RangeError);
    expect(() => fromManilaLocal("2026-10-12", "9am")).toThrow(RangeError);
  });

  it("round-trips with formatManila", () => {
    const instant = fromManilaLocal("2026-12-31", "17:00");
    expect(formatManila(instant, "isoDate")).toBe("2026-12-31");
    expect(formatManila(instant, "time")).toBe("5:00 PM");
  });
});

describe("day helpers", () => {
  it("uses the Manila calendar date, not the UTC one", () => {
    expect(toManilaIsoDate(justAfterManilaMidnight)).toBe("2026-10-12");
    expect(manilaWeekday(justAfterManilaMidnight)).toBe(1);
  });

  it("returns the UTC instant of Manila midnight", () => {
    expect(startOfManilaDay(mondayNineAm).toISOString()).toBe("2026-10-11T16:00:00.000Z");
    expect(startOfManilaDay(justAfterManilaMidnight).toISOString()).toBe(
      "2026-10-11T16:00:00.000Z",
    );
  });

  it("returns Sunday as 0", () => {
    expect(manilaWeekday(new Date("2026-10-11T01:00:00Z"))).toBe(0);
  });

  it("returns the Manila hour", () => {
    expect(manilaHour(mondayNineAm)).toBe(9);
    expect(manilaHour(justAfterManilaMidnight)).toBe(1);
  });
});
