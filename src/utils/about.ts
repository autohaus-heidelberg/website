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
      'Wir sind ein kleiner Haufen Leute, die für Musik und alles drumherum brennen. Wir machen Konzerte, Partys, Kinoabende, Ausstellungen und worauf wir sonst Lust haben, inzwischen als ehrenamtlicher Verein Carousel e.V.',
      'Möglich macht das ein deutlich größerer Haufen: die Helfer*innen an der Tür, hinter der Bar und überall, wo sonst noch was zu tun ist.',
    ],
  },
  en: {
    title: 'About us',
    paragraphs: [
      'We are a small bunch of people who live and breathe music and everything around it. We put on concerts, parties, film nights, exhibitions and whatever else we feel like, these days as the volunteer-run association Carousel e.V.',
      'It is made possible by a much bigger bunch: the helpers at the door, behind the bar and wherever else there is something to do.',
      'Find us at Hebelstraße 7, Heidelberg, in the former car dealership. Nearest tram stop: Rudolf-Diesel-Straße.',
    ],
  },
}
