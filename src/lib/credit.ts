type Entry = { amountCentavos: number; voidedAt?: string | Date | null };

/** The balance is always the sum of the live ledger rows, never a stored number. */
export function creditBalance(entries: Entry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.voidedAt ? 0 : entry.amountCentavos), 0);
}

/** Entries oldest first, each with the balance after it. Voided entries don't move it. */
export function withRunningBalance<T extends Entry & { createdAt: string }>(
  entries: T[],
): (T & { balanceAfterCentavos: number })[] {
  let running = 0;
  return [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((entry) => {
      if (!entry.voidedAt) running += entry.amountCentavos;
      return { ...entry, balanceAfterCentavos: running };
    });
}
