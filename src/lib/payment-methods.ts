export const PAYMENT_METHODS = ["cash", "gcash", "maya", "bank_transfer", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  card: "Card",
};
