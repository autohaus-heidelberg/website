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
   * Anzahl Portionen pro Flasche (z.B. 35 für Vodka-Shots à 0,02L). Wenn
   * gesetzt (≥ 2), markiert das den Drink als "wird auch portionsweise
   * ausgeschenkt" → wir bieten 0,25er-Schritte im Stepper an, damit
   * angebrochene Flaschen sauber gepflegt werden können. Andernfalls
   * (null / 0 / 1) wird der Drink flaschenweise verkauft → ganze
   * Flaschen pro Klick.
   */
  portions_per_bottle?: number | null
}

/**
 * Schrittweite des Flaschen-Steppers für ein Getränk, das in Einzelflaschen
 * geführt wird (units_per_crate ≤ 1).
 *
 * Heuristik:
 *  • Drink hat KEINE portions_per_bottle hinterlegt → Schritt = 1
 *    (Piccolo, Sekt, Wein, Bier-Einzelflasche etc. werden immer
 *    flaschenweise verkauft, also auch flaschenweise gezählt).
 *  • Drink HAT eine portions_per_bottle (Spirituose) → Schritt = 0,25
 *    Flasche. Das ist die grobe Granularität, in der angebrochene
 *    Flaschen üblicherweise nachgepflegt werden ("noch ¾ voll").
 *    Wir nutzen ABSICHTLICH nicht 1/portions, weil das für portions=35
 *    (Vodka-Shots) absurd kleine Schritte (0,0286) und floatige Werte
 *    wie 5,28571 produziert.
 */
export function bottleStep(beverage: BottleStepBeverage): number {
  const portions = beverage.portions_per_bottle ?? 0
  if (portions >= 2) return 0.25
  return 1
}

/**
 * Wendet einen ±delta-Klick auf einen Flaschen-Zähler (Einzelflaschen-
 * Modus, units_per_crate ≤ 1) an.
 *
 * Wichtige Designentscheidung: wir runden NUR das Ergebnis auf 4
 * Nachkommastellen (gegen Float-Drift) und klemmen es bei 0. Wir snappen
 * den aktuellen Wert NICHT aufs Step-Grid — der Server-Bestand liegt
 * selten exakt auf einem 0,25er-Vielfachen, und ein Snap würde den
 * "−"-Klick paradox aussehen lassen (z.B. 5,29 → 5,25 statt 5,04).
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

/**
 * Normalisiert einen Kisten/Flaschen-State, nachdem der Flaschenzähler
 * *direkt* gesetzt wurde (Tippen, Paste, native ▲▼-Spin-Buttons).
 * Anders als `stepBottleInCrate` arbeiten wir hier nicht mit einem
 * Delta, sondern mit dem bereits gesetzten Wert.
 *
 * Zwei Modi:
 *
 * `'increment'` (Default — Spin-Button, Tastatur-Pfeile, alle Wege bei
 * denen die Zahl ein Delta gegen den bestehenden State ist):
 *  • bottles ≥ upc           → so viele volle Kisten wie möglich hochrollen
 *  • bottles < 0             → so viele Kisten wie nötig "borrowen"
 *  • 0 ≤ bottles < upc       → State bleibt unverändert
 *  • bottles ist kein Number → State bleibt unverändert (User tippt
 *    gerade, leeres Feld ist OK — nicht auf 0 zurückspringen, sonst
 *    klemmt der Cursor)
 *
 * `'absolute'` (Direkteingabe im Flaschen-Feld): die Zahl meint die
 * *Gesamtmenge an Flaschen* für diesen Eintrag, der bisherige
 * Kisten-Counter wird verworfen und neu berechnet. Damit wirken
 * Korrekturen wie "ich tippe erst 45, dann 36" nicht additiv.
 *
 * Liefert immer einen *neuen* State. Wird in AccountingView.vue im
 * @input-/@change-Handler der Flaschen-Inputs aufgerufen.
 */
export function normalizeCrateBottleState(
  state: CrateBottleState,
  unitsPerCrate: number,
  mode: 'increment' | 'absolute' = 'increment',
): CrateBottleState {
  if (unitsPerCrate < 1) return state
  if (!Number.isFinite(state.bottles)) return state
  const b = state.bottles
  if (mode === 'absolute') {
    if (b < 0) return { crates: 0, bottles: 0 }
    const extra = Math.floor(b / unitsPerCrate)
    return { crates: extra, bottles: b - extra * unitsPerCrate }
  }
  if (b >= unitsPerCrate) {
    const extra = Math.floor(b / unitsPerCrate)
    return {
      crates: state.crates + extra,
      bottles: b - extra * unitsPerCrate,
    }
  }
  if (b < 0) {
    // Robust gegen große Negativ-Eingaben (z.B. User tippt −7): so viele
    // Kisten borgen, wie nötig — und bei 0 hart clampen.
    let nb = b
    let nc = state.crates
    while (nb < 0 && nc > 0) {
      nc -= 1
      nb += unitsPerCrate
    }
    if (nb < 0) nb = 0
    return { crates: nc, bottles: nb }
  }
  return state
}
