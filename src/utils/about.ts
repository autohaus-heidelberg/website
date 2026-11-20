export type AboutLang = 'de' | 'en'

export interface AboutText {
  title: string
  paragraphs: string[]
  /** Beschriftung des Links zur Autohaus-Seite */
  more: string
}

/** "Über uns" in zwei Sprachen. Die deutsche Fassung ist ein Zwischenstand, bis der Verein einen eigenen Text schreibt. */
export const aboutTexts: Record<AboutLang, AboutText> = {
  de: {
    title: 'Über uns',
    more: 'Mehr zum Autohaus',
    paragraphs: [
      'Wir sind ein kleiner Haufen Leute, die für Musik und alles drumherum brennen, als ehrenamtlicher Verein: Carousel e.V. Wir fördern Kunst und Kultur in Heidelberg und geben jungen Kunstschaffenden Räume für Proben, Ateliers und Auftritte.',
      'Dafür haben wir das Autohaus: rund 20 Proberäume, Ateliers und Lager, in denen Bands, Künstler*innen und Kollektive ihr Ding machen, und eine Community, die mit anpackt.',
      'Eine Besonderheit ist das Carousel, unser Veranstaltungsraum: Konzerte, Partys, Kino, Ausstellungen. Möglich macht das ein deutlich größerer Haufen: die Helfer*innen an der Tür, hinter der Bar und überall, wo sonst noch was zu tun ist.',
    ],
  },
  en: {
    title: 'About us',
    more: 'More about the Autohaus',
    paragraphs: [
      'We are a small bunch of people who live and breathe music and everything around it, as a volunteer-run association: Carousel e.V. We support art and culture in Heidelberg and give young artists space for rehearsals, studios and performances.',
      'That is what the Autohaus is for: around 20 rehearsal rooms, studios and storage rooms where bands, artists and collectives do their thing, and a community that pitches in.',
      'A special part is Carousel, our event space: concerts, parties, film nights, exhibitions. It is made possible by a much bigger bunch: the helpers at the door, behind the bar and wherever else there is something to do.',
      'Find us at Hebelstraße 7, Heidelberg, in the former car dealership. Nearest tram stop: Rudolf-Diesel-Straße.',
    ],
  },
}
