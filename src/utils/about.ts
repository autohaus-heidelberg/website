export type AboutLang = 'de' | 'en'

export interface AboutText {
  title: string
  paragraphs: string[]
}

/** "Über uns" in zwei Sprachen. Die deutsche Fassung ist ein Zwischenstand, bis der Verein einen eigenen Text schreibt. */
export const aboutTexts: Record<AboutLang, AboutText> = {
  de: {
    title: 'Über uns',
    paragraphs: [
      'Wir sind ein kleiner Kreis an Menschen, die sich für Musik und alles drum herum begeistern. Als ehrenamtlicher Verein Carousel e.V. sind wir seit 2023 aktiv und veranstalten Konzerte, Partys, Kinoabende, Ausstellungen und worauf wir sonst Lust haben.',
      'Unsere Veranstaltungen werden getragen von einem großen Kreis an fleißigen Helfer*innen, die an der Tür, hinter der Bar und bei allen weiteren Aufgaben tatkräftig unterstützen.',
    ],
  },
  en: {
    title: 'About us',
    paragraphs: [
      'We are a small circle of people who love music and everything around it. As the volunteer-run association Carousel e.V., we have been active since 2023, putting on concerts, parties, film nights, exhibitions and whatever else we feel like.',
      'Our events are carried by a large circle of hard-working helpers who support us at the door, behind the bar and with everything else.',
      'Find us at Hebelstraße 7, Heidelberg, in the former car dealership. Nearest tram stop: Rudolf-Diesel-Straße.',
    ],
  },
}
