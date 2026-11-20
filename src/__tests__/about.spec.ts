import { describe, it, expect } from 'vitest'
import { aboutTexts } from '../utils/about'

describe('aboutTexts', () => {
  it('has a title and at least two paragraphs in every language', () => {
    for (const text of Object.values(aboutTexts)) {
      expect(text.title.length).toBeGreaterThan(0)
      expect(text.paragraphs.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('names the association and gives the address where visitors need it', () => {
    expect(aboutTexts.de.paragraphs.join(' ')).toContain('Carousel e.V.')
    expect(aboutTexts.en.paragraphs.join(' ')).toContain('Carousel e.V.')
    expect(aboutTexts.en.paragraphs.join(' ')).toContain('Hebelstraße 7')
  })
})
