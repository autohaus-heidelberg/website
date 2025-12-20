import { api } from './api'
import { type Artist } from './events'
import type { PaginatedResponse } from '@/types/api'

export const artistService = {
  /**
   * Get all artists (paginated)
   */
  async getAll(): Promise<PaginatedResponse<Artist>> {
    return api.get<PaginatedResponse<Artist>>('/api/artists/')
  },

  /**
   * Get single artist by ID
   */
  async getById(id: number): Promise<Artist> {
    return api.get<Artist>(`/api/artists/${id}/`)
  },

  /**
   * Create new artist
   */
  async create(artist: Partial<Artist>): Promise<Artist> {
    return api.post<Artist>('/api/artists/', artist)
  },

  /**
   * Update existing artist
   */
  async update(id: number, artist: Partial<Artist>): Promise<Artist> {
    return api.patch<Artist>(`/api/artists/${id}/`, artist)
  },

  /**
   * Delete artist
   */
  async delete(id: number): Promise<void> {
    return api.delete(`/api/artists/${id}/`)
  },

  /**
   * Upload artist image
   */
  async uploadImage(id: number, file: File): Promise<Artist> {
    return api.uploadFile<Artist>(`/api/artists/${id}/`, file, 'image')
  },
}
