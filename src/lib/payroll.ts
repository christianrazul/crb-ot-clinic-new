export type PayrollLine = {
  sessions: number;
  rateCentavos: number;
  grossCentavos: number;
  therapistShareCentavos: number;
  clinicShareCentavos: number;
};

/**
 * Splits gross billings between therapist and clinic. The therapist share is
 * rounded to the nearest centavo and the clinic keeps the remainder, so the
 * two always add up to the gross exactly.
 */
export function payrollLine(sessions: number, rateCentavos: number, sharePct: number): PayrollLine {
  const grossCentavos = sessions * rateCentavos;
  const therapistShareCentavos = Math.round((grossCentavos * sharePct) / 100);
  return {
    sessions,
    rateCentavos,
    grossCentavos,
    therapistShareCentavos,
    clinicShareCentavos: grossCentavos - therapistShareCentavos,
  };
}

export function sumPayroll(lines: PayrollLine[]) {
  return lines.reduce(
    (total, line) => ({
      sessions: total.sessions + line.sessions,
      grossCentavos: total.grossCentavos + line.grossCentavos,
      therapistShareCentavos: total.therapistShareCentavos + line.therapistShareCentavos,
      clinicShareCentavos: total.clinicShareCentavos + line.clinicShareCentavos,
    }),
    { sessions: 0, grossCentavos: 0, therapistShareCentavos: 0, clinicShareCentavos: 0 },
  );
}
