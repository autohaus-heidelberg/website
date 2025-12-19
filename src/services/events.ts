import { api } from './api'

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
  artistOrder?: string
  artists: Artist[]
  artist_ids?: number[]
  artist_count?: number
}

export const eventService = {
  /**
   * Get all events
   */
  async getAll(): Promise<Event[]> {
    return api.get<Event[]>('/api/events/')
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
   * Upload event image
   */
  async uploadImage(id: string, file: File): Promise<Event> {
    return api.uploadFile<Event>(`/api/events/${id}/`, file, 'image')
  },
}
