import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";

export type PaymentInput = {
  dueCentavos: number;
  creditBalanceCentavos: number;
  useCredit: boolean;
  /** Credit the desk typed in. Null means "as much as possible". */
  creditRequestedCentavos: number | null;
  method: PaymentMethod;
  cashReceivedCentavos: number | null;
  referenceNo: string;
};

export type PaymentQuote = {
  /** The most credit that can be applied: min(balance, due). */
  creditMaxCentavos: number;
  creditAppliedCentavos: number;
  creditBalanceAfterCentavos: number;
  /** What is left to pay by cash, e-wallet, bank or card. */
  dueNowCentavos: number;
  needsMethod: boolean;
  changeCentavos: number | null;
  shortByCentavos: number | null;
  canConfirm: boolean;
  /** e.g. "Cash", "Credit" or "Credit + GCash". */
  methodLabel: string;
};

/**
 * Works out how a session fee is settled. Credit can cover up to the smaller
 * of the balance and the fee; the rest needs a method. Cash must cover the
 * remainder (and shows change); other methods need a reference number.
 * The server runs the same function before saving (Milestone 9).
 */
export function quotePayment(input: PaymentInput): PaymentQuote {
  const creditMax = Math.max(0, Math.min(input.creditBalanceCentavos, input.dueCentavos));
  const requested = input.creditRequestedCentavos ?? creditMax;
  const creditApplied = input.useCredit ? Math.max(0, Math.min(requested, creditMax)) : 0;
  const dueNow = input.dueCentavos - creditApplied;
  const needsMethod = dueNow > 0;
  const isCash = input.method === "cash";

  let changeCentavos: number | null = null;
  let shortByCentavos: number | null = null;
  if (needsMethod && isCash && input.cashReceivedCentavos !== null) {
    const difference = input.cashReceivedCentavos - dueNow;
    if (difference >= 0) changeCentavos = difference;
    else shortByCentavos = -difference;
  }

  let canConfirm: boolean;
  if (!needsMethod) canConfirm = creditApplied > 0;
  else if (isCash) canConfirm = changeCentavos !== null;
  else canConfirm = input.referenceNo.trim().length > 0;

  const methodName = PAYMENT_METHOD_LABELS[input.method];
  const methodLabel =
    creditApplied > 0 ? (needsMethod ? `Credit + ${methodName}` : "Credit") : methodName;

  return {
    creditMaxCentavos: creditMax,
    creditAppliedCentavos: creditApplied,
    creditBalanceAfterCentavos: input.creditBalanceCentavos - creditApplied,
    dueNowCentavos: dueNow,
    needsMethod,
    changeCentavos,
    shortByCentavos,
    canConfirm,
    methodLabel,
  };
}
