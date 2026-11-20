export const CONTACT_EMAIL = 'carouselev@gmail.com'

/** mailto-Link mit vorbelegtem Betreff, damit Anfragen von der Community-Seite gleich zuzuordnen sind. */
export function mailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export interface Door {
  id: 'helfen' | 'veranstalten' | 'kreativ' | 'raum'
  title: string
  text: string
  cta: string
  /** `route`: interne Seite (optional mit Sprungmarke oder Query), `mail`: E-Mail mit Betreff */
  action: { route: string; hash?: string; query?: Record<string, string> } | { mail: string }
}

/** Die Gruppen, die das Autohaus gemeinsam gestalten (Community-Seite). */
export interface Crew {
  id: 'haus' | 'bar' | 'verein'
  title: string
  text: string
  /** Optionaler Link zu einer internen Seite */
  link?: { label: string; route: string; hash?: string }
}

export const crew: Crew[] = [
  {
    id: 'haus',
    title: 'Im Haus',
    text: 'Bands, Künstler*innen, Fotograf*innen und Kollektive, die in den Proberäumen und Ateliers ihr Ding machen.',
    link: { label: 'Das Autohaus', route: 'autohaus' },
  },
  {
    id: 'bar',
    title: 'An Bar und Technik',
    text: 'Die Helfer*innen an Einlass, Bar, Ton und Licht. Ohne sie geht abends keine Tür auf.',
    link: { label: 'So machst du mit', route: 'community', hash: '#mitmachen' },
  },
  {
    id: 'verein',
    title: 'Im Verein',
    text: 'Der Vorstand leitet das Carousel e.V., die Mitglieder wählen ihn bei der Mitgliederversammlung. Ideen für Abende kommen zu den Vereinstreffen.',
    link: { label: 'Vereinstreffen', route: 'community', hash: '#treffen' },
  },
]

/** Die vier Wege, bei uns mitzumachen. Einladungslinks zu den Telegram-Gruppen stehen bewusst nicht auf der Seite:
 *  Der Verein gibt sie persönlich weiter, deshalb gibt es sie "auf Anfrage". */
export const doors: Door[] = [
  {
    id: 'helfen',
    title: 'Bei Veranstaltungen helfen',
    text: 'Bar, Einlass, Ton und Licht, Essen für die Bands. Serviceleistung: Eine Schicht dauert 90 Minuten, das sind etwa elf Zigaretten. Danach stehst du wieder vor der Bühne. Die erste machst du mit geschultem Personal an deiner Seite. Organisiert wird in einer Telegram-Gruppe, den Link gibt\'s persönlich: schreib uns kurz.',
    cta: 'Link anfragen',
    action: { mail: 'Helfer*in werden' },
  },
  {
    id: 'veranstalten',
    title: 'Selber veranstalten',
    text: 'Du kennst die Band, die hier spielen muss? Oder hast eine Idee für eine Party, einen Kinoabend, irgendwas dazwischen? Komm zum Vereinstreffen, stell sie kurz vor und such dir Mitstreiter*innen. Wer kann da nein sagen? Termine stehen weiter unten.',
    cta: 'Zu den Terminen',
    action: { route: 'community', hash: '#treffen' },
  },
  {
    id: 'kreativ',
    title: 'Kreativ austoben',
    text: 'Plakate, Flyer, Fotos, Texte, Schnapsideen. Unsere Flyer fallen nicht vom Himmel, die macht immer jemand. Nächstes Mal steht da vielleicht: Flyer art by dir. Telegram-Gruppe gibt\'s auch hier, Link auf Anfrage.',
    cta: 'Link anfragen',
    action: { mail: 'Kreativ mitmachen' },
  },
  {
    id: 'raum',
    title: 'Einen Raum im Haus',
    text: 'Du machst Musik, Kunst oder Fotos und suchst Platz zum Proben, Arbeiten oder Lagern? Im Autohaus gibt es Proberäume, Ateliers und Lager. Ob gerade etwas frei ist, klären wir persönlich.',
    cta: 'Anfrage stellen',
    action: { route: 'requests', query: { type: 'space' } },
  },
]

export interface EveningStep {
  when: string
  what: string
}

/** Anonymer Beispielabend, abgeleitet aus der Pad-Vorlage (relativ zum Beginn der Veranstaltung). */
export const eveningSteps: EveningStep[] = [
  { when: '3 Std. vorher', what: 'Get-In: Der Tourbus parkt vor der Tür, alle packen an' },
  { when: '2 Std. vorher', what: 'Soundcheck drinnen, Hospitality nebenan' },
  { when: '1 Std. vorher', what: 'Warmes Essen für die Bands. Nudeln mit Liebe reichen' },
  { when: 'Beginn', what: 'Türen auf. Einlass und Bar in 90-Minuten-Schichten, an der Bar nie allein' },
  { when: 'Den Abend über', what: 'Ton und Licht halten den Laden zusammen' },
  { when: 'Tag danach', what: 'Aufräumen. Erst feiern, dann Müll sammeln, der Kreislauf des Lebens' },
]

/** "SUCHE:"-Zeile der Kleinanzeige: die Titel der aktiven Gesuche aus dem Admin, sonst ein Standardtext. */
export function wantedLine(titles: string[]): string {
  const clean = titles.map(t => t.trim()).filter(Boolean)
  return clean.length ? clean.join(', ') : 'Leute mit zwei Händen für Bandessen, Ton, Bar und eigene Abende'
}

export const support = {
  title: 'Keine Zeit, aber was übrig?',
  text: 'Das Carousel lebt von Eintritt, Bar und Leuten, die umsonst schuften. Wenn du Geld oder brauchbares Zeug loswerden willst: schreib uns. Wir melden uns persönlich.',
  cta: 'Schreib uns',
  subject: 'Unterstützung',
}
