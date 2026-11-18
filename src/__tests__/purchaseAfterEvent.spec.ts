import { describe, it, expect } from 'vitest'
import { classifyPurchaseHint, type PurchaseHintInput } from '@/utils/purchaseAfterEvent'

const base: PurchaseHintInput = {
  deducted: false,
  counted: true,
  countedAfter: 143,
  consumed: 0,
  purchaseQty: 100,
}

const classify = (over: Partial<PurchaseHintInput>) => classifyPurchaseHint({ ...base, ...over })

describe('classifyPurchaseHint', () => {
  it('flags an overcount as certainly counted along', () => {
    expect(classify({ consumed: -40 })).toEqual({ level: 'likely', reason: 'overcount' })
  })

  it('knows the purchase is not in the current count when the rest is smaller than the purchase', () => {
    // Gilt auch nach händischer Korrektur: 185 gezählt − 100 abgezogen = 85 < 100.
    expect(classify({ countedAfter: 60, consumed: 43 })).toEqual({ level: 'unlikely', reason: 'rest_too_small' })
  })

  it('stays unclear for any plausible consumption, however low or high', () => {
    // Ruhiger Abend (Montags-Show) ist normal und kein Indiz für einen mitgezählten Einkauf.
    for (const consumed of [0, 3, 20, 60, 150, 400]) {
      expect(classify({ consumed }).level).toBe('unclear')
    }
  })

  it('reports deducted and not-yet-counted states before looking at numbers', () => {
    expect(classify({ deducted: true, consumed: -40 }).level).toBe('deducted')
    expect(classify({ counted: false, consumed: -40 }).level).toBe('pending')
  })
})
