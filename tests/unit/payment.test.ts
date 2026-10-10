import { describe, expect, it } from "vitest";

import { type PaymentInput, quotePayment } from "@/lib/payment";

const base: PaymentInput = {
  dueCentavos: 70_000,
  creditBalanceCentavos: 0,
  useCredit: false,
  creditRequestedCentavos: null,
  method: "cash",
  cashReceivedCentavos: null,
  referenceNo: "",
};

describe("quotePayment", () => {
  it("cash must cover the fee and shows change", () => {
    expect(quotePayment({ ...base, cashReceivedCentavos: 100_000 })).toMatchObject({
      dueNowCentavos: 70_000,
      changeCentavos: 30_000,
      shortByCentavos: null,
      canConfirm: true,
      methodLabel: "Cash",
    });
  });

  it("blocks confirming when cash is short", () => {
    expect(quotePayment({ ...base, cashReceivedCentavos: 50_000 })).toMatchObject({
      shortByCentavos: 20_000,
      changeCentavos: null,
      canConfirm: false,
    });
  });

  it("cannot confirm cash before anything is entered", () => {
    expect(quotePayment(base).canConfirm).toBe(false);
  });

  it("non-cash methods need a reference number", () => {
    expect(quotePayment({ ...base, method: "gcash" }).canConfirm).toBe(false);
    expect(quotePayment({ ...base, method: "gcash", referenceNo: "  " }).canConfirm).toBe(false);
    expect(quotePayment({ ...base, method: "gcash", referenceNo: "0029 8841" })).toMatchObject({
      canConfirm: true,
      methodLabel: "GCash",
    });
  });

  it("credit covers up to min(balance, due) by default", () => {
    const quote = quotePayment({ ...base, creditBalanceCentavos: 490_000, useCredit: true });
    expect(quote).toMatchObject({
      creditMaxCentavos: 70_000,
      creditAppliedCentavos: 70_000,
      creditBalanceAfterCentavos: 420_000,
      dueNowCentavos: 0,
      needsMethod: false,
      canConfirm: true,
      methodLabel: "Credit",
    });
  });

  it("a small balance covers part of the fee and the rest needs a method", () => {
    const quote = quotePayment({
      ...base,
      dueCentavos: 150_000,
      creditBalanceCentavos: 70_000,
      useCredit: true,
      method: "maya",
      referenceNo: "M-1",
    });
    expect(quote).toMatchObject({
      creditAppliedCentavos: 70_000,
      dueNowCentavos: 80_000,
      needsMethod: true,
      canConfirm: true,
      methodLabel: "Credit + Maya",
    });
  });

  it("clamps the requested credit between zero and the maximum", () => {
    const over = { ...base, creditBalanceCentavos: 490_000, useCredit: true };
    expect(quotePayment({ ...over, creditRequestedCentavos: 999_999 }).creditAppliedCentavos).toBe(
      70_000,
    );
    expect(quotePayment({ ...over, creditRequestedCentavos: -5 }).creditAppliedCentavos).toBe(0);
    expect(quotePayment({ ...over, creditRequestedCentavos: 20_000 }).dueNowCentavos).toBe(50_000);
  });

  it("ignores credit when the toggle is off", () => {
    const quote = quotePayment({ ...base, creditBalanceCentavos: 490_000, useCredit: false });
    expect(quote.creditAppliedCentavos).toBe(0);
    expect(quote.dueNowCentavos).toBe(70_000);
  });
});
