import { describe, it, expect } from 'vitest'
import {
  buildCalendarDays,
  buildIcs,
  dateKey,
  groupEventsByDay,
  isoWeek,
  parseDateKey,
  shiftCursor,
  shiftEventToDay,
  startOfWeek,
  visibleRange,
  type CalendarEvent,
} from '../utils/calendar'

function ev(id: string, date: string, endDate?: string): CalendarEvent {
  return { id, date, endDate, title: id }
}

describe('dateKey / parseDateKey', () => {
  it('formats local dates', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('round-trips without UTC shift', () => {
    const key = '2026-03-01'
    expect(dateKey(parseDateKey(key))).toBe(key)
  })
})

describe('startOfWeek', () => {
  it('uses Monday as the first day', () => {
    // 2026-01-07 is a Wednesday.
    expect(dateKey(startOfWeek(new Date(2026, 0, 7)))).toBe('2026-01-05')
  })

  it('keeps Monday itself', () => {
    expect(dateKey(startOfWeek(new Date(2026, 0, 5)))).toBe('2026-01-05')
  })

  it('maps Sunday back to the preceding Monday', () => {
    expect(dateKey(startOfWeek(new Date(2026, 0, 11)))).toBe('2026-01-05')
  })
})

describe('isoWeek', () => {
  it('counts the first week of 2026', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
  })

  it('assigns 2027-01-01 (a Friday) to week 53 of 2026', () => {
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53)
  })

  it('assigns 2024-12-30 (a Monday) to week 1', () => {
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1)
  })
})

describe('groupEventsByDay', () => {
  it('places a single-day event on exactly one day', () => {
    const map = groupEventsByDay([ev('a', '2026-01-05T19:00:00')])
    expect([...map.keys()]).toEqual(['2026-01-05'])
    expect(map.get('2026-01-05')![0].multiDay).toBe(false)
  })

  it('spans a multi-day event across every day of its range', () => {
    const map = groupEventsByDay([ev('a', '2026-01-05T19:00:00', '2026-01-08T23:59:00')])
    expect([...map.keys()]).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'])
    expect(map.get('2026-01-05')![0].isStart).toBe(true)
    expect(map.get('2026-01-05')![0].isEnd).toBe(false)
    expect(map.get('2026-01-08')![0].isEnd).toBe(true)
  })

  it('spans across a month boundary', () => {
    const map = groupEventsByDay([ev('a', '2026-01-30T19:00:00', '2026-02-02T23:59:00')])
    expect([...map.keys()]).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })

  it('ignores events whose end is before their start', () => {
    const map = groupEventsByDay([ev('a', '2026-01-05T19:00:00', '2026-01-01T23:59:00')])
    expect(map.size).toBe(0)
  })

  it('sorts multi-day bands first, then by start time', () => {
    const map = groupEventsByDay([
      ev('late', '2026-01-05T22:00:00'),
      ev('early', '2026-01-05T18:00:00'),
      ev('band', '2026-01-04T10:00:00', '2026-01-06T23:59:00'),
    ])
    expect(map.get('2026-01-05')!.map(e => e.event.id)).toEqual(['band', 'early', 'late'])
  })
})

describe('visibleRange', () => {
  it('pads the month grid to full weeks', () => {
    // 2026-02-01 is a Sunday, so the grid starts on 2026-01-26.
    const { start, end } = visibleRange(new Date(2026, 1, 15), 'month')
    expect(dateKey(start)).toBe('2026-01-26')
    expect(dateKey(end)).toBe('2026-03-01')
  })

  it('returns a single day for day mode', () => {
    const { start, end } = visibleRange(new Date(2026, 1, 15), 'day')
    expect(dateKey(start)).toBe('2026-02-15')
    expect(dateKey(end)).toBe('2026-02-15')
  })

  it('returns the full year for year mode', () => {
    const { start, end } = visibleRange(new Date(2026, 5, 15), 'year')
    expect(dateKey(start)).toBe('2026-01-01')
    expect(dateKey(end)).toBe('2026-12-31')
  })
})

describe('buildCalendarDays', () => {
  it('builds whole weeks for a month', () => {
    const days = buildCalendarDays(new Date(2026, 1, 15), 'month', new Map(), new Date(2026, 1, 15))
    expect(days.length % 7).toBe(0)
    expect(days[0].date.getDay()).toBe(1)
  })

  it('marks days outside the cursor month', () => {
    const days = buildCalendarDays(new Date(2026, 1, 15), 'month', new Map(), new Date(2026, 1, 15))
    expect(days[0].inCurrentMonth).toBe(false)
    expect(days.find(d => d.key === '2026-02-15')!.inCurrentMonth).toBe(true)
  })

  it('does not mark the same day number of another year as in-month', () => {
    const days = buildCalendarDays(new Date(2026, 0, 15), 'month', new Map(), new Date(2026, 0, 15))
    expect(days.every(d => d.date.getFullYear() === 2026 || !d.inCurrentMonth)).toBe(true)
  })

  it('flags today and weekends', () => {
    const days = buildCalendarDays(new Date(2026, 0, 7), 'week', new Map(), new Date(2026, 0, 7))
    expect(days.filter(d => d.isToday).map(d => d.key)).toEqual(['2026-01-07'])
    expect(days.filter(d => d.isWeekend).map(d => d.key)).toEqual(['2026-01-10', '2026-01-11'])
  })

  it('attaches the grouped entries', () => {
    const byDay = groupEventsByDay([ev('a', '2026-01-07T19:00:00')])
    const days = buildCalendarDays(new Date(2026, 0, 7), 'week', byDay, new Date(2026, 0, 7))
    expect(days.find(d => d.key === '2026-01-07')!.entries).toHaveLength(1)
  })

  it('spans a DST change without losing or duplicating a day', () => {
    // DST in Europe starts on 2026-03-29.
    const days = buildCalendarDays(new Date(2026, 2, 15), 'month', new Map(), new Date(2026, 2, 15))
    const keys = days.map(d => d.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('2026-03-29')
  })
})

describe('shiftCursor', () => {
  it('does not skip a month when the cursor is on the 31st', () => {
    const next = shiftCursor(new Date(2026, 0, 31), 'month', 1)
    expect(next.getMonth()).toBe(1)
  })

  it('steps a week', () => {
    expect(dateKey(shiftCursor(new Date(2026, 0, 7), 'week', 1))).toBe('2026-01-14')
    expect(dateKey(shiftCursor(new Date(2026, 0, 7), 'week', -1))).toBe('2025-12-31')
  })

  it('steps a day', () => {
    expect(dateKey(shiftCursor(new Date(2026, 0, 1), 'day', -1))).toBe('2025-12-31')
  })

  it('steps a year', () => {
    expect(shiftCursor(new Date(2026, 5, 15), 'year', 1).getFullYear()).toBe(2027)
  })
})

describe('shiftEventToDay', () => {
  it('keeps the time of day when moving forward', () => {
    const result = shiftEventToDay(ev('a', '2026-01-05T19:00:00.000Z'), '2026-01-08', '2026-01-05')
    expect(new Date(result.date).toISOString()).toBe('2026-01-08T19:00:00.000Z')
    expect(result.endDate).toBeNull()
  })

  it('moves the end date by the same offset', () => {
    const result = shiftEventToDay(
      ev('a', '2026-01-05T19:00:00.000Z', '2026-01-08T22:00:00.000Z'),
      '2026-01-01',
      '2026-01-05',
    )
    expect(new Date(result.date).toISOString()).toBe('2026-01-01T19:00:00.000Z')
    expect(new Date(result.endDate!).toISOString()).toBe('2026-01-04T22:00:00.000Z')
  })

  it('uses the grabbed day, not the start day, as the offset anchor', () => {
    // Band von 05. bis 08., am 07. angefasst und auf den 09. gezogen -> +2 Tage.
    const result = shiftEventToDay(
      ev('a', '2026-01-05T19:00:00.000Z', '2026-01-08T22:00:00.000Z'),
      '2026-01-09',
      '2026-01-07',
    )
    expect(new Date(result.date).toISOString()).toBe('2026-01-07T19:00:00.000Z')
    expect(new Date(result.endDate!).toISOString()).toBe('2026-01-10T22:00:00.000Z')
  })
})

describe('buildIcs', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')

  it('wraps events in a valid VCALENDAR envelope', () => {
    const ics = buildIcs([{ ...ev('a', '2026-01-05T19:00:00.000Z'), title: 'Konzert' }], { now })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Konzert')
    expect(ics).toContain('DTSTART:20260105T190000Z')
  })

  it('defaults to a four hour block without an end date', () => {
    const ics = buildIcs([ev('a', '2026-01-05T19:00:00.000Z')], { now })
    expect(ics).toContain('DTEND:20260105T230000Z')
  })

  it('uses the end date for multi-day events', () => {
    const ics = buildIcs([ev('a', '2026-01-05T19:00:00.000Z', '2026-01-08T22:00:00.000Z')], { now })
    expect(ics).toContain('DTEND:20260108T220000Z')
  })

  it('marks cancelled events', () => {
    const ics = buildIcs([{ ...ev('a', '2026-01-05T19:00:00.000Z'), title: 'Konzert', cancelled: true }], { now })
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('SUMMARY:ABGESAGT: Konzert')
  })

  it('escapes commas, semicolons and newlines', () => {
    const ics = buildIcs([{ ...ev('a', '2026-01-05T19:00:00.000Z'), title: 'A, B; C' }], { now })
    expect(ics).toContain('SUMMARY:A\\, B\\; C')
  })

  it('strips HTML from the description', () => {
    const ics = buildIcs(
      [{ ...ev('a', '2026-01-05T19:00:00.000Z'), descriptionShort: '<p>Hallo <b>Welt</b></p>' }],
      { now },
    )
    expect(ics).toContain('DESCRIPTION:Hallo Welt')
  })

  it('folds lines longer than 75 octets', () => {
    const ics = buildIcs([{ ...ev('a', '2026-01-05T19:00:00.000Z'), title: 'x'.repeat(200) }], { now })
    expect(ics.split('\r\n').every(l => l.length <= 75)).toBe(true)
  })

  it('adds a deep link when a base url is given', () => {
    const ics = buildIcs([ev('a', '2026-01-05T19:00:00.000Z')], { now, baseUrl: 'https://example.org' })
    expect(ics).toContain('URL:https://example.org/admin/events/a')
  })
})
