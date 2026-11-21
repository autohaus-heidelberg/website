// Bandcamp-Embed-URLs kommen in verschiedenen Varianten aus dem Admin.
// `size=large` ohne `artwork=small` zeichnet ein quadratisches Cover über volle Breite
// (Höhe ≈ Breite + 120px) – bei fester Iframe-Höhe wird der Player abgeschnitten.
// Darum vereinheitlichen: kleines Cover, keine Trackliste, Höhe passend zur Größe.

export interface BandcampEmbed {
  src: string
  height: number
}

export function bandcampEmbed(url: string): BandcampEmbed {
  const small = /\/size=small(\/|$)/.test(url)
  if (small) return { src: url, height: 42 }

  let src = url.replace(/\/+$/, '')
  src = /\/artwork=[^/]*/.test(src)
    ? src.replace(/\/artwork=(?!none)[^/]*/, '/artwork=small')
    : `${src}/artwork=small`
  src = /\/tracklist=[^/]*/.test(src)
    ? src.replace(/\/tracklist=[^/]*/, '/tracklist=false')
    : `${src}/tracklist=false`
  return { src: `${src}/`, height: 120 }
}
