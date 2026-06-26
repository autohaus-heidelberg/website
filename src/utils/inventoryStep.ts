/**
 * Stepper-Heuristik für die Inventur in `AccountingView.vue`.
 *
 * Ausgelagert in ein eigenes Utility (statt einer Closure-Funktion im
 * SFC), damit sich das Verhalten in Vitest dokumentieren und absichern
 * lässt — z.B. der Carry-Over zwischen Kisten- und Flaschenzähler
 * (Aufgabe: "wenn ich auf − klicke und 0 Flaschen habe, soll 1 Kiste
 * weniger und upc-1 Flaschen stehen").
 */

export interface BottleStepBeverage {
  /**
   * Anzahl Portionen pro Flasche (z.B. 20 für Spirituosen à 0.04 L). Wenn
   * null / 0 / 1 ist, wird der Bottle-Stepper als Ganz-Flaschen-Stepper
   * geführt (Piccolo, Wein, Bier-Einzelflasche). Andernfalls beträgt die
   * Schrittweite 1 / portions_per_bottle, sodass eine Portion einem
   * Klick entspricht.
   */
  portions_per_bottle?: number | null
}

/**
 * Schrittweite des Flaschen-Steppers für ein Getränk, das in Einzelflaschen
 * geführt wird (units_per_crate ≤ 1).
 */
export function bottleStep(beverage: BottleStepBeverage): number {
  const portions = beverage.portions_per_bottle ?? 1
  if (!portions || portions <= 1) return 1
  return 1 / portions
}

/**
 * Wendet einen ±delta-Klick auf einen Flaschen-Zähler (Einzelflaschen-
 * Modus, units_per_crate ≤ 1) an.
 *
 * Wichtige Designentscheidung: wir runden NUR das Ergebnis auf 4
 * Nachkommastellen (gegen Float-Drift wie 0.05*7 ≠ 0.35). Wir snappen
 * den aktuellen Wert NICHT aufs Step-Grid, weil der vom Server gelieferte
 * Bestand selten exakt darauf liegt:
 *
 *   • Three Sixty Vodka, portions=35, Server-Bestand 5.29 →
 *     1×"−"  → 5.2614 (eine Portion abgezogen)
 *     2×"−"  → 5.2328
 *   • Rotwein, portions=3, Server-Bestand 4.67 →
 *     1×"−"  → 4.3367 (ein Glas abgezogen)
 *     2×"−"  → 4.0034
 *
 * Würden wir snappen, würde der erste Klick "−" den Wert paradoxerweise
 * z.B. auf 5.2857 (= 185/35) HOCH-snappen, weil 5.29 ≈ 185.15/35 ≈ 185/35.
 */
export function applyBottleStep(
  current: number,
  delta: number,
  beverage: BottleStepBeverage,
): number {
  const step = bottleStep(beverage)
  const raw = Math.max(0, current + delta * step)
  return Math.round(raw * 10000) / 10000
}

export interface CrateBottleState {
  crates: number
  bottles: number
}

/**
 * Wendet einen ±delta-Klick auf den Flaschenzähler im Kistenmodus an.
 *
 * Regeln:
 *  • Unterläuft der Flaschenzähler (next < 0) und sind noch Kisten übrig,
 *    wird eine Kiste abgezogen und der Flaschenzähler auf upc-1 gesetzt.
 *  • Sind keine Kisten mehr übrig, klemmt der Zähler bei 0 (kein
 *    Negativbestand).
 *  • Überläuft der Flaschenzähler (next ≥ upc), werden volle Kisten in
 *    den Kistenzähler übertragen. Funktioniert auch für sehr große
 *    delta-Werte (z.B. Tastatureingabe).
 *
 * Liefert immer einen *neuen* State zurück — der Aufrufer entscheidet,
 * ob/wie er ihn auf das ursprüngliche Objekt zurückschreibt.
 */
export function stepBottleInCrate(
  state: CrateBottleState,
  delta: number,
  unitsPerCrate: number,
): CrateBottleState {
  if (unitsPerCrate < 1) {
    // Keine Kisten definiert → behandle alles als Flaschen, ohne Carry.
    return { crates: state.crates, bottles: Math.max(0, state.bottles + delta) }
  }
  const next = state.bottles + delta
  if (next < 0) {
    if (state.crates > 0) {
      return { crates: state.crates - 1, bottles: unitsPerCrate - 1 }
    }
    return { crates: 0, bottles: 0 }
  }
  if (next >= unitsPerCrate) {
    const extraCrates = Math.floor(next / unitsPerCrate)
    return {
      crates: state.crates + extraCrates,
      bottles: next - extraCrates * unitsPerCrate,
    }
  }
  return { crates: state.crates, bottles: next }
}
