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
      'Wir sind ein kleiner Haufen Leute, die für Musik und alles drumherum brennen, organisiert als ehrenamtlicher, gemeinnütziger Verein: Carousel e.V. Wir wollen Kunst und Kultur in Heidelberg fördern und jungen Kunstschaffenden Räume für Proben, Ateliers und Auftritte geben.',
      'Dafür haben wir das Autohaus: In rund 20 Proberäumen, Ateliers und Lagern machen Bands, Künstler*innen, Fotograf*innen und Kollektive ihr Ding. Zusammen mit allen, die hier mit anpacken, ist daraus eine Community geworden.',
      'Eine Besonderheit ist das Carousel, der Veranstaltungsraum im Autohaus: Hier organisieren wir Konzerte lokaler und internationaler Bands, dazu Partys, Kinoabende, Ausstellungen und Workshops.',
      'Möglich macht das ein deutlich größerer Haufen: die Helfer*innen an der Tür, hinter der Bar und überall, wo sonst noch was zu tun ist.',
    ],
  },
  en: {
    title: 'About us',
    paragraphs: [
      'We are a small bunch of people who live and breathe music and everything around it, organised as the non-profit, volunteer-run association Carousel e.V. We want to support art and culture in Heidelberg and give young artists space for rehearsals, studios and performances.',
      'That is what the Autohaus is for: around 20 rehearsal rooms, studios and storage rooms where bands, artists, photographers and collectives do their thing. Together with everyone who pitches in, it has grown into a community.',
      'A special part of it is Carousel, the event space in the building: here we put on concerts by local and international bands, plus parties, film nights, exhibitions and workshops.',
      'It is made possible by a much bigger bunch: the helpers at the door, behind the bar and wherever else there is something to do.',
      'Find us at Hebelstraße 7, Heidelberg, in the former car dealership. Nearest tram stop: Rudolf-Diesel-Straße.',
    ],
  },
}
