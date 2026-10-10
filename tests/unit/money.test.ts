import { describe, expect, it } from "vitest";

import { formatPeso, pesos, pesosToCentavos } from "@/lib/money";

describe("formatPeso", () => {
  it("formats whole amounts without decimals", () => {
    expect(formatPeso(70_000)).toBe("₱700");
    expect(formatPeso(700_000)).toBe("₱7,000");
    expect(formatPeso(123_456_700)).toBe("₱1,234,567");
  });

  it("formats zero", () => {
    expect(formatPeso(0)).toBe("₱0");
  });

  it("shows centavos when the amount is not whole", () => {
    expect(formatPeso(700_050)).toBe("₱7,000.50");
    expect(formatPeso(1)).toBe("₱0.01");
  });

  it("uses a minus sign for negative amounts", () => {
    expect(formatPeso(-50_000)).toBe("−₱500");
  });

  it("rejects non-integer centavos", () => {
    expect(() => formatPeso(10.5)).toThrow(RangeError);
    expect(() => formatPeso(Number.NaN)).toThrow(RangeError);
  });
});

describe("pesosToCentavos", () => {
  it.each([
    ["700", 70_000],
    ["1,500", 150_000],
    ["₱7,000", 700_000],
    [" 250.5 ", 25_050],
    ["0.01", 1],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(pesosToCentavos(input)).toBe(expected);
  });

  it("avoids floating point errors", () => {
    // 0.1 + 0.2 style bugs: 19.99 * 100 is 1998.9999999999998 in floats.
    expect(pesosToCentavos("19.99")).toBe(1_999);
  });

  it.each(["", "abc", "-500", "1.234", "1e3", "12.", ".5", "1,2,3.4.5"])("rejects %j", (input) => {
    expect(pesosToCentavos(input)).toBeNull();
  });
});

describe("pesos", () => {
  it("converts pesos to centavos", () => {
    expect(pesos(700)).toBe(70_000);
    expect(pesos(19.99)).toBe(1_999);
  });
});
