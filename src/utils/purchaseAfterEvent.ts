/** Einschätzung, ob ein Einkauf nach dem Event bei einer späten Inventur
 *  mitgezählt wurde. Die zählende Person weiß das oft selbst nicht.
 *
 *  Bewusst nur Aussagen, die aus den Zahlen zwingend folgen. „Ungewöhnlich
 *  wenig/viel Verbrauch“ taugt nicht als Indiz: Ein ruhiger Abend (Montags-Show)
 *  ist normal – bei echten Daten liegt rund jede dritte Zählung unter dem halben
 *  Durchschnittsverbrauch. Ein falsches „wahrscheinlich mitgezählt“ würde zum
 *  Abziehen verleiten und den Verbrauch dauerhaft verfälschen.
 *
 *  Stufen: deducted = schon abgezogen · pending = noch nicht gezählt ·
 *  likely = mehr gezählt als da war (Handlung) · unclear = Person entscheidet ·
 *  none = nichts zu tun, kein Hinweis. */

export type PurchaseHintLevel = 'deducted' | 'pending' | 'likely' | 'unclear' | 'none'

export interface PurchaseHintInput {
  deducted: boolean
  counted: boolean
  /** Bestand nach dem Event laut Zählung (Flaschen). */
  countedAfter: number
  /** Verbrauch ohne Abzug = Vorher − gezählt (Flaschen, kann negativ sein). */
  consumed: number
  /** Flaschen aus dem Einkauf. */
  purchaseQty: number
  /** Ein späteres Event wurde schon gezählt: niemand korrigiert das frühere
   *  Event noch, „unklar“ ist dann nur Rauschen. */
  laterEventCounted?: boolean
}

export function classifyPurchaseHint(i: PurchaseHintInput): PurchaseHintLevel {
  if (i.deducted) return 'deducted'
  if (!i.counted) return 'pending'
  // Gezählter Rest kleiner als der Einkauf: steckt (nicht mehr) im Wert – nie
  // drin oder schon von Hand abgezogen. Nichts zu tun.
  if (i.countedAfter < i.purchaseQty) return 'none'
  // Der Überschuss muss durch den Einkauf erklärbar sein, sonst fehlt noch etwas anderes.
  if (i.consumed < 0 && i.consumed + i.purchaseQty >= 0) return 'likely'
  if (i.laterEventCounted) return 'none'
  return 'unclear'
}
