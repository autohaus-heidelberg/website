/**
 * Lokale Vorschau: Im Dev-Server werden events.local.json / community.local.json dazugeladen, falls vorhanden
 * (erzeugt mit `python manage.py export_local_preview` im Backend). Im Build sind sie nie enthalten.
 */
const localFiles = import.meta.env.DEV
  ? import.meta.glob(['../events.local.json', '../community.local.json'], { eager: true, import: 'default' })
  : {}

export function localData<T>(file: 'events' | 'community'): T | undefined {
  return localFiles[`../${file}.local.json`] as T | undefined
}

/** Fügt lokale Einträge zu den veröffentlichten hinzu; bei gleicher id gewinnt der lokale Eintrag. */
export function mergeById<T extends { id: string }>(published: T[], local: T[] | undefined): T[] {
  if (!local?.length) return published
  const ids = new Set(local.map(e => e.id))
  return [...published.filter(e => !ids.has(e.id)), ...local]
}
