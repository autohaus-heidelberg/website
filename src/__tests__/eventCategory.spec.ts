import { describe, expect, it } from 'vitest'
import { categoriesIn, categoryLabel } from '../utils/eventCategory'

describe('eventCategory', () => {
  it('labels known categories and ignores missing or unknown ones', () => {
    expect(categoryLabel({ category: 'film' })).toBe('Kino')
    expect(categoryLabel({ category: '' })).toBe('')
    expect(categoryLabel({})).toBe('')
    expect(categoryLabel({ category: 'bogus' })).toBe('')
  })

  it('lists used categories in fixed order', () => {
    const list = categoriesIn([{ category: 'workshop' }, { category: 'concert' }, { category: '' }, { category: 'workshop' }])
    expect(list.map(c => c.value)).toEqual(['concert', 'workshop'])
  })
})
