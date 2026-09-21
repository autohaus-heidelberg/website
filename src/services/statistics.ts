import { api } from './api'

export interface AiTagsResponse {
  event_categories: Record<string, string>
  artist_countries: Record<string, string>
  /** How many artists still need a(nother) lookup — poll again if > 0. */
  artist_countries_pending: number
  /** Google Search quota is used up right now — polling again won't help. */
  artist_countries_quota_exhausted: boolean
}

export const statisticsService = {
  /**
   * AI-estimated event category (Konzert/Party/...) and artist country of
   * origin, for the "Statistik" admin view. Best-effort estimates, not
   * verified data — classifies anything not yet cached server-side.
   * `force: true` re-classifies everything, overwriting previous AI values
   * and manual corrections. `retryUnknown: true` re-attempts only artists
   * currently stuck on "Unbekannt". Artist lookups are slow (real web
   * search), so a large batch is only partially processed per call —
   * check `artist_countries_pending` and call again to continue.
   */
  async getAiTags(force = false, retryUnknown = false): Promise<AiTagsResponse> {
    const params = new URLSearchParams()
    if (force) params.set('force', 'true')
    if (retryUnknown) params.set('retry_unknown', 'true')
    const query = params.toString()
    return api.get<AiTagsResponse>(`/api/statistics/ai-tags/${query ? `?${query}` : ''}`)
  },

  /**
   * Manually correct a single AI-suggested event category or artist country.
   */
  async overrideAiTag(type: 'event' | 'artist', id: string | number, value: string): Promise<void> {
    await api.post('/api/statistics/ai-tags/override/', { type, id, value })
  },
}
