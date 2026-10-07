/**
 * Split-Logik für die Inventur-Eingabe in `AccountingView.vue`.
 *
 * Mengen werden in zwei Feldern gezählt: einer Haupt- und einer Nebeneinheit.
 * Welche das sind, hängt vom Getränk ab:
 *
 *  • Kistengetränk (units_per_crate > 1):       major = Kisten,   minor = Flaschen
 *  • Portionsgetränk (portions_per_bottle ≥ 2): major = Flaschen, minor = Viertel
 *  • Alles andere (Piccolo & Co.):              kein Split, ein Ganzzahlfeld
 *
 * Die Carry-over-Logik ist für beide Modi dieselbe — sie rechnet nur mit
 * Zählwerten und einer Obergrenze ("20 Flaschen pro Kiste" verhält sich wie
 * "4 Viertel pro Flasche"). Nur die Umrechnung Split ↔ Gesamtmenge braucht
 * den Skalierungsfaktor `minorSize`.
 *
 * Ausgelagert in ein eigenes Utility (statt einer Closure im SFC), damit sich
 * das Verhalten in Vitest dokumentieren und absichern lässt.
 */

export interface SplitModeBeverage {
  units_per_crate?: number | null
  /**
   * Portionen pro Flasche (z.B. 35 für Vodka-Shots, 3 für Wein). Ab 2 gilt der
   * Drink als "wird portionsweise ausgeschenkt" und bekommt das Viertel-Raster
   * für angebrochene Flaschen.
   */
  portions_per_bottle?: number | null
}

export interface QtySplitMode {
  /** Wie viele Nebeneinheiten in eine Haupteinheit passen. Kiste: units_per_crate, Portionsflasche: 4. */
  minorPerMajor: number
  /** Wert einer Nebeneinheit in Basiseinheiten (Flaschen). Kiste: 1, Viertel: 0.25. */
  minorSize: number
}

export interface QtySplit {
  major: number
  minor: number
}

/** Viertel sind binär exakt darstellbar und decken sich damit, wie angebrochene
 *  Flaschen real geschätzt werden ("noch ¾ voll"). Bewusst NICHT 1/portions:
 *  bei portions=35 wären das 0,0286er-Schritte und Werte wie 5,28571. */
const QUARTERS_PER_BOTTLE = 4

/**
 * Bestimmt, in welche zwei Felder die Menge eines Getränks aufgeteilt wird.
 * `null` heißt: kein Split, die Menge wird in einem Ganzzahlfeld erfasst.
 */
export function splitMode(beverage: SplitModeBeverage): QtySplitMode | null {
  const upc = beverage.units_per_crate ?? 1
  if (upc > 1) return { minorPerMajor: upc, minorSize: 1 }
  const portions = beverage.portions_per_bottle ?? 0
  if (portions >= 2) return { minorPerMajor: QUARTERS_PER_BOTTLE, minorSize: 0.25 }
  return null
}

/** Größe einer Haupteinheit in Basiseinheiten (Flaschen). */
export function majorSize(mode: QtySplitMode): number {
  return mode.minorPerMajor * mode.minorSize
}

/**
 * Zerlegt eine Gesamtmenge in Haupt- und Nebeneinheit.
 *
 * `minor` darf bewusst gebrochen herauskommen: ein Altbestand von 19,1 Flaschen
 * ergibt `{ major: 19, minor: 0.4 }` — also kein ganzes Viertel. Die UI zeigt
 * das als "kein Segment aktiv" und rastet erst beim ersten Klick ein. Würden
 * wir hier runden, verschöben wir stillschweigend Bestände, die der Nutzer nie
 * angefasst hat.
 */
export function splitQuantity(total: number, mode: QtySplitMode): QtySplit {
  if (!Number.isFinite(total)) return { major: 0, minor: 0 }
  const size = majorSize(mode)
  if (size <= 0) return { major: 0, minor: 0 }
  const major = Math.floor(total / size)
  const rest = total - major * size
  return { major, minor: Math.round((rest / mode.minorSize) * 10000) / 10000 }
}

/** Setzt Haupt- und Nebeneinheit wieder zur Gesamtmenge zusammen. */
export function joinQuantity(split: QtySplit, mode: QtySplitMode): number {
  const major = Number.isFinite(split.major) ? split.major : 0
  const minor = Number.isFinite(split.minor) ? split.minor : 0
  return Math.round((major * majorSize(mode) + minor * mode.minorSize) * 10000) / 10000
}

/**
 * Wendet einen ±delta-Klick auf den Nebeneinheiten-Zähler an.
 *
 * Regeln:
 *  • Unterläuft der Zähler (next < 0) und sind noch Haupteinheiten übrig, wird
 *    eine abgezogen und der Zähler auf minorPerMajor-1 gesetzt.
 *  • Sind keine Haupteinheiten mehr übrig, klemmt der Zähler bei 0 (kein
 *    Negativbestand).
 *  • Überläuft der Zähler (next ≥ minorPerMajor), werden volle Haupteinheiten
 *    übertragen. Funktioniert auch für große delta-Werte (Tastatureingabe).
 *
 * Liefert immer einen *neuen* Split — der Aufrufer entscheidet, ob/wie er ihn
 * zurückschreibt.
 */
export function stepMinor(
  split: QtySplit,
  delta: number,
  minorPerMajor: number,
): QtySplit {
  if (minorPerMajor < 1) {
    // Ohne Obergrenze gibt es nichts zu carryen.
    return { major: split.major, minor: Math.max(0, split.minor + delta) }
  }
  const next = split.minor + delta
  if (next < 0) {
    if (split.major > 0) {
      return { major: split.major - 1, minor: minorPerMajor - 1 }
    }
    return { major: 0, minor: 0 }
  }
  if (next >= minorPerMajor) {
    const extraMajor = Math.floor(next / minorPerMajor)
    return {
      major: split.major + extraMajor,
      minor: next - extraMajor * minorPerMajor,
    }
  }
  return { major: split.major, minor: next }
}

/**
 * Normalisiert einen Split, nachdem die Nebeneinheit *direkt* gesetzt wurde
 * (Tippen, Paste, native ▲▼-Spin-Buttons). Anders als `stepMinor` arbeiten wir
 * hier nicht mit einem Delta, sondern mit dem bereits gesetzten Wert.
 *
 * Das Nebeneinheiten-Feld ist der *Rest* innerhalb der angebrochenen
 * Haupteinheit, NICHT die Gesamtmenge. Deshalb bleibt die Gesamtmenge erhalten
 * und wir buchen nur Über-/Unterlauf um:
 *  • minor ≥ minorPerMajor     → so viele volle Haupteinheiten wie möglich hochrollen
 *  • minor < 0                 → so viele Haupteinheiten wie nötig "borrowen"
 *  • 0 ≤ minor < minorPerMajor → Split bleibt unverändert
 *  • minor ist kein Number     → Split bleibt unverändert (User tippt gerade,
 *    leeres Feld ist OK — nicht auf 0 zurückspringen, sonst klemmt der Cursor)
 */
export function normalizeSplit(
  split: QtySplit,
  minorPerMajor: number,
): QtySplit {
  if (minorPerMajor < 1) return split
  if (!Number.isFinite(split.minor)) return split
  const m = split.minor
  if (m >= minorPerMajor) {
    const extra = Math.floor(m / minorPerMajor)
    return {
      major: split.major + extra,
      minor: m - extra * minorPerMajor,
    }
  }
  if (m < 0) {
    // Robust gegen große Negativ-Eingaben (z.B. User tippt −7): so viele
    // Haupteinheiten borgen wie nötig — und bei 0 hart clampen.
    let nm = m
    let nMajor = split.major
    while (nm < 0 && nMajor > 0) {
      nMajor -= 1
      nm += minorPerMajor
    }
    if (nm < 0) nm = 0
    return { major: nMajor, minor: nm }
  }
  return split
}
