/**
 * Zentrale Regel, ab wann eine Veranstaltung als "vergangen" gilt.
 *
 * Nicht mit Tages-/Veranstaltungsende, sondern erst am Morgen danach – so
 * bleibt ein Event waehrend der Nacht noch oben in den Kommend-Listen.
 */
export const EVENT_EXPIRY_HOUR = 6

export interface DatedEvent {
  date: string
  /** Bei mehrtaegigen Events (z.B. Ausstellungen) zaehlt das Enddatum. */
  endDate?: string | null
}

export function eventExpiry(event: DatedEvent): Date {
  const expiry = new Date(event.endDate || event.date)
  expiry.setDate(expiry.getDate() + 1)
  expiry.setHours(EVENT_EXPIRY_HOUR, 0, 0, 0)
  return expiry
}

export function isPastEvent(event: DatedEvent, now: Date = new Date()): boolean {
  return now >= eventExpiry(event)
}
