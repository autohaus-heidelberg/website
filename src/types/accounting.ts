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
  bottle_size?: string | null
  portions_per_bottle?: number | null
  selling_price_portion?: string | null
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

export const REVENUE_SOURCE_KEYS: Record<RevenueSource, string> = {
  bar_cash: 'revenue.sources.bar_cash',
  bar_paypal: 'revenue.sources.bar_paypal',
  entrance_cash: 'revenue.sources.entrance_cash',
  entrance_paypal: 'revenue.sources.entrance_paypal',
  vvk_pretix: 'revenue.sources.vvk_pretix',
  vvk_paypal: 'revenue.sources.vvk_paypal',
  vvk_stripe: 'revenue.sources.vvk_stripe',
}

export const REVENUE_GROUPS: { labelKey: string; sources: RevenueSource[] }[] = [
  { labelKey: 'revenue.groups.drinkSales', sources: ['bar_cash', 'bar_paypal'] },
  { labelKey: 'revenue.groups.admission', sources: ['entrance_cash', 'entrance_paypal', 'vvk_pretix'] },
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
  snapshot_purchase_price?: string
  snapshot_selling_price?: string | null
  snapshot_deposit?: string
  recorded_by?: number
  recorded_at?: string
}

export type ExpensePaidFrom = 'entrance_cash' | 'bar_cash' | 'other'

export const EXPENSE_PAID_FROM_KEYS: Record<ExpensePaidFrom, string> = {
  entrance_cash: 'revenue.expensePaidFrom.entrance_cash',
  bar_cash: 'revenue.expensePaidFrom.bar_cash',
  other: 'revenue.expensePaidFrom.other',
}

export interface ExpenseEntry {
  id?: number
  accounting: number
  description: string
  amount: string
  notes: string
  paid_from: ExpensePaidFrom
  is_paid_out?: boolean
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
  event: string | null
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

// ── Purchase (Wareneingang / Einkauf) ───────────────────────────

export type PurchaseStatus = 'draft' | 'final'

export interface PurchaseItem {
  id?: number
  beverage_item: number
  quantity: number
  unit_price: string
  total_price: string
}

export interface Purchase {
  id?: number
  date: string
  supplier: string
  invoice_number: string
  invoice_total: string
  notes: string
  status: PurchaseStatus
  created_at?: string
  updated_at?: string
  items?: PurchaseItem[]
}

// ── Stock (Bestandsübersicht) ───────────────────────────────────

export interface StockEntry {
  id: number
  name: string
  supplier_group: string
  units_per_crate: number
  bottle_size: string | null
  quantity: number
  crates: number
  loose_bottles: number
  purchase_price: string
  deposit: string
  stock_value: string
  deposit_value: string
}
