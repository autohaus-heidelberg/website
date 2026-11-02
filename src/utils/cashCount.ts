export interface PrePayoutCountInput {
  /** Rechner: Bargeld-Feld (beim Buchen eingefroren, Stand VOR Auszahlung) und abgezogenes Wechselgeld. */
  calcCash: number
  calcChange: number
  /** Kassenzählung des Einlasses (Gesamt, Wechselgeld, Gebühren). */
  total: number
  changeMoney: number
  fees: number
  /** Summe der aus der Einlasskasse bezahlten Ausgaben (Gagen etc.). */
  payouts: number
}

export interface PrePayoutCountWarning {
  /** Gezählter Betrag ohne Wechselgeld, entspricht dem Stand vor der Auszahlung laut Rechner. */
  countedNet: number
  /** Vorschlag für das Feld "Gesamt": gezählter Betrag abzüglich der Auszahlungen. */
  correctedTotal: number
  /** Vorschlag für das Bargeld-Feld des Rechners (Stand vor der Auszahlung, Wechselgeld-Feld bleibt). */
  correctedFrozen: number
  payouts: number
}

const TOLERANCE = 0.01

/**
 * Die Kassenzählung soll den Stand NACH der Auszahlung enthalten — Auszahlungen
 * werden überall wieder aufaddiert. Entspricht der gezählte Betrag exakt dem
 * beim Buchen eingefrorenen Rechnerwert (= Stand vor der Auszahlung), obwohl
 * bereits aus der Kasse ausgezahlt wurde, wurde entweder die Kasse vor der
 * Auszahlung eingetragen oder der Rechnerwert nach der Auszahlung — in beiden
 * Fällen würde die Auszahlung doppelt gezählt.
 *
 * Verglichen wird auf beiden Seiten ohne Wechselgeld: im Rechner kann es im
 * Bargeld-Feld schon herausgerechnet oder erst im zweiten Feld abgezogen sein.
 */
export function detectPrePayoutCount(input: PrePayoutCountInput): PrePayoutCountWarning | null {
  const { calcCash, calcChange, total, changeMoney, fees, payouts } = input
  if (payouts <= TOLERANCE || total <= 0) return null
  const countedNet = total - changeMoney - fees
  if (Math.abs(countedNet - (calcCash - calcChange)) > TOLERANCE) return null
  const correctedTotal = total - payouts
  if (correctedTotal < 0) return null
  return { countedNet, correctedTotal, correctedFrozen: countedNet + payouts + calcChange, payouts }
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
