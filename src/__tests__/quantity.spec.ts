import { describe, it, expect } from 'vitest'
import { parseQty, qtyEquals, normalizeQty } from '../utils/quantity'

describe('parseQty', () => {
  it('parses integer strings', () => {
    expect(parseQty('40')).toBe(40)
  })

  it('parses decimal strings', () => {
    expect(parseQty('40.00')).toBe(40)
    expect(parseQty('7.50')).toBe(7.5)
  })

  it('handles numbers', () => {
    expect(parseQty(40)).toBe(40)
    expect(parseQty(7.5)).toBe(7.5)
  })

  it('returns 0 for null/undefined/empty', () => {
    expect(parseQty(null)).toBe(0)
    expect(parseQty(undefined)).toBe(0)
    expect(parseQty('')).toBe(0)
  })

  it('returns 0 for NaN strings', () => {
    expect(parseQty('abc')).toBe(0)
  })
})

describe('qtyEquals', () => {
  it('treats "40.00" and "40" as equal', () => {
    expect(qtyEquals('40.00', '40')).toBe(true)
  })

  it('treats "7.50" and "7.5" as equal', () => {
    expect(qtyEquals('7.50', '7.5')).toBe(true)
  })

  it('treats number 40 and string "40.00" as equal', () => {
    expect(qtyEquals(40, '40.00')).toBe(true)
  })

  it('treats 0, "0", "0.00", null, undefined as equal', () => {
    expect(qtyEquals(0, '0')).toBe(true)
    expect(qtyEquals('0.00', null)).toBe(true)
    expect(qtyEquals(undefined, '0')).toBe(true)
  })

  it('detects actual differences', () => {
    expect(qtyEquals('40', '39')).toBe(false)
    expect(qtyEquals('7.5', '7')).toBe(false)
  })
})

describe('normalizeQty', () => {
  it('strips trailing .00', () => {
    expect(normalizeQty('40.00')).toBe('40')
  })

  it('strips trailing .0 but keeps .5', () => {
    expect(normalizeQty('7.50')).toBe('7.5')
    expect(normalizeQty('7.5')).toBe('7.5')
  })

  it('returns "0" for falsy values', () => {
    expect(normalizeQty(null)).toBe('0')
    expect(normalizeQty(undefined)).toBe('0')
    expect(normalizeQty('')).toBe('0')
  })

  it('handles integers', () => {
    expect(normalizeQty(40)).toBe('40')
    expect(normalizeQty('10')).toBe('10')
  })
})
