import { describe, it, expect } from 'vitest'
import { detectPrePayoutCount, detectCashShortfall } from '@/utils/cashCount'

const base = { fees: 0, payouts: 460 }

describe('detectPrePayoutCount', () => {
  it('warnt, wenn die Zählung dem eingefrorenen Stand vor der Auszahlung entspricht (Geisterbahn)', () => {
    const w = detectPrePayoutCount({ ...base, frozenCash: 1044, total: 1044 })
    expect(w).toEqual({ countedCash: 1044, correctedTotal: 584, correctedFrozen: 1504, payouts: 460 })
  })

  it('warnt nicht, wenn nach der Auszahlung gezählt wurde', () => {
    expect(detectPrePayoutCount({ ...base, frozenCash: 1044, total: 584 })).toBeNull()
  })

  it('vergleicht inkl. Wechselgeld (Rechner zieht es erst im zweiten Feld ab)', () => {
    // Netto ohne 200 € Wechselgeld (844) ist nicht derselbe Stand wie 1044 im Rechner.
    expect(detectPrePayoutCount({ ...base, frozenCash: 1044, total: 844 })).toBeNull()
  })

  it('warnt nicht ohne Auszahlung aus der Einlasskasse', () => {
    expect(detectPrePayoutCount({ ...base, payouts: 0, frozenCash: 1044, total: 1044 })).toBeNull()
  })

  it('warnt nicht bei leerer Kassenzählung', () => {
    expect(detectPrePayoutCount({ ...base, frozenCash: 0, total: 0 })).toBeNull()
  })

  it('berücksichtigt Gebühren und Rundung', () => {
    const w = detectPrePayoutCount({ frozenCash: 1043.5, total: 1044, fees: 0.5, payouts: 460 })
    expect(w?.correctedTotal).toBe(584)
    expect(w?.correctedFrozen).toBe(1503.5)
  })

  it('korrigiert nicht auf negative Beträge', () => {
    expect(detectPrePayoutCount({ ...base, payouts: 2000, frozenCash: 1044, total: 1044 })).toBeNull()
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
