import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";

export type PaymentInput = {
  dueCentavos: number;
  creditBalanceCentavos: number;
  useCredit: boolean;
  /** Credit the desk typed in. Null means "as much as possible". */
  creditRequestedCentavos: number | null;
  method: PaymentMethod;
  /**
   * The amount received by any method (the name predates e-wallets taking an
   * amount). Cash needs it; for other methods null means the full amount.
   */
  cashReceivedCentavos: number | null;
  referenceNo: string;
  /** Put whatever cash doesn't cover on the patient's tab (D-129). */
  markAsDebt?: boolean;
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
  /** A non-cash amount above what's due: there is no change on a transfer. */
  overByCentavos: number | null;
  /** The amount received came up short, so the rest can go on the patient's tab instead. */
  canMarkAsDebt: boolean;
  /** What goes on the tab: the shortfall, when marked as debt; otherwise 0. */
  debtCentavos: number;
  /** Money actually taken now (cash, e-wallet, bank or card), net of change. */
  paidNowCentavos: number;
  canConfirm: boolean;
  /** e.g. "Cash", "Credit", "Credit + GCash" or "Cash + Debt". */
  methodLabel: string;
};

/**
 * Works out how a session fee is settled. Credit can cover up to the smaller
 * of the balance and the fee; the rest needs a method. Cash must cover the
 * remainder (and shows change); other methods need a reference number.
 * The server runs the same function before saving (Milestone 9).
 *
 * Any method can take the amount received. When it comes up short,
 * `markAsDebt` records the payment anyway and puts the shortfall on the
 * patient's tab (D-129). Paying nothing at all (₱0 received) puts the whole
 * remainder there. A non-cash payment still needs its reference number unless
 * nothing was paid that way.
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
  let overByCentavos: number | null = null;
  if (needsMethod && input.cashReceivedCentavos !== null) {
    const difference = input.cashReceivedCentavos - dueNow;
    if (difference < 0) shortByCentavos = -difference;
    else if (isCash) changeCentavos = difference;
    else if (difference > 0) overByCentavos = difference;
  }

  const canMarkAsDebt = shortByCentavos !== null;
  const debt = canMarkAsDebt && input.markAsDebt ? shortByCentavos! : 0;
  const paidNow = needsMethod ? dueNow - debt : 0;
  const hasReference = input.referenceNo.trim().length > 0;

  let canConfirm: boolean;
  if (!needsMethod) canConfirm = creditApplied > 0;
  else if (shortByCentavos !== null && debt === 0) canConfirm = false;
  else if (overByCentavos !== null) canConfirm = false;
  else if (isCash) canConfirm = changeCentavos !== null || debt > 0;
  // Nothing paid by transfer (all on the tab) needs no reference.
  else canConfirm = paidNow === 0 || hasReference;

  const parts = [
    creditApplied > 0 && "Credit",
    paidNow > 0 && PAYMENT_METHOD_LABELS[input.method],
    debt > 0 && "Debt",
  ].filter(Boolean);
  const methodLabel = parts.length ? parts.join(" + ") : PAYMENT_METHOD_LABELS[input.method];

  return {
    creditMaxCentavos: creditMax,
    creditAppliedCentavos: creditApplied,
    creditBalanceAfterCentavos: input.creditBalanceCentavos - creditApplied,
    dueNowCentavos: dueNow,
    needsMethod,
    changeCentavos,
    shortByCentavos,
    overByCentavos,
    canMarkAsDebt,
    debtCentavos: debt,
    paidNowCentavos: paidNow,
    canConfirm,
    methodLabel,
  };
}
