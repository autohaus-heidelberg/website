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
 * getestet werden kann.
 *
 * WICHTIG (Modell A+B, Team-Absprache 2026-09-29): JEDER Band-Deal (Festgage,
 * Doordeal, Kombi) löst sich in GENAU EINE Ausgabe auf — reiner Doordeal ist
 * nur ein Kombi mit Garantie 0 (resolveComboDeal → resolvedAmount = %-Anteil
 * der Türbasis). Bands gehören NIE in `door_deal_splits`; diese Liste ist
 * ausschließlich für externe Parteien (Mitveranstalter). Steht dort trotzdem
 * ein Bandname → `orphanSplit` (veraltet, in Ausgabe umwandeln).
 *
 * `expectedAmount` = resolveComboDeal().resolvedAmount (Festgage == Garantie,
 * Doordeal == %-Türanteil, Kombi == das Höhere). `mismatchAcknowledged` = die
 * Kassenwart:in hat den abweichenden gezahlten Betrag bewusst bestätigt.
 *
 * Der Abgleich läuft NUR bei Festgagen: ein Betrag mit Türanteil hängt an der
 * Türeinnahme, die wiederum die bereits ausgezahlten Gagen enthält (die Kasse
 * wird erst nach den Auszahlungen gezählt). Ein Nachrechnen würde die Gage
 * also aus ihrer eigenen Grundlage ableiten und bei jedem Übernehmen weiter
 * hochlaufen. Der ausgezahlte Betrag ist ein Snapshot — das Geld ist raus.
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
  /** Vorschlag: Deal-Betrag als Ausgabe übernehmen (gilt für alle Deal-Typen). */
  suggestExpense: boolean
  /** Warnung/Wahl: Festgage gebucht, Betrag weicht vom Deal ab. */
  amountMismatch: boolean
  /** Warnung: Band steht in door_deal_splits — dort gehören nur externe Parteien hin. */
  orphanSplit: boolean
}

export function bandDealIssues(s: BandDealState): BandDealIssues {
  const hasDeal =
    s.dealType === 'guarantee' ||
    s.dealType === 'door_deal' ||
    s.dealType === 'guarantee_plus_door'

  const amountMismatch =
    s.dealType === 'guarantee' &&
    s.hasExpense &&
    !s.mismatchAcknowledged &&
    s.expenseAmount != null &&
    s.expectedAmount != null &&
    Math.abs(s.expenseAmount - s.expectedAmount) > 0.01

  return {
    suggestExpense: hasDeal && !s.hasExpense,
    amountMismatch,
    orphanSplit: hasDeal && s.hasSplit,
  }
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
