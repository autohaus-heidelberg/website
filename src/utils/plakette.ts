/** Easter Egg der Startseite: So oft auf „Gebraucht, aber gut in Schuss“ tippen, dann landet der Prüfstempel auf dem Cover. */
export const PLAKETTE_TAPS = 5

/** Die nächste „Hauptuntersuchung“ ist wie beim Auto in zwei Jahren fällig (MM/JJ). */
export function nextInspection(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String((now.getFullYear() + 2) % 100).padStart(2, '0')
  return `${month}/${year}`
}
