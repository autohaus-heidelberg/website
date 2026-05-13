import { describe, it, expect } from 'vitest'
import { eventHash, convertToYouTubeEmbed, extractBandcampEmbedUrl } from '../utils'

describe('eventHash', () => {
  it('produces a consistent hash for same event', () => {
    const event = { date: '2026-05-20', title: 'Bats' } as any
    expect(eventHash(event)).toBe(eventHash(event))
  })

  it('produces different hashes for different events', () => {
    const a = { date: '2026-05-20', title: 'Bats' } as any
    const b = { date: '2026-05-20', title: 'Crocodiles' } as any
    expect(eventHash(a)).not.toBe(eventHash(b))
  })

  it('returns a string', () => {
    const event = { date: '2026-01-01', title: 'Test' } as any
    expect(typeof eventHash(event)).toBe('string')
  })
})

describe('convertToYouTubeEmbed', () => {
  it('converts standard watch URL', () => {
    expect(convertToYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('converts short youtu.be URL', () => {
    expect(convertToYouTubeEmbed('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('returns embed URL as-is (strips query params)', () => {
    expect(convertToYouTubeEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('handles empty string', () => {
    expect(convertToYouTubeEmbed('')).toBe('')
  })

  it('returns unrecognized URLs unchanged', () => {
    expect(convertToYouTubeEmbed('https://vimeo.com/12345'))
      .toBe('https://vimeo.com/12345')
  })

  it('handles watch URL with extra params', () => {
    expect(convertToYouTubeEmbed('https://www.youtube.com/watch?v=abc123&t=30'))
      .toBe('https://www.youtube.com/embed/abc123')
  })

  it('handles youtu.be URL with query params', () => {
    expect(convertToYouTubeEmbed('https://youtu.be/abc123?t=30'))
      .toBe('https://www.youtube.com/embed/abc123')
  })

  it('trims whitespace', () => {
    expect(convertToYouTubeEmbed('  https://youtu.be/abc123  '))
      .toBe('https://www.youtube.com/embed/abc123')
  })
})

describe('extractBandcampEmbedUrl', () => {
  it('returns null for empty input', () => {
    expect(extractBandcampEmbedUrl('')).toBeNull()
  })

  it('returns null for null-like input', () => {
    expect(extractBandcampEmbedUrl(null as any)).toBeNull()
  })

  it('returns direct EmbeddedPlayer URL as-is', () => {
    const url = 'https://bandcamp.com/EmbeddedPlayer/album=123/size=large/'
    expect(extractBandcampEmbedUrl(url)).toBe(url)
  })

  it('extracts URL from iframe embed code (double quotes)', () => {
    const iframe = '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=123/size=large/" width="350" height="470"></iframe>'
    expect(extractBandcampEmbedUrl(iframe))
      .toBe('https://bandcamp.com/EmbeddedPlayer/album=123/size=large/')
  })

  it('extracts URL from iframe embed code (single quotes)', () => {
    const iframe = "<iframe src='https://bandcamp.com/EmbeddedPlayer/album=456/' width='350'></iframe>"
    expect(extractBandcampEmbedUrl(iframe))
      .toBe('https://bandcamp.com/EmbeddedPlayer/album=456/')
  })

  it('returns null for unrelated URLs', () => {
    expect(extractBandcampEmbedUrl('https://example.com/something')).toBeNull()
  })

  it('trims whitespace', () => {
    const url = '  https://bandcamp.com/EmbeddedPlayer/album=789/  '
    expect(extractBandcampEmbedUrl(url))
      .toBe('https://bandcamp.com/EmbeddedPlayer/album=789/')
  })
})
