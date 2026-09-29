import type { ArtistDeal, ArtistDealType } from '@/services'

export interface ComboResolution {
  guaranteeAmount: number
  doorDealPercentage: number
  resolvedAmount: number
  resolvedSource: 'guarantee' | 'doordeal'
}

/**
 * Vertragslogik "Garantie + Doordeal": die Band bekommt NIE Garantie UND
 * %-Anteil addiert, sondern IMMER nur das Höhere von beidem ("Garantie =
 * Untergrenze"). `doorDealBase` ist die aktuelle Netto-Türeinnahme (ggf.
 * abzüglich abzugsfähiger Kosten wie GEMA).
 */
export function resolveComboDeal(
  d: Pick<ArtistDeal, 'guarantee_amount' | 'door_deal_percentage'>,
  doorDealBase: number,
): ComboResolution {
  const guaranteeAmount = parseFloat(d.guarantee_amount || '0') || 0
  const doorDealPercentage = parseFloat(d.door_deal_percentage || '0') || 0
  const doorShareAmount = doorDealBase * (doorDealPercentage / 100)
  return {
    guaranteeAmount,
    doorDealPercentage,
    resolvedAmount: Math.max(guaranteeAmount, doorShareAmount),
    resolvedSource: doorShareAmount > guaranteeAmount ? 'doordeal' : 'guarantee',
  }
}

/**
 * Namensdopplungen in %-Split-Tabellen (Doordeal, Gewinnverteilung) sind so
 * gut wie immer ein Versehen (zwei Zeilen für dieselbe Partei splitten den
 * Betrag künstlich auf zwei Zahlen, statt einfach einen höheren %-Satz zu
 * nehmen) — case- und whitespace-insensitiv, leere Namen werden ignoriert.
 */
export function findDuplicateNames(names: string[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const raw of names) {
    const name = raw.trim().toLowerCase()
    if (!name) continue
    if (seen.has(name)) duplicates.add(name)
    seen.add(name)
  }
  return duplicates
}

/** Deutsches Komma- oder Punkt-Dezimalformat parsen (z.B. Ticketpreise "18,60"). */
export function parsePrice(value?: string): number {
  const n = parseFloat((value || '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function showsGuarantee(type?: ArtistDealType): boolean {
  return type === 'guarantee' || type === 'guarantee_plus_door'
}

export function showsDoorDeal(type?: ArtistDealType): boolean {
  return type === 'door_deal' || type === 'guarantee_plus_door'
}

/**
 * Vollständiger Abrechnungs-Status EINER Band bezogen auf ihren aktuellen
 * Deal — die EINE Quelle der Wahrheit für alle Hinweise/Vorschläge im
 * Ausgaben-Tab. Bewusst als reine Funktion, damit die gesamte Matrix
 * (Deal-Typ × Ausgabe-vorhanden × Split-vorhanden × Betrag-passt) erschöpfend
 * getestet werden kann — genau die Kombinationen, die beim nachträglichen
 * Umstellen des Deal-Typs + Entfernen der Ausgabe schieflaufen konnten.
 *
 * `expectedAmount` = der aus dem Deal aktuell korrekte Ausgaben-Betrag
 * (resolveComboDeal().resolvedAmount — bei reiner Garantie == Garantie, bei
 * Kombi das Höhere von Garantie/Türanteil). `mismatchAcknowledged` = die
 * Kassenwart:in hat den abweichenden gezahlten Betrag bewusst bestätigt.
 */
export interface BandDealState {
  dealType: ArtistDealType | string | null | undefined
  hasExpense: boolean
  hasSplit: boolean
  expenseAmount: number | null
  expectedAmount: number | null
  mismatchAcknowledged: boolean
}

export interface BandDealIssues {
  /** Vorschlag: Gage/Kombi-Betrag als Ausgabe übernehmen. */
  suggestGuarantee: boolean
  /** Vorschlag: Doordeal-Split anlegen. */
  suggestDoorDeal: boolean
  /** Warnung: Ausgabe vorhanden, Deal ist aber reiner Doordeal (keine Festgage). */
  orphanExpense: boolean
  /** Warnung: Doordeal-Split vorhanden, Deal hat aber keinen Doordeal-Anteil. */
  orphanSplit: boolean
  /** Warnung/Wahl: Ausgabe vorhanden, Betrag weicht vom aktuell korrekten ab. */
  amountMismatch: boolean
}

export function bandDealIssues(s: BandDealState): BandDealIssues {
  const isGuarantee = s.dealType === 'guarantee'
  const isCombo = s.dealType === 'guarantee_plus_door'
  const isDoorDeal = s.dealType === 'door_deal'
  const wantsExpense = isGuarantee || isCombo

  const amountMismatch =
    wantsExpense &&
    s.hasExpense &&
    !s.mismatchAcknowledged &&
    s.expenseAmount != null &&
    s.expectedAmount != null &&
    Math.abs(s.expenseAmount - s.expectedAmount) > 0.01

  return {
    suggestGuarantee: wantsExpense && !s.hasExpense,
    suggestDoorDeal: isDoorDeal && !s.hasSplit,
    orphanExpense: isDoorDeal && s.hasExpense,
    orphanSplit: wantsExpense && s.hasSplit,
    amountMismatch,
  }
}

/**
 * Ob für einen Band-Deal noch ein Übernahme-Vorschlag (Ausgaben-Tab) gezeigt
 * werden soll — dünner Wrapper über `bandDealIssues` (nur der Vorschlags-Teil),
 * damit bestehende Aufrufer/Tests unverändert bleiben.
 */
export function needsDealSuggestion(
  dealType: ArtistDealType | string | undefined,
  guaranteeApplied: boolean,
  doorDealApplied: boolean,
): boolean {
  const i = bandDealIssues({
    dealType,
    hasExpense: guaranteeApplied,
    hasSplit: doorDealApplied,
    expenseAmount: null,
    expectedAmount: null,
    mismatchAcknowledged: false,
  })
  return i.suggestGuarantee || i.suggestDoorDeal
}

/**
 * Netto-Eintrittsumsatz, ab dem die Summe der Doordeal-Anteile mehr wert ist
 * als die Summe der zugehörigen Garantien (nur Kombi-Deals). Grobe Schätzung
 * — die echte Abrechnung zieht abzugsfähige Kosten vor der Aufteilung ab,
 * der reale Schwellenwert liegt also etwas höher. null wenn nicht berechenbar.
 */
export function comboBreakeven(totalGuarantee: number, totalPct: number): number | null {
  if (!totalPct || !totalGuarantee) return null
  return totalGuarantee / (totalPct / 100)
}

/** Regulärer USt-Satz für Eintritt (siehe REVENUE_VAT_RATE_DEFAULTS in types/accounting.ts). */
export const ENTRANCE_VAT_RATE = 0.07

/**
 * Ungefähre Ticketanzahl-Spanne (zwischen reinem VVK- und reinem AK-Verkauf)
 * bis zum Breakeven, formatiert als "12" (gleich) oder "12–20" (Spanne).
 * Eintrittspreise sind Brutto (inkl. USt), die Basis wird aber netto verteilt
 * — daher hier wieder hochgerechnet. null wenn nicht berechenbar.
 */
export function estimateTicketRange(
  netRevenue: number | null,
  vvkPrice: number,
  akPrice: number,
  vatRate: number = ENTRANCE_VAT_RATE,
): string | null {
  if (netRevenue === null) return null
  const grossRevenue = netRevenue * (1 + vatRate)
  const prices = [vvkPrice, akPrice].filter(p => p > 0)
  if (!prices.length) return null
  const counts = prices.map(p => Math.ceil(grossRevenue / p))
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  return min === max ? `${min}` : `${min}–${max}`
}
