export interface PrePayoutCountInput {
  /** Rechnerwert: beim Buchen der ersten Gage eingefrorenes Bargeld inkl. Wechselgeld (Stand VOR Auszahlung). */
  frozenCash: number
  /** Kassenzählung des Einlasses: Gesamt (inkl. Wechselgeld) und Gebühren. */
  total: number
  fees: number
  /** Summe der aus der Einlasskasse bezahlten Ausgaben (Gagen etc.). */
  payouts: number
}

export interface PrePayoutCountWarning {
  /** Gezähltes Bargeld inkl. Wechselgeld laut Kassenzählung, entspricht dem Stand vor der Auszahlung. */
  countedCash: number
  /** Vorschlag für das Feld "Gesamt": gezählter Betrag abzüglich der Auszahlungen. */
  correctedTotal: number
  /** Stand vor der Auszahlung (inkl. Wechselgeld), falls stattdessen der Rechnerwert falsch ist. */
  correctedFrozen: number
  payouts: number
}

const TOLERANCE = 0.01

/**
 * Die Kassenzählung soll den Stand NACH der Auszahlung enthalten — Auszahlungen
 * werden überall wieder aufaddiert. Entspricht das gezählte Bargeld exakt dem
 * beim Buchen eingefrorenen Rechnerwert (= Stand vor der Auszahlung), obwohl
 * bereits aus der Kasse ausgezahlt wurde, wurde entweder die Kasse vor der
 * Auszahlung eingetragen oder der Rechnerwert nach der Auszahlung — in beiden
 * Fällen würde die Auszahlung doppelt gezählt. Beide Werte enthalten das
 * Wechselgeld (der Rechner zieht es erst im zweiten Feld ab).
 */
export function detectPrePayoutCount(input: PrePayoutCountInput): PrePayoutCountWarning | null {
  const { frozenCash, total, fees, payouts } = input
  if (payouts <= TOLERANCE || total <= 0) return null
  const countedCash = total - fees
  if (Math.abs(countedCash - frozenCash) > TOLERANCE) return null
  const correctedTotal = total - payouts
  if (correctedTotal < 0) return null
  return { countedCash, correctedTotal, correctedFrozen: countedCash + payouts, payouts }
}

export interface CashShortfall {
  payouts: number
  /** Bargeld, das vor den Auszahlungen über dem Wechselgeld in der Kasse lag. */
  available: number
  shortfall: number
}

/**
 * Hinweis, wenn aus einer Kasse mehr bezahlt wurde, als darin (über dem
 * Wechselgeld) lag. Kein Fehler — die Differenz kommt oft aus dem Wechselgeld
 * oder einer anderen Kasse — aber die "Bezahlt aus"-Zuordnung sollte dann
 * stimmen. `availableBefore` = null, solange der Kassenstand unbekannt ist.
 */
export function detectCashShortfall(payouts: number, availableBefore: number | null): CashShortfall | null {
  if (availableBefore === null || payouts <= TOLERANCE) return null
  const available = Math.max(0, availableBefore)
  const shortfall = payouts - available
  if (shortfall <= TOLERANCE) return null
  return { payouts, available, shortfall }
}
