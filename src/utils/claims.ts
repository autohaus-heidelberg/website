/** Ein Teil des Claims: normaler Text oder geschwärztes Wort (Zensurbalken, geht beim Antippen auf). */
export type ClaimPart = { text: string } | { censor: string }
export type Claim = ClaimPart[]

/** Fester Cover-Claim im Schreibmaschinen-Stil; der Verein spricht, ohne Markennamen einzelner Veranstalter. */
export const claim: Claim = [
  { text: 'Früher Gebrauchtwagen, heute Livemusik. Ein gemeinnütziger Verein dreht hier die Runden. ' },
  { censor: 'Wir stellen keine weiteren Fragen.' },
]
