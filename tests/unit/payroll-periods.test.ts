import { describe, expect, it } from "vitest";

import { payrollRange, shiftPeriod } from "@/lib/payroll-periods";

describe("payroll periods", () => {
  it("finds the day, Monday-start week and month around a date", () => {
    expect(payrollRange("daily", "2026-08-22")).toEqual({ from: "2026-08-22", to: "2026-08-23" });
    expect(payrollRange("weekly", "2026-08-23")).toEqual({ from: "2026-08-17", to: "2026-08-24" });
    expect(payrollRange("monthly", "2026-12-15")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });

  it("steps to the previous and next period", () => {
    expect(shiftPeriod("daily", "2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftPeriod("weekly", "2026-08-22", 1)).toBe("2026-08-24");
    expect(shiftPeriod("monthly", "2026-01-31", -1)).toBe("2025-12-01");
  });
});
