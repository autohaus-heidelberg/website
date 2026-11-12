import { describe, it, expect } from 'vitest'
import { PLAKETTE_TAPS, nextInspection } from '../utils/plakette'

describe('plakette', () => {
  it('needs several taps so nobody triggers it by accident', () => {
    expect(PLAKETTE_TAPS).toBeGreaterThanOrEqual(3)
  })

  it('schedules the next inspection two years ahead as MM/YY', () => {
    expect(nextInspection(new Date(2026, 10, 12))).toBe('11/28')
    expect(nextInspection(new Date(2099, 0, 1))).toBe('01/01')
  })
})
