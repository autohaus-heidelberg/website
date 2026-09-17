import { api } from './api'

export interface AiTagsResponse {
  event_categories: Record<string, string>
  artist_countries: Record<string, string>
}

export const statisticsService = {
  /**
   * AI-estimated event category (Konzert/Party/...) and artist country of
   * origin, for the "Statistik" admin view. Best-effort estimates, not
   * verified data — classifies anything not yet cached server-side.
   * `force: true` re-classifies everything, overwriting previous AI values
   * and manual corrections.
   */
  async getAiTags(force = false): Promise<AiTagsResponse> {
    return api.get<AiTagsResponse>(`/api/statistics/ai-tags/${force ? '?force=true' : ''}`)
  },

  /**
   * Manually correct a single AI-suggested event category or artist country.
   */
  async overrideAiTag(type: 'event' | 'artist', id: string | number, value: string): Promise<void> {
    await api.post('/api/statistics/ai-tags/override/', { type, id, value })
  },
}
