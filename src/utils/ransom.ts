const RANSOM_CLASSES = 5

/** Zerlegt einen Titel in Buchstaben mit wechselnden Klassen für den Ransom-Note-Look (Erpresserbrief). */
export function ransomChars(text: string, seed = 0): { ch: string; cls: string }[] {
  return Array.from(text).map((ch, i) => ({
    ch: ch === ' ' ? '\u00a0' : ch,
    cls: ch === ' ' ? 'fz-ch-sp' : `fz-ch-${(i * 3 + seed * 2) % RANSOM_CLASSES}`,
  }))
}
