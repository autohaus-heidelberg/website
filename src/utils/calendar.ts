/**
 * Reine Kalender-Logik (Datumsraster, Gruppierung, ICS-Export) ohne Vue-Bezug,
 * damit die fehleranfaellige Datumsarithmetik testbar bleibt.
 */

export type CalendarMode = 'month' | 'week' | 'day' | 'agenda' | 'year'

export interface CalendarEvent {
  id: string
  date: string
  endDate?: string | null
  title: string
  cancelled?: boolean
}

export interface CalendarEntry<T extends CalendarEvent> {
  event: T
  multiDay: boolean
  isStart: boolean
  isEnd: boolean
}

export interface CalendarDay<T extends CalendarEvent> {
  date: Date
  key: string
  inCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  week: number
  entries: CalendarEntry<T>[]
}

const DAY_MS = 86400000

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** `YYYY-MM-DD` als lokale Mitternacht (nicht UTC wie bei `new Date(str)`). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Montag als erster Wochentag. */
export function startOfWeek(d: Date): Date {
  const date = startOfDay(d)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(d: Date): number {
  const date = startOfDay(d)
  // Der Donnerstag der Woche bestimmt das KW-Jahr.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const firstThursday = new Date(date.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
}

/**
 * Events pro Tag; mehrtaegige Events (endDate) erscheinen als Band an jedem Tag
 * ihrer Spanne.
 */
export function groupEventsByDay<T extends CalendarEvent>(events: T[]): Map<string, CalendarEntry<T>[]> {
  const map = new Map<string, CalendarEntry<T>[]>()
  for (const e of events) {
    const startDay = startOfDay(new Date(e.date))
    const lastDay = startOfDay(e.endDate ? new Date(e.endDate) : new Date(e.date))
    if (lastDay < startDay) continue
    const multiDay = lastDay.getTime() > startDay.getTime()
    const startKey = dateKey(startDay)
    const endKey = dateKey(lastDay)
    const cur = new Date(startDay)
    while (cur <= lastDay) {
      const key = dateKey(cur)
      const list = map.get(key)
      const entry: CalendarEntry<T> = { event: e, multiDay, isStart: key === startKey, isEnd: key === endKey }
      if (list) list.push(entry)
      else map.set(key, [entry])
      cur.setDate(cur.getDate() + 1)
    }
  }
  for (const list of map.values()) {
    // Mehrtaegige Baender zuerst, dann Einzeltermine nach Uhrzeit.
    list.sort((a, b) => {
      if (a.multiDay !== b.multiDay) return a.multiDay ? -1 : 1
      return new Date(a.event.date).getTime() - new Date(b.event.date).getTime()
    })
  }
  return map
}

/** Erster und letzter im Raster sichtbarer Tag fuer den jeweiligen Modus. */
export function visibleRange(cursor: Date, mode: CalendarMode): { start: Date; end: Date } {
  if (mode === 'day') {
    const start = startOfDay(cursor)
    return { start, end: start }
  }
  if (mode === 'week') {
    const start = startOfWeek(cursor)
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6) }
  }
  if (mode === 'year') {
    return { start: new Date(cursor.getFullYear(), 0, 1), end: new Date(cursor.getFullYear(), 11, 31) }
  }
  if (mode === 'agenda') {
    const start = startOfDay(cursor)
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, start.getDate()) }
  }
  const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const end = startOfWeek(lastOfMonth)
  end.setDate(end.getDate() + 6)
  return { start, end }
}

export function buildCalendarDays<T extends CalendarEvent>(
  cursor: Date,
  mode: CalendarMode,
  byDay: Map<string, CalendarEntry<T>[]>,
  today: Date = new Date(),
): CalendarDay<T>[] {
  const { start, end } = visibleRange(cursor, mode)
  const todayKey = dateKey(today)
  const dayCount = Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS) + 1
  const days: CalendarDay<T>[] = []
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = dateKey(d)
    days.push({
      date: d,
      key,
      inCurrentMonth: d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(),
      isToday: key === todayKey,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      week: isoWeek(d),
      entries: byDay.get(key) || [],
    })
  }
  return days
}

/** Verschiebt den Cursor um eine Einheit des jeweiligen Modus. */
export function shiftCursor(cursor: Date, mode: CalendarMode, direction: 1 | -1): Date {
  const c = new Date(cursor)
  switch (mode) {
    case 'month':
      // Auf den 1. setzen, damit z.B. 31.03. -> 01.03. statt 02.03. wird.
      return new Date(c.getFullYear(), c.getMonth() + direction, 1)
    case 'week':
      c.setDate(c.getDate() + 7 * direction)
      return c
    case 'day':
      c.setDate(c.getDate() + direction)
      return c
    case 'agenda':
      c.setMonth(c.getMonth() + 3 * direction)
      return c
    case 'year':
      return new Date(c.getFullYear() + direction, 0, 1)
  }
}

/**
 * Neues Start-/Enddatum beim Verschieben eines Events auf einen anderen Tag.
 * Uhrzeit und Dauer bleiben erhalten; Rueckgabe als ISO-String fuers Backend.
 */
export function shiftEventToDay(
  event: CalendarEvent,
  targetKey: string,
  grabbedKey: string,
): { date: string; endDate: string | null } {
  const offsetDays = Math.round(
    (parseDateKey(targetKey).getTime() - parseDateKey(grabbedKey).getTime()) / DAY_MS,
  )
  const start = new Date(event.date)
  start.setDate(start.getDate() + offsetDays)
  let endIso: string | null = null
  if (event.endDate) {
    const end = new Date(event.endDate)
    end.setDate(end.getDate() + offsetDays)
    endIso = end.toISOString()
  }
  return { date: start.toISOString(), endDate: endIso }
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** ICS erlaubt max. 75 Oktette pro Zeile; Fortsetzungen beginnen mit Space. */
function foldIcsLine(line: string): string {
  if (line.length <= 73) return line
  const parts: string[] = [line.slice(0, 73)]
  for (let i = 73; i < line.length; i += 72) parts.push(' ' + line.slice(i, i + 72))
  return parts.join('\r\n')
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Strippt HTML aus den Rich-Text-Beschreibungen fuer die ICS-Description. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface IcsEvent extends CalendarEvent {
  descriptionShort?: string
  artists?: { name: string }[]
}

/** Minimaler, nach RFC 5545 gueltiger VCALENDAR-Export in UTC. */
export function buildIcs(events: IcsEvent[], options: { baseUrl?: string; now?: Date } = {}): string {
  const stamp = icsStamp(options.now ?? new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carousel im alten Autohaus//Admin Kalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Carousel Veranstaltungen',
  ]
  for (const e of events) {
    const start = new Date(e.date)
    // Ohne endDate wird ein Standardblock von 4 Stunden angenommen.
    const end = e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 4 * 3600000)
    const artists = e.artists?.map(a => a.name).filter(Boolean).join(', ')
    const description = [artists, e.descriptionShort ? stripHtml(e.descriptionShort) : '']
      .filter(Boolean)
      .join(' — ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(e.id)}@carousel-im-alten-autohaus.de`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${escapeIcs(e.cancelled ? `ABGESAGT: ${e.title}` : e.title)}`,
      `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    )
    if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`)
    if (options.baseUrl) lines.push(`URL:${escapeIcs(`${options.baseUrl}/admin/events/${e.id}`)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
