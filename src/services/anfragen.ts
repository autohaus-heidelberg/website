import { api } from './api'
import type { PaginatedResponse } from '@/types/api'

export interface Anfrage {
  id: number
  type: 'band' | 'event' | 'rent' | 'other'
  name: string
  message: string
  genre?: string | null
  dateStart?: string | null
  dateEnd?: string | null
  technicalRequirements?: string | null
  contactEmail: string
  budget: string
  submittedAt: string
  isRead: boolean
  lastReplySubject?: string | null
  lastReplyMessage?: string | null
  lastReplyAt?: string | null
}

export const ANFRAGE_TYPE_LABELS: Record<string, string> = {
  band: 'Band',
  event: 'Event',
  rent: 'Vermietung',
  other: 'Sonstige',
}

export const anfrageService = {
  async getAll(params?: { is_read?: boolean }): Promise<PaginatedResponse<Anfrage>> {
    let url = '/api/anfragen/'
    if (params?.is_read !== undefined) {
      url += `?is_read=${params.is_read}`
    }
    return api.get<PaginatedResponse<Anfrage>>(url)
  },

  async getById(id: number): Promise<Anfrage> {
    return api.get<Anfrage>(`/api/anfragen/${id}/`)
  },

  async markRead(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/mark_read/`)
  },

  async markUnread(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/mark_unread/`)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/anfragen/${id}/`)
  },

  async reply(id: number, subject: string, message: string): Promise<void> {
    await api.post(`/api/anfragen/${id}/reply/`, { subject, message })
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<{ count: number }>('/api/anfragen/unread_count/')
    return res.count
  },
}
