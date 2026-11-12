import { describe, it, expect } from 'vitest'
import { claim } from '../utils/claims'

describe('claim', () => {
  it('has plain text and exactly one censored part', () => {
    expect(claim.some(p => 'text' in p)).toBe(true)
    expect(claim.filter(p => 'censor' in p)).toHaveLength(1)
  })

  it('never mentions a single organizer brand', () => {
    expect(JSON.stringify(claim)).not.toMatch(/goldesel/i)
  })
})
