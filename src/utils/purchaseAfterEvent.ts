/** Einschätzung, ob ein Einkauf nach dem Event bei einer späten Inventur
 *  mitgezählt wurde. Die zählende Person weiß das oft selbst nicht – die
 *  Zahlen verraten es aber meistens. */

export type PurchaseHintLevel = 'deducted' | 'pending' | 'likely' | 'unclear' | 'unlikely'

export type PurchaseHintReason =
  | 'overcount'        // mehr gezählt als vor dem Event da war
  | 'low_without'      // ohne Abzug ungewöhnlich wenig, mit Abzug normal
  | 'too_high_with'    // mit Abzug ungewöhnlich viel
  | 'rest_too_small'   // gezählter Rest kleiner als der Einkauf
  | 'no_signal'

export interface PurchaseHintInput {
  deducted: boolean
  counted: boolean
  /** Bestand nach dem Event laut Zählung (Flaschen). */
  countedAfter: number
  /** Verbrauch ohne Abzug = Vorher − gezählt (Flaschen, kann negativ sein). */
  consumed: number
  /** Flaschen aus dem Einkauf. */
  purchaseQty: number
  /** Historischer Verbrauch des Getränks (oder der Kategorie); null = zu wenig Daten. */
  baseline: { mean: number; threshold: number } | null
}

export interface PurchaseHint {
  level: PurchaseHintLevel
  reason: PurchaseHintReason
  /** Verbrauch, falls der Einkauf abgezogen würde. */
  consumedIfDeducted: number
}

export function classifyPurchaseHint(i: PurchaseHintInput): PurchaseHint {
  const consumedIfDeducted = i.consumed + i.purchaseQty
  const hint = (level: PurchaseHintLevel, reason: PurchaseHintReason): PurchaseHint =>
    ({ level, reason, consumedIfDeducted })

  if (i.deducted) return hint('deducted', 'no_signal')
  if (!i.counted) return hint('pending', 'no_signal')
  if (i.countedAfter < i.purchaseQty) return hint('unlikely', 'rest_too_small')
  if (i.consumed < 0) return hint('likely', 'overcount')
  if (i.baseline) {
    if (consumedIfDeducted > i.baseline.threshold) return hint('unlikely', 'too_high_with')
    if (i.consumed < i.baseline.mean / 2) return hint('likely', 'low_without')
  }
  return hint('unclear', 'no_signal')
}
