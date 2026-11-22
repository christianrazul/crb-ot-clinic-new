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

describe("quotePayment, marking a shortfall as debt (D-129)", () => {
  it("offers debt only when cash comes up short", () => {
    expect(quotePayment({ ...base, cashReceivedCentavos: 30_000 })).toMatchObject({
      shortByCentavos: 40_000,
      canMarkAsDebt: true,
      canConfirm: false,
      debtCentavos: 0,
    });
    expect(quotePayment({ ...base, cashReceivedCentavos: 70_000 }).canMarkAsDebt).toBe(false);
    expect(quotePayment({ ...base, cashReceivedCentavos: null }).canMarkAsDebt).toBe(false);
    // A transfer with no amount entered is the full amount.
    expect(
      quotePayment({ ...base, method: "gcash", referenceNo: "1", markAsDebt: true }),
    ).toMatchObject({ canMarkAsDebt: false, debtCentavos: 0, canConfirm: true });
  });

  it("puts the shortfall on the tab and takes the cash", () => {
    expect(quotePayment({ ...base, cashReceivedCentavos: 30_000, markAsDebt: true })).toMatchObject(
      {
        debtCentavos: 40_000,
        paidNowCentavos: 30_000,
        canConfirm: true,
        methodLabel: "Cash + Debt",
      },
    );
  });

  it("can put the whole fee on the tab when nothing is paid", () => {
    expect(quotePayment({ ...base, cashReceivedCentavos: 0, markAsDebt: true })).toMatchObject({
      debtCentavos: 70_000,
      paidNowCentavos: 0,
      canConfirm: true,
      methodLabel: "Debt",
    });
  });

  it("applies credit first, then cash, then debt", () => {
    expect(
      quotePayment({
        ...base,
        creditBalanceCentavos: 20_000,
        useCredit: true,
        cashReceivedCentavos: 30_000,
        markAsDebt: true,
      }),
    ).toMatchObject({
      creditAppliedCentavos: 20_000,
      paidNowCentavos: 30_000,
      debtCentavos: 20_000,
      methodLabel: "Credit + Cash + Debt",
    });
  });
});

describe("quotePayment, amounts for e-wallet, bank and card (D-129)", () => {
  const gcash = { ...base, method: "gcash" as const, referenceNo: "0029" };

  it("blocks a short transfer unless the rest is marked as debt", () => {
    expect(quotePayment({ ...gcash, cashReceivedCentavos: 30_000 })).toMatchObject({
      shortByCentavos: 40_000,
      canMarkAsDebt: true,
      canConfirm: false,
    });
    expect(
      quotePayment({ ...gcash, cashReceivedCentavos: 30_000, markAsDebt: true }),
    ).toMatchObject({
      debtCentavos: 40_000,
      paidNowCentavos: 30_000,
      canConfirm: true,
      methodLabel: "GCash + Debt",
    });
  });

  it("still needs a reference when part was paid by transfer", () => {
    expect(
      quotePayment({ ...gcash, referenceNo: "", cashReceivedCentavos: 30_000, markAsDebt: true })
        .canConfirm,
    ).toBe(false);
    // Nothing paid by transfer: all on the tab, no reference needed.
    expect(
      quotePayment({ ...gcash, referenceNo: "", cashReceivedCentavos: 0, markAsDebt: true }),
    ).toMatchObject({ canConfirm: true, methodLabel: "Debt" });
  });

  it("accepts the exact amount and refuses more, since transfers give no change", () => {
    expect(quotePayment({ ...gcash, cashReceivedCentavos: 70_000 }).canConfirm).toBe(true);
    expect(quotePayment({ ...gcash, cashReceivedCentavos: 80_000 })).toMatchObject({
      overByCentavos: 10_000,
      changeCentavos: null,
      canConfirm: false,
    });
  });
});
