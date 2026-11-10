export const CONTACT_EMAIL = 'carouselev@gmail.com'

/** mailto-Link mit vorbelegtem Betreff, damit Anfragen von der Community-Seite gleich zuzuordnen sind. */
export function mailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export interface Door {
  id: 'helfen' | 'veranstalten' | 'kreativ'
  title: string
  text: string
  cta: string
  /** `route`: interne Seite, `mail`: E-Mail mit Betreff */
  action: { route: string } | { mail: string }
}

/** Die drei Wege, bei uns mitzumachen. Einladungslinks zu den Telegram-Gruppen stehen bewusst nicht auf der Seite:
 *  Der Verein gibt sie persönlich weiter, deshalb gibt es sie "auf Anfrage". */
export const doors: Door[] = [
  {
    id: 'helfen',
    title: 'Bei Konzerten helfen',
    text: 'Bar, Einlass, Ton und Licht, Essen für die Bands. Wir arbeiten in Schichten von etwa 90 Minuten, deine erste machst du mit jemandem, der sich auskennt. Organisiert wird alles in einer Telegram-Gruppe für Helfer:innen. Den Link geben wir persönlich weiter: schreib uns kurz.',
    cta: 'Link anfragen',
    action: { mail: 'Helfer:in werden' },
  },
  {
    id: 'veranstalten',
    title: 'Selber veranstalten',
    text: 'Ihr habt eine Idee für ein Konzert, eine Party oder einen Abend im Autohaus? Kommt zum Vereinstreffen, stellt sie kurz vor und findet Mitstreiter*innen aus dem Verein. Offen für alle, die im Carousel etwas auf die Beine stellen wollen. Die Termine stehen weiter unten.',
    cta: 'Anfrage stellen',
    action: { route: 'requests' },
  },
  {
    id: 'kreativ',
    title: 'Kreativ einbringen',
    text: 'Plakate, Flyer, Fotos, Texte, Ideen. Auch dafür gibt es eine Telegram-Gruppe. Den Link bekommst du auf Anfrage.',
    cta: 'Link anfragen',
    action: { mail: 'Kreativ mitmachen' },
  },
]

export interface EveningStep {
  when: string
  what: string
}

/** Anonymer Beispielabend, abgeleitet aus der Pad-Vorlage (relativ zum Beginn der Veranstaltung). */
export const eveningSteps: EveningStep[] = [
  { when: '3 Std. vorher', what: 'Get-In: die Bands kommen an, Aufbau' },
  { when: '2 Std. vorher', what: 'Soundcheck und Hospitality' },
  { when: '1 Std. vorher', what: 'Essen für die Bands' },
  { when: 'Beginn', what: 'Einlass und Bar, Schichten à 90 Minuten, an der Bar zu zweit' },
  { when: 'Den Abend über', what: 'Ton und Licht' },
  { when: 'Tag danach', what: 'Aufräumen' },
]

/** "SUCHE:"-Zeile der Kleinanzeige: die Titel der aktiven Gesuche aus dem Admin, sonst ein Standardtext. */
export function wantedLine(titles: string[]): string {
  const clean = titles.map(t => t.trim()).filter(Boolean)
  return clean.length ? clean.join(', ') : 'Leute fürs Bandessen, für Ton, Bar und eigene Abende'
}

export const support = {
  title: 'Du willst uns unterstützen?',
  text: 'Das Carousel lebt von Eintritt, Bar und ehrenamtlicher Arbeit. Wenn du uns mit Geld oder mit Sachen unter die Arme greifen möchtest, schreib uns. Wir melden uns persönlich.',
  cta: 'Schreib uns',
  subject: 'Unterstützung',
}
