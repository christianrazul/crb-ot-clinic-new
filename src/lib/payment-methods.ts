export const PAYMENT_METHODS = ["cash", "gcash", "maya", "bank_transfer", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  card: "Card",
};

/** Money received per method over some period; every method listed, zero or not. */
export type ReceivedByMethod = {
  method: PaymentMethod;
  totalCentavos: number;
  /** Money-in transactions: session payments, advance top-ups and debt paid off. */
  count: number;
}[];
