export interface BeverageItem {
  id?: number
  name: string
  supplier_group: string
  purchase_price: string
  selling_price?: string | null
  deposit: string
  units_per_crate: number
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type RevenueSource =
  | 'bar_cash'
  | 'bar_paypal'
  | 'entrance_cash'
  | 'entrance_paypal'
  | 'vvk_pretix'
  | 'vvk_paypal'
  | 'vvk_stripe'

export const REVENUE_SOURCE_LABELS: Record<RevenueSource, string> = {
  bar_cash: 'Bar (Bargeld)',
  bar_paypal: 'Bar (PayPal)',
  entrance_cash: 'Einlass (Bargeld)',
  entrance_paypal: 'Einlass (PayPal)',
  vvk_pretix: 'VVK (Pretix)',
  vvk_paypal: 'VVK (PayPal)',
  vvk_stripe: 'VVK (Stripe)',
}

export const REVENUE_GROUPS: { label: string; sources: RevenueSource[] }[] = [
  { label: 'Getränkeverkauf', sources: ['bar_cash', 'bar_paypal'] },
  { label: 'Eintritt', sources: ['entrance_cash', 'entrance_paypal', 'vvk_pretix', 'vvk_paypal', 'vvk_stripe'] },
]

export interface RevenueEntry {
  id?: number
  accounting: number
  source: RevenueSource
  total: string
  change_money: string
  fees: string
}

export interface InventoryEntry {
  id?: number
  accounting: number
  beverage_item: number
  beverage_item_name?: string
  beverage_item_supplier_group?: string
  quantity_before: string
  quantity_after: string
  recorded_by?: number
  recorded_at?: string
}

export type ExpensePaidFrom = 'entrance_cash' | 'bar_cash' | 'other'

export const EXPENSE_PAID_FROM_LABELS: Record<ExpensePaidFrom, string> = {
  entrance_cash: 'Einlasskasse',
  bar_cash: 'Barkasse',
  other: 'Sonstiges',
}

export interface ExpenseEntry {
  id?: number
  accounting: number
  description: string
  amount: string
  notes: string
  paid_from: ExpensePaidFrom
  is_paid_out: boolean
}

export interface AccountingSplit {
  id?: number
  accounting: number
  participant_name: string
  share_percentage: string
}

export type AccountingStatus = 'draft' | 'final'

export interface EventAccounting {
  id?: number
  event: string
  event_title?: string
  event_date?: string
  status: AccountingStatus
  notes: string
  deposit_return: string
  created_by?: number
  created_at?: string
  updated_at?: string
  revenues?: RevenueEntry[]
  inventory_entries?: InventoryEntry[]
  expenses?: ExpenseEntry[]
  splits?: AccountingSplit[]
}

export interface AccountingSummary {
  total_revenue: string
  total_revenue_by_group: { label: string; total: string }[]
  total_expenses: string
  total_inventory_value_before: string
  total_inventory_value_after: string
  total_consumption_value: string
  deposit_return: string
  result: string
  splits: { participant_name: string; amount: string }[]
}
