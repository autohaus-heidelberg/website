import { api } from './api'

export interface SettingContent {
  content: string
  [key: string]: any
}

export interface Setting {
  id?: number
  name: string
  setting: SettingContent
}

export const settingsService = {
  /**
   * Get setting by name
   */
  async getByName(name: string): Promise<Setting> {
    return api.get<Setting>(`/api/settings/by-name/${name}/`)
  },

  /**
   * Update setting by ID
   */
  async update(id: number, setting: SettingContent): Promise<Setting> {
    return api.patch<Setting>(`/api/settings/${id}/`, { setting })
  },

  /**
   * Create new setting
   */
  async create(name: string, setting: SettingContent): Promise<Setting> {
    return api.post<Setting>('/api/settings/', { name, setting })
  }
}
