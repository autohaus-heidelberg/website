import { describe, it, expect } from 'vitest'
import { classifyPurchaseHint, type PurchaseHintInput } from '@/utils/purchaseAfterEvent'

// Pils, 20er Kiste: üblich Ø 100 Fl. pro Event, ab 180 „ungewöhnlich hoch“.
const base: PurchaseHintInput = {
  deducted: false,
  counted: true,
  countedAfter: 143,
  consumed: 0,
  purchaseQty: 100,
  baseline: { mean: 100, threshold: 180 },
}

const classify = (over: Partial<PurchaseHintInput>) => classifyPurchaseHint({ ...base, ...over })

describe('classifyPurchaseHint', () => {
  it('flags an overcount as almost certainly counted along', () => {
    expect(classify({ consumed: -40 })).toMatchObject({ level: 'likely', reason: 'overcount', consumedIfDeducted: 60 })
  })

  it('flags unusually low consumption that becomes normal with the deduction', () => {
    expect(classify({ consumed: 20 })).toMatchObject({ level: 'likely', reason: 'low_without', consumedIfDeducted: 120 })
  })

  it('advises against deducting when that would make consumption unusually high', () => {
    expect(classify({ consumed: 90 })).toMatchObject({ level: 'unlikely', reason: 'too_high_with' })
  })

  it('cannot have been counted along when the rest is smaller than the purchase', () => {
    expect(classify({ countedAfter: 60, consumed: 43 })).toMatchObject({ level: 'unlikely', reason: 'rest_too_small' })
  })

  it('is unclear when the numbers fit both ways or there is no history', () => {
    expect(classify({ consumed: 60 }).level).toBe('unclear')
    expect(classify({ consumed: 20, baseline: null }).level).toBe('unclear')
  })

  it('reports deducted and not-yet-counted states before looking at numbers', () => {
    expect(classify({ deducted: true, consumed: -40 }).level).toBe('deducted')
    expect(classify({ counted: false, consumed: -40 }).level).toBe('pending')
  })
})
