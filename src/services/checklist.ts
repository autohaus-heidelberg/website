import { api } from './api'
import type { PaginatedResponse } from '@/types/api'

export interface ChecklistTemplateItem {
  id?: number
  name: string
  stage: string
  phase: 'before' | 'during' | 'after'
  created?: string
  created_by?: number
  created_by_username?: string
}

export interface ChecklistInstanceItem {
  id?: number
  name: string
  stage: string
  phase: 'before' | 'during' | 'after'
  status: 'initial' | 'inProgress' | 'blocked' | 'done'
  created?: string
  modified?: string
  edited_by?: number
  edited_by_username?: string
  event: string
}

export const checklistTemplateService = {
  /**
   * Get all checklist templates (paginated)
   */
  async getAll(): Promise<PaginatedResponse<ChecklistTemplateItem>> {
    return api.get<PaginatedResponse<ChecklistTemplateItem>>('/api/checklist-templates/')
  },

  /**
   * Get single checklist template by ID
   */
  async getById(id: number): Promise<ChecklistTemplateItem> {
    return api.get<ChecklistTemplateItem>(`/api/checklist-templates/${id}/`)
  },

  /**
   * Create new checklist template
   */
  async create(item: Partial<ChecklistTemplateItem>): Promise<ChecklistTemplateItem> {
    return api.post<ChecklistTemplateItem>('/api/checklist-templates/', item)
  },

  /**
   * Update existing checklist template
   */
  async update(id: number, item: Partial<ChecklistTemplateItem>): Promise<ChecklistTemplateItem> {
    return api.patch<ChecklistTemplateItem>(`/api/checklist-templates/${id}/`, item)
  },

  /**
   * Delete checklist template
   */
  async delete(id: number): Promise<void> {
    return api.delete(`/api/checklist-templates/${id}/`)
  }
}

export const checklistInstanceService = {
  /**
   * Get all checklist instances (paginated)
   */
  async getAll(): Promise<PaginatedResponse<ChecklistInstanceItem>> {
    return api.get<PaginatedResponse<ChecklistInstanceItem>>('/api/checklist-instances/')
  },

  /**
   * Get checklist instances for a specific event
   */
  async getByEventId(eventId: string): Promise<PaginatedResponse<ChecklistInstanceItem>> {
    return api.get<PaginatedResponse<ChecklistInstanceItem>>(
      `/api/checklist-instances/?event_id=${eventId}`
    )
  },

  /**
   * Get single checklist instance by ID
   */
  async getById(id: number): Promise<ChecklistInstanceItem> {
    return api.get<ChecklistInstanceItem>(`/api/checklist-instances/${id}/`)
  },

  /**
   * Update existing checklist instance
   */
  async update(id: number, item: Partial<ChecklistInstanceItem>): Promise<ChecklistInstanceItem> {
    return api.patch<ChecklistInstanceItem>(`/api/checklist-instances/${id}/`, item)
  },

  /**
   * Update only the status of a checklist instance
   */
  async updateStatus(id: number, status: ChecklistInstanceItem['status']): Promise<ChecklistInstanceItem> {
    return api.patch<ChecklistInstanceItem>(`/api/checklist-instances/${id}/`, { status })
  }
}
