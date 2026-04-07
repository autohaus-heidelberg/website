import type { PaginatedResponse } from '@/types/api'
import type {
  BeverageItem,
  EventAccounting,
  RevenueEntry,
  InventoryEntry,
  ExpenseEntry,
  AccountingSplit,
  AccountingSummary,
} from '@/types/accounting'

// ── LocalStorage helpers ────────────────────────────────────────
// Daten werden im Browser gespeichert, bis das Backend die
// Endpoints bereitstellt. Dann einfach diesen Service austauschen.

const STORAGE_KEYS = {
  beverages: 'accounting_beverages',
  accountings: 'accounting_events',
  revenues: 'accounting_revenues',
  inventory: 'accounting_inventory',
  expenses: 'accounting_expenses',
  splits: 'accounting_splits',
  nextId: 'accounting_next_id',
} as const

function getStore<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

function nextId(): number {
  const current = parseInt(localStorage.getItem(STORAGE_KEYS.nextId) || '1', 10)
  localStorage.setItem(STORAGE_KEYS.nextId, String(current + 1))
  return current
}

function paginate<T>(items: T[]): PaginatedResponse<T> {
  return { count: items.length, next: null, previous: null, results: items }
}

// delay to simulate async
const tick = () => new Promise<void>(r => setTimeout(r, 0))

// ── Seed-Daten: Standard-Getränke ──────────────────────────────
// Werden einmalig beim ersten Laden angelegt, wenn noch keine da sind.
const SEED_BEVERAGES: Omit<BeverageItem, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Kurpfalz hell',              supplier_group: 'Bier',     purchase_price: '20.00', selling_price: null, deposit: '3.10',  units_per_crate: 20, sort_order: 1,  is_active: true },
  { name: 'Faust Pils',                 supplier_group: 'Bier',     purchase_price: '19.00', selling_price: null, deposit: '3.10',  units_per_crate: 20, sort_order: 2,  is_active: true },
  { name: 'Eichbaum Ur-Eich',           supplier_group: 'Bier',     purchase_price: '18.00', selling_price: null, deposit: '3.42',  units_per_crate: 24, sort_order: 3,  is_active: true },
  { name: 'Faust Naturradler',          supplier_group: 'Bier',     purchase_price: '17.00', selling_price: null, deposit: '3.10',  units_per_crate: 20, sort_order: 4,  is_active: true },
  { name: 'Faust alkoholfrei',          supplier_group: 'Bier',     purchase_price: '17.50', selling_price: null, deposit: '3.10',  units_per_crate: 20, sort_order: 5,  is_active: true },
  { name: 'Paulaner Spezi',             supplier_group: 'Limo',     purchase_price: '15.50', selling_price: null, deposit: '3.42',  units_per_crate: 24, sort_order: 6,  is_active: true },
  { name: 'Club Mate',                  supplier_group: 'Limo',     purchase_price: '14.50', selling_price: null, deposit: '4.50',  units_per_crate: 20, sort_order: 7,  is_active: true },
  { name: 'Afri Cola',                  supplier_group: 'Limo',     purchase_price: '14.00', selling_price: null, deposit: '5.10',  units_per_crate: 24, sort_order: 8,  is_active: true },
  { name: 'Black Forrest still',        supplier_group: 'Wasser',   purchase_price: '10.50', selling_price: null, deposit: '6.50',  units_per_crate: 20, sort_order: 9,  is_active: true },
  { name: 'Prinzenperle classic',       supplier_group: 'Wasser',   purchase_price: '3.90',  selling_price: null, deposit: '3.30',  units_per_crate: 12, sort_order: 10, is_active: true },
  { name: 'Thomas Henry Tonic Water',   supplier_group: 'Wasser',   purchase_price: '13.50', selling_price: null, deposit: '2.40',  units_per_crate: 6,  sort_order: 11, is_active: true },
  { name: 'Seezüngle Birne',            supplier_group: 'Seezüngle', purchase_price: '12.00', selling_price: null, deposit: '3.15', units_per_crate: 11, sort_order: 12, is_active: true },
  { name: 'Seezüngle Rhabarber',        supplier_group: 'Seezüngle', purchase_price: '12.00', selling_price: null, deposit: '3.15', units_per_crate: 11, sort_order: 13, is_active: true },
  { name: 'Seezüngle Kirsche',          supplier_group: 'Seezüngle', purchase_price: '12.00', selling_price: null, deposit: '3.15', units_per_crate: 11, sort_order: 14, is_active: true },
  { name: 'Seezüngle Träuble',          supplier_group: 'Seezüngle', purchase_price: '12.00', selling_price: null, deposit: '3.15', units_per_crate: 11, sort_order: 15, is_active: true },
  // Flaschen-Getränke (units_per_crate = 1 → Einzelflaschen, Dezimal-Eingabe)
  { name: 'Rotwein',                    supplier_group: 'Wein',       purchase_price: '7.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 20, is_active: true },
  { name: 'Rotwein (Angebot)',          supplier_group: 'Wein',       purchase_price: '4.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 21, is_active: true },
  { name: 'Steinmänndel Rotwein',       supplier_group: 'Wein',       purchase_price: '3.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 22, is_active: true },
  { name: 'Riesling',                   supplier_group: 'Wein',       purchase_price: '3.79',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 23, is_active: true },
  { name: 'Riesling Tiefenb. Htr.',     supplier_group: 'Wein',       purchase_price: '4.79',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 24, is_active: true },
  { name: 'Riesling Neuenburger',       supplier_group: 'Wein',       purchase_price: '3.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 25, is_active: true },
  { name: 'Sekt Söhnlein (klein)',      supplier_group: 'Wein',       purchase_price: '2.49',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 26, is_active: true },
  { name: 'Sekt Söhnlein (groß)',       supplier_group: 'Wein',       purchase_price: '4.49',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 27, is_active: true },
  { name: 'Three Sixty Vodka (Angebot)', supplier_group: 'Spirituosen', purchase_price: '8.99', selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 30, is_active: true },
  { name: 'Bombay Sapphire Gin',        supplier_group: 'Spirituosen', purchase_price: '16.99', selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 31, is_active: true },
  { name: 'Gordon\'s Gin',              supplier_group: 'Spirituosen', purchase_price: '9.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 32, is_active: true },
  { name: 'Jägermeister',               supplier_group: 'Spirituosen', purchase_price: '10.99', selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 33, is_active: true },
  { name: 'Pfeffi',                     supplier_group: 'Spirituosen', purchase_price: '4.99',  selling_price: null, deposit: '0.00', units_per_crate: 1, sort_order: 34, is_active: true },
]

function seedBeveragesIfEmpty(): void {
  const existing = getStore<BeverageItem>(STORAGE_KEYS.beverages)
  if (existing.length > 0) return
  const now = new Date().toISOString()
  const seeded = SEED_BEVERAGES.map(b => ({
    ...b,
    id: nextId(),
    created_at: now,
    updated_at: now,
  }))
  setStore(STORAGE_KEYS.beverages, seeded)
}

seedBeveragesIfEmpty()

// ── Beverage Items ──────────────────────────────────────────────

export const beverageService = {
  async getAll(): Promise<PaginatedResponse<BeverageItem>> {
    await tick()
    return paginate(getStore<BeverageItem>(STORAGE_KEYS.beverages))
  },

  async getById(id: number): Promise<BeverageItem> {
    await tick()
    const item = getStore<BeverageItem>(STORAGE_KEYS.beverages).find(b => b.id === id)
    if (!item) throw new Error('Getränk nicht gefunden')
    return item
  },

  async create(item: Partial<BeverageItem>): Promise<BeverageItem> {
    await tick()
    const all = getStore<BeverageItem>(STORAGE_KEYS.beverages)
    const newItem: BeverageItem = {
      id: nextId(),
      name: item.name || '',
      supplier_group: item.supplier_group || '',
      purchase_price: item.purchase_price || '0.00',
      selling_price: item.selling_price || null,
      deposit: item.deposit || '0.00',
      units_per_crate: item.units_per_crate ?? 24,
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    all.push(newItem)
    setStore(STORAGE_KEYS.beverages, all)
    return newItem
  },

  async update(id: number, item: Partial<BeverageItem>): Promise<BeverageItem> {
    await tick()
    const all = getStore<BeverageItem>(STORAGE_KEYS.beverages)
    const idx = all.findIndex(b => b.id === id)
    if (idx === -1) throw new Error('Getränk nicht gefunden')
    all[idx] = { ...all[idx], ...item, updated_at: new Date().toISOString() }
    setStore(STORAGE_KEYS.beverages, all)
    return all[idx]
  },

  async delete(id: number): Promise<void> {
    await tick()
    const all = getStore<BeverageItem>(STORAGE_KEYS.beverages).filter(b => b.id !== id)
    setStore(STORAGE_KEYS.beverages, all)
  },
}

// ── Event Accounting ────────────────────────────────────────────

export const accountingService = {
  async getAll(): Promise<PaginatedResponse<EventAccounting>> {
    await tick()
    return paginate(getStore<EventAccounting>(STORAGE_KEYS.accountings))
  },

  async getByEvent(eventId: string): Promise<EventAccounting> {
    await tick()
    const item = getStore<EventAccounting>(STORAGE_KEYS.accountings).find(a => a.event === eventId)
    if (!item) throw new Error('Keine Abrechnung für dieses Event')
    return item
  },

  async create(data: Partial<EventAccounting>): Promise<EventAccounting> {
    await tick()
    const all = getStore<EventAccounting>(STORAGE_KEYS.accountings)
    const newItem: EventAccounting = {
      id: nextId(),
      event: data.event || '',
      status: data.status || 'draft',
      notes: data.notes || '',
      deposit_return: data.deposit_return || '0.00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    all.push(newItem)
    setStore(STORAGE_KEYS.accountings, all)
    return newItem
  },

  async update(id: number, data: Partial<EventAccounting>): Promise<EventAccounting> {
    await tick()
    const all = getStore<EventAccounting>(STORAGE_KEYS.accountings)
    const idx = all.findIndex(a => a.id === id)
    if (idx === -1) throw new Error('Abrechnung nicht gefunden')
    all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() }
    setStore(STORAGE_KEYS.accountings, all)
    return all[idx]
  },

  async getSummary(_id: number): Promise<AccountingSummary> {
    await tick()
    return {
      total_revenue: '0', total_revenue_by_group: [],
      total_expenses: '0', total_inventory_value_before: '0',
      total_inventory_value_after: '0', total_consumption_value: '0',
      deposit_return: '0', result: '0', splits: [],
    }
  },

  // ── Revenues ──

  async getRevenues(accountingId: number): Promise<RevenueEntry[]> {
    await tick()
    return getStore<RevenueEntry>(STORAGE_KEYS.revenues).filter(r => r.accounting === accountingId)
  },

  async saveRevenue(accountingId: number, entry: Partial<RevenueEntry>): Promise<RevenueEntry> {
    await tick()
    const all = getStore<RevenueEntry>(STORAGE_KEYS.revenues)
    if (entry.id) {
      const idx = all.findIndex(r => r.id === entry.id)
      if (idx !== -1) { all[idx] = { ...all[idx], ...entry }; setStore(STORAGE_KEYS.revenues, all); return all[idx] }
    }
    const newEntry: RevenueEntry = {
      id: nextId(),
      accounting: accountingId,
      source: entry.source || 'bar_cash',
      total: entry.total || '0.00',
      change_money: entry.change_money || '0.00',
      fees: entry.fees || '0.00',
    }
    all.push(newEntry)
    setStore(STORAGE_KEYS.revenues, all)
    return newEntry
  },

  async deleteRevenue(_accountingId: number, entryId: number): Promise<void> {
    await tick()
    setStore(STORAGE_KEYS.revenues, getStore<RevenueEntry>(STORAGE_KEYS.revenues).filter(r => r.id !== entryId))
  },

  // ── Inventory ──

  async getInventory(accountingId: number): Promise<InventoryEntry[]> {
    await tick()
    return getStore<InventoryEntry>(STORAGE_KEYS.inventory).filter(i => i.accounting === accountingId)
  },

  async saveInventory(accountingId: number, entry: Partial<InventoryEntry>): Promise<InventoryEntry> {
    await tick()
    const all = getStore<InventoryEntry>(STORAGE_KEYS.inventory)
    if (entry.id) {
      const idx = all.findIndex(i => i.id === entry.id)
      if (idx !== -1) { all[idx] = { ...all[idx], ...entry }; setStore(STORAGE_KEYS.inventory, all); return all[idx] }
    }
    const newEntry: InventoryEntry = {
      id: nextId(),
      accounting: accountingId,
      beverage_item: entry.beverage_item || 0,
      quantity_before: entry.quantity_before || '0',
      quantity_after: entry.quantity_after || '0',
    }
    all.push(newEntry)
    setStore(STORAGE_KEYS.inventory, all)
    return newEntry
  },

  async saveAllInventory(accountingId: number, entries: Partial<InventoryEntry>[]): Promise<InventoryEntry[]> {
    await tick()
    const results: InventoryEntry[] = []
    for (const entry of entries) {
      results.push(await this.saveInventory(accountingId, entry))
    }
    return results
  },

  // ── Expenses ──

  async getExpenses(accountingId: number): Promise<ExpenseEntry[]> {
    await tick()
    return getStore<ExpenseEntry>(STORAGE_KEYS.expenses).filter(e => e.accounting === accountingId)
  },

  async saveExpense(accountingId: number, entry: Partial<ExpenseEntry>): Promise<ExpenseEntry> {
    await tick()
    const all = getStore<ExpenseEntry>(STORAGE_KEYS.expenses)
    if (entry.id) {
      const idx = all.findIndex(e => e.id === entry.id)
      if (idx !== -1) { all[idx] = { ...all[idx], ...entry }; setStore(STORAGE_KEYS.expenses, all); return all[idx] }
    }
    const newEntry: ExpenseEntry = {
      id: nextId(),
      accounting: accountingId,
      description: entry.description || '',
      amount: entry.amount || '0.00',
      notes: entry.notes || '',
      paid_from: entry.paid_from || 'bar_cash',
      is_paid_out: entry.is_paid_out ?? false,
    }
    all.push(newEntry)
    setStore(STORAGE_KEYS.expenses, all)
    return newEntry
  },

  async deleteExpense(_accountingId: number, entryId: number): Promise<void> {
    await tick()
    setStore(STORAGE_KEYS.expenses, getStore<ExpenseEntry>(STORAGE_KEYS.expenses).filter(e => e.id !== entryId))
  },

  // ── Splits ──

  async getSplits(accountingId: number): Promise<AccountingSplit[]> {
    await tick()
    return getStore<AccountingSplit>(STORAGE_KEYS.splits).filter(s => s.accounting === accountingId)
  },

  async saveSplit(accountingId: number, entry: Partial<AccountingSplit>): Promise<AccountingSplit> {
    await tick()
    const all = getStore<AccountingSplit>(STORAGE_KEYS.splits)
    if (entry.id) {
      const idx = all.findIndex(s => s.id === entry.id)
      if (idx !== -1) { all[idx] = { ...all[idx], ...entry }; setStore(STORAGE_KEYS.splits, all); return all[idx] }
    }
    const newEntry: AccountingSplit = {
      id: nextId(),
      accounting: accountingId,
      participant_name: entry.participant_name || '',
      share_percentage: entry.share_percentage || '0',
    }
    all.push(newEntry)
    setStore(STORAGE_KEYS.splits, all)
    return newEntry
  },

  async deleteSplit(_accountingId: number, entryId: number): Promise<void> {
    await tick()
    setStore(STORAGE_KEYS.splits, getStore<AccountingSplit>(STORAGE_KEYS.splits).filter(s => s.id !== entryId))
  },
}
