import { api } from './api'
import type { PaginatedResponse } from '@/types/api'

export interface AnfrageMessage {
  id: number
  direction: 'outgoing' | 'incoming'
  subject: string
  body: string
  fromEmail: string
  createdAt: string
}

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
  readAt?: string | null
  readBy?: number | null
  readByUsername?: string | null
  isAnswered: boolean
  lastReplySubject?: string | null
  lastReplyMessage?: string | null
  lastReplyAt?: string | null
  messages?: AnfrageMessage[]
}

export const ANFRAGE_TYPE_LABELS: Record<string, string> = {
  band: 'Band',
  event: 'Event',
  rent: 'Vermietung',
  other: 'Sonstige',
}

export const anfrageService = {
  async getAll(params?: { is_read?: boolean; is_answered?: boolean }): Promise<PaginatedResponse<Anfrage>> {
    const query = new URLSearchParams()
    if (params?.is_read !== undefined) query.set('is_read', String(params.is_read))
    if (params?.is_answered !== undefined) query.set('is_answered', String(params.is_answered))
    const qs = query.toString()
    return api.get<PaginatedResponse<Anfrage>>(`/api/anfragen/${qs ? '?' + qs : ''}`)
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

  async markAnswered(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/mark_answered/`)
  },

  async markUnanswered(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/mark_unanswered/`)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/anfragen/${id}/`)
  },

  async reply(id: number, subject: string, message: string): Promise<void> {
    await api.post(`/api/anfragen/${id}/reply/`, { subject, message })
  },

  async generateReply(id: number, reason: 'zu_teuer' | 'keine_kapazitaet'): Promise<string> {
    const res = await api.post<{ message: string }>(`/api/anfragen/${id}/generate_reply/`, { reason })
    return res.message
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<{ count: number }>('/api/anfragen/unread_count/')
    return res.count
  },
}
