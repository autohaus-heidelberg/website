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
  origin?: string | null
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
  isSupportCandidate: boolean
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
  async getAll(params?: { is_read?: boolean; is_answered?: boolean; support_candidate?: boolean }): Promise<PaginatedResponse<Anfrage>> {
    const query = new URLSearchParams()
    if (params?.is_read !== undefined) query.set('is_read', String(params.is_read))
    if (params?.is_answered !== undefined) query.set('is_answered', String(params.is_answered))
    if (params?.support_candidate !== undefined) query.set('support_candidate', String(params.support_candidate))
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

  async markSupportCandidate(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/mark_support_candidate/`)
  },

  async unmarkSupportCandidate(id: number): Promise<void> {
    await api.post(`/api/anfragen/${id}/unmark_support_candidate/`)
  },

  async getSupportCandidates(): Promise<Anfrage[]> {
    const res = await this.getAll({ support_candidate: true })
    return res.results
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/anfragen/${id}/`)
  },

  async reply(id: number, subject: string, message: string): Promise<void> {
    await api.post(`/api/anfragen/${id}/reply/`, { subject, message })
  },

  async generateReply(id: number, reason: 'zu_teuer' | 'keine_kapazitaet' | 'aufgenommen'): Promise<string> {
    const res = await api.post<{ message: string }>(`/api/anfragen/${id}/generate_reply/`, { reason })
    return res.message
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<{ count: number }>('/api/anfragen/unread_count/')
    return res.count
  },
}
