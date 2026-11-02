import { describe, it, expect } from 'vitest'
import { detectPrePayoutCount, detectCashShortfall } from '@/utils/cashCount'

// Kassenzählung: 1044 Gesamt, davon 200 Wechselgeld; 460 Gage aus der Einlasskasse.
const count = { total: 1044, changeMoney: 200, fees: 0, payouts: 460 }

describe('detectPrePayoutCount', () => {
  it('warnt, wenn der Rechner Bargeld inkl. Wechselgeld enthält und das zweite Feld es abzieht (Geisterbahn)', () => {
    const w = detectPrePayoutCount({ ...count, calcCash: 1044, calcChange: 200 })
    expect(w).toEqual({ countedNet: 844, correctedTotal: 584, correctedFrozen: 1504, payouts: 460 })
  })

  it('warnt auch, wenn das Wechselgeld im Bargeld-Feld schon herausgerechnet wurde', () => {
    const w = detectPrePayoutCount({ ...count, calcCash: 844, calcChange: 0 })
    expect(w).toEqual({ countedNet: 844, correctedTotal: 584, correctedFrozen: 1304, payouts: 460 })
  })

  it('warnt nicht, wenn nach der Auszahlung gezählt wurde', () => {
    expect(detectPrePayoutCount({ ...count, total: 584, calcCash: 1044, calcChange: 200 })).toBeNull()
    expect(detectPrePayoutCount({ ...count, total: 584, calcCash: 844, calcChange: 0 })).toBeNull()
  })

  it('warnt nicht ohne Auszahlung aus der Einlasskasse', () => {
    expect(detectPrePayoutCount({ ...count, payouts: 0, calcCash: 1044, calcChange: 200 })).toBeNull()
  })

  it('warnt nicht bei leerer Kassenzählung', () => {
    expect(detectPrePayoutCount({ ...count, total: 0, changeMoney: 0, calcCash: 0, calcChange: 0 })).toBeNull()
  })

  it('berücksichtigt Gebühren und Rundung', () => {
    const w = detectPrePayoutCount({ ...count, fees: 0.5, calcCash: 1043.5, calcChange: 200 })
    expect(w?.correctedTotal).toBe(584)
    expect(w?.correctedFrozen).toBe(1503.5)
  })

  it('korrigiert nicht auf negative Beträge', () => {
    expect(detectPrePayoutCount({ ...count, payouts: 2000, calcCash: 1044, calcChange: 200 })).toBeNull()
  })
})

describe('detectCashShortfall', () => {
  it('meldet die Differenz, wenn mehr ausgezahlt wurde als verfügbar war', () => {
    expect(detectCashShortfall(919, 844)).toEqual({ payouts: 919, available: 844, shortfall: 75 })
  })

  it('schweigt, wenn der Bestand reicht', () => {
    expect(detectCashShortfall(460, 844)).toBeNull()
    expect(detectCashShortfall(844, 844)).toBeNull()
  })

  it('schweigt ohne bekannten Kassenstand oder ohne Auszahlung', () => {
    expect(detectCashShortfall(460, null)).toBeNull()
    expect(detectCashShortfall(0, 100)).toBeNull()
  })

  it('rechnet einen negativen Bestand als 0 verfügbar', () => {
    expect(detectCashShortfall(100, -20)).toEqual({ payouts: 100, available: 0, shortfall: 100 })
  })
})
