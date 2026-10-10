import { describe, expect, it } from "vitest";

import { ageOn } from "@/lib/age";
import { bookableHours, eligibleStaff, hourGutterLabel, hourLabel } from "@/lib/booking";
import { creditBalance, withRunningBalance } from "@/lib/credit";
import { payrollLine, sumPayroll } from "@/lib/payroll";

describe("payrollLine", () => {
  it("splits gross between therapist and clinic", () => {
    expect(payrollLine(112, 70_000, 70)).toEqual({
      sessions: 112,
      rateCentavos: 70_000,
      grossCentavos: 7_840_000,
      therapistShareCentavos: 5_488_000,
      clinicShareCentavos: 2_352_000,
    });
  });

  it("the two shares always add up to the gross", () => {
    const line = payrollLine(3, 33_333, 33);
    expect(line.therapistShareCentavos + line.clinicShareCentavos).toBe(line.grossCentavos);
  });

  it("sums lines", () => {
    expect(sumPayroll([payrollLine(1, 70_000, 70), payrollLine(2, 50_000, 80)])).toEqual({
      sessions: 3,
      grossCentavos: 170_000,
      therapistShareCentavos: 129_000,
      clinicShareCentavos: 41_000,
    });
  });
});

describe("credit", () => {
  const entries = [
    { amountCentavos: -70_000, createdAt: "2026-08-05T01:00:00Z" },
    { amountCentavos: 700_000, createdAt: "2026-08-01T01:00:00Z" },
  ];

  it("balance is the sum of the ledger", () => {
    expect(creditBalance(entries)).toBe(630_000);
    expect(creditBalance([])).toBe(0);
  });

  it("running balance follows date order", () => {
    expect(withRunningBalance(entries).map((e) => e.balanceAfterCentavos)).toEqual([
      700_000, 630_000,
    ]);
  });
});

describe("booking", () => {
  const staff = [
    { id: "a", rateClassId: "rc_ot", active: true },
    { id: "b", rateClassId: "rc_ot_aide", active: true },
    { id: "c", rateClassId: "rc_speech", active: true },
    { id: "d", rateClassId: "rc_ot", active: false },
  ];

  it("filters staff by the session type's allowed rate classes", () => {
    expect(eligibleStaff(staff, ["rc_ot", "rc_ot_aide"]).map((s) => s.id)).toEqual(["a", "b"]);
    expect(eligibleStaff(staff, ["rc_ot"]).map((s) => s.id)).toEqual(["a"]);
  });

  it("null means anyone active (make up sessions)", () => {
    expect(eligibleStaff(staff, null).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("sessions start on the hour and end by closing time", () => {
    expect(bookableHours(9, 17)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("labels hours", () => {
    expect(hourLabel(9)).toBe("9:00 AM");
    expect(hourLabel(12)).toBe("12:00 PM");
    expect(hourLabel(16)).toBe("4:00 PM");
    expect(hourGutterLabel(13)).toBe("1 PM");
  });
});

describe("ageOn", () => {
  it("counts whole years", () => {
    expect(ageOn("2023-02-14", "2026-08-22")).toBe(3);
    expect(ageOn("2020-08-22", "2026-08-22")).toBe(6);
    expect(ageOn("2020-08-23", "2026-08-22")).toBe(5);
  });
});
