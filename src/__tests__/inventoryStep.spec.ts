import { describe, it, expect } from 'vitest'
import { bottleStep, stepBottleInCrate, applyBottleStep } from '../utils/inventoryStep'

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
