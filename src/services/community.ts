import { api } from './api'
import type { PaginatedResponse } from '@/types/api'

export interface HelpRequest {
  id?: number
  title: string
  text: string
  active: boolean
  order: number
}

export const helpRequestService = {
  async getAll(): Promise<PaginatedResponse<HelpRequest>> {
    return api.get<PaginatedResponse<HelpRequest>>('/api/help-requests/')
  },

  async create(item: Partial<HelpRequest>): Promise<HelpRequest> {
    return api.post<HelpRequest>('/api/help-requests/', item)
  },

  async update(id: number, item: Partial<HelpRequest>): Promise<HelpRequest> {
    return api.patch<HelpRequest>(`/api/help-requests/${id}/`, item)
  },

  async delete(id: number): Promise<void> {
    return api.delete<void>(`/api/help-requests/${id}/`)
  },
}
