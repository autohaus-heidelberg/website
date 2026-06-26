import { describe, it, expect } from 'vitest'
import { bottleStep, stepBottleInCrate } from '../utils/inventoryStep'

describe('bottleStep', () => {
  it('returns 1 for whole-bottle drinks (no portions defined)', () => {
    // Piccolo, Wein, Bier-Einzelflasche → ganze Flaschen, kein 0.1/0.25.
    expect(bottleStep({})).toBe(1)
    expect(bottleStep({ portions_per_bottle: null })).toBe(1)
    expect(bottleStep({ portions_per_bottle: 0 })).toBe(1)
    expect(bottleStep({ portions_per_bottle: 1 })).toBe(1)
  })

  it('returns 1 / portions_per_bottle for portion-based drinks', () => {
    // Spirituose mit 20 Portionen (0.04 L) pro Flasche → 0.05er Schritte.
    expect(bottleStep({ portions_per_bottle: 20 })).toBeCloseTo(0.05)
    expect(bottleStep({ portions_per_bottle: 10 })).toBeCloseTo(0.1)
    expect(bottleStep({ portions_per_bottle: 4 })).toBeCloseTo(0.25)
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
