import { describe, it, expect } from 'vitest'
import {
  splitMode,
  splitQuantity,
  joinQuantity,
  stepMinor,
  normalizeSplit,
} from '../utils/inventoryStep'

const CRATE = { minorPerMajor: 20, minorSize: 1 }
const QUARTERS = { minorPerMajor: 4, minorSize: 0.25 }

describe('splitMode', () => {
  it('uses crates for crate drinks, regardless of portions', () => {
    expect(splitMode({ units_per_crate: 20 })).toEqual(CRATE)
    // Kiste schlaegt Portion: ein Kistengetraenk wird immer in K/Fl gezaehlt.
    expect(splitMode({ units_per_crate: 6, portions_per_bottle: 35 })).toEqual({
      minorPerMajor: 6,
      minorSize: 1,
    })
  })

  it('uses quarters for portion drinks sold as single bottles', () => {
    // Vodka (35 Shots) und Wein (3 Glaeser) bekommen dasselbe Viertel-Raster.
    // Bewusst NICHT 1/portions — das waeren 0,0286er-Schritte bei portions=35.
    expect(splitMode({ units_per_crate: 1, portions_per_bottle: 35 })).toEqual(QUARTERS)
    expect(splitMode({ portions_per_bottle: 3 })).toEqual(QUARTERS)
    expect(splitMode({ portions_per_bottle: 2 })).toEqual(QUARTERS)
  })

  it('returns null for whole-bottle drinks (Piccolo & Co.)', () => {
    // Kein Split -> die UI zeigt ein einziges Ganzzahlfeld.
    expect(splitMode({})).toBeNull()
    expect(splitMode({ units_per_crate: 1 })).toBeNull()
    expect(splitMode({ portions_per_bottle: null })).toBeNull()
    expect(splitMode({ portions_per_bottle: 0 })).toBeNull()
    expect(splitMode({ portions_per_bottle: 1 })).toBeNull()
  })
})

describe('splitQuantity / joinQuantity', () => {
  it('round-trips quarter values exactly', () => {
    for (const total of [0, 19, 19.25, 19.5, 19.75, 20]) {
      expect(joinQuantity(splitQuantity(total, QUARTERS), QUARTERS)).toBe(total)
    }
  })

  it('maps quarters to integer minor counts', () => {
    expect(splitQuantity(19, QUARTERS)).toEqual({ major: 19, minor: 0 })
    expect(splitQuantity(19.25, QUARTERS)).toEqual({ major: 19, minor: 1 })
    expect(splitQuantity(19.5, QUARTERS)).toEqual({ major: 19, minor: 2 })
    expect(splitQuantity(19.75, QUARTERS)).toEqual({ major: 19, minor: 3 })
  })

  it('keeps off-grid legacy values fractional instead of silently rounding', () => {
    // 19,1 Flaschen = 19 Flaschen + 0,4 Viertel. Die UI zeigt dafuer KEIN
    // aktives Segment und rastet erst beim ersten Klick ein — sonst wuerden
    // wir Bestaende verschieben, die niemand angefasst hat.
    expect(splitQuantity(19.1, QUARTERS)).toEqual({ major: 19, minor: 0.4 })
    expect(joinQuantity(splitQuantity(19.1, QUARTERS), QUARTERS)).toBe(19.1)
  })

  it('splits crate quantities into crates + loose bottles', () => {
    expect(splitQuantity(48, CRATE)).toEqual({ major: 2, minor: 8 })
    expect(splitQuantity(40, CRATE)).toEqual({ major: 2, minor: 0 })
    expect(joinQuantity({ major: 2, minor: 8 }, CRATE)).toBe(48)
  })

  it('treats non-numeric input as zero', () => {
    expect(splitQuantity(NaN, QUARTERS)).toEqual({ major: 0, minor: 0 })
    expect(joinQuantity({ major: 3, minor: NaN }, QUARTERS)).toBe(3)
  })
})

describe('stepMinor', () => {
  it('decrements the minor counter within the same major unit', () => {
    expect(stepMinor({ major: 2, minor: 5 }, -1, 20)).toEqual({ major: 2, minor: 4 })
  })

  it('increments the minor counter within the same major unit', () => {
    expect(stepMinor({ major: 2, minor: 5 }, 1, 20)).toEqual({ major: 2, minor: 6 })
  })

  // ── Carry-Over nach unten ──────────────────────────────────────────
  it('carries into the next crate down when bottles reach zero', () => {
    // upc=20, (1 Kiste, 0 Fl.), Klick "−" -> (0 K, 19 Fl.)
    expect(stepMinor({ major: 1, minor: 0 }, -1, 20)).toEqual({ major: 0, minor: 19 })
  })

  it('carries into the next bottle down when quarters reach zero', () => {
    // (19 Fl., 0 Viertel), Klick "−" -> (18 Fl., drei Viertel)
    expect(stepMinor({ major: 19, minor: 0 }, -1, 4)).toEqual({ major: 18, minor: 3 })
  })

  it('clamps at zero when no major units are left to borrow from', () => {
    expect(stepMinor({ major: 0, minor: 0 }, -1, 20)).toEqual({ major: 0, minor: 0 })
    expect(stepMinor({ major: 0, minor: 0 }, -1, 4)).toEqual({ major: 0, minor: 0 })
  })

  // ── Carry-Over nach oben ───────────────────────────────────────────
  it('carries up when the minor counter would reach its limit', () => {
    expect(stepMinor({ major: 0, minor: 19 }, 1, 20)).toEqual({ major: 1, minor: 0 })
    // (19 Fl., drei Viertel), Klick "+" -> (20 Fl., 0 Viertel)
    expect(stepMinor({ major: 19, minor: 3 }, 1, 4)).toEqual({ major: 20, minor: 0 })
  })

  it('handles multi-unit overflow (e.g. direct keyboard input of 25 at upc=20)', () => {
    expect(stepMinor({ major: 0, minor: 0 }, 25, 20)).toEqual({ major: 1, minor: 5 })
  })

  it('treats minorPerMajor < 1 as "no carry semantics"', () => {
    expect(stepMinor({ major: 0, minor: 3 }, -1, 0)).toEqual({ major: 0, minor: 2 })
    expect(stepMinor({ major: 0, minor: 0 }, -1, 0)).toEqual({ major: 0, minor: 0 })
  })
})

describe('normalizeSplit', () => {
  // Wert kommt vom Spin-Button, Pfeiltasten oder Tippen — ist also ein bereits
  // gesetzter Stand, kein Delta. Haupteinheiten bleiben erhalten.

  it('rolls minor overflow into one more major unit (at 20 with upc=20)', () => {
    expect(normalizeSplit({ major: 0, minor: 20 }, 20)).toEqual({ major: 1, minor: 0 })
  })

  it('rolls quarter overflow into one more bottle', () => {
    expect(normalizeSplit({ major: 19, minor: 4 }, 4)).toEqual({ major: 20, minor: 0 })
  })

  it('rolls multi-unit overflow when the user pastes a huge number', () => {
    // 45 Flaschen in einem 6er-Kisten-Drink -> 7 Kisten + 3 Flaschen.
    expect(normalizeSplit({ major: 0, minor: 45 }, 6)).toEqual({ major: 7, minor: 3 })
  })

  it('preserves existing major units when normalising (additive)', () => {
    expect(normalizeSplit({ major: 1, minor: 6 }, 6)).toEqual({ major: 2, minor: 0 })
  })

  it('borrows one major unit when the minor is pushed below 0', () => {
    expect(normalizeSplit({ major: 1, minor: -1 }, 6)).toEqual({ major: 0, minor: 5 })
    expect(normalizeSplit({ major: 19, minor: -1 }, 4)).toEqual({ major: 18, minor: 3 })
  })

  it('borrows multiple major units for large negative input', () => {
    // 3 Kisten, User tippt "−7" -> borgt 2 Kisten: 1 K, 5 Fl.
    expect(normalizeSplit({ major: 3, minor: -7 }, 6)).toEqual({ major: 1, minor: 5 })
  })

  it('clamps at zero when there is nothing to borrow from', () => {
    expect(normalizeSplit({ major: 0, minor: -1 }, 6)).toEqual({ major: 0, minor: 0 })
  })

  it('leaves a valid in-range split untouched', () => {
    const s = { major: 2, minor: 3 }
    expect(normalizeSplit(s, 6)).toEqual(s)
  })

  it('leaves a non-numeric minor value untouched (mid-typing empty field)', () => {
    // v-model.number reicht '' bei geleertem Feld durch — wir duerfen nicht auf
    // 0 zurueckspringen, sonst klemmt der Cursor beim Tippen.
    const s = { major: 2, minor: NaN }
    expect(normalizeSplit(s, 6)).toBe(s)
  })

  // Regression: Tippen im Nebeneinheiten-Feld darf die Haupteinheiten NICHT
  // auf 0 zuruecksetzen. Frueher interpretierte das Tippen die Zahl als
  // Gesamtmenge: bei "3 Kisten" eine "1" tippen sprang auf 0 Kisten.
  it('preserves existing major units when typing a small in-range minor value', () => {
    expect(normalizeSplit({ major: 3, minor: 1 }, 20)).toEqual({ major: 3, minor: 1 })
    expect(normalizeSplit({ major: 3, minor: 14 }, 20)).toEqual({ major: 3, minor: 14 })
  })
})
