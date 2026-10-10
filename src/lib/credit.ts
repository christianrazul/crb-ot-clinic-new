/** The balance is always the sum of the ledger, never a stored number. */
export function creditBalance(entries: { amountCentavos: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.amountCentavos, 0);
}

/** Entries oldest first, each with the balance after it. */
export function withRunningBalance<T extends { amountCentavos: number; createdAt: string }>(
  entries: T[],
): (T & { balanceAfterCentavos: number })[] {
  let running = 0;
  return [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((entry) => {
      running += entry.amountCentavos;
      return { ...entry, balanceAfterCentavos: running };
    });
}
