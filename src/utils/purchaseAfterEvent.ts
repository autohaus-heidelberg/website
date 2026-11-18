/** Einschätzung, ob ein Einkauf nach dem Event bei einer späten Inventur
 *  mitgezählt wurde. Die zählende Person weiß das oft selbst nicht.
 *
 *  Bewusst nur Aussagen, die aus den Zahlen zwingend folgen. „Ungewöhnlich
 *  wenig/viel Verbrauch“ taugt nicht als Indiz: Ein ruhiger Abend (Montags-Show)
 *  ist normal – bei echten Daten liegt rund jede dritte Zählung unter dem halben
 *  Durchschnittsverbrauch. Ein falsches „wahrscheinlich mitgezählt“ würde zum
 *  Abziehen verleiten und den Verbrauch dauerhaft verfälschen. */

export type PurchaseHintLevel = 'deducted' | 'pending' | 'likely' | 'unclear' | 'unlikely'

export type PurchaseHintReason =
  | 'overcount'        // mehr gezählt als vor dem Event da war – sicher mitgezählt
  | 'rest_too_small'   // gezählter Rest kleiner als der Einkauf – steckt (nicht mehr) im Wert; nie drin oder schon abgezogen
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
}

export interface PurchaseHint {
  level: PurchaseHintLevel
  reason: PurchaseHintReason
}

export function classifyPurchaseHint(i: PurchaseHintInput): PurchaseHint {
  if (i.deducted) return { level: 'deducted', reason: 'no_signal' }
  if (!i.counted) return { level: 'pending', reason: 'no_signal' }
  if (i.countedAfter < i.purchaseQty) return { level: 'unlikely', reason: 'rest_too_small' }
  if (i.consumed < 0) return { level: 'likely', reason: 'overcount' }
  return { level: 'unclear', reason: 'no_signal' }
}
