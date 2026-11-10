import { describe, it, expect } from 'vitest'
import { mergeById } from '../utils/localPreview'

describe('mergeById', () => {
  const published = [{ id: 'a', t: 'alt' }, { id: 'b', t: 'alt' }]

  it('returns the published list unchanged without local entries', () => {
    expect(mergeById(published, undefined)).toBe(published)
    expect(mergeById(published, [])).toBe(published)
  })

  it('adds new local entries and lets local win on the same id', () => {
    const merged = mergeById(published, [{ id: 'b', t: 'lokal' }, { id: 'c', t: 'lokal' }])
    expect(merged).toEqual([{ id: 'a', t: 'alt' }, { id: 'b', t: 'lokal' }, { id: 'c', t: 'lokal' }])
  })
})
