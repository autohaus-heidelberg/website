import { api, API_BASE_URL } from './api'
import type { PaginatedResponse } from '@/types/api'

export type PrintInvoiceSource = 'print' | 'gema' | 'meininger'
export type PrintInvoiceStatus = 'pending' | 'assigned' | 'ignored'

export interface PrintInvoice {
  id: number
  source: PrintInvoiceSource
  from_email: string
  subject: string
  email_date: string | null
  file_name: string
  status: PrintInvoiceStatus
  event: string | null
  event_title: string
  suggested_event: string | null
  suggested_event_title: string
  match_info: string
  assigned_by: number | null
  assigned_by_name: string
  assigned_at: string | null
  document: number | null
  drive_url: string
  created_at: string
}

export const PRINT_INVOICE_SOURCE_LABELS: Record<PrintInvoiceSource, string> = {
  print: 'Druck',
  gema: 'GEMA',
  meininger: 'MEININGER Hotel',
}

export const printInvoiceService = {
  async getAll(status?: PrintInvoiceStatus): Promise<PaginatedResponse<PrintInvoice>> {
    const qs = status ? `?status=${status}` : ''
    return api.get<PaginatedResponse<PrintInvoice>>(`/api/print-invoices/${qs}`)
  },

  /** Invoices assigned to a specific event (for the accounting expenses tab). */
  async getForEvent(eventId: string, status: PrintInvoiceStatus = 'assigned'): Promise<PrintInvoice[]> {
    const res = await api.get<PaginatedResponse<PrintInvoice>>(
      `/api/print-invoices/?event=${encodeURIComponent(eventId)}&status=${status}`,
    )
    return res.results
  },

  async assign(id: number, eventId: string): Promise<PrintInvoice> {
    return api.post<PrintInvoice>(`/api/print-invoices/${id}/assign/`, { event_id: eventId })
  },

  async ignore(id: number): Promise<PrintInvoice> {
    return api.post<PrintInvoice>(`/api/print-invoices/${id}/ignore/`)
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/api/print-invoices/${id}/`)
  },

  /** Fetch the stored PDF with auth and open it in a new tab. The download
   *  endpoint requires a Bearer token, so a plain link can't be used. */
  async openPdf(id: number): Promise<void> {
    const token = localStorage.getItem('access_token')
    const resp = await fetch(`${API_BASE_URL}/api/print-invoices/${id}/download/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) throw new Error('Vorschau konnte nicht geladen werden')
    const url = URL.createObjectURL(await resp.blob())
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  },
}
