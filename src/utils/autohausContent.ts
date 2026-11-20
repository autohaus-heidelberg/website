export interface HausRow {
  /** Linke Spalte der Liste (Kurzbezeichnung) */
  label: string
  text: string
}

export const hausIntro =
  'Das Autohaus ist das ganze Haus: In rund 20 Proberäumen, Ateliers und Lagern machen Bands, Künstler*innen und Kollektive ihr Ding. Das Carousel ist der Veranstaltungsraum darin, und der Carousel e.V. sorgt dafür, dass der Laden für alle läuft.'

/** Wer im Haus sein Ding macht. */
export const hausWorkers: HausRow[] = [
  { label: 'Bands', text: 'Proberäume, in denen aus Ideen Songs werden und aus Songs irgendwann Konzerte.' },
  { label: 'Bildende Kunst', text: 'Ateliers für Künstler*innen, die Platz zum Ausbreiten brauchen.' },
  { label: 'Fotografie', text: 'Räume für Fotograf*innen, mit Platz fürs Equipment und für Shootings.' },
  { label: 'Kollektive', text: 'Räume für Gruppen, die zusammen etwas anzetteln.' },
]

/** Das Carousel: der Veranstaltungsraum im Autohaus (Datenblatt der Anfrageseite). */
export const hausCarousel = {
  label: 'Das Carousel: die Bühne im Autohaus',
  paragraphs: [
    'Das Carousel ist der Veranstaltungsraum im Autohaus: eine Bühne mit PA und Monitoring und Platz für 199 Leute (stehend). Gemacht wird hier alles ehrenamtlich, vom Einlass bis zum Mischpult.',
    'Bands, die hier spielen wollen, und Vereine oder Kollektive, die für eine kulturelle Veranstaltung einen Raum brauchen, schreiben uns über das Anfrageformular. Private Feiern gibt es bei uns nicht.',
  ],
  programTitle: 'Was hier zum Beispiel passiert',
  ctaProgram: 'Zum Programm',
  ctaRequest: 'Booking & Vermietung',
}

/** Beispielhafte Formate im Carousel. */
export const hausProgram: HausRow[] = [
  { label: 'Konzerte', text: 'Lokale und internationale Bands, live auf der Bühne.' },
  { label: 'Partys', text: 'Von elektronischer Musik bis offenes DJ-Pult.' },
  { label: 'Kino', text: 'Filmabende, auch als Open-Air-Kino.' },
  { label: 'Ausstellungen', text: 'Wenn aus dem Atelier etwas an die Wand soll.' },
]

/** Haus und Carousel greifen ineinander. */
export const hausZusammen = {
  label: 'Wenn alles zusammenkommt',
  text: 'Manchmal greift alles ineinander: Ateliers stehen offen, Bands aus dem Haus spielen, dazu gibt es Workshops, Flohmarkt oder Kleidertausch.',
}

/** Teaser auf der Startseite */
export const autohausTeaser = {
  stamp: 'Im Autohaus',
  title: 'Mehr als eine Bühne.',
  text: 'Das Autohaus ist das ganze Haus: rund 20 Proberäume, Ateliers und Lager für Bands, Künstler*innen und Kollektive, dazu das Carousel als Bühne. Wer das alles am Laufen hält, steht gleich darunter.',
  cta: 'Das Autohaus',
}

/** Überleitung zur Community-Seite */
export const hausCommunity = {
  label: 'Wer das alles am Laufen hält',
  text: 'Ein Haus macht sich nicht von allein. Der Carousel e.V. trägt es, ehrenamtlich: Vorstand, Mitglieder und alle, die an Bar, Einlass und Technik mit anpacken.',
  cta: 'Zur Community',
}

export const hausRequest = {
  title: 'Atelier oder Proberaum gesucht?',
  text: 'Wir geben keine Zusagen auf Zuruf. Schreib uns kurz, was du machst und was du brauchst. Ob etwas frei ist, klären wir persönlich.',
  cta: 'Anfrage stellen',
}
