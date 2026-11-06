import { describe, it, expect } from 'vitest'
import { communityOnly, concertsOnly, isCommunity } from '../utils/community'

const events = [
  { id: 'a' },
  { id: 'b', type: 'concert' },
  { id: 'c', type: 'community' },
]

describe('community helpers', () => {
  it('treats missing type as concert', () => {
    expect(isCommunity(events[0])).toBe(false)
    expect(isCommunity(events[1])).toBe(false)
    expect(isCommunity(events[2])).toBe(true)
  })

  it('splits events into concerts and community meetings', () => {
    expect(concertsOnly(events).map(e => e.id)).toEqual(['a', 'b'])
    expect(communityOnly(events).map(e => e.id)).toEqual(['c'])
  })
})
