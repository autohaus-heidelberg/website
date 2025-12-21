import { api, API_BASE_URL } from './api'
import type { PaginatedResponse } from '@/types/api'

export interface Artist {
  id?: number
  name: string
  image?: string
  image_url?: string
  link?: string
  description?: string
  soundcloud?: string
  youtube?: string
  bandcamp?: string
}

export interface Event {
  id: string
  user?: number
  user_username?: string
  date: string
  title: string
  image?: string
  image_url?: string
  descriptionShort: string
  descriptionLong?: string
  fee?: string
  feeAk?: string
  shopLink?: string
  helferpadLink?: string
  artistOrder?: string
  artists: Artist[]
  artist_ids?: number[]
  artist_count?: number
}

export const eventService = {
  /**
   * Get all events (paginated)
   */
  async getAll(): Promise<PaginatedResponse<Event>> {
    return api.get<PaginatedResponse<Event>>('/api/events/')
  },

  /**
   * Get single event by ID
   */
  async getById(id: string): Promise<Event> {
    return api.get<Event>(`/api/events/${id}/`)
  },

  /**
   * Create new event
   */
  async create(event: Partial<Event>): Promise<Event> {
    return api.post<Event>('/api/events/', event)
  },

  /**
   * Update existing event
   */
  async update(id: string, event: Partial<Event>): Promise<Event> {
    return api.patch<Event>(`/api/events/${id}/`, event)
  },

  /**
   * Delete event
   */
  async delete(id: string): Promise<void> {
    return api.delete(`/api/events/${id}/`)
  },

  /**
   * Clone event to Pretix
   */
  async cloneToPretix(id: string): Promise<{ shopLink: string }> {
    return api.post<{ shopLink: string }>(`/api/events/${id}/clone_to_pretix/`)
  },

  /**
   * Create Helferpad for event
   */
  async createHelferpad(id: string): Promise<{ helferpadLink: string }> {
    return api.post<{ helferpadLink: string }>(`/api/events/${id}/create_helferpad/`)
  },

  /**
   * Upload event image
   */
  async uploadImage(id: string, file: File): Promise<Event> {
    return api.uploadFile<Event>(`/api/events/${id}/`, file, 'image')
  },

  /**
   * Start SSE stream for syncing from git
   * Returns URL for EventSource to connect to
   */
  getSyncFromGitUrl(): string {
    const token = localStorage.getItem('access_token')
    return `${API_BASE_URL}/events/sync/?token=${token}`
  },

  /**
   * Start SSE stream for writing events to website
   * @param eventIds - Array of event IDs to write
   * Returns URL for EventSource to connect to
   */
  getWriteToWebsiteUrl(eventIds: string[]): string {
    const token = localStorage.getItem('access_token')
    const ids = eventIds.join(',')
    return `${API_BASE_URL}/events/write-to-website?event_ids=${ids}&token=${token}`
  },
}
