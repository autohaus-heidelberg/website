<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { accountingService, beverageService, eventService, pretixService, paypalBarService, grantService, stockService, documentService } from '@/services'
import type { Event } from '@/services'
import type { PretixOrderSummary, PayPalBarSummary, PayPalCategory, EventDocument } from '@/services/accounting'
import type {
  EventAccounting,
  RevenueEntry,
  RevenueSource,
  InventoryEntry,
  ExpenseEntry,
  AccountingSplit,
  ExpensePaidFrom,
  BeverageItem,
  GrantApplication,
  GrantSummary,
  StockEntry,
  TaxSphere,
  VatRate,
} from '@/types/accounting'
import {
  REVENUE_SOURCE_LABELS,
  REVENUE_GROUPS,
  EXPENSE_PAID_FROM_LABELS,
  TAX_SPHERE_LABELS,
  VAT_RATE_LABELS,
} from '@/types/accounting'
import { useSort } from '@/composables/useSort'
import { parseQty, qtyEquals, normalizeQty } from '@/utils/quantity'
import { useAuthStore } from '@/stores/auth'


const props = defineProps<{
  eventId: string
}>()

const router = useRouter()
const authStore = useAuthStore()
const activeTab = ref('cashcount')
const showOverflow = ref(false)
const expandedSources = ref<Set<string>>(new Set())

// ── State ────────────────────────────────────────────────────────
const event = ref<Event | null>(null)
const accounting = ref<EventAccounting | null>(null)
const beverages = ref<BeverageItem[]>([])
const stockData = ref<Record<number, StockEntry>>({})
const revenues = ref<RevenueEntry[]>([])
const inventory = ref<InventoryEntry[]>([])
const expenses = ref<ExpenseEntry[]>([])
const splits = ref<AccountingSplit[]>([])

const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const saveSuccess = ref('')
const stockChangedWarning = ref('')

// FIFO stock conflicts surfaced from the last save attempt. Keyed by drink_id.
// Cleared per-drink when the user edits that drink's row, or globally on a
// successful save.
type InventoryConflict = { drink: string; available: number; requested: number }
const inventoryConflicts = reactive(new Map<number, InventoryConflict>())

// ── Pretix VVK ───────────────────────────────────────────────────
const pretixData = ref<PretixOrderSummary | null>(null)
const pretixLoading = ref(false)
const pretixError = ref('')

// ── PayPal Bar ───────────────────────────────────────────────────
const paypalBarData = ref<PayPalBarSummary | null>(null)
const paypalBarLoading = ref(false)
const paypalBarError = ref('')

// ── Grant (Förderung) ────────────────────────────────────────────
const grantTouched = ref(false)
const grantRecord = ref<GrantApplication | null>(null)
const grantSummary = ref<GrantSummary | null>(null)
const grantSubTab = ref<'antrag' | 'nachweis'>('antrag')
const rentFlatAmount = ref(134.46)
const approvedAmount = ref<number | null>(null)
const grantDownloading = ref<string | null>(null)

// Zuwendungsbescheid
const zuwendungsbescheidDate = ref('')
const auszahlungAmount = ref<number | null>(null)

// Sachbericht
const sachbericht = ref('')
const grantNotes = ref('')

function generateDefaultSachbericht() {
  if (!event.value) return
  const e = event.value
  const dateStr = new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const weekday = new Date(e.date).toLocaleDateString('de-DE', { weekday: 'long' })
  const artistNames = e.artists.map(a => a.name)
  const hasDJ = artistNames.some(n => /\bdj\b/i.test(n))
  const isWeekend = [5, 6].includes(new Date(e.date).getDay()) // Fr=5, Sa=6
  const startTime = isWeekend ? '21:00' : '20:00'

  let text = `Die Veranstaltung „${e.title}" fand am ${weekday}, den ${dateStr} im Alten Autohaus Heidelberg statt. `
  text += `Sie wurde über soziale Medien, die Webseite, den Newsletter und Plakatierung beworben und zog ein Publikum aus Heidelberg und der Großregion an. `
  text += `Dank reibungslosem Einsatz der ehrenamtlichen Helfer*innen konnte das Konzert nach Aufbau, Soundcheck und hausgemachtem Abendessen pünktlich gegen ${startTime} beginnen. `

  if (artistNames.length === 1) {
    text += `${artistNames[0]} boten einen mitreißenden Auftritt, der das Publikum begeisterte. `
  } else if (artistNames.length >= 2) {
    text += `${artistNames[0]} eröffneten den Abend und wussten dem Publikum ordentlich einzuheizen. `
    for (let i = 1; i < artistNames.length - 1; i++) {
      text += `Im Anschluss begeisterten ${artistNames[i]} das Publikum mit einem energiegeladenen Auftritt. `
    }
    const last = artistNames[artistNames.length - 1]
    text += `${last} legten nochmal eine Schippe drauf und boten einen Auftritt der Superlative. `
  }

  const endTime = isWeekend ? '03:00' : '01:00'
  if (hasDJ) {
    text += `Nach Ende des Konzertes wurde rasch aufgeräumt, bevor die Gäste und Künstler*innen glücklich und zufrieden gegen ${endTime} die Heimreise bzw. den Weg ins Hotel antraten.`
  } else {
    text += `Nach Ende des Konzertes wurde rasch aufgeräumt, bevor die Gäste und Künstler*innen glücklich und zufrieden gegen ${endTime} die Heimreise bzw. den Weg ins Hotel antraten.`
  }

  sachbericht.value = text
}

// Budget plan (expected expenses & revenues for Antrag)
const budgetKuenstler = ref<{ name: string; amount: string }[]>([])
const budgetSachkosten = ref<{ name: string; amount: string }[]>([])
const budgetSonstiges = ref<{ name: string; amount: string }[]>([])
const budgetRevEintritt = ref('0')
const budgetRevGetraenke = ref('0')
const budgetRevEigenmittel = ref('0')
const budgetRevDrittmittel = ref('0')
const budgetRevSonstige = ref('0')

// ── Documents (Google Drive) ────────
const documents = ref<EventDocument[]>([])
const isLoadingDocs = ref(false)
const uploadingFiles = ref<{ name: string }[]>([])
const dragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadError = ref('')

const paypalBarTotals = computed(() => {
  if (!paypalBarData.value) return { amount: 0, fees: 0, net: 0, count: 0 }
  const txns = paypalBarData.value.transactions
  return {
    amount: txns.reduce((s, t) => s + t.amount, 0),
    fees: txns.reduce((s, t) => s + t.fee, 0),
    net: txns.reduce((s, t) => s + t.net, 0),
    count: txns.length,
  }
})

const paypalBarCategoryTotals = computed(() => {
  if (!paypalBarData.value) return { bar: { amount: 0, fees: 0, count: 0 }, entrance: { amount: 0, fees: 0, count: 0 } }
  const txns = paypalBarData.value.transactions
  const bar = txns.filter(t => t.category === 'bar')
  const entrance = txns.filter(t => t.category === 'entrance')
  return {
    bar: { amount: bar.reduce((s, t) => s + t.amount, 0), fees: bar.reduce((s, t) => s + t.fee, 0), count: bar.length },
    entrance: { amount: entrance.reduce((s, t) => s + t.amount, 0), fees: entrance.reduce((s, t) => s + t.fee, 0), count: entrance.length },
  }
})

function paypalTransactionsFor(category: 'bar' | 'entrance') {
  if (!paypalBarData.value) return []
  return paypalBarData.value.transactions
    .map((txn, idx) => ({ txn, idx }))
    .filter(({ txn }) => txn.category === category)
}

// ── Sorting ──────────────────────────────────────────────────────
const invSort = useSort<{ beverage: BeverageItem; entry: InventoryEntry }>()
const expSort = useSort<ExpenseEntry>()

function sortedInventory(items: { beverage: BeverageItem; entry: InventoryEntry }[]) {
  return invSort.sorted(items, (item, key) => {
    switch (key) {
      case 'name': return item.beverage.name.toLowerCase()
      case 'before': return parseFloat(item.entry.quantity_before || '0')
      case 'after': return parseFloat(item.entry.quantity_after || '0')
      case 'consumed': return inventoryConsumption(item.entry)
      case 'value': return inventoryValue(item.entry, item.beverage)
      default: return 0
    }
  })
}

const sortedExpenses = computed(() => {
  return expSort.sorted(expenses.value, (item, key) => {
    switch (key) {
      case 'desc': return (item.description || '').toLowerCase()
      case 'amount': return parseFloat(item.amount || '0')
      default: return 0
    }
  })
})

// ── Combined External Data Fetch ─────────────────────────────────
const externalDataLoading = ref(false)
const externalDataLoaded = ref(false)

// ── Result tab expand toggles ────────────────────────────────────
const resultExpandRevenue = ref(false)
const resultExpandInventory = ref(false)
const resultExpandExpenses = ref(false)
const resultExpandVat = ref(false)

async function fetchAndApplyAllExternal() {
  if (!props.eventId) return
  externalDataLoading.value = true
  pretixError.value = ''
  paypalBarError.value = ''

  const results = await Promise.allSettled([
    pretixService.getOrderSummary(props.eventId),
    paypalBarService.getBarTransactions(props.eventId),
  ])

  // Pretix
  if (results[0].status === 'fulfilled') {
    pretixData.value = results[0].value
    applyPretixData()
  } else {
    pretixError.value = results[0].reason?.message || 'Pretix-Daten konnten nicht geladen werden'
  }

  // PayPal
  if (results[1].status === 'fulfilled') {
    paypalBarData.value = results[1].value
    applyPaypalBarData()
  } else {
    paypalBarError.value = results[1].reason?.message || 'PayPal-Daten konnten nicht geladen werden'
  }

  externalDataLoaded.value = true
  externalDataLoading.value = false
}

async function fetchPretixData() {
  if (!props.eventId) return
  pretixLoading.value = true
  pretixError.value = ''
  try {
    pretixData.value = await pretixService.getOrderSummary(props.eventId)
  } catch (e: any) {
    pretixError.value = e.message || 'Pretix-Daten konnten nicht geladen werden'
  } finally {
    pretixLoading.value = false
  }
}

function applyPretixData() {
  if (!pretixData.value) return
  const d = pretixData.value
  const totalFees = d.pretix_fee + Object.values(d.by_source).reduce((s, i) => s + i.fees, 0)
  const rev = getRevenue('vvk_pretix')
  rev.total = d.total_revenue.toFixed(2)
  rev.fees = totalFees.toFixed(2)
  rev.change_money = '0.00'
}

async function fetchPaypalBarData() {
  if (!props.eventId) return
  paypalBarLoading.value = true
  paypalBarError.value = ''
  try {
    paypalBarData.value = await paypalBarService.getBarTransactions(props.eventId)
  } catch (e: any) {
    paypalBarError.value = e.message || 'PayPal-Daten konnten nicht geladen werden'
  } finally {
    paypalBarLoading.value = false
  }
}

function applyPaypalBarData() {
  if (!paypalBarData.value) return
  const ct = paypalBarCategoryTotals.value
  // Apply bar transactions
  const barRev = getRevenue('bar_paypal')
  barRev.total = ct.bar.amount.toFixed(2)
  barRev.fees = ct.bar.fees.toFixed(2)
  barRev.change_money = '0.00'
  // Apply entrance transactions
  const entranceRev = getRevenue('entrance_paypal')
  entranceRev.total = ct.entrance.amount.toFixed(2)
  entranceRev.fees = ct.entrance.fees.toFixed(2)
  entranceRev.change_money = '0.00'
}

function removePaypalBarTransaction(idx: number) {
  if (!paypalBarData.value) return
  paypalBarData.value.transactions.splice(idx, 1)
}

function togglePaypalCategory(idx: number) {
  if (!paypalBarData.value) return
  const txn = paypalBarData.value.transactions[idx]
  txn.category = txn.category === 'bar' ? 'entrance' : 'bar'
  applyPaypalBarData()
}

function setAllPaypalCategory(category: PayPalCategory) {
  if (!paypalBarData.value) return
  paypalBarData.value.transactions.forEach(t => { t.category = category })
  applyPaypalBarData()
}

// ── Computed: Revenue ────────────────────────────────────────────

const allRevenueSources: RevenueSource[] = [
  'bar_cash', 'bar_paypal',
  'entrance_cash', 'entrance_paypal',
  'vvk_pretix',
]

function getRevenue(source: RevenueSource): RevenueEntry {
  const existing = revenues.value.find(r => r.source === source)
  if (existing) return existing
  const entry: RevenueEntry = {
    accounting: accounting.value?.id || 0,
    source,
    total: '0.00',
    change_money: '0.00',
    fees: '0.00',
  }
  revenues.value.push(entry)
  return entry
}

function revenueNet(entry: RevenueEntry): number {
  return parseFloat(entry.total || '0') - parseFloat(entry.change_money || '0') - parseFloat(entry.fees || '0')
}

const totalRevenue = computed(() => {
  return revenues.value.reduce((sum, r) => sum + revenueNet(r), 0)
})

function groupRevenue(sources: RevenueSource[]): number {
  return revenues.value
    .filter(r => sources.includes(r.source))
    .reduce((sum, r) => sum + revenueNet(r), 0)
}

function groupRevenueGross(sources: RevenueSource[]): number {
  const net = groupRevenue(sources)
  const cashSources = sources.filter(s => s.endsWith('_cash'))
  const paidOut = cashSources.reduce((sum, s) => sum + expensesFromSource(s), 0)
  return net + paidOut
}

function toggleSourceExpanded(source: string) {
  if (expandedSources.value.has(source)) {
    expandedSources.value.delete(source)
  } else {
    expandedSources.value.add(source)
  }
}

// ── Computed: Inventory ──────────────────────────────────────────

// ── Kisten/Flaschen-Hilfs-State für Inventur-UI ─────────────────
// Speichert die aufgeteilte Eingabe (Kisten + Einzelflaschen),
// berechnet daraus den Gesamtwert für quantity_before / quantity_after.
const inventoryCrates = ref<Record<string, { beforeCrates: number; beforeBottles: number; afterCrates: number; afterBottles: number }>>({})

function crateKey(bevId: number, field: 'before' | 'after'): string {
  return `${bevId}_${field}`
}

function getOrInitCrateState(bevId: number, unitsPerCrate: number, entry: InventoryEntry) {
  const key = String(bevId)
  if (!inventoryCrates.value[key]) {
    const totalBefore = parseFloat(entry.quantity_before || '0')
    const totalAfter = parseFloat(entry.quantity_after || '0')
    inventoryCrates.value[key] = {
      beforeCrates: Math.floor(totalBefore / unitsPerCrate),
      beforeBottles: Math.round((totalBefore % unitsPerCrate) * 100) / 100,
      afterCrates: Math.floor(totalAfter / unitsPerCrate),
      afterBottles: Math.round((totalAfter % unitsPerCrate) * 100) / 100,
    }
  }
  return inventoryCrates.value[key]
}

/** Recompute and store consumed_quantity = max(0, before - after).
 * This is the user-intent we persist; quantity_before may shift independently
 * (parallel-tab corrections, retroactive purchases) without losing the intent.
 *
 * Also clears any sticky stock-conflict for this drink — the user has just
 * acknowledged the warning by editing.
 */
function recomputeConsumed(entry: InventoryEntry) {
  const before = parseFloat(entry.quantity_before || '0')
  const after = parseFloat(entry.quantity_after || '0')
  const consumed = Math.max(0, before - after)
  entry.consumed_quantity = String(consumed)
  inventoryConflicts.delete(entry.beverage_item)
  // If the user dialed consumption back to 0, the row is no longer "confirmed"
  // (no user intent left). Without this the row would still pass the save
  // filter and produce an empty AbrechnungsItem on the server.
  if (consumed === 0) {
    confirmedInventory.delete(entry.beverage_item)
  }
}

function updateEntryFromCrates(entry: InventoryEntry, beverage: BeverageItem) {
  const state = inventoryCrates.value[String(beverage.id)]
  if (!state) return
  const upc = beverage.units_per_crate || 1
  entry.quantity_before = String(state.beforeCrates * upc + state.beforeBottles)
  entry.quantity_after = String(state.afterCrates * upc + state.afterBottles)
  recomputeConsumed(entry)
}

const inventoryBySupplier = computed(() => {
  const groups: Record<string, { beverage: BeverageItem; entry: InventoryEntry }[]> = {}
  for (const bev of beverages.value) {
    if (!bev.is_active) continue
    const group = bev.supplier_group || 'Sonstige'
    if (!groups[group]) groups[group] = []
    const entry = inventory.value.find(i => i.beverage_item === bev.id)
    // Server ships virtual inventory_entries (id=null, consumed=0) for every
    // active drink, so this lookup should always hit. If it doesn't, the
    // beverage is genuinely outside the current accounting context — skip
    // rather than mutating `inventory.value` from inside a computed (which
    // triggers re-evaluation cascades and leaves rows with no snapshot data).
    if (!entry) continue
    getOrInitCrateState(bev.id!, bev.units_per_crate || 1, entry)
    groups[group].push({ beverage: bev, entry })
  }
  return groups
})

function inventoryConsumption(entry: InventoryEntry): number {
  const val = parseFloat(entry.quantity_before || '0') - parseFloat(entry.quantity_after || '0')
  return Math.round(val * 100) / 100
}

function inventoryValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const consumedCrates = inventoryConsumption(entry) / upc
  const price = parseFloat(entry.snapshot_purchase_price || beverage.purchase_price || '0')
  const deposit = parseFloat(entry.snapshot_deposit || beverage.deposit || '0')
  return consumedCrates * (price + deposit)
}

function groupInventoryValue(items: { beverage: BeverageItem; entry: InventoryEntry }[]): number {
  return items.reduce((sum, { beverage, entry }) => sum + inventoryValue(entry, beverage), 0)
}

// ── Mobile Inventory Helpers ─────────────────────────────────────
const hideZeroStock = ref(true)
// Tracks explicit user touch — used to keep the row in the save list even
// when the user edited it back to consumed_quantity = 0 (so the persisted
// row gets a real save instead of being silently filtered out).
const confirmedInventory = reactive(new Set<number>())

/** A row is visually "confirmed" (gelb) when the user has expressed an
 *  intent — currently meaning consumed_quantity > 0. Resetting consumed back
 *  to 0 reverts the row to "pending" appearance. */
function isInventoryConfirmed(entry: InventoryEntry): boolean {
  return parseFloat(entry.consumed_quantity || '0') > 0
}

function stepCrate(beverage: BeverageItem, entry: InventoryEntry, field: 'after' | 'before', delta: number) {
  const state = getOrInitCrateState(beverage.id!, beverage.units_per_crate || 1, entry)
  const key = field === 'after' ? 'afterCrates' : 'beforeCrates'
  state[key] = Math.max(0, state[key] + delta)
  updateEntryFromCrates(entry, beverage)
  if (field === 'after') confirmedInventory.add(beverage.id!)
}

function stepBottle(beverage: BeverageItem, entry: InventoryEntry, field: 'after' | 'before', delta: number) {
  const upc = beverage.units_per_crate || 1
  if (upc > 1) {
    const state = getOrInitCrateState(beverage.id!, upc, entry)
    const key = field === 'after' ? 'afterBottles' : 'beforeBottles'
    state[key] = Math.max(0, state[key] + delta)
    updateEntryFromCrates(entry, beverage)
  } else {
    const current = parseFloat(entry[field === 'after' ? 'quantity_after' : 'quantity_before'] || '0')
    const step = 0.25
    const newVal = Math.max(0, current + delta * step)
    if (field === 'after') entry.quantity_after = String(newVal)
    else entry.quantity_before = String(newVal)
    recomputeConsumed(entry)
  }
  if (field === 'after') confirmedInventory.add(beverage.id!)
}

function inventoryItemVisible(entry: InventoryEntry): boolean {
  if (!hideZeroStock.value) return true
  return parseFloat(entry.quantity_before || '0') > 0 || parseFloat(entry.quantity_after || '0') > 0
}

function inventoryProgress(items: { beverage: BeverageItem; entry: InventoryEntry }[]): string {
  const visible = items.filter(({ entry }) => inventoryItemVisible(entry))
  const confirmed = visible.filter(({ entry }) => isInventoryConfirmed(entry))
  return `${confirmed.length}/${visible.length}`
}

const totalInventoryValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + groupInventoryValue(items), 0
  )
})

function stockValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const afterCrates = parseFloat(entry.quantity_after || '0') / upc
  const price = parseFloat(entry.snapshot_purchase_price || beverage.purchase_price || '0')
  const deposit = parseFloat(entry.snapshot_deposit || beverage.deposit || '0')
  return afterCrates * (price + deposit)
}

const totalStockValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + items.reduce(
      (s, { beverage, entry }) => s + stockValue(entry, beverage), 0
    ), 0
  )
})

// ── Computed: Expenses ───────────────────────────────────────────

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

// Expenses paid from a cash register are already deducted from the cash count,
// so we need to add them back to get the true revenue.
function expensesFromSource(source: string): number {
  return expenses.value
    .filter(e => e.paid_from === source)
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
}

const expensesPaidFromRegister = computed(() => {
  return expensesFromSource('entrance_cash') + expensesFromSource('bar_cash')
})

const externalExpenses = computed(() => {
  return expenses.value
    .filter(e => e.paid_from === 'other')
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

function addExpense() {
  expenses.value.push({
    accounting: accounting.value?.id || 0,
    description: '',
    amount: '0.00',
    notes: '',
    paid_from: 'bar_cash',
  })
}

function removeExpense(index: number) {
  expenses.value.splice(index, 1)
}

// ── Computed: Result ─────────────────────────────────────────────

// True revenue = cash counted + expenses paid from registers (which reduced the count)
const adjustedRevenue = computed(() => {
  return totalRevenue.value + expensesPaidFromRegister.value
})

const artistHospitality = computed(() => {
  return (event.value?.artists?.length ?? 0) * 20
})

const result = computed(() => {
  return adjustedRevenue.value - totalExpenses.value - totalInventoryValue.value
})

// ── USt (Umsatzsteuer) ───────────────────────────────────────────
// Output-USt (Erlöse): Eintritt 7%, Getränke 19%.
// Berechnet aus den Brutto-Einnahmen (Netto + aus Kasse bezahlt).
const vat7Entrance = computed(() => {
  const gross = groupRevenueGross(REVENUE_GROUPS[1].sources)
  return gross - gross / 1.07
})

const vat19Bar = computed(() => {
  const gross = groupRevenueGross(REVENUE_GROUPS[0].sources)
  return gross - gross / 1.19
})

const vatOutput = computed(() => {
  return vat7Entrance.value + vat19Bar.value
})

// Vorsteuer (Eingänge): Wareneinsatz pauschal 19% (Getränke + Pfand),
// Ausgaben gemäß ihrem vat_rate-Feld (none/7/19).
const inputVatInventory = computed(() => {
  // Wareneinsatz ist Brutto inkl. 19% — Vorsteuer = brutto * 19/119
  return totalInventoryValue.value * 0.19 / 1.19
})

const inputVatExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => {
    const amt = parseFloat(e.amount || '0')
    if (!amt || !e.vat_rate || e.vat_rate === 'none') return sum
    const rate = e.vat_rate === '7' ? 7 : e.vat_rate === '19' ? 19 : 0
    if (!rate) return sum
    return sum + amt * rate / (100 + rate)
  }, 0)
})

const vatInput = computed(() => {
  return inputVatInventory.value + inputVatExpenses.value
})

// Zahllast (oder Erstattung bei negativem Wert): Output-USt − Vorsteuer.
const vatLiability = computed(() => {
  return vatOutput.value - vatInput.value
})

// Backwards-compat alias used by existing template.
const vatTotal = vatLiability

// Wahres Ergebnis nach USt-Korrektur:
//   echtes Netto-Ergebnis = result − (Output-USt − Vorsteuer)
// Bei mehr Vorsteuer als Output-USt wird das Ergebnis besser (Erstattung).
const resultAfterVat = computed(() => {
  return result.value - vatLiability.value
})

function addSplit() {
  splits.value.push({
    accounting: accounting.value?.id || 0,
    participant_name: '',
    share_percentage: '0',
  })
}

function removeSplit(index: number) {
  splits.value.splice(index, 1)
}

// Verteilungsbasis ist das Ergebnis nach USt — die USt-Zahllast gehört dem
// Finanzamt und ist kein Gewinn der Beteiligten. Sie wird in der UI als
// separate, nicht-editierbare „Finanzamt"-Position oben in der Splits-Tabelle
// angezeigt; die %-Splits rechnen auf `resultAfterVat`.
function splitAmount(split: AccountingSplit): number {
  const pct = parseFloat(split.share_percentage || '0')
  return resultAfterVat.value * (pct / 100)
}

const totalSplitPercentage = computed(() => {
  return splits.value.reduce((sum, s) => sum + parseFloat(s.share_percentage || '0'), 0)
})

const remainingAfterSplits = computed(() => {
  return resultAfterVat.value - splits.value.reduce((sum, s) => sum + splitAmount(s), 0)
})

// ── Grant computeds ──────────────────────────────────────────────

const grantRecordedExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

const grantCostOfGoods = computed(() => {
  return Math.max(0, totalInventoryValue.value - artistHospitality.value)
})

const grantTotalEligible = computed(() => {
  return grantRecordedExpenses.value + artistHospitality.value + grantCostOfGoods.value + rentFlatAmount.value
})

const grantAdmissionRevenue = computed(() => {
  const admissionNet = revenues.value
    .filter(r => r.source === 'entrance_cash' || r.source === 'entrance_paypal' || r.source === 'vvk_pretix')
    .reduce((sum, r) => sum + revenueNet(r), 0)
  // Add back expenses paid from entrance cash (these were admission revenue used for payouts)
  return admissionNet + expensesFromSource('entrance_cash')
})

const grantBarContribution = computed(() => {
  const barTotal = revenues.value
    .filter(r => r.source === 'bar_cash' || r.source === 'bar_paypal')
    .reduce((sum, r) => sum + revenueNet(r), 0)
  return barTotal * 0.2
})

const grantTotalOwnRevenue = computed(() => {
  return grantAdmissionRevenue.value + grantBarContribution.value
})

const grantEligibleAmount = computed(() => {
  return Math.max(0, grantTotalEligible.value - grantTotalOwnRevenue.value)
})

const grantAmount = computed(() => {
  const calculated = Math.min(1000, grantEligibleAmount.value)
  if (approvedAmount.value != null && approvedAmount.value > 0) {
    return Math.min(calculated, approvedAmount.value)
  }
  return calculated
})

// ── Kostenplan-based computeds (for Antrag) ──────────────────────

const budgetTotalKuenstler = computed(() => {
  return budgetKuenstler.value.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
})

const budgetTotalSachkosten = computed(() => {
  return budgetSachkosten.value.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
})

const budgetTotalSonstiges = computed(() => {
  return budgetSonstiges.value.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
})

const budgetTotalExpenses = computed(() => {
  return budgetTotalKuenstler.value + budgetTotalSachkosten.value + budgetTotalSonstiges.value + rentFlatAmount.value
})

const budgetTotalRevenues = computed(() => {
  return (parseFloat(budgetRevEintritt.value) || 0)
    + (parseFloat(budgetRevGetraenke.value) || 0)
    + (parseFloat(budgetRevEigenmittel.value) || 0)
    + (parseFloat(budgetRevDrittmittel.value) || 0)
    + (parseFloat(budgetRevSonstige.value) || 0)
})

const budgetEligibleAmount = computed(() => {
  return Math.max(0, budgetTotalExpenses.value - budgetTotalRevenues.value)
})

const budgetGrantAmount = computed(() => {
  return Math.min(1000, budgetEligibleAmount.value)
})

// ── Format helpers ───────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatQty(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '0' : n.toLocaleString('de-DE')
}

function formatTime(isoString: string): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// ── Load & Save ──────────────────────────────────────────────────

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    const [ev, bevData] = await Promise.all([
      eventService.getById(props.eventId),
      beverageService.getAll(),
    ])
    event.value = ev
    beverages.value = bevData.results

    // Fetch current stock for auto-fill and warnings
    try {
      const stockEntries = await stockService.getAll()
      const map: Record<number, StockEntry> = {}
      for (const s of stockEntries) map[s.id] = s
      stockData.value = map
    } catch { /* stock is optional */ }

    try {
      const acc = await accountingService.getOrCreateByEvent(props.eventId)
      accounting.value = acc

      // Nested data is included in the accounting response
      revenues.value = acc.revenues ?? []
      inventory.value = acc.inventory_entries ?? []
      // Normalize and mark loaded entries as confirmed if they have consumption
      for (const entry of inventory.value) {
        entry.quantity_before = normalizeQty(entry.quantity_before)
        entry.quantity_after = normalizeQty(entry.quantity_after)
        entry.consumed_quantity = normalizeQty(entry.consumed_quantity ?? '0')
        if (parseFloat(entry.consumed_quantity) > 0) {
          confirmedInventory.add(entry.beverage_item)
        }
      }
      expenses.value = acc.expenses ?? []
      // Auto-assign grant_category for known expense types
      for (const exp of expenses.value) {
        if (!exp.grant_category && exp.description) {
          const desc = exp.description.toLowerCase()
          if (/gema|ksk|künstlersozial/.test(desc)) {
            exp.grant_category = 'sachkosten'
          }
        }
      }
      splits.value = acc.splits ?? []
    } catch (e: any) {
      error.value = e.message || 'Abrechnung konnte nicht geladen werden'
    }

    // Default splits: Bernd 33%, Carousel e.V. 67%
    // Only initialize for treasurers — non-treasurers receive splits=[] from
    // the backend and we must not seed default splits that would later be
    // sent on save (which the backend would silently drop, but it's cleaner
    // not to populate them at all).
    if (accounting.value && splits.value.length === 0 && authStore.isTreasurer) {
      splits.value.push(
        {
          accounting: accounting.value?.id || 0,
          participant_name: 'Bernd',
          share_percentage: '33',
        },
        {
          accounting: accounting.value?.id || 0,
          participant_name: 'Carousel e.V.',
          share_percentage: '67',
        },
      )
    }

    // Load grant record (optional)
    try {
      const existing = await grantService.getByEvent(props.eventId)
      if (existing) {
        grantRecord.value = existing
        const rent = parseFloat(existing.annual_rent_costs || '0')
        rentFlatAmount.value = rent > 0 ? rent : 134.46
        const approved = parseFloat(existing.approved_amount || '0')
        approvedAmount.value = approved > 0 ? approved : null

        // Zuwendungsbescheid fields
        zuwendungsbescheidDate.value = existing.zuwendungsbescheid_date || ''
        const auszahlung = parseFloat(existing.auszahlung_amount || '0')
        auszahlungAmount.value = auszahlung > 0 ? auszahlung : null

        // Sachbericht + notes
        sachbericht.value = existing.sachbericht || ''
        grantNotes.value = existing.notes || ''

        // Budget plan
        const bp = existing.budget_plan || {}
        const bpExp = bp.expenses || {}
        const bpRev = bp.revenues || {}
        budgetKuenstler.value = (bpExp.kuenstlerhonorar || []).map((i: any) => ({ name: i.name || '', amount: String(i.amount || '0') }))
        budgetSachkosten.value = (bpExp.sachkosten || []).map((i: any) => ({ name: i.name || '', amount: String(i.amount || '0') }))
        budgetSonstiges.value = (bpExp.sonstiges || []).map((i: any) => ({ name: i.name || '', amount: String(i.amount || '0') }))
        budgetRevEintritt.value = String(bpRev.eintritt || '0')
        budgetRevGetraenke.value = String(bpRev.getraenke || '0')
        budgetRevEigenmittel.value = String(bpRev.eigenmittel || '0')
        budgetRevDrittmittel.value = String(bpRev.drittmittel || '0')
        budgetRevSonstige.value = String(bpRev.sonstige || '0')
      }
      // Auto-generate Sachbericht if empty (also for new grants)
      if (!sachbericht.value) generateDefaultSachbericht()
      const eventYear = ev.date ? new Date(ev.date).getFullYear() : new Date().getFullYear()
      grantSummary.value = await grantService.getSummary(eventYear)
    } catch { /* grant data is optional */ }
  } catch (e: any) {
    error.value = e.message || 'Daten konnten nicht geladen werden'
  } finally {
    isLoading.value = false
    // Enable auto-save after initial load is complete
    suppressAutoSave = false
  }
}

async function deleteAccounting() {
  showOverflow.value = false
  if (!accounting.value?.id) return
  if (!confirm('Abrechnung wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return
  try {
    await accountingService.delete(accounting.value.id)
    accounting.value = null
    revenues.value = []
    inventory.value = []
    expenses.value = []
    splits.value = []
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message || 'Fehler beim Löschen'
  }
}

async function saveAll(silent = false) {
  if (!accounting.value?.id) return
  if (isSaving.value) return // prevent concurrent saves
  isSaving.value = true
  if (!silent) error.value = ''
  if (!silent) saveSuccess.value = ''
  // A new save attempt invalidates any previous per-drink conflicts; the
  // server will re-issue them in the 400 response if they still apply.
  inventoryConflicts.clear()

  try {
    const accId = accounting.value.id

    // Build all nested data and save in one PUT.
    // Splits are only sent for treasurers — for everyone else we omit the
    // field entirely so the backend doesn't see splits=[] (which the backend
    // already ignores for non-treasurers, but omitting is cleaner).
    const payload: any = {
      notes: accounting.value.notes,
      revenues: revenues.value
        .filter(rev => rev.id || parseFloat(rev.total || '0') !== 0 || parseFloat(rev.change_money || '0') !== 0 || parseFloat(rev.fees || '0') !== 0),
      inventory_entries: inventory.value
        .filter(inv => inv.id || confirmedInventory.has(inv.beverage_item) || parseFloat(inv.consumed_quantity || '0') > 0)
        .map(inv => {
          // consumed_quantity is the user's intent, kept stable against
          // parallel-tab corrections to quantity_before. The backend computes
          // chronological quantity_before / quantity_after for display.
          // Normalize to 2 decimals before sending so a stepper-typed
          // "3.333" doesn't round-trip differently than the server's
          // quantized snapshot.
          const consumed = parseFloat(inv.consumed_quantity ?? '0')
          return {
            id: inv.id,
            accounting: inv.accounting,
            beverage_item: inv.beverage_item,
            consumed_quantity: (isNaN(consumed) ? 0 : consumed).toFixed(2),
          }
        }),
      expenses: expenses.value
        .filter(exp => exp.description)
        .map(exp => ({ ...exp, amount: exp.amount || '0' })),
    }
    if (authStore.isTreasurer) {
      payload.splits = splits.value.filter(split => split.participant_name || split.id)
    }
    const saved = await accountingService.update(accId, payload)

    // Sync from backend response.
    //
    // Design decision: do NOT overwrite the user's typed values
    // (quantity_before, quantity_after) from the server response. The user
    // owns those inputs while the form is open; rewriting them would cause
    // visible "jumps" on parallel-tab edits.
    //
    // We do sync:
    //   - server-assigned IDs for newly-created entries (so subsequent saves
    //     update instead of recreate)
    //   - consumed_quantity (server may have rounded it, e.g. 0.5 → 0.50);
    //     used as the persisted intent on next render but NOT re-derived
    //     from after-before.
    if (saved.inventory_entries) {
      for (const serverEntry of saved.inventory_entries) {
        const local = inventory.value.find(e => e.beverage_item === serverEntry.beverage_item)
        if (!local) continue
        if (serverEntry.id && !local.id) {
          local.id = serverEntry.id
        }
        if (serverEntry.consumed_quantity !== undefined) {
          local.consumed_quantity = normalizeQty(serverEntry.consumed_quantity)
        }
      }
    }

    // Also save grant data if grant tab has data
    if (activeTab.value === 'grant' || grantRecord.value || grantTouched.value) {
      const budgetPlan = {
        expenses: {
          kuenstlerhonorar: budgetKuenstler.value.filter(i => i.name || parseFloat(i.amount) > 0).map(i => ({ name: i.name, amount: parseFloat(i.amount) || 0 })),
          sachkosten: budgetSachkosten.value.filter(i => i.name || parseFloat(i.amount) > 0).map(i => ({ name: i.name, amount: parseFloat(i.amount) || 0 })),
          sonstiges: budgetSonstiges.value.filter(i => i.name || parseFloat(i.amount) > 0).map(i => ({ name: i.name, amount: parseFloat(i.amount) || 0 })),
        },
        revenues: {
          zuwendung: budgetGrantAmount.value,
          eintritt: parseFloat(budgetRevEintritt.value) || 0,
          getraenke: parseFloat(budgetRevGetraenke.value) || 0,
          eigenmittel: parseFloat(budgetRevEigenmittel.value) || 0,
          drittmittel: parseFloat(budgetRevDrittmittel.value) || 0,
          sonstige: parseFloat(budgetRevSonstige.value) || 0,
        },
      }

      const data: Partial<GrantApplication> = {
        event: props.eventId,
        requested_amount: budgetGrantAmount.value.toFixed(2),
        eligible_expenses: grantTotalEligible.value.toFixed(2),
        own_revenue: grantTotalOwnRevenue.value.toFixed(2),
        annual_rent_costs: rentFlatAmount.value.toFixed(2),
        approved_amount: approvedAmount.value != null ? approvedAmount.value.toFixed(2) : null,
        zuwendungsbescheid_date: zuwendungsbescheidDate.value || null,
        auszahlung_amount: auszahlungAmount.value != null ? auszahlungAmount.value.toFixed(2) : null,
        actual_admission_revenue: grantAdmissionRevenue.value.toFixed(2),
        actual_beverage_revenue: grantBarContribution.value.toFixed(2),
        sachbericht: sachbericht.value,
        notes: grantNotes.value,
        budget_plan: budgetPlan,
      }
      if (grantRecord.value?.id) {
        grantRecord.value = await grantService.update(grantRecord.value.id, data)
      } else {
        grantRecord.value = await grantService.create(data)
      }

      grantTouched.value = false
      const eventYear = event.value?.date ? new Date(event.value.date).getFullYear() : new Date().getFullYear()
      grantSummary.value = await grantService.getSummary(eventYear)
    }

    if (!silent) {
      saveSuccess.value = 'Gespeichert!'
      setTimeout(() => { saveSuccess.value = '' }, 3000)
    }
  } catch (e: any) {
    // FIFO stock conflict (400 with conflicts array).
    //
    // Design decision: NEVER mutate the user's typed values from inside the
    // conflict handler. Doing so caused inputs to "jump" without user action
    // (regression: "User input does not jump when a parallel save returns
    // 400 conflict"). Instead we surface the conflicts inline at each affected
    // row and pause auto-save until the user edits something.
    if (e.response?.status === 400 && e.response?.data?.conflicts) {
      const conflicts = e.response.data.conflicts as Array<{
        drink_id: number; drink: string; available: string; requested: string
      }>
      inventoryConflicts.clear()
      for (const c of conflicts) {
        inventoryConflicts.set(c.drink_id, {
          drink: c.drink,
          available: parseFloat(c.available),
          requested: parseFloat(c.requested),
        })
      }
      // Pause auto-save until user edits an entry again (the watcher resets
      // this flag — see below).
      autoSavePausedByConflict = true
      // Clear the dirty timer so we don't keep retrying with the same values
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      autoSaveDirty.value = false
    } else {
      if (!silent) error.value = e.message || 'Fehler beim Speichern'
    }
  } finally {
    isSaving.value = false
  }
}

async function downloadAntrag() {
  if (!grantRecord.value?.id) return
  grantDownloading.value = 'antrag'
  error.value = ''
  try {
    await grantService.downloadAntrag(grantRecord.value.id, event.value?.title || 'Event')
  } catch (e: any) {
    error.value = e.message || 'Download fehlgeschlagen'
  } finally {
    grantDownloading.value = null
  }
}

async function downloadVerwendungsnachweis() {
  grantDownloading.value = 'verwendungsnachweis'
  error.value = ''
  try {
    await saveAll()
    await grantService.downloadVerwendungsnachweis(props.eventId)
  } catch (e: any) {
    error.value = e.message || 'Download fehlgeschlagen'
  } finally {
    grantDownloading.value = null
  }
}

function addBudgetItem(category: 'kuenstler' | 'sachkosten' | 'sonstiges') {
  const item = { name: '', amount: '0' }
  if (category === 'kuenstler') budgetKuenstler.value.push(item)
  else if (category === 'sachkosten') budgetSachkosten.value.push(item)
  else budgetSonstiges.value.push(item)
}

function removeBudgetItem(category: 'kuenstler' | 'sachkosten' | 'sonstiges', index: number) {
  if (category === 'kuenstler') budgetKuenstler.value.splice(index, 1)
  else if (category === 'sachkosten') budgetSachkosten.value.splice(index, 1)
  else budgetSonstiges.value.splice(index, 1)
}

// ── Document Methods ─────────────────────────────────────────────

async function loadDocuments() {
  isLoadingDocs.value = true
  try {
    documents.value = await documentService.list(props.eventId)
  } catch {
    // silently fail — documents are non-critical
  } finally {
    isLoadingDocs.value = false
  }
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function handleFileUpload(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(Array.from(input.files))
  input.value = ''
}

function handleDrop(e: DragEvent) {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    uploadFiles(Array.from(files))
  }
}

async function uploadFiles(files: File[]) {
  uploadError.value = ''
  for (const file of files) {
    uploadingFiles.value.push({ name: file.name })
    try {
      const doc = await documentService.upload(props.eventId, file)
      documents.value.unshift(doc)
    } catch (err: any) {
      uploadError.value = err.response?.data?.error || 'Upload fehlgeschlagen'
    } finally {
      uploadingFiles.value = uploadingFiles.value.filter(f => f.name !== file.name)
    }
  }
}

async function deleteDocument(doc: EventDocument) {
  if (!confirm(`"${doc.file_name}" wirklich löschen?`)) return
  try {
    await documentService.remove(props.eventId, doc.id)
    documents.value = documents.value.filter(d => d.id !== doc.id)
  } catch (err: any) {
    console.error('Delete failed:', err)
  }
}

function closeOverflow(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.btn-overflow') && !(e.target as HTMLElement).closest('.overflow-dropdown')) {
    showOverflow.value = false
  }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const autoSaveDirty = ref(false)
let suppressAutoSave = true // suppress during initial load
// Set to true after a 400 stock conflict. Auto-save pauses until the user
// edits an inventory entry again — preventing infinite save loops and giving
// the user a stable read of their typed values.
let autoSavePausedByConflict = false

function scheduleAutoSave() {
  if (suppressAutoSave) return
  if (autoSavePausedByConflict) return
  if (!accounting.value?.id) return
  autoSaveDirty.value = true
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    autoSaveDirty.value = false
    saveAll(true)
  }, 2000)
}

/** Immediately flush pending auto-save (e.g. before navigation) */
function flushAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (autoSaveDirty.value) {
    autoSaveDirty.value = false
    saveAll(true)
  }
}

// Warn before browser close/refresh if there are unsaved changes
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (autoSaveDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// Flush auto-save on Vue route navigation
onBeforeRouteLeave(() => {
  flushAutoSave()
})

// Watch data changes for auto-save
watch(
  [inventory, revenues, expenses, splits],
  () => {
    // Any data change is a fresh user intent — un-pause auto-save if it was
    // halted by a previous 400 conflict. The next save attempt uses the
    // user's latest values.
    autoSavePausedByConflict = false
    scheduleAutoSave()
  },
  { deep: true }
)
watch(
  () => [accounting.value?.notes],
  () => { scheduleAutoSave() }
)
watch(
  [sachbericht, grantNotes, budgetKuenstler, budgetSachkosten, budgetSonstiges,
   budgetRevEintritt, budgetRevGetraenke, budgetRevEigenmittel, budgetRevDrittmittel,
   budgetRevSonstige, approvedAmount, zuwendungsbescheidDate, auszahlungAmount, rentFlatAmount],
  () => {
    grantTouched.value = true
    scheduleAutoSave()
  },
  { deep: true }
)

// ── Refresh Vorher values from server (used on tab/window focus) ──
//
// Re-fetches the current Abrechnung from the server. The server computes
// `quantity_before` chronologically (purchases up to event date minus
// consumption of all earlier events), so this gives a correct Vorher even
// when later events have been edited in parallel.
//
// We update only `quantity_before` for entries the user has not actively
// confirmed (consumed_quantity == 0). For entries the user has touched
// (consumed > 0), we leave their typed values alone — re-deriving Nachher
// would surprise the user mid-edit. Vorher stays in display sync via the
// next save cycle.
//
// Does NOT trigger an automatic save — that prevents a regression where
// 400-conflict loops could cascade through refresh→save→400→refresh→…
async function refreshStockAndCorrect() {
  if (!accounting.value?.id) return
  try {
    const fresh = await accountingService.getById(accounting.value.id)
    const serverEntries = fresh.inventory_entries ?? []

    suppressAutoSave = true
    const changedItems: string[] = []
    for (const serverEntry of serverEntries) {
      const local = inventory.value.find(e => e.beverage_item === serverEntry.beverage_item)
      if (!local) continue
      const serverBefore = normalizeQty(serverEntry.quantity_before ?? '0')
      const ownConsumed = parseFloat(local.consumed_quantity || '0')

      if (qtyEquals(serverBefore, local.quantity_before)) continue

      if (ownConsumed === 0) {
        // No user intent — safe to fully refresh both Vorher and Nachher.
        local.quantity_before = serverBefore
        local.quantity_after = serverBefore
        delete inventoryCrates.value[String(serverEntry.beverage_item)]
      } else {
        // User has typed a Nachher; keep their input. Update only Vorher and
        // re-derive Nachher = Vorher - consumed so display stays consistent.
        local.quantity_before = serverBefore
        local.quantity_after = normalizeQty(Math.max(0, parseFloat(serverBefore) - ownConsumed))
        delete inventoryCrates.value[String(serverEntry.beverage_item)]
        const bev = beverages.value.find(b => b.id === serverEntry.beverage_item)
        if (bev) changedItems.push(bev.name)
      }
    }
    if (changedItems.length > 0) {
      stockChangedWarning.value = `Bestand extern geändert: ${changedItems.join(', ')}`
      setTimeout(() => { stockChangedWarning.value = '' }, 6000)
    }
    setTimeout(() => { suppressAutoSave = false }, 0)
  } catch { /* ignore – next save will catch it */ }
}

// ── Refresh stock on tab/window focus (prevent stale quantity_before) ──
async function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  await refreshStockAndCorrect()
}

async function handleWindowFocus() {
  await refreshStockAndCorrect()
}

onMounted(() => {
  loadData()
  loadDocuments()
  document.addEventListener('click', closeOverflow)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  flushAutoSave()
  document.removeEventListener('click', closeOverflow)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template lang="pug">
.accounting-view
  .loading(v-if="isLoading") Abrechnung wird geladen...
  template(v-else-if="accounting")
    .accounting-header
      .tabs
        button.tab(
          :class="{ active: activeTab === 'cashcount' }"
          @click="activeTab = 'cashcount'"
        ) 💰 Kassenzählung
        button.tab(
          :class="{ active: activeTab === 'inventory' }"
          @click="activeTab = 'inventory'"
        ) 📦 Inventur
        button.tab(
          :class="{ active: activeTab === 'expenses' }"
          @click="activeTab = 'expenses'"
        ) 🧾 Ausgaben
        button.tab(
          :class="{ active: activeTab === 'documents' }"
          @click="activeTab = 'documents'"
        ) 📎 Belege
        button.tab(
          :class="{ active: activeTab === 'result' }"
          @click="activeTab = 'result'"
        ) 📊 Ergebnis
        button.tab.tab-grant(
          :class="{ active: activeTab === 'grant' }"
          @click="activeTab = 'grant'"
        ) 🏛️ Förderung
      .accounting-actions
        span.stock-changed-warning(v-if="stockChangedWarning") ⚠️ {{ stockChangedWarning }}
        span.save-success(v-if="saveSuccess") {{ saveSuccess }}
        span.auto-save-indicator(v-else-if="isSaving") Speichert...
        span.auto-save-indicator(v-else-if="autoSaveDirty") Ungespeichert
        button.btn-save(@click="saveAll(false)" :disabled="isSaving")
          | {{ isSaving ? 'Speichern...' : 'Alles speichern' }}
        button.btn-overflow(@click="showOverflow = !showOverflow") ⋯
        .overflow-dropdown(v-if="showOverflow")
          button.overflow-item.overflow-danger(@click="deleteAccounting") Abrechnung löschen

    .error(v-if="error") {{ error }}

    //- ── Cash Count Tab ──
    .tab-content(v-if="activeTab === 'cashcount'")
      .external-data-bar
        button.btn-fetch-all(
          @click="fetchAndApplyAllExternal"
          :disabled="externalDataLoading"
        ) {{ externalDataLoading ? 'Laden...' : externalDataLoaded ? '↻ Externe Daten neu laden' : '⬇ Externe Daten laden (Pretix + PayPal)' }}
        .external-data-status(v-if="externalDataLoaded && !externalDataLoading")
          span.success(v-if="!pretixError && !paypalBarError") ✓ Daten übernommen
          span.pretix-error(v-if="pretixError") Pretix: {{ pretixError }}
          span.pretix-error(v-if="paypalBarError") PayPal: {{ paypalBarError }}
        .pretix-warnings(v-if="pretixData?.warnings?.length")
          .pretix-warning(v-for="w in pretixData.warnings" :key="w") ⚠️ {{ w }}
        .external-data-summary(v-if="externalDataLoaded && !pretixError && !paypalBarError")
          span(v-if="pretixData") 🎟️ {{ pretixData.total_tickets }} Tickets ({{ formatCurrency(pretixData.total_revenue) }})
          span(v-if="paypalBarData") &nbsp;· 🍺 {{ paypalBarCategoryTotals.bar.count }} Bar ({{ formatCurrency(paypalBarCategoryTotals.bar.amount) }}) · 🚪 {{ paypalBarCategoryTotals.entrance.count }} Einlass ({{ formatCurrency(paypalBarCategoryTotals.entrance.amount) }})

      .section(v-for="group in REVENUE_GROUPS" :key="group.label")
        .section-title-row
          h3.section-title {{ group.label }}
        .revenue-table
          .revenue-header
            .col-source Quelle
            .col-amount Gesamt
            .col-amount Wechselgeld
            .col-amount Gebühren
            .col-amount Netto

          template(v-for="source in group.sources" :key="source")
            .revenue-row
              .col-source {{ REVENUE_SOURCE_LABELS[source] }}
              .col-amount(data-label="Gesamt")
                .amount-wrap
                  input.amount-input(
                    v-model="getRevenue(source).total"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  )
              .col-amount(data-label="Wechselgeld")
                .amount-wrap(v-if="source.endsWith('_cash')")
                  input.amount-input(
                    v-model="getRevenue(source).change_money"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  )
                span.no-field(v-else) —
              .col-amount(data-label="Gebühren")
                .amount-wrap
                  input.amount-input(
                    v-model="getRevenue(source).fees"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  )
              .col-amount.col-computed(data-label="Netto") {{ formatCurrency(revenueNet(getRevenue(source))) }}
            template(v-if="source === 'vvk_pretix' && pretixData")
              .revenue-row.sub-row.expandable(@click="toggleSourceExpanded('pretix')")
                .col-source.sub-source {{ expandedSources.has('pretix') ? '▾' : '▸' }} {{ Object.keys(pretixData.by_source).length }} Zahlungsquellen
                .col-amount.sub-val
                .col-amount.sub-val
                .col-amount.sub-val
                .col-amount.sub-val
              template(v-if="expandedSources.has('pretix')")
                .revenue-row.sub-row(v-for="(info, src) in pretixData.by_source" :key="src")
                  .col-source.sub-source &nbsp;&nbsp;{{ src === 'vvk_stripe' ? '└ Stripe' : src === 'vvk_paypal' ? '└ PayPal' : '└ ' + src }}
                  .col-amount.sub-val {{ formatCurrency(info.revenue) }}
                  .col-amount.sub-val —
                  .col-amount.sub-val {{ formatCurrency(info.fees) }}
                  .col-amount.sub-val
                .revenue-row.sub-row
                  .col-source.sub-source &nbsp;&nbsp;└ Pretix-Gebühr
                  .col-amount.sub-val
                  .col-amount.sub-val —
                  .col-amount.sub-val {{ formatCurrency(pretixData.pretix_fee) }}
                  .col-amount.sub-val
            template(v-if="(source === 'bar_paypal' || source === 'entrance_paypal') && paypalBarData && paypalTransactionsFor(source === 'bar_paypal' ? 'bar' : 'entrance').length")
              .revenue-row.sub-row.paypal-cat-actions.expandable(@click="toggleSourceExpanded(source)")
                .col-source.sub-source
                  span {{ expandedSources.has(source) ? '▾' : '▸' }} {{ paypalTransactionsFor(source === 'bar_paypal' ? 'bar' : 'entrance').length }} Transaktionen
                  button.btn-cat-all(@click.stop="setAllPaypalCategory(source === 'bar_paypal' ? 'entrance' : 'bar')") Alle → {{ source === 'bar_paypal' ? '🚪 Einlass' : '🍺 Bar' }}
                  span.entry-price-hint(v-if="source === 'entrance_paypal' && paypalBarData.entry_price") Eintritt: {{ paypalBarData.entry_price }}€{{ paypalBarData.entry_price_ak ? ' / AK ' + paypalBarData.entry_price_ak + '€' : '' }}
              template(v-if="expandedSources.has(source)")
                .revenue-row.sub-row.sub-detail(
                  v-for="{ txn, idx } in paypalTransactionsFor(source === 'bar_paypal' ? 'bar' : 'entrance')"
                  :key="idx"
                  :class="{ 'cat-entrance': txn.category === 'entrance', 'cat-bar': txn.category === 'bar' }"
                )
                  .col-source.sub-source.sub-detail-source
                    button.btn-cat-toggle(
                      @click.stop="togglePaypalCategory(idx)"
                      :title="source === 'bar_paypal' ? '→ Einlass verschieben' : '→ Bar verschieben'"
                    ) {{ source === 'bar_paypal' ? '→ 🚪' : '→ 🍺' }}
                    span {{ txn.name }} · {{ formatTime(txn.timestamp) }}
                  .col-amount.sub-val {{ formatCurrency(txn.amount) }}
                  .col-amount.sub-val —
                  .col-amount.sub-val {{ formatCurrency(txn.fee) }}
                  .col-amount.sub-val {{ formatCurrency(txn.net) }}
                  button.btn-remove-txn(@click.stop="removePaypalBarTransaction(idx)" title="Transaktion entfernen") ✕
        .group-total
          span Gesamt {{ group.label }}:
          strong {{ formatCurrency(groupRevenue(group.sources)) }}

      .section.section-summary
        .section-title-row
          h3.section-title Zusammenfassung
        .summary-list
          .summary-line.summary-expandable(@click="toggleSourceExpanded('beverage_detail')")
            span.summary-label {{ expandedSources.has('beverage_detail') ? '▾' : '▸' }} Getränkeverkauf
            span.summary-value {{ formatCurrency(groupRevenue(REVENUE_GROUPS[0].sources)) }}
          template(v-if="expandedSources.has('beverage_detail')")
            .summary-line.summary-sub(v-if="expensesFromSource('bar_cash') > 0")
              span.summary-label Gezählt (netto)
              span.summary-value {{ formatCurrency(groupRevenue(REVENUE_GROUPS[0].sources)) }}
            .summary-line.summary-sub(v-if="expensesFromSource('bar_cash') > 0")
              span.summary-label + Aus Kasse bezahlt
              span.summary-value + {{ formatCurrency(expensesFromSource('bar_cash')) }}
            .summary-line.summary-sub.summary-highlight(v-if="expensesFromSource('bar_cash') > 0")
              span.summary-label = Getränke brutto
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[0].sources)) }}
            .summary-line.summary-sub
              span.summary-label davon USt (19%)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[0].sources) - groupRevenueGross(REVENUE_GROUPS[0].sources) / 1.19) }}
            .summary-line.summary-sub
              span.summary-label Netto (abzgl. 19% USt)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[0].sources) / 1.19) }}
          .summary-line.summary-expandable(@click="toggleSourceExpanded('entrance_detail')")
            span.summary-label {{ expandedSources.has('entrance_detail') ? '▾' : '▸' }} Eintritt
            span.summary-value {{ formatCurrency(groupRevenue(REVENUE_GROUPS[1].sources)) }}
          template(v-if="expandedSources.has('entrance_detail')")
            .summary-line.summary-sub(v-if="expensesFromSource('entrance_cash') > 0")
              span.summary-label Gezählt (netto)
              span.summary-value {{ formatCurrency(groupRevenue(REVENUE_GROUPS[1].sources)) }}
            .summary-line.summary-sub(v-if="expensesFromSource('entrance_cash') > 0")
              span.summary-label + Aus Kasse bezahlt (z.B. Honorare)
              span.summary-value + {{ formatCurrency(expensesFromSource('entrance_cash')) }}
            .summary-line.summary-sub.summary-highlight(v-if="expensesFromSource('entrance_cash') > 0")
              span.summary-label = Eintritt brutto
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources)) }}
            .summary-line.summary-sub
              span.summary-label davon USt (7%)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources) - groupRevenueGross(REVENUE_GROUPS[1].sources) / 1.07) }}
            .summary-line.summary-sub
              span.summary-label Netto (abzgl. 7% USt)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources) / 1.07) }}
          .summary-line.summary-total
            span.summary-label Gesamteinnahmen (gezählt)
            span.summary-value {{ formatCurrency(totalRevenue) }}

    //- ── Inventory Tab ──
    .tab-content(v-if="activeTab === 'inventory'")
      .inventory-toolbar
        label.hide-zero-toggle
          input(type="checkbox" v-model="hideZeroStock")
          span Leere ausblenden

      .conflict-banner(v-if="inventoryConflicts.size > 0")
        .conflict-banner-icon ⚠️
        .conflict-banner-text
          strong {{ inventoryConflicts.size === 1 ? '1 Bestandskonflikt' : `${inventoryConflicts.size} Bestandskonflikte` }}
          span  – Während du editiert hast, hat jemand anders parallel verbraucht. Bitte die rot markierten Werte unten anpassen.

      .section(v-for="(items, group) in inventoryBySupplier" :key="group")
        h3.section-title {{ group }}
          span.inv-progress {{ inventoryProgress(items) }}

        //- Desktop table
        .inventory-table.desktop-only
          .inventory-header
            .col-inv-name.sortable(@click="invSort.toggle('name')") Getränk{{ invSort.indicator('name') }}
            .col-inv-info Kiste
            .col-inv-pair.sortable(@click="invSort.toggle('before')") Vorher{{ invSort.indicator('before') }}
            .col-inv-pair.sortable(@click="invSort.toggle('after')") Nachher{{ invSort.indicator('after') }}
            .col-inv-num Gesamt
            .col-inv-num.sortable(@click="invSort.toggle('consumed')") Verbraucht{{ invSort.indicator('consumed') }}
            .col-inv-amount.sortable(@click="invSort.toggle('value')") Wert{{ invSort.indicator('value') }}

          template(v-for="{ beverage, entry } in sortedInventory(items)" :key="beverage.id")
            .inventory-row(v-show="inventoryItemVisible(entry)" :class="{ 'inv-confirmed': isInventoryConfirmed(entry), 'inv-pending': !isInventoryConfirmed(entry), 'inv-conflict': inventoryConflicts.has(beverage.id) }")
              .col-inv-name
                .bev-name {{ beverage.name }}
                .bev-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}St. · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }} · Pf. {{ formatCurrency(parseFloat(beverage.deposit || '0')) }}
                .bev-info(v-else) Flasche · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }}
              .col-inv-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}St.
              .col-inv-info(v-else) Fl.

              //- Crate mode (units_per_crate > 1)
              template(v-if="(beverage.units_per_crate || 1) > 1")
                .col-inv-pair.readonly-before
                  .crate-input
                    span.qty-display {{ getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeCrates }}
                    span.input-label K
                  .crate-input
                    span.qty-display {{ formatQty(getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeBottles) }}
                    span.input-label Fl
                .col-inv-pair
                  .crate-input
                    input.qty-input(
                      v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterCrates"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      @input="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    span.input-label K
                  .crate-input
                    input.qty-input(
                      v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterBottles"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      @input="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    span.input-label Fl

              //- Bottle mode (units_per_crate = 1)
              template(v-else)
                .col-inv-pair.bottle-mode.readonly-before
                  span.qty-display {{ formatQty(entry.quantity_before || '0') }}
                  span.input-label Fl.
                .col-inv-pair.bottle-mode
                  input.qty-input(
                    v-model="entry.quantity_after"
                    type="number"
                    min="0"
                    step="0.1"
                    @input="recomputeConsumed(entry); confirmedInventory.add(beverage.id)"
                    placeholder="0"
                  )
                  span.input-label Fl.

              .col-inv-num {{ formatQty(entry.quantity_before) }}
              .col-inv-num(:class="{ 'negative-consumption': inventoryConsumption(entry) < 0 }") {{ formatQty(inventoryConsumption(entry)) }}
                span.consumption-warning(v-if="inventoryConsumption(entry) < 0") ⚠
              .col-inv-amount {{ formatCurrency(inventoryValue(entry, beverage)) }}

            .inventory-row-conflict(v-if="inventoryConflicts.has(beverage.id)" v-show="inventoryItemVisible(entry)")
              span.conflict-icon ⚠️
              span.conflict-text
                | {{ beverage.name }}: Du möchtest #[strong {{ inventoryConflicts.get(beverage.id)?.requested }}] verbrauchen, aber aktuell sind nur noch #[strong {{ inventoryConflicts.get(beverage.id)?.available }}] verfügbar. Bitte „Nachher" um mindestens #[strong {{ ((inventoryConflicts.get(beverage.id)?.requested ?? 0) - (inventoryConflicts.get(beverage.id)?.available ?? 0)) }}] erhöhen.

        //- Mobile cards
        .inventory-cards.mobile-only
          .inv-card(v-for="{ beverage, entry } in sortedInventory(items)" :key="beverage.id" v-show="inventoryItemVisible(entry)" :class="{ 'inv-confirmed': isInventoryConfirmed(entry), 'inv-pending': !isInventoryConfirmed(entry), 'inv-conflict': inventoryConflicts.has(beverage.id) }")
            .inv-card-header
              .inv-card-name {{ beverage.name }}
            .inv-card-conflict(v-if="inventoryConflicts.has(beverage.id)")
              span ⚠️
              | {{ beverage.name }}: angefordert #[strong {{ inventoryConflicts.get(beverage.id)?.requested }}], verfügbar #[strong {{ inventoryConflicts.get(beverage.id)?.available }}]. Nachher erhöhen.
            .inv-card-info
              span.inv-info-item
                span.inv-info-label V:
                template(v-if="(beverage.units_per_crate || 1) > 1")
                  | {{ getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeCrates }}K {{ formatQty(getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeBottles) }}Fl
                template(v-else)
                  | {{ formatQty(entry.quantity_before) }}Fl
              span.inv-info-sep ·
              span.inv-info-item(:class="{ 'negative-consumption': inventoryConsumption(entry) < 0 }") Δ {{ formatQty(inventoryConsumption(entry)) }}
                span.consumption-warning(v-if="inventoryConsumption(entry) < 0") ⚠
              span.inv-info-sep ·
              span.inv-info-item
                template(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}er
                template(v-else) Fl.
              span.inv-info-sep ·
              span.inv-info-item.inv-info-price {{ formatCurrency(inventoryValue(entry, beverage)) }}
            .inv-card-after
              //- Crate stepper
              template(v-if="(beverage.units_per_crate || 1) > 1")
                .stepper-row
                  .stepper-group
                    button.stepper-btn(@click="stepCrate(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterCrates"
                      type="number"
                      min="0"
                      step="1"
                      @change="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    button.stepper-btn(@click="stepCrate(beverage, entry, 'after', 1)") +
                    span.stepper-unit K
                  .stepper-group
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterBottles"
                      type="number"
                      min="0"
                      step="1"
                      @change="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', 1)") +
                    span.stepper-unit Fl
              //- Bottle stepper
              template(v-else)
                .stepper-row
                  .stepper-group
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="entry.quantity_after"
                      type="number"
                      min="0"
                      step="0.25"
                      @change="recomputeConsumed(entry); confirmedInventory.add(beverage.id)"
                    )
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', 1)") +
                    span.stepper-unit Fl.

        .group-total
          span Zwischensumme {{ group }}:
          strong {{ formatCurrency(groupInventoryValue(items)) }}

      .grand-total
        div
          span Lagerwert (inkl. Pfand):
          strong {{ formatCurrency(totalStockValue) }}
        div.separator
        div
          span Wareneinsatz (inkl. Pfand):
          strong {{ formatCurrency(totalInventoryValue) }}

    //- ── Expenses Tab ──
    .tab-content(v-if="activeTab === 'expenses'")
      h3.section-title Ausgaben
      .expenses-table
        .expense-header
          span.sortable(@click="expSort.toggle('desc')") Beschreibung{{ expSort.indicator('desc') }}
          span.sortable(@click="expSort.toggle('amount')") Betrag{{ expSort.indicator('amount') }}
          span Bezahlt aus
          span Sphäre
          span

        .expense-row(v-for="(exp, index) in sortedExpenses" :key="index")
          input.text-input(
            v-model="exp.description"
            type="text"
            placeholder="z.B. Rewe, Hotel..."
          )
          .amount-wrap
            input.amount-input(
              v-model="exp.amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            )
          select.select-input(v-model="exp.paid_from")
            option(v-for="(label, source) in EXPENSE_PAID_FROM_LABELS" :key="source" :value="source")
              | {{ label }}
          select.select-input(v-model="exp.tax_sphere" :class="{ 'missing': !exp.tax_sphere }")
            option(:value="null" disabled hidden) Sphäre wählen
            option(v-for="(label, key) in TAX_SPHERE_LABELS" :key="key" :value="key")
              | {{ label }}
          button.btn-remove(@click="removeExpense(index)") ×

      button.btn-add(@click="addExpense") + Ausgabe hinzufügen

      .grand-total
        span Gesamtausgaben:
        strong {{ formatCurrency(totalExpenses) }}

      .footnote
        p
          strong Sphären-Zuordnung (Pflichtfeld)
        ul
          li
            strong Zweckbetrieb
            |  — Ausgaben für den Vereinszweck (z.B. Künstlergagen, GEMA, Technik)
          li
            strong Wirtschaftlich
            |  — Ausgaben für wirtschaftlichen Geschäftsbetrieb (z.B. Getränkeeinkauf, Bar-Zubehör)
          li
            strong Vermögensverwaltung
            |  — langfristige Vermietung/Verpachtung (z.B. Proberaum)
          li
            strong Ideell
            |  — allgemeine Vereinsarbeit ohne wirtschaftlichen Bezug

    //- ── Result Tab ──
    .tab-content(v-if="activeTab === 'result'")

      //- Block 1: Wirtschaftliches Ergebnis ────────────────────
      .section
        .section-title-row
          h3.section-title 📊 Wirtschaftliches Ergebnis
        .result-summary
          .result-row.expandable(@click="resultExpandRevenue = !resultExpandRevenue")
            span {{ resultExpandRevenue ? '▼' : '▶' }} 💰 Einnahmen (gezählt)
            strong {{ formatCurrency(totalRevenue) }}
          template(v-if="resultExpandRevenue")
            .result-row.detail(v-for="rev in revenues" :key="rev.source" v-show="revenueNet(rev) !== 0")
              span {{ REVENUE_SOURCE_LABELS[rev.source] }}
              span {{ formatCurrency(revenueNet(rev)) }}
          .result-row.sub(v-if="expensesPaidFromRegister > 0")
            span + Aus Kassen bezahlte Ausgaben
            strong {{ formatCurrency(expensesPaidFromRegister) }}
          .result-row.intermediate(v-if="expensesPaidFromRegister > 0")
            span = Tatsächliche Einnahmen
            strong.positive {{ formatCurrency(adjustedRevenue) }}
          .result-row.expandable(@click="resultExpandInventory = !resultExpandInventory")
            span {{ resultExpandInventory ? '▼' : '▶' }} 📦 − Wareneinsatz
            strong.negative {{ formatCurrency(totalInventoryValue) }}
          template(v-if="resultExpandInventory")
            .result-row.detail(v-for="(items, group) in inventoryBySupplier" :key="group" v-show="groupInventoryValue(items) !== 0")
              span {{ group }}
              span -{{ formatCurrency(groupInventoryValue(items)) }}
          .result-row.expandable(@click="resultExpandExpenses = !resultExpandExpenses")
            span {{ resultExpandExpenses ? '▼' : '▶' }} 🧾 − Ausgaben
            strong.negative {{ formatCurrency(totalExpenses) }}
          template(v-if="resultExpandExpenses")
            .result-row.detail(v-for="exp in expenses" :key="exp.id || exp.description" v-show="parseFloat(exp.amount || '0') !== 0")
              span {{ exp.description || '(ohne Beschreibung)' }}
              span {{ formatCurrency(parseFloat(exp.amount || '0')) }}
          .result-row.result-total
            span 🏆 Ergebnis (vor USt)
            strong(:class="result >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(result) }}

      //- Block 2: Umsatzsteuer ─────────────────────────────────
      .section(v-if="vatOutput !== 0 || vatInput !== 0")
        .section-title-row
          h3.section-title 🧮 Umsatzsteuer
        .vat-card
          .vat-grid
            .vat-col
              .vat-col-header Output-USt (an Finanzamt)
              .vat-col-row(v-show="vat7Entrance !== 0")
                span 7% auf Eintritt
                span {{ formatCurrency(vat7Entrance) }}
              .vat-col-row(v-show="vat19Bar !== 0")
                span 19% auf Getränkeverkauf
                span {{ formatCurrency(vat19Bar) }}
              .vat-col-total
                span Σ Output-USt
                strong {{ formatCurrency(vatOutput) }}
            .vat-col
              .vat-col-header − Vorsteuer (vom Finanzamt)
              .vat-col-row(v-show="inputVatInventory !== 0")
                span 19% Wareneinsatz
                span -{{ formatCurrency(inputVatInventory) }}
              .vat-col-row(v-show="inputVatExpenses !== 0")
                span Ausgaben (lt. Beleg)
                span -{{ formatCurrency(inputVatExpenses) }}
              .vat-col-row(v-show="vatInput === 0")
                span.vat-empty Keine Vorsteuer (USt-Sätze auf Ausgaben pflegen)
                span
              .vat-col-total
                span Σ Vorsteuer
                strong -{{ formatCurrency(vatInput) }}
          .vat-result(:class="{ 'liability': vatLiability >= 0, 'refund': vatLiability < 0 }")
            span.vat-result-label {{ vatLiability >= 0 ? 'USt-Zahllast (an Finanzamt)' : 'USt-Erstattung (vom Finanzamt)' }}
            strong.vat-result-value {{ formatCurrency(Math.abs(vatLiability)) }}
          p.vat-note Hinweis: Vorsteuer-Abzug nur möglich, wenn Belege ordnungsgemäß sind und Verein vorsteuerabzugsberechtigt ist (wirtschaftlicher Geschäftsbetrieb).

      //- Block 3: Endergebnis nach USt ─────────────────────────
      .final-result(v-if="vatLiability !== 0")
        .final-result-label 💼 Verfügbares Ergebnis (nach USt)
        .final-result-value(:class="resultAfterVat >= 0 ? 'positive' : 'negative'") {{ formatCurrency(resultAfterVat) }}

      //- Block 4: Gewinnverteilung ─────────────────────────────
      //- Nur für Treasurer sichtbar — Backend liefert splits=[] für andere
      //- und ignoriert eingehende splits stillschweigend.
      .section(v-if="authStore.isTreasurer")
        .section-title-row
          h3.section-title 🤝 Gewinnverteilung
        p.splits-note(v-if="vatLiability !== 0")
          | Verteilungsbasis ist das Ergebnis nach USt ({{ formatCurrency(resultAfterVat) }}). Die USt-Zahllast ist als feste Position für das Finanzamt reserviert.
        .splits-table
          //- Fixed pseudo-split for tax authority — non-editable, automatic from vatLiability.
          .split-row.split-fixed(v-if="vatLiability > 0")
            .col-name
              span.fixed-name 🏛️ Finanzamt (USt-Zahllast)
            .col-pct
              span.fixed-pct —
            .col-amount {{ formatCurrency(vatLiability) }}
            .col-action
          .split-row(v-for="(split, index) in splits" :key="index")
            .col-name
              input.text-input(
                v-model="split.participant_name"
                type="text"
                placeholder="Name"
              )
            .col-pct
              input.amount-input(
                v-model="split.share_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              )
              span.unit %
            .col-amount {{ formatCurrency(splitAmount(split)) }}
            .col-action
              button.btn-remove(@click="removeSplit(index)") ×

        button.btn-add(@click="addSplit") + Anteil hinzufügen

        .splits-summary(v-if="splits.length")
          .result-row
            span Verteilt ({{ totalSplitPercentage.toFixed(1) }}%)
            strong {{ formatCurrency(resultAfterVat - remainingAfterSplits) }}
          .result-row.result-total
            span Verbleibend
            strong(:class="remainingAfterSplits >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(remainingAfterSplits) }}

      //- Block 5: Notizen ──────────────────────────────────────
      .section
        .section-title-row
          h3.section-title 📝 Notizen
        textarea.notes-input(
          v-model="accounting.notes"
          placeholder="Notizen zu dieser Abrechnung..."
          rows="4"
        )

    //- ── Grant Tab ──
    .tab-content(v-if="activeTab === 'grant'")
      .grant-tab

        //- ── Sub-Tab Navigation ──
        .grant-sub-tabs
          button.grant-sub-tab(
            :class="{ active: grantSubTab === 'antrag' }"
            @click="grantSubTab = 'antrag'"
          ) Antrag
          button.grant-sub-tab(
            :class="{ active: grantSubTab === 'nachweis' }"
            @click="grantSubTab = 'nachweis'"
          ) Verwendungsnachweis

        //- ════════════════════════════════════════════════════════
        //- ── Sub-Tab: Antrag ──
        //- ════════════════════════════════════════════════════════
        template(v-if="grantSubTab === 'antrag'")

          //- ── Budget Plan (Kostenplan) ──
          h3.section-title Kostenplan

          .grant-detail
            .detail-row.detail-cat-header
              span Künstlerhonorare / Anfahrt / Übernachtung
              button.btn-add-sm(@click="addBudgetItem('kuenstler')") +
            .detail-row.input-row(v-for="(item, idx) in budgetKuenstler" :key="'k' + idx")
              input.text-input(v-model="item.name" type="text" placeholder="z.B. Band XY Gage")
              .input-group
                input.amount-input(v-model="item.amount" type="number" step="0.01" min="0" placeholder="0.00")
                span.unit €
                button.btn-remove-sm(@click="removeBudgetItem('kuenstler', idx)") ×

            .detail-row.detail-cat-header
              span Projektspezifische Sachkosten (Werbung, Marketing)
              button.btn-add-sm(@click="addBudgetItem('sachkosten')") +
            .detail-row.input-row(v-for="(item, idx) in budgetSachkosten" :key="'s' + idx")
              input.text-input(v-model="item.name" type="text" placeholder="z.B. Band XY Gage")
              .input-group
                input.amount-input(v-model="item.amount" type="number" step="0.01" min="0" placeholder="0.00")
                span.unit €
                button.btn-remove-sm(@click="removeBudgetItem('sachkosten', idx)") ×

            .detail-row.detail-cat-header
              span Sonstiges (GEMA, KSK, etc.)
              button.btn-add-sm(@click="addBudgetItem('sonstiges')") +
            .detail-row.input-row(v-for="(item, idx) in budgetSonstiges" :key="'o' + idx")
              input.text-input(v-model="item.name" type="text" placeholder="z.B. Band XY Gage")
              .input-group
                input.amount-input(v-model="item.amount" type="number" step="0.01" min="0" placeholder="0.00")
                span.unit €
                button.btn-remove-sm(@click="removeBudgetItem('sonstiges', idx)") ×

            .detail-row.detail-cat-header
              span Personal- und Mietkosten
            .detail-row.input-row
              span Mietkosten (0,5% Jahresmiete)
              .input-group
                input.amount-input(
                  v-model.number="rentFlatAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="134.46"
                )
                span.unit €

            .detail-row.detail-total
              span Geplante Ausgaben gesamt
              strong {{ formatCurrency(budgetTotalExpenses) }}

          //- ── Expected Revenues ──
          h3.section-title Erwartete Einnahmen (für Antrag)
          .grant-detail
            .detail-row.input-row
              span Eintrittseinnahmen
              .input-group
                input.amount-input(v-model="budgetRevEintritt" type="number" step="0.01" min="0" placeholder="0")
                span.unit €
            .detail-row.input-row
              span 20% Getränkeeinnahmen
              .input-group
                input.amount-input(v-model="budgetRevGetraenke" type="number" step="0.01" min="0" placeholder="0")
                span.unit €
            .detail-row.input-row
              span Eigenmittel
              .input-group
                input.amount-input(v-model="budgetRevEigenmittel" type="number" step="0.01" min="0" placeholder="0")
                span.unit €
            .detail-row.input-row
              span Drittmittel
              .input-group
                input.amount-input(v-model="budgetRevDrittmittel" type="number" step="0.01" min="0" placeholder="0")
                span.unit €
            .detail-row.input-row
              span Sonstige Einnahmen
              .input-group
                input.amount-input(v-model="budgetRevSonstige" type="number" step="0.01" min="0" placeholder="0")
                span.unit €
            .detail-row.detail-total
              span Geplante Einnahmen gesamt
              strong {{ formatCurrency(budgetTotalRevenues) }}

          //- ── Calculation (from Kostenplan) ──
          h3.section-title Berechnung Förderbetrag
          .grant-summary
            .result-row
              span Geplante Ausgaben gesamt
              strong {{ formatCurrency(budgetTotalExpenses) }}
            .result-row
              span − Eigenanteil
              strong.negative {{ formatCurrency(budgetTotalRevenues) }}
            .result-row
              span Förderfähiger Betrag
              strong {{ formatCurrency(budgetEligibleAmount) }}
            .result-row.result-total
              span Beantragter Zuschuss
              strong {{ formatCurrency(budgetGrantAmount) }}
            .max-note Max. 1.000 € pro Veranstaltung / 3.000 € pro Jahr (6.000 € bei >24 Veranstaltungen/Jahr)

          //- ── Download Antrag ──
          .grant-actions
            button.btn-pdf(@click="downloadAntrag" :disabled="grantDownloading !== null || !grantRecord?.id")
              | {{ grantDownloading === 'antrag' ? 'Lade...' : '⬇ Antrag PDF' }}

        //- ════════════════════════════════════════════════════════
        //- ── Sub-Tab: Verwendungsnachweis ──
        //- ════════════════════════════════════════════════════════
        template(v-if="grantSubTab === 'nachweis'")

          //- ── Bewilligungsbescheid ──
          h3.section-title Bewilligungsbescheid
          .grant-detail
            .detail-row.input-row
              span Bewilligter Höchstbetrag
              .input-group
                input.amount-input(
                  v-model.number="approvedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="–"
                )
                span.unit €
            .detail-row.detail-total(v-if="approvedAmount != null && approvedAmount > 0")
              span Förderbetrag (nach Bescheid)
              strong {{ formatCurrency(grantAmount) }}
            .detail-row.input-row
              span Bescheiddatum
              .input-group
                input.date-input(v-model="zuwendungsbescheidDate" type="date")
            .detail-row.input-row
              span Ausgezahlter Betrag
              .input-group
                input.amount-input(
                  v-model.number="auszahlungAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="–"
                )
                span.unit €

          //- ── Actual Eligible Expenses ──
          h3.section-title Zuwendungsfähige Ausgaben
          .expenses-table.grant-expenses
            .expense-header
              .col-desc Beschreibung
              .col-amount Betrag
              .col-grant-cat Förder-Kat.
            template(v-for="(exp, index) in expenses" :key="index")
              .expense-row(v-if="parseFloat(exp.amount || '0') !== 0")
                .col-desc {{ exp.description || '–' }}
                .col-amount {{ formatCurrency(parseFloat(exp.amount || '0')) }}
                .col-grant-cat
                  select.select-input(v-model="exp.grant_category")
                    option(:value="null") –
                    option(value="kuenstlerhonorar") Künstler
                    option(value="sachkosten") Sachkosten
                    option(value="sonstiges") Sonstiges
            .expense-row(v-if="artistHospitality > 0")
              .col-desc Bewirtung Bands ({{ event?.artists?.length ?? 0 }} × 20 €)
              .col-amount {{ formatCurrency(artistHospitality) }}
              .col-grant-cat
            .expense-row(v-if="grantCostOfGoods > 0")
              .col-desc Wareneinsatz
              .col-amount {{ formatCurrency(grantCostOfGoods) }}
              .col-grant-cat
            .expense-row
              .col-desc Mietkosten (0,5% Jahresmiete)
              .col-amount {{ formatCurrency(rentFlatAmount) }}
              .col-grant-cat
            .expense-row.expense-total
              .col-desc Zuwendungsfähige Ausgaben gesamt
              .col-amount
                strong {{ formatCurrency(grantTotalEligible) }}
              .col-grant-cat

          //- ── Actual Own Revenue ──
          h3.section-title Eigenanteil (Einnahmen)
          .grant-detail
            .detail-row
              span Eintrittseinnahmen
              span.amount {{ formatCurrency(grantAdmissionRevenue) }}
            .detail-row
              span 20% Getränkeeinnahmen (Abendöffnung)
              span.amount {{ formatCurrency(grantBarContribution) }}
            .detail-row.detail-total
              span Eigenanteil gesamt
              strong {{ formatCurrency(grantTotalOwnRevenue) }}

          //- ── Actual Calculation ──
          h3.section-title Abrechnung Förderbetrag
          .grant-summary
            .result-row
              span Zuwendungsfähige Ausgaben gesamt
              strong {{ formatCurrency(grantTotalEligible) }}
            .result-row
              span − Eigenanteil
              strong.negative {{ formatCurrency(grantTotalOwnRevenue) }}
            .result-row
              span Förderfähiger Betrag
              strong {{ formatCurrency(grantEligibleAmount) }}
            .result-row.result-total
              span Beantragter Zuschuss
              strong {{ formatCurrency(grantAmount) }}

          //- ── Sachbericht (for Verwendungsnachweis) ──
          h3.section-title Sachbericht
          textarea.notes-input(
            v-model="sachbericht"
            placeholder="Kurze Beschreibung der Veranstaltung, Programm, Besucherzahl..."
            rows="6"
          )

          //- ── Notizen ──
          h3.section-title Notizen
          textarea.notes-input(
            v-model="grantNotes"
            placeholder="Interne Notizen zur Förderung..."
            rows="3"
          )

          //- ── Download Verwendungsnachweis ──
          .grant-actions
            button.btn-pdf(@click="downloadVerwendungsnachweis" :disabled="grantDownloading !== null || !grantRecord?.id")
              | {{ grantDownloading === 'verwendungsnachweis' ? 'Lade...' : '⬇ Verwendungsnachweis PDF' }}

        //- ── Summary (visible in both sub-tabs) ──
        .summary-section(v-if="grantSummary")
          h3.section-title Förder-Übersicht ({{ event?.date ? new Date(event.date).getFullYear() : '' }})
          .grant-detail
            .detail-row
              span Beantragte Summe
              span.amount {{ formatCurrency(grantSummary.total_requested) }}
            .detail-row
              span Anzahl Förderanträge
              span.amount {{ grantSummary.grant_count }}

    //- ── Documents Tab ──
    .tab-content(v-if="activeTab === 'documents'")
      .documents-tab
        .section-header
          h3.section-title Belege
          .header-actions
            button.btn-upload(@click="triggerFileUpload") + Beleg hochladen
            router-link.btn-secondary(:to="`/admin/events/${eventId}/documents`") Alle Dokumente →

        input.file-input(
          ref="fileInputRef"
          type="file"
          multiple
          @change="handleFileUpload"
          style="display: none"
        )

        .drop-zone(
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
          :class="{ 'drag-over': dragOver }"
        )
          p(v-if="!dragOver") Belege (Bons, Quittungen) hierher ziehen
          p(v-else) Loslassen zum Hochladen…

        .upload-progress(v-if="uploadingFiles.length")
          .upload-item(v-for="f in uploadingFiles" :key="f.name")
            span {{ f.name }}
            span.status ⏳ wird hochgeladen…

        .upload-error(v-if="uploadError")
          p ⚠️ {{ uploadError }}

        .documents-list(v-if="documents.length")
          table.documents-table
            thead
              tr
                th Datei
                th Hochgeladen
                th Von
                th
            tbody
              tr(v-for="doc in documents" :key="doc.id")
                td
                  a.doc-link(v-if="doc.drive_url" :href="doc.drive_url" target="_blank") {{ doc.file_name }}
                  span(v-else) {{ doc.file_name }}
                td {{ new Date(doc.uploaded_at).toLocaleString('de-DE') }}
                td {{ doc.uploaded_by_name }}
                td
                  button.btn-delete(@click="deleteDocument(doc)") ✕

        .empty-state(v-else-if="!isLoadingDocs")
          p Noch keine Belege hochgeladen.

        .loading(v-if="isLoadingDocs") Belege werden geladen…
  .error(v-else-if="error") ⚠️ {{ error }}
</template>

<style scoped>
.accounting-view {
  background: white;
}

.loading {
  padding: 3rem;
  text-align: center;
}

.accounting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-top: 0.5rem;
  flex-wrap: wrap;
}

.accounting-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  position: relative;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.stock-changed-warning {
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.save-success {
  color: black;
  font-weight: 900;
  padding: 0.4rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 0.8rem;
}

.auto-save-indicator {
  color: #888;
  font-size: 0.75rem;
  font-style: italic;
  position: absolute;
  right: 0;
  top: 100%;
  white-space: nowrap;
}

.btn-save {
  padding: 0.4rem 1rem;
  background: black;
  color: white;
  border: 0.2rem solid black;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  transition: filter 0.2s;
}

.btn-save:hover {
  filter: brightness(120%);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tab-grant {
  border-left: 0.15rem solid black;
  margin-left: auto;
}

.btn-overflow {
  padding: 0.4rem 0.75rem;
  border: 0.2rem solid black;
  background: white;
  color: black;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.2;
}

.btn-overflow:hover {
  background: black;
  color: white;
}

.overflow-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  background: white;
  border: 0.25rem solid black;
  z-index: 100;
  min-width: 12rem;
}

.overflow-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: white;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.overflow-danger {
  color: #c00;
}

.overflow-danger:hover {
  background: #c00;
  color: white;
}

.error {
  padding: 1rem;
  border: 0.25rem solid black;
  margin-bottom: 1rem;
  font-weight: 600;
}

/* ── Tabs ── */

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tab {
  padding: 0.5rem 1.25rem;
  background: #f0f0f0;
  color: black;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.tab:hover {
  background: #ddd;
}

.tab.active {
  background: black;
  color: white;
}

.tab-content {
  padding: 1.5rem 0;
}

/* ── Section ── */

.section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  margin-bottom: 0;
}

.section-title-row {
  display: flex;
  align-items: stretch;
}

.section-title-row .section-title {
  flex: 1;
}

.section-header-row {
  display: flex;
  align-items: stretch;
}

.section-header-row .section-title {
  flex: 1;
}

.btn-generate {
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-generate:hover {
  filter: brightness(150%);
}

.pretix-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: black;
  padding: 0 1rem 0 0;
}

.external-data-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 0.25rem solid black;
  background: #f9f9f9;
}

.btn-fetch-all {
  background: black;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-fetch-all:hover {
  filter: brightness(130%);
}

.btn-fetch-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.external-data-status .success {
  color: #00a844;
  font-weight: 700;
  font-size: 0.8rem;
}

.external-data-summary {
  font-size: 0.8rem;
  font-weight: 600;
  color: #333;
}

.btn-pretix {
  background: white;
  color: black;
  border: 2px solid white;
  padding: 0.25rem 0.75rem;
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-pretix:hover {
  background: #e0e0e0;
}

.btn-pretix:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-apply {
  background: #00c853;
  color: white;
  border-color: #00c853;
}

.btn-apply:hover {
  background: #00a844;
}

.pretix-error {
  color: #ff5252;
  font-size: 0.75rem;
  font-weight: 600;
}

.pretix-warnings {
  margin-top: 0.25rem;
}
.pretix-warning {
  color: #f57c00;
  font-size: 0.75rem;
  font-weight: 600;
}

/* ── Revenue Table ── */

.revenue-table {
  border: 0.25rem solid black;
  border-top: none;
}

.revenue-header, .revenue-row {
  display: grid;
  grid-template-columns: 180px minmax(110px, 1fr) minmax(110px, 1fr) minmax(110px, 1fr) 120px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
}

.revenue-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.revenue-row {
  border-bottom: 1px solid #ddd;
}

.revenue-row:nth-child(even) {
  background: #f5f5f5;
}

.revenue-row:last-child {
  border-bottom: none;
}

.revenue-row.sub-row {
  background: #f5f5f5;
  font-size: 0.75rem;
  color: #666;
  padding: 0.25rem 1rem;
  border-bottom: 1px dashed #ccc;
}

.revenue-row.sub-row.expandable {
  cursor: pointer;
  font-weight: 600;
  color: #333;
  user-select: none;
}
.revenue-row.sub-row.expandable:hover {
  background: #eaeaea;
}

.revenue-row.sub-toggle {
  cursor: pointer;
  font-weight: 600;
  color: #333;
}
.revenue-row.sub-toggle:hover {
  background: #eaeaea;
}

.revenue-row.sub-detail {
  font-size: 0.7rem;
  color: #888;
  padding: 0.15rem 1rem;
  position: relative;
}

.sub-detail-source {
  padding-left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.sub-detail-source span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}

.btn-remove-txn {
  position: absolute;
  right: 0.3rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: 1px solid #ccc;
  color: #999;
  font-size: 0.65rem;
  line-height: 1;
  padding: 0.1rem 0.3rem;
  cursor: pointer;
}
.btn-remove-txn:hover {
  background: black;
  color: white;
  border-color: black;
}

.btn-cat-toggle {
  background: none;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 0.25rem;
  line-height: 1.4;
  flex-shrink: 0;
}
.btn-cat-toggle:hover {
  background: #f0f0f0;
}

.cat-entrance {
  background: rgba(76, 175, 80, 0.06);
}
.cat-bar {
  background: rgba(255, 152, 0, 0.06);
}

.btn-cat-all {
  background: none;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  margin-right: 0.3rem;
  color: #555;
}
.btn-cat-all:hover {
  background: #eee;
}

.entry-price-hint {
  font-size: 0.65rem;
  color: #888;
  margin-left: 0.3rem;
}

.paypal-cat-summary {
  font-size: 0.75rem;
  color: #555;
  margin-left: 0.5rem;
}

.paypal-txn-count {
  font-size: 0.8rem;
  color: #666;
  margin-right: 0.75rem;
}

.paypal-cat-actions {
  border-bottom: 1px solid #eee;
}

.sub-source {
  padding-left: 1rem;
}

.sub-val {
  font-variant-numeric: tabular-nums;
}

/* ── Inventory Table ── */

.inventory-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.hide-zero-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.hide-zero-toggle input {
  width: 1rem;
  height: 1rem;
}

.negative-consumption {
  color: #dc2626;
  font-weight: 600;
}
.consumption-warning {
  font-size: 0.75rem;
  color: #dc2626;
  margin-left: 0.25rem;
}

.inv-progress {
  font-size: 0.75rem;
  font-weight: 400;
  color: #666;
  margin-left: 0.5rem;
}

.inventory-table {
  border: 0.25rem solid black;
  border-top: none;
}

.inventory-header, .inventory-row {
  display: grid;
  grid-template-columns: 2fr 45px 1.2fr 1.2fr 0.6fr 0.8fr 1fr;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  align-items: center;
}

.col-inv-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.bev-info {
  font-size: 0.75rem;
  font-weight: 400;
  color: #555;
}

.stock-warning {
  font-size: 0.7rem;
  color: #c55;
  font-weight: 500;
}

.col-inv-info {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
}

.col-inv-pair {
  display: flex;
  gap: 0.2rem;
  justify-content: center;
}

.crate-input {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  max-width: 80px;
}

.crate-input .qty-input {
  min-width: 58px;
  width: auto;
}

.qty-display {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  min-width: 1.5rem;
  text-align: center;
}

.readonly-before {
  opacity: 0.7;
}

.input-label {
  font-size: 0.7rem;
  font-weight: 900;
  color: black;
  min-width: 1rem;
}

.bottle-mode {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  justify-content: center;
}

.bottle-mode .qty-input {
  min-width: 64px;
  width: auto;
}

.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable:hover {
  text-decoration: underline;
}

.col-inv-num {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 0.85rem;
}

.col-inv-amount {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.inventory-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.inventory-header .col-inv-pair,
.inventory-header .col-inv-num,
.inventory-header .col-inv-amount,
.inventory-header .col-inv-info {
  text-align: center;
  justify-content: center;
}

.inventory-row {
  border-bottom: 1px solid #ddd;
  transition: background 0.2s;
}

.inventory-row.inv-pending {
  background: #fff8e1;
}

.inventory-row.inv-confirmed {
  background: #e8f5e9;
}

.inventory-row.inv-conflict {
  background: #ffebee;
  outline: 2px solid #d32f2f;
  outline-offset: -2px;
}

.inventory-row:last-child {
  border-bottom: none;
}

/* Per-row conflict explanation, rendered as a sibling div right below the row. */
.inventory-row-conflict {
  background: #ffebee;
  border-left: 4px solid #d32f2f;
  padding: 0.5em 1em;
  font-size: 0.9em;
  color: #b71c1c;
  display: flex;
  gap: 0.5em;
  align-items: flex-start;
}

.inventory-row-conflict .conflict-icon {
  flex-shrink: 0;
  font-size: 1.1em;
}

.inventory-row-conflict .conflict-text {
  line-height: 1.4;
}

.inventory-row-conflict .conflict-text strong {
  color: #d32f2f;
}

/* Top banner shown when any drink has an unresolved conflict. */
.conflict-banner {
  background: #fff3e0;
  border: 1px solid #ffb74d;
  border-radius: 6px;
  padding: 0.75em 1em;
  margin: 0.5em 0 1em;
  display: flex;
  gap: 0.75em;
  align-items: flex-start;
}

.conflict-banner-icon {
  font-size: 1.2em;
  flex-shrink: 0;
}

.conflict-banner-text {
  line-height: 1.4;
  color: #5d4037;
}

.conflict-banner-text strong {
  color: #d32f2f;
}

/* Mobile card variant */
.inv-card.inv-conflict {
  background: #ffebee;
  border-color: #d32f2f;
}

.inv-card-conflict {
  background: #ffcdd2;
  color: #b71c1c;
  font-size: 0.85em;
  padding: 0.4em 0.6em;
  border-radius: 4px;
  margin: 0.4em 0;
  line-height: 1.3;
}

.inv-card-conflict strong {
  color: #d32f2f;
}

/* ── Mobile Inventory Cards ── */

.mobile-only {
  display: none !important;
}

.inventory-cards {
  flex-direction: column;
  gap: 0.5rem;
}

.inv-card {
  border: 2px solid black;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: white;
  overflow: hidden;
  transition: background 0.2s, border-color 0.2s;
}

.inv-card.inv-pending {
  background: #fff8e1;
  border-color: #f9a825;
}

.inv-card.inv-confirmed {
  background: #e8f5e9;
  border-color: #43a047;
}

.inv-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.2rem;
}

.inv-card-name {
  font-weight: 800;
  font-size: 1rem;
}

.inv-card-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #555;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.inv-info-label {
  font-weight: 700;
  margin-right: 0.15rem;
}

.inv-info-sep {
  color: #bbb;
}

.inv-info-price {
  font-weight: 600;
  color: #333;
}

.inv-card-label {
  font-weight: 700;
  margin-right: 0.25rem;
}

.inv-card-after {
  margin-bottom: 0.5rem;
}

.inv-card-after > .inv-card-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.stepper-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.stepper-group {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: #f5f5f5;
  border-radius: 0.5rem;
  padding: 0.25rem;
}

.stepper-btn {
  all: unset;
  width: 40px;
  height: 40px;
  border: 2px solid black;
  border-radius: 0.4rem;
  background: white;
  color: black;
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, color 0.1s;
  box-sizing: border-box;
}

.stepper-btn:active {
  background: black;
  color: white;
}

.stepper-value {
  width: 3rem;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  -moz-appearance: textfield;
}

.stepper-value::-webkit-inner-spin-button,
.stepper-value::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stepper-unit {
  font-size: 0.85rem;
  font-weight: 800;
  color: #333;
  min-width: 1.5rem;
  margin-left: 0.2rem;
}


/* ── Expenses Table ── */

.expenses-table {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 1rem;
}

.expense-row input,
.expense-row select {
  height: 2rem;
  line-height: 1.2;
  box-sizing: border-box;
  min-width: 0;
}

.expense-header, .expense-row {
  display: grid;
  grid-template-columns: 1fr 100px 140px 140px 36px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
}

.expense-row > div {
  min-width: 0;
  overflow: hidden;
}

.grant-expenses .expense-header,
.grant-expenses .expense-row {
  grid-template-columns: 1fr 120px 140px;
}

.grant-expenses {
  margin-bottom: 0;
  border-top: 0.25rem solid black;
}

.grant-expenses .col-desc {
  text-align: left;
}

.grant-expenses .col-amount {
  text-align: right;
}

.expense-row.expense-total {
  border-top: 0.25rem solid black;
  font-weight: 700;
  background: #f5f5f5;
}

.expense-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.expense-row {
  border-bottom: 1px solid #ddd;
}

.expense-row:nth-child(even) {
  background: #f5f5f5;
}

.expense-row:last-child {
  border-bottom: none;
}

/* ── Splits Table ── */

.splits-table {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 1rem;
}

.split-row {
  display: grid;
  grid-template-columns: 1fr 120px 120px 40px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
  border-bottom: 1px solid #ddd;
}

.split-row:nth-child(even) {
  background: #f5f5f5;
}

.split-row:last-child {
  border-bottom: none;
}

/* Fixed (non-editable) split row for tax authority. */
.split-row.split-fixed {
  background: #f0f4f8;
  border-bottom: 0.2rem solid black;
  font-weight: 700;
}
.split-row.split-fixed:nth-child(even) {
  background: #f0f4f8;
}
.split-row.split-fixed .fixed-name {
  font-weight: 700;
  color: #333;
}
.split-row.split-fixed .fixed-pct {
  color: #888;
  font-size: 0.85rem;
  text-align: center;
  display: block;
}

/* Hinweis unter dem Section-Title — visuell als verbundener Streifen. */
.splits-note {
  font-size: 0.8rem;
  color: #555;
  margin: 0;
  padding: 0.5rem 1rem;
  font-style: italic;
  background: #f9f9f9;
  border: 0.25rem solid black;
  border-top: none;
  border-bottom: none;
  line-height: 1.4;
}

/* ── Inputs ── */

.col-source {
  font-weight: 600;
  font-size: 0.9rem;
}

.col-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.col-price, .col-qty, .col-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.col-computed {
  font-weight: 600;
}

.no-field {
  color: #999;
  text-align: center;
  display: block;
}

.col-desc, .col-from, .col-action, .col-pct, .col-sphere {
  font-size: 0.9rem;
}

.col-sphere .select-input {
  font-size: 0.9rem;
  padding: 0.375rem 0.5rem;
}

.col-pct {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.amount-input, .qty-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
  -moz-appearance: textfield;
}

.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.amount-wrap {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 2rem;
}

.amount-wrap input {
  padding-right: 1.5rem;
  height: 100%;
}

.amount-wrap::after {
  content: '€';
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  font-weight: 600;
  pointer-events: none;
  color: #666;
}

.text-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  box-sizing: border-box;
}

.select-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  background: white;
  box-sizing: border-box;
}

.amount-input:focus, .qty-input:focus, .text-input:focus, .select-input:focus {
  outline: none;
  background: black;
  color: white;
}

.notes-input {
  width: 100%;
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-family: inherit;
  resize: vertical;
}

.notes-input:focus {
  outline: none;
  background: black;
  color: white;
}

.input-inline {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.input-inline .amount-input {
  width: 120px;
}

.unit {
  font-weight: 900;
  font-size: 0.9rem;
}

/* ── Buttons ── */

.btn-add {
  padding: 0.625rem 1rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-add:hover {
  background: black;
  color: white;
}

.btn-remove {
  padding: 0.25rem 0.5rem;
  background: black;
  color: white;
  border: 0.15rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 1rem;
  line-height: 1;
}

.btn-remove:hover {
  filter: brightness(120%);
}

/* ── Totals ── */

.group-total {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  color: black;
  font-weight: 700;
  font-size: 0.95rem;
}

.group-detail {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 1rem;
  font-size: 0.85rem;
  color: #444;
  gap: 1rem;
}

.vat-hint {
  font-size: 0.75rem;
  color: #888;
  margin-left: auto;
}

.cashcount-summary {
  margin-top: 1.5rem;
  border: 0.25rem solid black;
  padding: 1rem;
}

.cashcount-summary .section-title {
  margin-bottom: 0.75rem;
}

.summary-list {
  display: flex;
  flex-direction: column;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.summary-line.summary-expandable {
  cursor: pointer;
  user-select: none;
}
.summary-line.summary-expandable:hover {
  background: #f5f5f5;
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.summary-line.summary-sub {
  font-size: 0.8rem;
  font-weight: 400;
  color: #555;
  padding: 0.25rem 0 0.25rem 1rem;
}

.summary-line.summary-sub.summary-highlight {
  font-weight: 600;
  color: black;
  border-top: 1px solid #ddd;
  padding-top: 0.375rem;
  margin-top: 0.25rem;
}

.summary-line.summary-total {
  border-top: 0.2rem solid black;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  font-size: 1.05rem;
  font-weight: 900;
}

.summary-label {
  text-align: left;
}

.summary-value {
  text-align: left;
  font-variant-numeric: tabular-nums;
  min-width: 100px;
}

.summary-table {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
  font-size: 0.95rem;
}

.summary-row.summary-total {
  border-top: 2px solid black;
  padding-top: 0.75rem;
  margin-top: 0.375rem;
  font-size: 1.1rem;
}

.summary-row.summary-expandable {
  cursor: pointer;
  user-select: none;
}
.summary-row.summary-expandable:hover {
  background: #f5f5f5;
}

.summary-row.summary-sub {
  font-size: 0.8rem;
  color: #555;
}

.summary-row.summary-highlight {
  font-size: 0.85rem;
  color: black;
  border-top: 1px solid #ddd;
  padding-top: 0.375rem;
  margin-top: 0.25rem;
}

.summary-divider {
  border-top: 1px dashed #ccc;
  margin: 0.5rem 0;
}

.grand-total {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f5f5f5;
  color: black;
  font-weight: 700;
  font-size: 1.1rem;
  border: 0.25rem solid black;
  margin-top: 1.5rem;
}

.grand-total > div, .grand-total > span {
  display: flex;
  justify-content: space-between;
}

.footnote {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #666;
  line-height: 1.4;
}

.footnote p {
  margin: 0.25rem 0;
}

.footnote ul {
  margin: 0.25rem 0;
  padding-left: 1.2rem;
}

.footnote li {
  margin: 0.1rem 0;
}

.select-input.missing {
  border-color: #c00;
  color: #999;
}

.grand-total .separator {
  border-top: 1px solid rgba(0,0,0,0.2);
  margin: 0.25rem 0;
}

/* ── Result ── */

.result-detail {
  border: 0.25rem solid black;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ddd;
  font-size: 0.9rem;
}

.detail-row:nth-child(even):not(.detail-total) {
  background: #f5f5f5;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.detail-total {
  background: #f5f5f5;
  color: black;
  font-weight: 700;
  font-size: 0.95rem;
  border-bottom: none;
}

.result-summary {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 2rem;
  margin-top: 0;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid black;
  font-size: 1rem;
}

.result-row.expandable {
  cursor: pointer;
  user-select: none;
}

.result-row.expandable:hover {
  background: #f5f5f5;
}

.result-row.detail {
  padding: 0.4rem 1rem 0.4rem 2.5rem;
  font-size: 0.85rem;
  color: #444;
  border-bottom: 1px solid #eee;
}

.result-row:last-child {
  border-bottom: none;
}

.result-total {
  background: black;
  color: white;
  font-size: 1.2rem;
  border-bottom: none;
}

.positive {
  font-weight: 900;
}

.negative {
  font-weight: 900;
}

.splits-summary {
  border: 0.25rem solid black;
  margin-top: 1.5rem;
}

.notes-section {
  margin-top: 2rem;
}

/* Intermediate result row inside .result-summary (not bold black border). */
.result-row.intermediate {
  background: #f5f5f5;
  font-weight: 700;
  border-bottom: 1px solid black;
}

/* ── USt-Karte (zwei-Spalten) ─────────────────────────── */
.vat-card {
  border: 0.25rem solid black;
  border-top: none;
}

.vat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.vat-col {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem;
}

.vat-col + .vat-col {
  border-left: 0.15rem solid black;
}

.vat-col-header {
  font-weight: 900;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #ddd;
}

.vat-col-row {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.vat-col-row .vat-empty {
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
}

.vat-col-total {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 0.2rem solid black;
  font-weight: 700;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.vat-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  border-top: 0.25rem solid black;
  font-size: 1.05rem;
  font-weight: 900;
}

.vat-result.liability {
  background: #fff3cd;
  color: #856404;
}

.vat-result.refund {
  background: #d4edda;
  color: #155724;
}

.vat-result-label {
  font-weight: 700;
}

.vat-result-value {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
}

.vat-note {
  margin: 0;
  padding: 0.6rem 1rem;
  font-size: 0.75rem;
  color: #666;
  font-style: italic;
  border-top: 1px dashed #ccc;
  background: #fafafa;
  line-height: 1.4;
}

/* ── Endergebnis nach USt (prominenter Block) ─────────── */
.final-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
  border: 0.3rem solid black;
  background: white;
  color: black;
}

.final-result-label {
  font-size: 1.05rem;
  font-weight: 700;
}

.final-result-value {
  font-size: 1.6rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.final-result-value.positive {
  color: #2e7d32;
}

.final-result-value.negative {
  color: #c00;
}

/* Total-Zeilen im Result-Tab: weiß mit dicker Top-Border statt schwarz,
   damit nicht mit den schwarzen Section-Headern konkurriert. */
.result-summary .result-row.result-total,
.splits-summary .result-row.result-total {
  background: white;
  color: black;
  border-top: 0.3rem solid black;
  border-bottom: none;
  font-size: 1.15rem;
  font-weight: 900;
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.result-summary .result-row.result-total .positive,
.splits-summary .result-row.result-total .positive {
  color: #2e7d32;
}

.result-summary .result-row.result-total .negative,
.splits-summary .result-row.result-total .negative {
  color: #c00;
}

@media (max-width: 700px) {
  .vat-grid {
    grid-template-columns: 1fr;
  }
  .vat-col + .vat-col {
    border-left: none;
    border-top: 0.15rem solid black;
  }
  .final-result {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}

/* ── Responsive ── */

@media (max-width: 900px) {
  .revenue-header, .inventory-header {
    display: none;
  }

  .revenue-row, .inventory-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
  }

  .revenue-row > .col-amount[data-label]::before {
    content: attr(data-label) ": ";
    font-weight: 600;
    font-size: 0.8rem;
    color: #555;
  }

  .expense-header {
    display: none;
  }

  .expense-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .col-price, .col-qty, .col-amount {
    text-align: left;
  }

  /* Show mobile cards, hide desktop table */
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: flex !important;
  }
}

/* ── Grant Tab ── */
.grant-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.grant-sub-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0 0;
}

.grant-sub-tab {
  padding: 0.5rem 1.25rem;
  border: none;
  background: #f0f0f0;
  color: black;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s;
}

.grant-sub-tab:hover {
  background: #ddd;
}

.grant-sub-tab.active {
  background: black;
  color: white;
}

.event-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 0.25rem solid black;
}

.info-row {
  display: flex;
  gap: 1rem;
}

.info-row .label {
  font-weight: 700;
  min-width: 120px;
}

.grant-detail {
  display: flex;
  flex-direction: column;
  border: 0.25rem solid black;
}

.grant-detail .detail-row .amount {
  text-align: right;
  min-width: 100px;
}

.grant-tab .detail-row.detail-total {
  background: #f5f5f5;
  color: black;
  font-weight: 700;
}

.detail-row.detail-cat-header {
  background: #f5f5f5;
  font-weight: 700;
  font-size: 0.9rem;
}

.detail-row.input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.detail-row.input-row .text-input {
  flex: 1;
  min-width: 0;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}



.input-group .unit {
  font-size: 0.85rem;
  color: #666;
}

.input-group .computed {
  font-size: 0.85rem;
  color: #333;
  min-width: 120px;
  text-align: right;
}

.grant-summary {
  border: 0.25rem solid black;
  display: flex;
  flex-direction: column;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ccc;
}

.result-row:last-child {
  border-bottom: none;
}

.result-row.result-total {
  background: black;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
}

.result-row .negative {
  color: #c00;
}

.result-row.result-total .negative {
  color: #faa;
}

.max-note {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}

.grant-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-pdf {
  padding: 0.75rem 1.5rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-pdf:hover {
  background: black;
  color: white;
}

.btn-pdf:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.budget-section {
  border: 0.25rem solid black;
  margin-bottom: 1.5rem;
}

.budget-category {
  border-bottom: 1px solid #ddd;
}

.budget-category:last-child {
  border-bottom: none;
}

.budget-cat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  font-weight: 700;
  font-size: 0.9rem;
}

.budget-cat-total {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: black;
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
}

.budget-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.375rem 1rem;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.budget-row .text-input {
  flex: 1;
}

.budget-row .amount-input {
  width: 100px;
}

.btn-add-sm {
  padding: 0.15rem 0.5rem;
  background: black;
  color: white;
  border: 0.15rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 0.85rem;
  line-height: 1;
}

.btn-add-sm:hover {
  filter: brightness(120%);
}

.btn-remove-sm {
  padding: 0.15rem 0.4rem;
  background: black;
  color: white;
  border: 0.15rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 0.85rem;
  line-height: 1;
}

.btn-remove-sm:hover {
  filter: brightness(120%);
}

.date-input {
  padding: 0.25rem 0.5rem;
  border: 0.15rem solid black;
  font-family: inherit;
  font-size: inherit;
  font-weight: 600;
}

.date-input:focus {
  outline: none;
  background: black;
  color: white;
}

.summary-section {
  margin-top: 1rem;
}

/* ── Documents Tab ─────────────────────────────── */
.documents-tab .section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.documents-tab .header-actions {
  display: flex;
  gap: 0.5rem;
}
.btn-upload {
  padding: 0.625rem 1rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}
.btn-upload:hover {
  background: black;
  color: white;
}
.btn-secondary {
  background: transparent;
  border: 1px solid #666;
  color: inherit;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}
.drop-zone {
  border: 2px dashed #444;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1rem;
  transition: border-color 0.2s, background 0.2s;
}
.drop-zone.drag-over {
  border-color: var(--color-accent, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}
.upload-progress {
  margin-bottom: 1rem;
}
.upload-error {
  background: #fff3cd;
  border: 1px solid #856404;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: #856404;
}
.upload-item {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0;
  font-size: 0.85rem;
  opacity: 0.7;
}
.documents-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.documents-table th,
.documents-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #333;
}
.doc-link {
  color: var(--color-accent, #4f46e5);
  text-decoration: none;
}
.doc-link:hover {
  text-decoration: underline;
}
.btn-delete {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 1rem;
}
.empty-state {
  text-align: center;
  padding: 2rem;
  opacity: 0.6;
}

/* ── Einheitliche Typografie über alle Abrechnungs-Tabs ─────────────
   Eine zentrale Skala mit nur 5 Schriftgrößen + 3 Gewichten.
   Diese Block überschreibt punktuell ältere, inkonsistente Werte
   in den oben definierten Selektoren.
   Skala (1rem ≈ 16px):
     --fs-xs   0.75rem  Hilfstexte, Footnotes, Hinweise, Indikatoren
     --fs-sm   0.85rem  Sub-Rows, Details, Tabellen-Header
     --fs-base 0.95rem  Standard-Inhaltszeilen, Inputs, Selects
     --fs-md   1.05rem  Total/Summen-Zeilen, Section-Titles
     --fs-xl   1.5rem   Final-Result, große Akzent-Beträge
*/
.accounting-view {
  --fs-xs: 0.75rem;
  --fs-sm: 0.85rem;
  --fs-base: 0.95rem;
  --fs-md: 1.05rem;
  --fs-xl: 1.5rem;
}

/* Section-Titles (Container-Header) — überall gleich groß. */
.accounting-view .section-title {
  font-size: var(--fs-md);
}

/* Tabellen-Header (Spalten-Beschriftungen). */
.accounting-view .revenue-header,
.accounting-view .inventory-header,
.accounting-view .expense-header,
.accounting-view .vat-col-header {
  font-size: var(--fs-sm);
  font-weight: 900;
}

/* Standard-Inhaltszeilen / -Inputs. */
.accounting-view .revenue-row,
.accounting-view .inventory-row,
.accounting-view .expense-row,
.accounting-view .split-row,
.accounting-view .detail-row,
.accounting-view .summary-line,
.accounting-view .result-row,
.accounting-view .group-total,
.accounting-view .group-detail,
.accounting-view .grand-total,
.accounting-view .text-input,
.accounting-view .amount-input,
.accounting-view .qty-input,
.accounting-view .select-input,
.accounting-view .col-source,
.accounting-view .col-name,
.accounting-view .col-amount,
.accounting-view .col-pct,
.accounting-view .col-desc,
.accounting-view .col-inv-name,
.accounting-view .col-inv-amount {
  font-size: var(--fs-base);
}

/* Sub-Rows, Details, kleine Hinweise auf Reihen-Ebene. */
.accounting-view .summary-line.summary-sub,
.accounting-view .result-row.detail,
.accounting-view .revenue-row.sub-row,
.accounting-view .vat-col-row,
.accounting-view .col-inv-num,
.accounting-view .col-inv-info,
.accounting-view .bev-info {
  font-size: var(--fs-sm);
}

/* Total-/Summen-Zeilen — durch Größe + Border, nicht durch Schwarz. */
.accounting-view .summary-line.summary-total,
.accounting-view .summary-row.summary-total,
.accounting-view .vat-col-total,
.accounting-view .vat-result,
.accounting-view .result-row.intermediate,
.accounting-view .result-summary .result-row.result-total,
.accounting-view .splits-summary .result-row.result-total,
.accounting-view .final-result-label,
.accounting-view .grant-summary .result-row.result-total,
.accounting-view .grant-summary .result-row,
.accounting-view .expense-row.expense-total,
.accounting-view .detail-row.detail-total {
  font-size: var(--fs-md);
}

/* Hilfstexte, Footnotes, kleine Hinweise. */
.accounting-view .footnote,
.accounting-view .footnote p,
.accounting-view .footnote li,
.accounting-view .vat-note,
.accounting-view .max-note,
.accounting-view .splits-note,
.accounting-view .auto-save-indicator,
.accounting-view .entry-price-hint,
.accounting-view .vat-empty,
.accounting-view .external-data-summary,
.accounting-view .external-data-status,
.accounting-view .pretix-error,
.accounting-view .pretix-warning,
.accounting-view .save-success,
.accounting-view .stock-changed-warning,
.accounting-view .inv-progress,
.accounting-view .inv-card-info,
.accounting-view .stock-warning {
  font-size: var(--fs-xs);
}

/* Sehr kleine deeply-nested Details (z.B. PayPal-Transaktionszeilen). */
.accounting-view .revenue-row.sub-detail {
  font-size: var(--fs-xs);
}

/* Großer Akzent-Betrag im Endergebnis. */
.accounting-view .final-result-value {
  font-size: var(--fs-xl);
}

/* Mobile-Steppertasten dürfen größer bleiben — User-tap-target. */
.accounting-view .stepper-value {
  font-size: var(--fs-md);
}

/* Konsistente Schrift-Familie überall (erbt vom App-Root,
   stellt aber sicher dass keine browser-default-fonts in Inputs erscheinen). */
.accounting-view input,
.accounting-view select,
.accounting-view textarea,
.accounting-view button {
  font-family: inherit;
}
</style>
