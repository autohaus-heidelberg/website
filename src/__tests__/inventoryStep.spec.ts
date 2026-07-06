import { describe, it, expect } from 'vitest'
import {
  bottleStep,
  stepBottleInCrate,
  applyBottleStep,
  normalizeCrateBottleState,
} from '../utils/inventoryStep'

describe('bottleStep', () => {
  it('returns 1 for whole-bottle drinks (no portions defined)', () => {
    // Piccolo, Wein, Bier-Einzelflasche → ganze Flaschen.
    expect(bottleStep({})).toBe(1)
    expect(bottleStep({ portions_per_bottle: null })).toBe(1)
    expect(bottleStep({ portions_per_bottle: 0 })).toBe(1)
    expect(bottleStep({ portions_per_bottle: 1 })).toBe(1)
  })

  it('returns 0.25 for portion-based drinks (spirits) regardless of portions count', () => {
    // Vodka mit 35 Shots oder Wein mit 3 Gläsern → einheitlich 0.25er
    // Schritte. NICHT 1/portions: das würde absurd kleine Schritte
    // produzieren (z.B. 0.0286 für portions=35) und Werte wie
    // 5.28571 in der UI hinterlassen.
    expect(bottleStep({ portions_per_bottle: 2 })).toBe(0.25)
    expect(bottleStep({ portions_per_bottle: 3 })).toBe(0.25)
    expect(bottleStep({ portions_per_bottle: 20 })).toBe(0.25)
    expect(bottleStep({ portions_per_bottle: 35 })).toBe(0.25)
  })
})

describe('stepBottleInCrate', () => {
  // ── Glücksfall: keine Carry-Over-Grenze überschritten ───────────────
  it('decrements bottles within the same crate', () => {
    expect(stepBottleInCrate({ crates: 2, bottles: 5 }, -1, 20)).toEqual({
      crates: 2,
      bottles: 4,
    })
  })

  it('increments bottles within the same crate', () => {
    expect(stepBottleInCrate({ crates: 2, bottles: 5 }, 1, 20)).toEqual({
      crates: 2,
      bottles: 6,
    })
  })

  // ── Carry-Over nach unten: "− auf 0 Fl. → 1 Kiste weniger, upc-1 Fl." ─
  it('carries into the next crate down when bottles reach zero', () => {
    // upc=20, state = (1 Kiste, 0 Fl.), klick "−" → (0 K, 19 Fl.)
    expect(stepBottleInCrate({ crates: 1, bottles: 0 }, -1, 20)).toEqual({
      crates: 0,
      bottles: 19,
    })
  })

  it('clamps at zero when no crates left to carry from', () => {
    // upc=20, state = (0 K, 0 Fl.), klick "−" → bleibt (0, 0)
    expect(stepBottleInCrate({ crates: 0, bottles: 0 }, -1, 20)).toEqual({
      crates: 0,
      bottles: 0,
    })
  })

  // ── Carry-Over nach oben: "+ auf upc-1 Fl. → 1 Kiste mehr, 0 Fl." ───
  it('carries into the next crate up when bottles would reach upc', () => {
    // upc=20, state = (0 K, 19 Fl.), klick "+" → (1 K, 0 Fl.)
    expect(stepBottleInCrate({ crates: 0, bottles: 19 }, 1, 20)).toEqual({
      crates: 1,
      bottles: 0,
    })
  })

  it('handles multi-crate overflow (e.g. direct keyboard input of 25 at upc=20)', () => {
    // state.bottles=0, delta=+25, upc=20  →  +1 Kiste und 5 Fl. übrig.
    expect(stepBottleInCrate({ crates: 0, bottles: 0 }, 25, 20)).toEqual({
      crates: 1,
      bottles: 5,
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────
  it('treats units_per_crate < 1 as "no crate semantics" (no carry)', () => {
    // Degenerate path: when AccountingView falls through to upc=1 it does
    // *not* call stepBottleInCrate (it uses the bottle branch instead).
    // For upc < 1 we keep a safe fallback: clamp at zero, no carry.
    expect(stepBottleInCrate({ crates: 0, bottles: 3 }, -1, 0)).toEqual({
      crates: 0,
      bottles: 2,
    })
    expect(stepBottleInCrate({ crates: 0, bottles: 0 }, -1, 0)).toEqual({
      crates: 0,
      bottles: 0,
    })
  })
})

describe('applyBottleStep', () => {
  // ── Whole-bottle drinks (portions=null/1) — Piccolo, Wein, Bier ─────
  it('decrements by 1 for whole-bottle drinks', () => {
    expect(applyBottleStep(12, -1, {})).toBe(11)
    expect(applyBottleStep(12, -1, { portions_per_bottle: null })).toBe(11)
    expect(applyBottleStep(12, -1, { portions_per_bottle: 1 })).toBe(11)
  })

  it('clamps at zero for whole-bottle drinks', () => {
    expect(applyBottleStep(0, -1, {})).toBe(0)
    expect(applyBottleStep(0.4, -1, {})).toBe(0)
  })

  // ── Portion-based drinks: 0.25er-Schritte ─────────────────────────
  // Regression: ein früheres Modell hat den Schritt aus 1/portions
  // berechnet — bei Vodka (portions=35) ergab das den Wert 5.28571 nach
  // einem Klick, was die UI unleserlich machte. Wir fixieren jetzt 0.25.
  it('decrements spirits by 0.25 (Three Sixty Vodka, portions=35)', () => {
    const drink = { portions_per_bottle: 35 }
    // Server-Bestand 5.29 → klick "−" → 5.04
    expect(applyBottleStep(5.29, -1, drink)).toBe(5.04)
    // 5 → klick "−" → 4.75 (vorher: 4.97142857)
    expect(applyBottleStep(5, -1, drink)).toBe(4.75)
  })

  it('decrements wine by 0.25 (Rotwein, portions=3)', () => {
    const drink = { portions_per_bottle: 3 }
    // Server-Bestand 4.67 → klick "−" → 4.42 (vorher: 4.33333)
    expect(applyBottleStep(4.67, -1, drink)).toBe(4.42)
    expect(applyBottleStep(4, -1, drink)).toBe(3.75)
  })

  // ── Klicks akkumulieren ohne Float-Drift (durch Rundung auf 1e-4) ──
  it('accumulates 0.25 steps without unbounded float drift', () => {
    const drink = { portions_per_bottle: 35 }
    let v = 5
    for (let i = 0; i < 4; i++) v = applyBottleStep(v, -1, drink)
    // 5 − 4*0.25 = 4. Ohne Rundung würde Float-Drift z.B. 3.9999… liefern.
    expect(v).toBe(4)
  })

  it('handles positive delta (clicking "+")', () => {
    expect(applyBottleStep(5.29, 1, { portions_per_bottle: 35 })).toBe(5.54)
    expect(applyBottleStep(12, 1, {})).toBe(13)
  })
})

describe('normalizeCrateBottleState (increment mode)', () => {
  // Default-Modus: Wert kommt vom Spin-Button oder Pfeiltasten, ist also
  // ein inkrementeller Stand. Vorhandene Kisten bleiben erhalten.

  it('rolls bottle overflow into one more crate (▲ at 19 with upc=20)', () => {
    // Browser-Spin-Button von 19 → 20 (kein max) → wir wollen (1 K + 0 Fl)
    // statt 20 Flaschen stehen lassen.
    expect(normalizeCrateBottleState({ crates: 0, bottles: 20 }, 20)).toEqual({
      crates: 1,
      bottles: 0,
    })
  })

  it('rolls multi-crate overflow when the user pastes a huge number', () => {
    // 45 Flaschen in einem 6er-Kisten-Drink → 7 Kisten + 3 Flaschen.
    expect(normalizeCrateBottleState({ crates: 0, bottles: 45 }, 6)).toEqual({
      crates: 7,
      bottles: 3,
    })
  })

  it('preserves existing crates when normalising (additive)', () => {
    // Vorher 1 Kiste, Spin-Button schubst bottles auf 6 (=upc) → 2 K, 0 Fl.
    expect(normalizeCrateBottleState({ crates: 1, bottles: 6 }, 6)).toEqual({
      crates: 2,
      bottles: 0,
    })
  })

  it('borrows one crate when ▼ pushes bottles below 0', () => {
    // 1 Kiste, 0 Flaschen, Browser-Spin auf "-1" → 0 K, 5 Fl (bei upc=6).
    expect(normalizeCrateBottleState({ crates: 1, bottles: -1 }, 6)).toEqual({
      crates: 0,
      bottles: 5,
    })
  })

  it('borrows multiple crates for large negative input', () => {
    // 3 Kisten, User tippt "−7" → borgt 2 Kisten: 1 K, -1+6+6 = wait,
    // -7 → +6 = -1 (borrow 1), → +6 = 5 (borrow 2). Ergebnis: 1 K, 5 Fl.
    expect(normalizeCrateBottleState({ crates: 3, bottles: -7 }, 6)).toEqual({
      crates: 1,
      bottles: 5,
    })
  })

  it('clamps at zero when there are no crates to borrow from', () => {
    expect(normalizeCrateBottleState({ crates: 0, bottles: -1 }, 6)).toEqual({
      crates: 0,
      bottles: 0,
    })
  })

  it('leaves a valid in-range state untouched', () => {
    const s = { crates: 2, bottles: 3 }
    expect(normalizeCrateBottleState(s, 6)).toEqual(s)
  })

  it('leaves a non-numeric bottles value untouched (mid-typing empty field)', () => {
    // v-model.number reicht '' bei geleertem Feld durch — wir dürfen
    // nicht auf 0 zurückspringen, sonst klemmt der Cursor beim Tippen.
    const s = { crates: 2, bottles: NaN }
    expect(normalizeCrateBottleState(s, 6)).toBe(s)
  })

  // ── Regression: Tippen einer Zahl im Flaschen-Feld darf die Kisten
  //    NICHT auf 0 zurücksetzen. Früher lief das Tippen im 'absolute'-
  //    Modus, der die getippte Zahl als Gesamtmenge interpretierte:
  //    Tippt man bei "3 Kisten" eine "1", sprangen die Kisten auf 0.
  it('preserves existing crates when typing a small in-range bottle value', () => {
    // Faust Pils (upc=20): 3 Kisten stehen, User tippt "1" (auf dem Weg
    // zu "14") → Kisten bleiben 3, Flaschen = 1.
    expect(normalizeCrateBottleState({ crates: 3, bottles: 1 }, 20)).toEqual({
      crates: 3,
      bottles: 1,
    })
    // ... und nach dem zweiten Tastendruck "14" → weiterhin 3 Kisten.
    expect(normalizeCrateBottleState({ crates: 3, bottles: 14 }, 20)).toEqual({
      crates: 3,
      bottles: 14,
    })
  })
})

