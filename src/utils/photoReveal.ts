/**
 * Touch-Geräte haben kein Hover: Der Kopierer-Look der Fotos (.fz-photo) wird dort in Farbe "entwickelt",
 * sobald das Foto im mittleren Bildschirmbereich liegt (Klasse .is-revealed, Styles in fanzine.css).
 */
export function initPhotoReveal(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || typeof IntersectionObserver === 'undefined') {
    return false
  }
  if (!window.matchMedia('(hover: none)').matches) return false

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) entry.target.classList.toggle('is-revealed', entry.isIntersecting)
    },
    { rootMargin: '-35% 0px -35% 0px' },
  )

  const watch = (root: ParentNode) => root.querySelectorAll('.fz-photo').forEach(el => io.observe(el))
  watch(document)

  // Seiten wechseln per Router, Fotos kommen dabei neu ins DOM
  new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return
        if (node.classList.contains('fz-photo')) io.observe(node)
        watch(node)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })

  return true
}
