/** Art einer Veranstaltung (nur Anzeige): Label an Karten und im Kalender, Filter im Kalender. Leer = keine Angabe. */
export const EVENT_CATEGORIES = [
  { value: 'concert', label: 'Konzert' },
  { value: 'party', label: 'Party' },
  { value: 'film', label: 'Kino' },
  { value: 'exhibition', label: 'Ausstellung' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'market', label: 'Markt' },
  { value: 'other', label: 'Sonstiges' },
] as const

export interface CategorizedEvent {
  category?: string | null
}

export function categoryLabel(event: CategorizedEvent): string {
  return EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? ''
}

/** Die in den Events vorkommenden Arten, in fester Reihenfolge (für die Filterchips). */
export function categoriesIn(events: CategorizedEvent[]): { value: string; label: string }[] {
  const used = new Set(events.map(e => e.category))
  return EVENT_CATEGORIES.filter(c => used.has(c.value))
}
