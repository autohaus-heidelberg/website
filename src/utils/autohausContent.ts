export interface HausRow {
  /** Linke Spalte der Liste (Kurzbezeichnung) */
  label: string
  text: string
}

export const hausIntro =
  'Das Carousel ist nicht nur Bühne. Im alten Autohaus machen rund 20 Bands, Künstler*innen und Kollektive in Proberäumen, Ateliers und Lagern ihr Ding, und der Verein sorgt dafür, dass der Laden für sie läuft.'

/** Wer im Haus sein Ding macht (Tätigkeitsbericht 2024). */
export const hausWorkers: HausRow[] = [
  { label: 'Bands', text: 'Proberäume, in denen aus Ideen Songs werden und aus Songs irgendwann Konzerte.' },
  { label: 'Bildende Kunst', text: 'Ateliers für Künstler*innen, die Platz zum Austoben brauchen.' },
  { label: 'Fotografie', text: 'Räume für Fotograf*innen zum Tüfteln und zum Lagern.' },
  { label: 'Kollektive', text: 'Räume für Gruppen, die zusammen etwas anzetteln.' },
]

/** Was außer Konzerten im Haus läuft (Tätigkeitsbericht 2024 und Über-uns-Text). */
export const hausProgram: HausRow[] = [
  { label: 'Partys', text: 'Von elektronischer Musik bis offenes DJ-Pult.' },
  { label: 'Kino', text: 'Filmabende, auch als Open-Air-Kino.' },
  { label: 'Ausstellungen', text: 'Wenn aus dem Atelier etwas an die Wand soll.' },
  { label: 'Workshops', text: 'Malen, Makramee und was die Leute im Haus sonst draufhaben.' },
  { label: 'Offene Ateliers', text: 'Beim Sommerfest stehen die Ateliers offen, dazu Flohmarkt und Kleidertausch.' },
]

/** Teaser auf der Startseite */
export const autohausTeaser = {
  stamp: 'Im Haus',
  title: 'Mehr als eine Bühne.',
  text: 'Im Autohaus gibt es rund 20 Proberäume, Ateliers und Lager, in denen Bands, Künstler*innen und Kollektive ihr Ding machen. Schau, wer hier Gas gibt.',
  cta: 'Das Autohaus',
}

export const hausRequest = {
  title: 'Raum gesucht?',
  text: 'Wir geben keine Zusagen auf Zuruf. Schreib uns kurz, was du machst und was du brauchst. Ob etwas frei ist, klären wir persönlich.',
  cta: 'Anfrage stellen',
}
