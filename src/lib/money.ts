/**
 * Money helpers. All amounts are stored and passed around as integer centavos
 * (₱1.00 = 100 centavos). Only convert to pesos at the display edge.
 */

const CENTAVOS_PER_PESO = 100;

const wholePesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const exactPesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function assertCentavos(centavos: number): void {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError(`Expected an integer number of centavos, got ${centavos}`);
  }
}

/**
 * Formats centavos for display: `700000` -> `₱7,000`, `700050` -> `₱7,000.50`.
 * Whole amounts drop the decimals to match the mockup; any non-zero centavos
 * are always shown so real amounts are never hidden by rounding.
 */
export function formatPeso(centavos: number): string {
  assertCentavos(centavos);
  const formatter = centavos % CENTAVOS_PER_PESO === 0 ? wholePesoFormatter : exactPesoFormatter;
  // Intl renders negatives as "-₱500"; use a true minus sign for UI copy.
  return formatter.format(centavos / CENTAVOS_PER_PESO).replace("-", "−");
}

const PESO_INPUT = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * Parses a peso amount typed by a user ("1,500", "₱700", "250.5") into centavos.
 * Returns null for anything that is not a non-negative amount with at most two
 * decimal places. Parsing goes through strings, never floating point maths.
 */
export function pesosToCentavos(input: string): number | null {
  const cleaned = input.trim().replace(/^₱/, "").replaceAll(",", "").trim();
  if (!PESO_INPUT.test(cleaned)) return null;

  const [whole = "0", fraction = ""] = cleaned.split(".");
  return Number(whole) * CENTAVOS_PER_PESO + Number(fraction.padEnd(2, "0"));
}

/** Converts whole pesos (as used in fixtures and settings copy) to centavos. */
export function pesos(amount: number): number {
  const centavos = Math.round(amount * CENTAVOS_PER_PESO);
  assertCentavos(centavos);
  return centavos;
}
