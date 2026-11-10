import { describe, it, expect } from 'vitest'
import { CONTACT_EMAIL, doors, eveningSteps, mailto, support, wantedLine } from '../utils/communityContent'

describe('communityContent', () => {
  it('builds a mailto link with an encoded subject', () => {
    expect(mailto('Helfer:in werden')).toBe(`mailto:${CONTACT_EMAIL}?subject=Helfer%3Ain%20werden`)
  })

  it('has the three doors and every door has an action', () => {
    expect(doors.map(d => d.id)).toEqual(['helfen', 'veranstalten', 'kreativ'])
    for (const d of doors) {
      expect('route' in d.action || 'mail' in d.action).toBe(true)
    }
  })

  it('never publishes Telegram invite links (they are shared personally)', () => {
    const all = JSON.stringify({ doors, eveningSteps, support })
    expect(all).not.toMatch(/t\.me|telegram\.me/i)
  })

  it('does not name individuals or a single organizer brand', () => {
    const all = JSON.stringify({ doors, eveningSteps, support })
    expect(all).not.toMatch(/goldesel/i)
  })

  it('builds the classified ad line from the published requests with a fallback', () => {
    expect(wantedLine(['Bar', ' Ton ', ''])).toBe('Bar, Ton')
    expect(wantedLine([])).toMatch(/Bandessen/)
  })

  it('describes the evening in chronological steps', () => {
    expect(eveningSteps.length).toBeGreaterThanOrEqual(5)
    expect(eveningSteps[0].what).toMatch(/Get-In/)
    expect(eveningSteps[eveningSteps.length - 1].what).toMatch(/Aufräumen/)
  })
})
