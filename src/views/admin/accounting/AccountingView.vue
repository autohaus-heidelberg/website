<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { accountingService, beverageService, eventService, pretixService, paypalBarService, sumupBarService, grantService, stockService, documentService } from '@/services'
import type { Event, ArtistDeal } from '@/services'
import type { PretixOrderSummary, PayPalBarSummary, PayPalCategory, SumUpBarSummary, SumUpCategory, EventDocument } from '@/services/accounting'
import type {
  EventAccounting,
  RevenueEntry,
  RevenueSource,
  InventoryEntry,
  ConsumptionStats,
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
  REVENUE_VAT_RATE_DEFAULTS,
  EXPENSE_PAID_FROM_LABELS,
  TAX_SPHERE_LABELS,
  VAT_RATE_LABELS,
} from '@/types/accounting'
import { useSort } from '@/composables/useSort'
import { parseQty, qtyEquals, normalizeQty } from '@/utils/quantity'
import { splitMode, splitQuantity, joinQuantity, stepMinor, normalizeSplit } from '@/utils/inventoryStep'
import { resolveComboDeal, findDuplicateNames, bandDealIssues, parsePrice, ENTRANCE_VAT_RATE } from '@/utils/artistDeals'
import type { BandDealIssues } from '@/utils/artistDeals'
import { useAuthStore } from '@/stores/auth'
import { printInvoiceService, PRINT_INVOICE_SOURCE_LABELS, type PrintInvoice } from '@/services/printInvoices'


const props = defineProps<{
  eventId: string
}>()

const emit = defineEmits<{
  'status-changed': [status: 'draft' | 'final']
  'tab-changed': [tab: string]
}>()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Tab-Persistenz via Query-Param `abrTab`. Damit überlebt der Inventur-
// Klick auf einen Drink → BeverageFormView → "Zurück" den Tab-State:
// die URL trägt z.B. `/admin/events/42?tab=accounting&abrTab=inventory`,
// und beim Restore (Browser-Back oder Cancel-Button) sind wir wieder
// genau in der Inventur statt im Default `cashcount`.
type AbrTab = 'cashcount' | 'inventory' | 'expenses' | 'result' | 'grant'
const VALID_ABR_TABS: AbrTab[] = ['cashcount', 'inventory', 'expenses', 'result', 'grant']
function readAbrTabFromRoute(): AbrTab {
  const q = route.query.abrTab
  // 'documents' was merged into 'expenses' — keep old links working.
  if (q === 'documents') return 'expenses'
  if (typeof q === 'string' && (VALID_ABR_TABS as string[]).includes(q)) return q as AbrTab
  return 'expenses'
}
const activeTab = ref<AbrTab>(readAbrTabFromRoute())
// Die URL schreibt ausschließlich die Elternview — zwei parallele
// router.replace-Aufrufe würden sich gegenseitig abbrechen.
watch(activeTab, (val) => emit('tab-changed', val), { immediate: true })
// Falls von außen (z.B. Browser-Back) die URL den abrTab ändert, ziehen
// wir den State nach. Filter auf abrTab-only, damit andere Query-Änderungen
// (z.B. Speicher-Acknowledge) nichts in Gang setzen.
watch(() => route.query.abrTab, () => {
  const next = readAbrTabFromRoute()
  if (next !== activeTab.value) activeTab.value = next
})

/** Baut die Ziel-Route für den Drink-Link in der Inventur-Tabelle.
 *  Hängt einen `returnTo`-Param an, der BeverageFormView nutzt, um nach
 *  "Speichern" oder "Abbrechen" zurück in den genau gleichen Tab dieser
 *  Abrechnung zu springen — statt stur auf `/admin/lager` zu landen. */
function beverageLinkTo(beverage: BeverageItem) {
  const returnTo = `/admin/events/${props.eventId}?tab=accounting&abrTab=inventory`
  return {
    path: `/admin/beverages/${beverage.id}`,
    query: { returnTo },
  }
}

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

// ── Doordeal ─────────────────────────────────────────────────────
// Kein manuelles An/Aus mehr — die Sektion ist immer sichtbar (wie Gewinn-
// verteilung), "aktiv" ist sie sobald mindestens eine Partei einen Namen hat.
// Ein leerer Platzhalter-Eintrag (Default beim Laden) darf NICHTS vom
// Ergebnis abziehen, siehe doorDealArtistAmount/doorDealVenueShare unten.
const doorDealSplits = ref<{ name: string; share: number }[]>([])
const doorDealActive = computed(() => doorDealSplits.value.some(s => s.name.trim() !== ''))

const isLoading = ref(false)
const isSaving = ref(false)
const isFinalizingStatus = ref(false)
const error = ref('')
const saveSuccess = ref('')
const stockChangedWarning = ref('')

// FIFO stock conflicts surfaced from the last save attempt. Keyed by drink_id.
// Cleared per-drink when the user edits that drink's row, or globally on a
// successful save.
type InventoryConflict = { drink: string; available: number; requested: number }
const inventoryConflicts = reactive(new Map<number, InventoryConflict>())

// Historical consumption stats (per drink + per category) used to warn when
// the entered consumption is unusually high — a strong hint that remaining
// stock was forgotten during the Inventur. Loaded once per Abrechnung.
const consumptionStats = ref<ConsumptionStats>({ drinks: {}, categories: {} })

// Optimistic-concurrency conflict: another user updated the same Abrechnung
// in parallel. Set on HTTP 409; the only resolution is to reload (otherwise
// the user's pending edits would silently overwrite the other user's work).
// See backend `AbrechnungSerializer.update` and `tests_abrechnung_occ.py`.
const staleAbrechnungConflict = ref(false)

// Set when a save fails with no HTTP response (timeout / connection reset /
// edge 5xx). The write outcome is unknown, so auto-save is paused until the
// user retries — blindly re-saving could overwrite a parallel editor.
const saveNetworkError = ref(false)

// ── Pretix VVK ───────────────────────────────────────────────────
const pretixData = ref<PretixOrderSummary | null>(null)
const pretixLoading = ref(false)
const pretixError = ref('')

// ── PayPal Bar ───────────────────────────────────────────────────
const paypalBarData = ref<PayPalBarSummary | null>(null)
const paypalBarLoading = ref(false)
const paypalBarError = ref('')

// ── SumUp Bar ────────────────────────────────────────────────────
const sumupBarData = ref<SumUpBarSummary | null>(null)
const sumupBarLoading = ref(false)
const sumupBarError = ref('')

// Abweichungen aus dem letzten Abruf, die NICHT automatisch übernommen wurden.
// Die Kategorie-Korrekturen (Bar/Einlass) pro Transaktion werden nicht
// gespeichert — ein erneuter Abruf würde sie sonst stillschweigend mit der
// Backend-Heuristik überschreiben.
interface ExternalDiff {
  source: RevenueSource
  label: string
  storedTotal: number
  storedFees: number
  fetchedTotal: number
  fetchedFees: number
}
const externalDiffs = ref<ExternalDiff[]>([])

/** Übernimmt API-Werte nur in unberührte oder unveränderte Zeilen. Weicht ein
 *  bereits erfasster Wert ab, wird er zum Vorschlag statt zur Überschreibung.
 *  `force` schreibt immer — für Umkategorisieren, wo der Nutzer selbst handelt. */
function applyRevenueFromExternal(source: RevenueSource, total: number, fees: number, force = false) {
  const rev = getRevenue(source)
  const storedTotal = parseFloat(rev.total || '0')
  const storedFees = parseFloat(rev.fees || '0')
  const untouched = storedTotal === 0 && storedFees === 0
  const unchanged = Math.abs(storedTotal - total) < 0.005 && Math.abs(storedFees - fees) < 0.005
  if (force || untouched || unchanged) {
    rev.total = total.toFixed(2)
    rev.fees = fees.toFixed(2)
    rev.change_money = '0.00'
    return
  }
  externalDiffs.value.push({
    source,
    label: REVENUE_SOURCE_LABELS[source],
    storedTotal, storedFees,
    fetchedTotal: total, fetchedFees: fees,
  })
}

function applyExternalDiff(diff: ExternalDiff) {
  const rev = getRevenue(diff.source)
  rev.total = diff.fetchedTotal.toFixed(2)
  rev.fees = diff.fetchedFees.toFixed(2)
  rev.change_money = '0.00'
  externalDiffs.value = externalDiffs.value.filter(d => d.source !== diff.source)
}

function dismissExternalDiff(diff: ExternalDiff) {
  externalDiffs.value = externalDiffs.value.filter(d => d.source !== diff.source)
}

// ── Grant (Förderung) ────────────────────────────────────────────
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
const renamingDocId = ref<number | null>(null)
const renameDraft = ref('')
const renameBusy = ref(false)
const renameError = ref('')

// ── Expense receipt scan (AI) ────────
const expenseScanInput = ref<HTMLInputElement | null>(null)
const scanningExpense = ref(false)
const scanExpenseError = ref('')
const scanningDocId = ref<number | null>(null)
const scanDocError = ref('')
const scanDocSuccess = ref('')

// ── Vendor invoices assigned to this event (from the Rechnungseingang inbox) ──
const eventInvoices = ref<PrintInvoice[]>([])
const importedInvoiceIds = ref<number[]>([])
const invoiceImportBusyId = ref<number | null>(null)
const invoiceImportError = ref('')

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

const sumupBarTotals = computed(() => {
  if (!sumupBarData.value) return { amount: 0, fees: 0, net: 0, count: 0 }
  const txns = sumupBarData.value.transactions
  return {
    amount: txns.reduce((s, t) => s + t.amount, 0),
    fees: txns.reduce((s, t) => s + t.fee, 0),
    net: txns.reduce((s, t) => s + t.net, 0),
    count: txns.length,
  }
})

const sumupBarCategoryTotals = computed(() => {
  if (!sumupBarData.value) return { bar: { amount: 0, fees: 0, count: 0 }, entrance: { amount: 0, fees: 0, count: 0 } }
  const txns = sumupBarData.value.transactions
  const bar = txns.filter(t => t.category === 'bar')
  const entrance = txns.filter(t => t.category === 'entrance')
  return {
    bar: { amount: bar.reduce((s, t) => s + t.amount, 0), fees: bar.reduce((s, t) => s + t.fee, 0), count: bar.length },
    entrance: { amount: entrance.reduce((s, t) => s + t.amount, 0), fees: entrance.reduce((s, t) => s + t.fee, 0), count: entrance.length },
  }
})

function sumupTransactionsFor(category: 'bar' | 'entrance') {
  if (!sumupBarData.value) return []
  return sumupBarData.value.transactions
    .map((txn, idx) => ({ txn, idx }))
    .filter(({ txn }) => txn.category === category)
}

// ── Sorting ──────────────────────────────────────────────────────
const invSort = useSort<{ beverage: BeverageItem; entry: InventoryEntry }>('category', 'asc')
const expSort = useSort<ExpenseEntry>()

function sortedInventory(items: { beverage: BeverageItem; entry: InventoryEntry }[]) {
  return invSort.sorted(items, (item, key) => {
    switch (key) {
      case 'name': return item.beverage.name.toLowerCase()
      case 'category': return `${(item.beverage.category || '\uffff').toLowerCase()}\u0000${item.beverage.name.toLowerCase()}`
      case 'before': return parseFloat(item.entry.quantity_before || '0')
      case 'after': return parseFloat(item.entry.quantity_after || '0')
      case 'consumed': return inventoryConsumption(item.entry)
      case 'value': return inventoryValue(item.entry, item.beverage)
      default: return 0
    }
  })
}

// Der „Getränk"-Header zykelt: Name ▲ → Name ▼ → Kategorie ▲ → Kategorie ▼.
function cycleInventoryNameSort() {
  const { sortKey, sortDir } = invSort
  if (sortKey.value === 'name' && sortDir.value === 'asc') sortDir.value = 'desc'
  else if (sortKey.value === 'name') { sortKey.value = 'category'; sortDir.value = 'asc' }
  else if (sortKey.value === 'category' && sortDir.value === 'asc') sortDir.value = 'desc'
  else { sortKey.value = 'name'; sortDir.value = 'asc' }
}

const inventoryNameHeader = computed(() => {
  const arrow = invSort.sortDir.value === 'asc' ? ' ▲' : ' ▼'
  if (invSort.sortKey.value === 'category') return `Getränk · Kategorie${arrow}`
  if (invSort.sortKey.value === 'name') return `Getränk${arrow}`
  return 'Getränk'
})

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
const resultExpandDoorDeal = ref(false)

async function fetchAndApplyAllExternal() {
  if (!props.eventId) return
  externalDataLoading.value = true
  pretixError.value = ''
  paypalBarError.value = ''
  sumupBarError.value = ''
  externalDiffs.value = []

  const results = await Promise.allSettled([
    pretixService.getOrderSummary(props.eventId),
    paypalBarService.getBarTransactions(props.eventId),
    sumupBarService.getBarTransactions(props.eventId),
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

  // SumUp
  if (results[2].status === 'fulfilled') {
    sumupBarData.value = results[2].value
    applySumupBarData()
  } else {
    sumupBarError.value = results[2].reason?.message || 'SumUp-Daten konnten nicht geladen werden'
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
  applyRevenueFromExternal('vvk_pretix', d.total_revenue, totalFees)
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

function applyPaypalBarData(force = false) {
  if (!paypalBarData.value) return
  const ct = paypalBarCategoryTotals.value
  applyRevenueFromExternal('bar_paypal', ct.bar.amount, ct.bar.fees, force)
  applyRevenueFromExternal('entrance_paypal', ct.entrance.amount, ct.entrance.fees, force)
}

function removePaypalBarTransaction(idx: number) {
  if (!paypalBarData.value) return
  paypalBarData.value.transactions.splice(idx, 1)
}

function togglePaypalCategory(idx: number) {
  if (!paypalBarData.value) return
  const txn = paypalBarData.value.transactions[idx]
  txn.category = txn.category === 'bar' ? 'entrance' : 'bar'
  applyPaypalBarData(true)
}

function setAllPaypalCategory(category: PayPalCategory) {
  if (!paypalBarData.value) return
  paypalBarData.value.transactions.forEach(t => { t.category = category })
  applyPaypalBarData(true)
}

async function fetchSumupBarData() {
  if (!props.eventId) return
  sumupBarLoading.value = true
  sumupBarError.value = ''
  try {
    sumupBarData.value = await sumupBarService.getBarTransactions(props.eventId)
  } catch (e: any) {
    sumupBarError.value = e.message || 'SumUp-Daten konnten nicht geladen werden'
  } finally {
    sumupBarLoading.value = false
  }
}

function applySumupBarData(force = false) {
  if (!sumupBarData.value) return
  const ct = sumupBarCategoryTotals.value
  applyRevenueFromExternal('bar_sumup', ct.bar.amount, ct.bar.fees, force)
  applyRevenueFromExternal('entrance_sumup', ct.entrance.amount, ct.entrance.fees, force)
}

function removeSumupBarTransaction(idx: number) {
  if (!sumupBarData.value) return
  sumupBarData.value.transactions.splice(idx, 1)
}

function toggleSumupCategory(idx: number) {
  if (!sumupBarData.value) return
  const txn = sumupBarData.value.transactions[idx]
  txn.category = txn.category === 'bar' ? 'entrance' : 'bar'
  applySumupBarData(true)
}

function setAllSumupCategory(category: SumUpCategory) {
  if (!sumupBarData.value) return
  sumupBarData.value.transactions.forEach(t => { t.category = category })
  applySumupBarData(true)
}

// ── Computed: Revenue ────────────────────────────────────────────

const allRevenueSources: RevenueSource[] = [
  'bar_cash', 'bar_paypal', 'bar_sumup',
  'entrance_cash', 'entrance_paypal', 'entrance_sumup',
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

// "Gezählt" bezieht sich nur auf die physische Kasse; PayPal/SumUp/Pretix
// werden aus den Zahlungsdienstleister-Reports übernommen, nicht gezählt.
function cashSourcesOf(sources: RevenueSource[]): RevenueSource[] {
  return sources.filter(s => s.endsWith('_cash'))
}
function digitalSourcesOf(sources: RevenueSource[]): RevenueSource[] {
  return sources.filter(s => !s.endsWith('_cash'))
}

// Besucherschätzung aus dem gezählten Eintritt: VVK-Tickets sind über Pretix
// exakt bekannt, der Rest der Eintrittseinnahmen ist Abendkasse. Getrennt nach
// VVK-/AK-Preis aufgeteilt statt einer Spanne über die gesamte Summe — sonst
// wird die Schätzung bei größeren Anteilen aus der Kasse bezahlter Ausgaben
// (Bandgagen etc.) unnötig ungenau.
const entranceVisitorEstimate = computed(() => {
  const vvkPrice = parsePrice(event.value?.fee)
  const akPrice = parsePrice(event.value?.feeAk) || vvkPrice
  if (!vvkPrice && !akPrice) return null

  const vvkEntry = revenues.value.find(r => r.source === 'vvk_pretix')
  const vvkTickets = pretixData.value
    ? pretixData.value.total_tickets
    : (vvkPrice > 0 ? Math.round(parseFloat(vvkEntry?.total || '0') / vvkPrice) : 0)

  const doorRevenueGross = groupRevenueGross(REVENUE_GROUPS[1].sources) - (vvkEntry ? revenueNet(vvkEntry) : 0)
  const doorTickets = akPrice > 0 ? Math.max(0, Math.round(doorRevenueGross / akPrice)) : 0

  const total = vvkTickets + doorTickets
  return total > 0 ? `${total}` : null
})

function toggleSourceExpanded(source: string) {
  if (expandedSources.value.has(source)) {
    expandedSources.value.delete(source)
  } else {
    expandedSources.value.add(source)
  }
}

// ── Computed: Inventory ──────────────────────────────────────────

// ── Split-State (Haupt-/Nebeneinheit) für die Inventur-UI ───────
// Kistengetränk  → major = Kisten,   minor = Flaschen
// Portionsdrink  → major = Flaschen, minor = Viertel
// Piccolo & Co.  → kein Split, ein einzelnes Ganzzahlfeld
// Aus dem Split werden quantity_before / quantity_after berechnet.
const inventoryCrates = ref<Record<string, { beforeCrates: number; beforeBottles: number; afterCrates: number; afterBottles: number }>>({})

/** Merkt sich ob der letzte input-Event durch einen Spinner-Klick (mousedown)
 *  ausgelöst wurde. So kann blur() gezielt nur nach Spinner-Clicks aufgerufen
 *  werden, nicht beim normalen Tippen. */
let _spinnerMousedown = false
function onQtyMousedown() { _spinnerMousedown = true; setTimeout(() => { _spinnerMousedown = false }, 300) }
function blurIfSpinner(e: InputEvent) { if (_spinnerMousedown) (e.currentTarget as HTMLInputElement | null)?.blur() }

/** Scrollrad auf Inventur-Inputs: einen Schritt ändern, dann sofort blur()
 *  damit das Rad nicht unkontrolliert weiterläuft. */
function onQtyWheel(e: WheelEvent) {
  e.preventDefault()
  const input = e.currentTarget as HTMLInputElement
  const delta = e.deltaY < 0 ? 1 : -1
  const cur = parseFloat(input.value) || 0
  input.value = String(Math.max(0, cur + delta))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.blur()
}

/** Gibt `null` für Getränke ohne Split (Piccolo & Co.) — die arbeiten direkt
 *  auf `entry.quantity_after`. */
function getOrInitSplit(beverage: BeverageItem, entry: InventoryEntry) {
  const mode = splitMode(beverage)
  if (!mode) return null
  const key = String(beverage.id)
  if (!inventoryCrates.value[key]) {
    const before = splitQuantity(parseFloat(entry.quantity_before || '0'), mode)
    const after = splitQuantity(parseFloat(entry.quantity_after || '0'), mode)
    inventoryCrates.value[key] = {
      beforeCrates: before.major,
      beforeBottles: before.minor,
      afterCrates: after.major,
      afterBottles: after.minor,
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
  const consumed = Math.max(0, Math.round((before - after) * 10000) / 10000)
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
  const mode = splitMode(beverage)
  if (!mode) return
  const state = inventoryCrates.value[String(beverage.id)]
  if (!state) return
  entry.quantity_before = String(joinQuantity({ major: state.beforeCrates, minor: state.beforeBottles }, mode))
  entry.quantity_after = String(joinQuantity({ major: state.afterCrates, minor: state.afterBottles }, mode))
  recomputeConsumed(entry)
}

/** Wenn der User direkt im Nebeneinheiten-Input arbeitet (native Spin-Buttons
 *  am rechten Rand, oder Tippen einer großen Zahl), normalisiert sich
 *  das Modell sonst nicht: `afterBottles=20` bei einer 20er-Kiste
 *  bleibt einfach stehen.
 *
 *  Eigentliche Logik (Carry-over) lebt in `utils/inventoryStep.ts` und
 *  ist dort isoliert getestet. Diese Wrapper-Funktion adressiert nur den
 *  reaktiven State unter `inventoryCrates[beverage.id]`. */
function normalizeBottleOverflow(
  beverage: BeverageItem,
  field: 'after' | 'before',
) {
  const mode = splitMode(beverage)
  if (!mode) return
  const state = inventoryCrates.value[String(beverage.id)]
  if (!state) return
  const crateKey = field === 'after' ? 'afterCrates' : 'beforeCrates'
  const bottleKey = field === 'after' ? 'afterBottles' : 'beforeBottles'
  const next = normalizeSplit(
    { major: state[crateKey], minor: state[bottleKey] as number },
    mode.minorPerMajor,
  )
  state[crateKey] = next.major
  state[bottleKey] = next.minor
}

/** Wrapper für @input auf dem Flaschen-Input. Aktualisiert die
 *  abgeleiteten Werte (Verbrauch/Betrag) live mit, normalisiert aber
 *  NICHT: Während des Tippens soll die eingegebene Rohzahl stehen
 *  bleiben (z.B. "45"), ohne dass das Feld mitten im Tippen in
 *  Kisten+Rest umgebucht wird. Das Umbuchen passiert erst beim Verlassen
 *  des Feldes (@change → onBottleChange). */
function onBottleInput(beverage: BeverageItem, entry: InventoryEntry) {
  updateEntryFromCrates(entry, beverage)
  confirmedInventory.add(beverage.id!)
}

/** Wrapper für @change (Blur) auf dem Flaschen-Input. Jetzt wird der
 *  Kisten/Flaschen-State normalisiert (Carry-over): Überlauf rollt in die
 *  Kisten, Unterlauf borgt. So "setzt" sich der Wert erst beim Verlassen
 *  des Feldes. */
function onBottleChange(
  beverage: BeverageItem,
  entry: InventoryEntry,
  field: 'after' | 'before',
) {
  normalizeBottleOverflow(beverage, field)
  updateEntryFromCrates(entry, beverage)
  if (field === 'after') confirmedInventory.add(beverage.id!)
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
    getOrInitSplit(bev, entry)
    groups[group].push({ beverage: bev, entry })
  }
  // Reihenfolge der Gruppen war bisher Zufall (Einfüge-Reihenfolge = wo das
  // alphabetisch erste Getränk der Gruppe in der Gesamtliste auftaucht).
  // "Getränkestation" ist unser Hauptlieferant und soll immer zuerst kommen,
  // der Rest bleibt in der bisherigen (zufälligen) Reihenfolge dahinter.
  const ordered: typeof groups = {}
  const mainSupplier = 'Getränkestation'
  if (groups[mainSupplier]) ordered[mainSupplier] = groups[mainSupplier]
  for (const [group, items] of Object.entries(groups)) {
    if (group === mainSupplier) continue
    ordered[group] = items
  }
  return ordered
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

/** Erwarteter Kassen-Umsatz aus dem gezählten Verbrauch (VK-Preis statt EK-Preis) —
 *  dient als Plausibilitätscheck gegen die tatsächlich gezählten Einnahmen.
 *  Bei Portionsverkauf (z.B. offene Weinflasche) wird über portions_per_bottle
 *  auf den Portionspreis umgerechnet. */
function expectedInventoryRevenue(entry: InventoryEntry, beverage: BeverageItem): number {
  const consumed = inventoryConsumption(entry)
  if (beverage.portions_per_bottle && beverage.selling_price_portion) {
    return consumed * beverage.portions_per_bottle * parseFloat(beverage.selling_price_portion)
  }
  const price = parseFloat(entry.snapshot_selling_price || beverage.selling_price || '0')
  return consumed * price
}

function groupExpectedRevenue(items: { beverage: BeverageItem; entry: InventoryEntry }[]): number {
  return items.reduce((sum, { beverage, entry }) => sum + expectedInventoryRevenue(entry, beverage), 0)
}

const totalExpectedRevenue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + groupExpectedRevenue(items), 0
  )
})

/** Namen der konsumierten Getränke ohne hinterlegten VK-Preis (weder pro Flasche
 *  noch pro Portion) — totalExpectedRevenue ist für diese Artikel 0, obwohl
 *  tatsächlich Umsatz gemacht wurde. Wird im Hint aufgelistet, damit man genau
 *  weiß, wo im Getränke-Stamm ein Preis nachgetragen werden muss. */
const missingSellingPriceBeverages = computed(() => {
  const names: string[] = []
  for (const items of Object.values(inventoryBySupplier.value)) {
    for (const { beverage, entry } of items) {
      if (inventoryConsumption(entry) <= 0) continue
      const hasPortionPrice = !!(beverage.portions_per_bottle && beverage.selling_price_portion)
      const hasBottlePrice = !!(entry.snapshot_selling_price || beverage.selling_price)
      if (!hasPortionPrice && !hasBottlePrice) names.push(beverage.name)
    }
  }
  return names
})

// Need at least this many past events before a consumption baseline is
// trustworthy enough to warn about outliers.
const MIN_ANOMALY_HISTORY = 3

/** Returns anomaly info when the entered consumption for a row is unusually
 *  high compared to the drink's history — the typical signature of a forgotten
 *  Restbestand (remaining stock booked as consumed). Falls back to the drink's
 *  category baseline when the drink itself has too little history (e.g. a new
 *  Sekt). Null when unremarkable. */
function consumptionAnomaly(entry: InventoryEntry, beverage?: BeverageItem): { mean: number; max: number; consumed: number } | null {
  let stat = consumptionStats.value.drinks[entry.beverage_item]
  if ((!stat || stat.count < MIN_ANOMALY_HISTORY) && beverage?.category) {
    stat = consumptionStats.value.categories[beverage.category]
  }
  if (!stat || stat.count < MIN_ANOMALY_HISTORY) return null
  const consumed = inventoryConsumption(entry)
  if (consumed <= stat.threshold) return null
  return { mean: stat.mean, max: stat.max, consumed }
}

// ── Mobile Inventory Helpers ─────────────────────────────────────
const hideZeroStock = ref(true)
// Tracks explicit user touch — used to keep the row in the save list even
// when the user edited it back to consumed_quantity = 0 (so the persisted
// row gets a real save instead of being silently filtered out).
const confirmedInventory = reactive(new Set<number>())

/** Toggle: einmal drücken → alle Nachher-Felder auf 0 (zum Hochzählen vom
 *  Nullpunkt); nochmal drücken → Vorher-Werte wiederherstellen. */
const inventoryZeroed = ref(false)

function toggleInventoryZero() {
  if (!inventoryZeroed.value) {
    // → auf 0 setzen
    for (const entry of inventory.value) {
      entry.quantity_after = '0'
      entry.consumed_quantity = '0'
    }
    for (const key of Object.keys(inventoryCrates.value)) {
      inventoryCrates.value[key].afterCrates = 0
      inventoryCrates.value[key].afterBottles = 0
    }
    confirmedInventory.clear()
    inventoryZeroed.value = true
  } else {
    // → Vorher-Werte wiederherstellen
    for (const entry of inventory.value) {
      entry.quantity_after = entry.quantity_before || '0'
      entry.consumed_quantity = '0'
    }
    // Split-State neu initialisieren (einfach leeren → getOrInitSplit baut neu auf)
    inventoryCrates.value = {}
    confirmedInventory.clear()
    inventoryZeroed.value = false
  }
}

/** A row is visually "confirmed" (gelb) when the user has expressed an
 *  intent — currently meaning consumed_quantity > 0. Resetting consumed back
 *  to 0 reverts the row to "pending" appearance. */
function isInventoryConfirmed(entry: InventoryEntry): boolean {
  return parseFloat(entry.consumed_quantity || '0') > 0
}

function stepCrate(beverage: BeverageItem, entry: InventoryEntry, field: 'after' | 'before', delta: number) {
  const state = getOrInitSplit(beverage, entry)
  if (!state) return
  const key = field === 'after' ? 'afterCrates' : 'beforeCrates'
  state[key] = Math.max(0, state[key] + delta)
  updateEntryFromCrates(entry, beverage)
  if (field === 'after') confirmedInventory.add(beverage.id!)
}

function stepBottle(beverage: BeverageItem, entry: InventoryEntry, field: 'after' | 'before', delta: number) {
  const mode = splitMode(beverage)
  const state = mode ? getOrInitSplit(beverage, entry) : null
  if (mode && state) {
    // Der Nebeneinheiten-Zähler "läuft durch" — siehe stepMinor.
    // Kiste (upc=20): "−" auf 0 Fl. → 1 Kiste weniger und 19 Fl.
    // Portionsflasche: "−" auf 0 Viertel → 1 Flasche weniger und drei Viertel.
    const crateKey = field === 'after' ? 'afterCrates' : 'beforeCrates'
    const bottleKey = field === 'after' ? 'afterBottles' : 'beforeBottles'
    const next = stepMinor(
      { major: state[crateKey], minor: state[bottleKey] },
      delta,
      mode.minorPerMajor,
    )
    state[crateKey] = next.major
    state[bottleKey] = next.minor
    updateEntryFromCrates(entry, beverage)
  } else {
    // Ganzflaschen-Drink (Piccolo & Co.) — nur ein Feld, also schlicht
    // ±1 Flasche, bei 0 geklemmt.
    const field2 = field === 'after' ? 'quantity_after' : 'quantity_before'
    const current = parseFloat(entry[field2] || '0')
    entry[field2] = String(Math.max(0, current + delta))
    recomputeConsumed(entry)
  }
  if (field === 'after') confirmedInventory.add(beverage.id!)
}

/** Viertel-Segmente bei Portionsgetränken. Ein Klick auf das bereits aktive
 *  Segment leert die angebrochene Flasche wieder — deshalb braucht es keinen
 *  eigenen "leer"-Button. Hier passiert auch der Snap für krumme Altbestände:
 *  ein geerbtes 19,1 (= 0,4 Viertel) wird erst durch den Klick aufs Raster
 *  gezogen. */
function setQuarter(beverage: BeverageItem, entry: InventoryEntry, quarter: number) {
  const state = getOrInitSplit(beverage, entry)
  if (!state) return
  state.afterBottles = state.afterBottles === quarter ? 0 : quarter
  updateEntryFromCrates(entry, beverage)
  confirmedInventory.add(beverage.id!)
}

/** Liegt der Wert off-grid (krummer Altbestand), ist bewusst KEIN Segment aktiv. */
function isQuarterActive(beverage: BeverageItem, entry: InventoryEntry, quarter: number): boolean {
  const state = getOrInitSplit(beverage, entry)
  return !!state && state.afterBottles === quarter
}

/** Pfeiltasten ↑/↓ im Flaschen-Input (Kistenmodus) sollen denselben
 *  Carry-over auslösen wie die +/- Buttons (siehe stepBottle). Wir
 *  binden auf das generische `@keydown` statt auf `.up`/`.down` mit
 *  Modifier, weil Pug-Templates die Modifier-Schreibweise zwar
 *  prinzipiell unterstützen, aber im Zusammenspiel mit
 *  parens-attribute-syntax fragil ist — ein expliziter JS-Handler ist
 *  robuster und einfacher zu debuggen. */
function onBottleKeydown(
  event: KeyboardEvent,
  beverage: BeverageItem,
  entry: InventoryEntry,
  field: 'after' | 'before',
) {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    stepBottle(beverage, entry, field, 1)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    stepBottle(beverage, entry, field, -1)
  }
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

// Band-Deals werden immer mit grant_category 'kuenstlerhonorar' gebucht — das
// trennt die Gagen von den übrigen Ausgaben, ohne ein eigenes Feld zu brauchen.
const gageExpenses = computed(() =>
  sortedExpenses.value.filter(e => e.grant_category === 'kuenstlerhonorar'),
)

const otherExpenses = computed(() =>
  sortedExpenses.value.filter(e => e.grant_category !== 'kuenstlerhonorar'),
)

const totalGageExpenses = computed(() =>
  gageExpenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0),
)

const totalOtherExpenses = computed(() =>
  otherExpenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0),
)

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

function removeExpense(exp: ExpenseEntry) {
  const index = expenses.value.indexOf(exp)
  if (index !== -1) expenses.value.splice(index, 1)
}

// Gagen sind immer Zweckbetrieb (Kernaufgabe des Vereins) — beim manuellen
// Zuordnen einer Ausgabe zur Förder-Kategorie "Künstler" die Sphäre erzwingen.
// Gagen dürfen auch NICHT von der Doordeal-Basis abgezogen werden (im
// Gegensatz zu GEMA/KSK) — sonst würde eine Band ihre eigene Gage von ihrer
// eigenen Doordeal-Basis abziehen.
function onGrantCategoryChange(exp: ExpenseEntry) {
  if (exp.grant_category === 'kuenstlerhonorar') {
    exp.tax_sphere = 'zweckbetrieb'
    exp.door_deal_deductible = false
  }
}

// ── Band-Deals Übersicht (Ausgaben-Tab) ──────────────────────────
// EINE feste Liste ALLER Bands mit hinterlegtem Deal (Event.artist_deals),
// immer sichtbar — auch wenn alles passt. Ersetzt die früheren vier
// situativen Einzel-Banner (Vorschläge / Betrag-Abweichung / verwaiste
// Ausgabe / verwaister Split). Ganze Entscheidungslogik kommt aus der reinen,
// erschöpfend getesteten Funktion bandDealIssues (utils/artistDeals.ts).
//
// WICHTIG (Vertragslogik Garantie+Doordeal): die Band bekommt NIE Garantie
// UND %-Anteil addiert, sondern IMMER nur das Höhere (resolveComboDeal). Ein
// Kombi-Deal löst sich in EINE Ausgabe auf (nicht in einen Doordeal-Split);
// ein reiner Doordeal läuft über einen Split, eine reine Garantie über eine
// Ausgabe.

// Marker in den Notizen, mit dem "gezahlten Betrag beibehalten" für GENAU
// diesen berechneten Betrag bestätigt wurde — ändert sich die Berechnung
// später erneut, passt der Marker nicht mehr und die Warnung kommt zurück.
const DOORDEAL_ACK_PREFIX = '[Doordeal-Diff bestätigt: '
const DOORDEAL_ACK_SUFFIX = '€]'

function doordealAckMarker(amount: number): string {
  return `${DOORDEAL_ACK_PREFIX}${amount.toFixed(2)}${DOORDEAL_ACK_SUFFIX}`
}

function stripDoordealAckMarkers(notes: string): string {
  return notes
    .split(' — ')
    .filter(part => !part.startsWith(DOORDEAL_ACK_PREFIX))
    .join(' — ')
}

interface BandDealRow {
  artistId: number
  artistName: string
  dealType: string
  dealLabel: string
  recordedLabel: string
  guaranteeAmount: number
  doorDealPercentage: number
  resolvedAmount: number
  resolvedSource: 'guarantee' | 'doordeal'
  notes: string
  currentAmount: number | null
  splitIndex: number
  splitShare: number | null
  issues: BandDealIssues
  allGood: boolean
}

// Eingefrorene gezählte Bareinnahme des Gagen-Rechners (null = folgt der
// Abrechnung). Sobald eine Gage gebucht ist, fließt sie über die
// Kassen-Rückrechnung in die Abrechnungs-Basis zurück — der Rechner darf dem
// nicht folgen, sonst leitet sich die nächste Gage aus einer Basis ab, die
// bereits eine Gage enthält.
const dealCalcFrozen = ref<string | null>(null)

// Wechselgeld im Einlass — wird von der Gage-Basis abgezogen (gehört zurück
// in die Kasse, nicht an die Band). Wird nicht gespeichert — reiner Abendhelfer.
const dealCalcChange = ref<string>('')
const dealCalcChangeAmount = computed(() => parseFloat(dealCalcChange.value) || 0)

const DEAL_CALC_DIGITAL_SOURCES: RevenueSource[] = [
  'entrance_paypal', 'entrance_sumup', 'vvk_pretix', 'vvk_paypal', 'vvk_stripe',
]

// Bargeld im Einlass inkl. der daraus schon bezahlten Posten — Vorbelegung
// des Rechner-Felds.
const dealCalcCashDefault = computed(() => {
  const entry = revenues.value.find(r => r.source === 'entrance_cash')
  if (!entry) return 0
  return revenueNet(entry) + expensesFromSource('entrance_cash')
})

const dealCalcCash = computed(() =>
  dealCalcFrozen.value === null ? dealCalcCashDefault.value : (parseFloat(dealCalcFrozen.value) || 0),
)

// Digitale Eintrittseinnahmen (Pretix VVK + PayPal-/SumUp-Einlass) — liegen
// nicht im Kassenbeutel, zählen aber zur Gagen-Grundlage.
const dealCalcDigital = computed(() =>
  revenues.value
    .filter(r => DEAL_CALC_DIGITAL_SOURCES.includes(r.source))
    .reduce((sum, r) => sum + parseFloat(r.total || '0'), 0),
)

const dealCalcDigitalFees = computed(() =>
  revenues.value
    .filter(r => DEAL_CALC_DIGITAL_SOURCES.includes(r.source))
    .reduce((sum, r) => sum + parseFloat(r.fees || '0'), 0),
)

const dealCalcSubtotal = computed(() =>
  dealCalcCash.value + dealCalcDigital.value - dealCalcDigitalFees.value - dealCalcChangeAmount.value,
)

// Gagen rechnen vom Netto — die USt gehört dem Finanzamt, nicht der Band.
const dealCalcVat = computed(() =>
  dealCalcSubtotal.value - dealCalcSubtotal.value / (1 + ENTRANCE_VAT_RATE),
)

const dealCalcBase = computed(() => dealCalcSubtotal.value / (1 + ENTRANCE_VAT_RATE))

function setDealCalcBase(e: globalThis.Event) {
  dealCalcFrozen.value = (e.target as HTMLInputElement).value
}

function dealLabelFor(
  row: Pick<BandDealRow, 'dealType' | 'guaranteeAmount' | 'doorDealPercentage' | 'resolvedAmount' | 'resolvedSource'>,
): string {
  if (row.dealType === 'guarantee') return `💶 Festgage ${formatCurrency(row.guaranteeAmount)}`
  if (row.dealType === 'door_deal') return `🚪 Doordeal ${row.doorDealPercentage}%`
  const head = `🎤 Garantie ${formatCurrency(row.guaranteeAmount)} vs. Doordeal ${row.doorDealPercentage}%`
  const winner = row.resolvedSource === 'doordeal' ? 'Doordeal' : 'Garantie'
  return `${head} → ${winner} gewinnt (${formatCurrency(row.resolvedAmount)})`
}

// Kurzform für die Deal-Spalte — der Betrag steht in einer eigenen Spalte,
// der Vergleich bei Kombi-Deals in einer zweiten Zeile darunter.
function dealShortLabel(row: BandDealRow): string {
  if (row.dealType === 'guarantee') return 'Festgage'
  if (row.dealType === 'door_deal') return `Doordeal ${row.doorDealPercentage} %`
  return `Garantie ${formatCurrency(row.guaranteeAmount)} vs. Doordeal ${row.doorDealPercentage} %`
}

function dealWinnerHint(row: BandDealRow): string {
  if (row.dealType !== 'guarantee_plus_door') return ''
  return row.resolvedSource === 'doordeal' ? '↳ Doordeal gewinnt' : '↳ Garantie gewinnt'
}

function recordedLabelFor(currentAmount: number | null, splitShare: number | null): string {
  if (currentAmount != null) return `Ausgabe ${formatCurrency(currentAmount)}`  // Ein Split für eine Band ist im Modell A+B veraltet (Splits = nur externe Parteien).
  if (splitShare != null) return `⚠ als externe Split-Zeile (${splitShare}%, veraltet)`
  return 'noch nicht erfasst'
}

const bandDealOverview = computed<BandDealRow[]>(() => {
  const deals = event.value?.artist_deals || {}
  const artists = event.value?.artists || []
  const rows: BandDealRow[] = []
  for (const a of artists) {
    if (a.id == null) continue
    const d = deals[String(a.id)]
    if (!d) continue
    const { resolvedAmount, resolvedSource, guaranteeAmount, doorDealPercentage } = resolveComboDeal(d, dealCalcBase.value)
    const exp = expenses.value.find(e => e.description.trim() === a.name.trim())
    const currentAmount = exp ? (parseFloat(exp.amount || '0') || 0) : null
    const splitIndex = doorDealSplits.value.findIndex(s => s.name.trim() === a.name.trim())
    const splitShare = splitIndex >= 0 ? doorDealSplits.value[splitIndex].share : null
    const issues = bandDealIssues({
      dealType: d.deal_type,
      hasExpense: exp != null,
      hasSplit: splitIndex >= 0,
      expenseAmount: currentAmount,
      expectedAmount: resolvedAmount,
      mismatchAcknowledged: exp ? exp.notes.includes(doordealAckMarker(resolvedAmount)) : false,
    })
    const allGood = !issues.suggestExpense && !issues.orphanSplit && !issues.amountMismatch
    const partial = {
      dealType: d.deal_type, guaranteeAmount, doorDealPercentage, resolvedAmount, resolvedSource,
    }
    rows.push({
      artistId: a.id,
      artistName: a.name,
      ...partial,
      dealLabel: dealLabelFor(partial),
      recordedLabel: recordedLabelFor(currentAmount, splitShare),
      notes: d.notes || '',
      currentAmount,
      splitIndex,
      splitShare,
      issues,
      allGood,
    })
  }
  return rows
})

// Bands, die (noch) als externer Split geführt werden — Warnung in Sektion B.
const bandNamesInExternalSplit = computed(() =>
  bandDealOverview.value.filter(r => r.issues.orphanSplit).map(r => r.artistName),
)

// Jeder Band-Deal (Festgage/Doordeal/Kombi) wird als EINE Ausgabe gebucht —
// Betrag = resolvedAmount (bei Doordeal = %-Anteil der Türbasis, bei Kombi das
// Höhere). Bands landen NIE in door_deal_splits (das ist nur für externe
// Mitveranstalter). Kassenbuch-Prinzip: der gebuchte Betrag ist ein Snapshot.
function applyExpenseRow(row: BandDealRow) {
  // Rechner-Basis festhalten, bevor die gebuchte Gage über die
  // Kassen-Rückrechnung in sie zurückfließt.
  if (dealCalcFrozen.value === null) dealCalcFrozen.value = dealCalcCashDefault.value.toFixed(2)
  const calcNote = row.dealType === 'guarantee_plus_door'
    ? `Doordeal-Vergleich: Garantie ${formatCurrency(row.guaranteeAmount)} vs. ${row.doorDealPercentage}% Netto-Türeinnahme = ${formatCurrency(row.doorDealPercentage / 100 * dealCalcBase.value)} — ${row.resolvedSource === 'doordeal' ? 'Doordeal' : 'Garantie'} gewinnt.`
    : row.dealType === 'door_deal'
      ? `Doordeal ${row.doorDealPercentage}% von ${formatCurrency(dealCalcBase.value)} Netto-Türeinnahme.`
      : ''
  expenses.value.push({
    accounting: accounting.value?.id || 0,
    description: row.artistName,
    amount: row.resolvedAmount.toFixed(2),
    notes: [row.notes, calcNote].filter(Boolean).join(' — '),
    // Gagen werden aus der Einlasskasse (Türeinnahmen) bezahlt, nicht aus der Barkasse.
    paid_from: 'entrance_cash',
    grant_category: 'kuenstlerhonorar',
    // Gagen sind immer Zweckbetrieb (Kernaufgabe des Vereins).
    tax_sphere: 'zweckbetrieb',
  })
}

// Gezahlten Betrag bewusst beibehalten — `amount` bleibt unverändert
// (Kassenbuch-Prinzip), nur ein Bestätigungs-Marker schaltet die Warnung stumm.
function keepPaidAmountRow(row: BandDealRow) {
  const exp = expenses.value.find(e => e.description.trim() === row.artistName.trim())
  if (!exp) return
  exp.notes = [stripDoordealAckMarkers(exp.notes), doordealAckMarker(row.resolvedAmount)]
    .filter(Boolean)
    .join(' — ')
}

// Neu berechneten Betrag bewusst übernehmen — Notiz mit dem alten Betrag zur Nachvollziehbarkeit.
function applyResolvedAmountRow(row: BandDealRow) {
  const exp = expenses.value.find(e => e.description.trim() === row.artistName.trim())
  if (!exp) return
  const auditNote = `Betrag von ${formatCurrency(row.currentAmount ?? 0)} auf ${formatCurrency(row.resolvedAmount)} angepasst (Deal-Anpassung)`
  exp.amount = row.resolvedAmount.toFixed(2)
  exp.notes = [stripDoordealAckMarkers(exp.notes), auditNote].filter(Boolean).join(' — ')
}

// Migration eines veralteten Band-Splits (Bands gehören nicht mehr in
// door_deal_splits): Split entfernen und — falls noch keine Ausgabe existiert —
// direkt als Ausgabe buchen.
function convertSplitToExpenseRow(row: BandDealRow) {
  if (row.splitIndex >= 0) doorDealSplits.value.splice(row.splitIndex, 1)
  const alreadyExpensed = expenses.value.some(e => e.description.trim() === row.artistName.trim())
  if (!alreadyExpensed) applyExpenseRow(row)
}

// Kombi-Deal-Status für die Ergebnis-Tab-Anzeige — reflektiert IMMER (auch
// ohne aktivierten Doordeal-Toggle, den es nicht mehr gibt), damit sichtbar
// ist, dass es hier einen Doordeal-Bestandteil gibt, auch wenn er bereits
// vollständig als Ausgabe erfasst ist.
interface ComboDealStatus {
  artistId: number
  artistName: string
  resolvedAmount: number
  resolvedSource: 'guarantee' | 'doordeal'
  guaranteeAmount: number
  doorDealPercentage: number
  applied: boolean
  /** Tatsächlich ausgezahlter Betrag — Snapshot, wird nicht nachgerechnet. */
  currentAmount: number | null
}

const comboDealStatuses = computed<ComboDealStatus[]>(() => {
  const deals = event.value?.artist_deals || {}
  const artists = event.value?.artists || []
  return artists
    // Doordeal-relevante Deals: Kombi UND reiner Doordeal (beide werden aus dem
    // Türeinnahmen-Topf bezahlt und mindern den Carousel-Anteil unten).
    .filter(a => a.id != null && ['guarantee_plus_door', 'door_deal'].includes(deals[String(a.id)]?.deal_type))
    .map((a): ComboDealStatus => {
      const d = deals[String(a.id!)]
      const { resolvedAmount, resolvedSource, guaranteeAmount, doorDealPercentage } = resolveComboDeal(d, dealCalcBase.value)
      const exp = expenses.value.find(e => e.description.trim() === a.name.trim())
      const currentAmount = exp ? (parseFloat(exp.amount || '0') || 0) : null
      return {
        artistId: a.id!,
        artistName: a.name,
        resolvedAmount,
        resolvedSource,
        guaranteeAmount,
        doorDealPercentage,
        applied: !!exp,
        currentAmount,
      }
    })
})

// Lookup für die Inline-Anmerkung an der jeweiligen Ausgaben-Zeile (statt
// einer separaten Liste weiter unten, siehe Team-Absprache) — nur Bands mit
// bereits gebuchter Ausgabe haben hier einen Eintrag.
const comboStatusByName = computed(() => {
  const map = new Map<string, ComboDealStatus>()
  for (const s of comboDealStatuses.value) {
    if (s.applied) map.set(s.artistName.trim(), s)
  }
  return map
})

function comboStatusHint(status: ComboDealStatus): string {
  // Ausgezahlt ist ausgezahlt — hier steht die Rechnung vom Abend, kein
  // Soll-Ist-Vergleich (der würde die Gage aus ihrer eigenen Basis ableiten).
  const paid = status.currentAmount ?? status.resolvedAmount
  const doorShare = `${status.doorDealPercentage}% von ${formatCurrency(dealCalcBase.value)}`
  return status.guaranteeAmount > 0
    ? `🎤 ${status.resolvedSource === 'doordeal' ? `Doordeal ${doorShare}` : `Garantie ${formatCurrency(status.guaranteeAmount)}`} → ${formatCurrency(paid)} ausgezahlt`
    : `🎤 Doordeal ${doorShare} → ${formatCurrency(paid)} ausgezahlt`
}

// Wrapper ohne TS non-null-assertion (die bricht im pug-Template zur
// Laufzeit, siehe Notiz) — gibt '' zurück statt eines optionalen Werts.
function expenseComboHint(exp: ExpenseEntry): string {
  const status = comboStatusByName.value.get(exp.description.trim())
  return status ? comboStatusHint(status) : ''
}

// Wie viel vom selben doorDealBase-Topf bereits über Garantie+Doordeal-Bands
// (comboDealStatuses) an Bands ausgezahlt wurde — Kassenbuch-Prinzip wie bei
// den Ausgaben selbst: zählt NUR tatsächlich als Ausgabe gebuchte Bands
// (applied), und zwar mit dem wirklich gebuchten Betrag (currentAmount), NICHT
// dem theoretisch aktuell korrekten resolvedAmount (kann bei einer Diskrepanz
// abweichen, siehe bandDealOverview amountMismatch / keepPaidAmountRow / applyResolvedAmountRow).
// Noch nicht gebuchte Vorschläge zählen nicht — das Geld ist ja noch nicht
// aus dem Topf raus. Nur wenn Doordeal aktuell gewinnt (resolvedSource ===
// 'doordeal') ist der Betrag konzeptionell ein %-Anteil der Türeinnahmen; eine
// gewinnende Garantie ist ein fixer Betrag, keine Tür-Beteiligung. Ohne
// diesen Abzug würde "🏠 Carousel-Anteil (verbleibt im Topf)" in der
// Doordeal-Split-Sektion unten so tun, als sei dieses Geld noch da, obwohl es
// über eine andere Ausgaben-Zeile schon rausgegangen ist.
const comboDoorDealShareAmount = computed(() => {
  return comboDealStatuses.value
    .filter(s => s.resolvedSource === 'doordeal' && s.applied)
    .reduce((sum, s) => sum + (s.currentAmount || 0), 0)
})

function triggerExpenseScan() {
  scanExpenseError.value = ''
  expenseScanInput.value?.click()
}

async function handleExpenseScan(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  scanningExpense.value = true
  scanExpenseError.value = ''
  try {
    const result = await accountingService.scanExpenseReceipt(file, props.eventId)
    expenses.value.push({
      accounting: accounting.value?.id || 0,
      description: result.description || result.supplier || '',
      amount: result.amount != null ? result.amount.toFixed(2) : '0.00',
      notes: '',
      paid_from: 'other',
      tax_sphere: result.tax_sphere ?? null,
      vat_rate: result.vat_rate ?? null,
    })
    // If the receipt was also uploaded to Drive, show it in the documents list.
    if (result.document) {
      documents.value.unshift(result.document)
    }
  } catch (err: any) {
    scanExpenseError.value = err.response?.data?.error || 'Scan fehlgeschlagen'
  } finally {
    scanningExpense.value = false
    input.value = ''
  }
}

async function scanDocument(doc: EventDocument) {
  scanningDocId.value = doc.id
  scanDocError.value = ''
  scanDocSuccess.value = ''
  try {
    const result = await accountingService.scanExistingDocument(doc.id)
    expenses.value.push({
      accounting: accounting.value?.id || 0,
      description: result.description || result.supplier || doc.file_name,
      amount: result.amount != null ? result.amount.toFixed(2) : '0.00',
      notes: '',
      paid_from: 'other',
      tax_sphere: result.tax_sphere ?? null,
      vat_rate: result.vat_rate ?? null,
    })
    scanDocSuccess.value = `„${result.description || doc.file_name}" als Ausgabe übernommen. Prüfe den Ausgaben-Tab.`
  } catch (err: any) {
    scanDocError.value = err.response?.data?.error || 'Scan fehlgeschlagen'
  } finally {
    scanningDocId.value = null
  }
}

async function loadEventInvoices() {
  if (!props.eventId) return
  try {
    eventInvoices.value = await printInvoiceService.getForEvent(props.eventId, 'assigned')
  } catch {
    // Non-critical: the invoice panel just stays empty if this fails.
  }
}

function invoiceSourceLabel(inv: PrintInvoice): string {
  return PRINT_INVOICE_SOURCE_LABELS[inv.source] ?? inv.source
}

// Read the invoice PDF's amount via the existing Gemini receipt-scan and add it
// as a prefilled expense row (same flow as scanDocument, but for an inbox
// invoice already filed to this event's Drive folder).
async function importInvoiceAsExpense(inv: PrintInvoice) {
  if (!inv.document) return
  invoiceImportBusyId.value = inv.id
  invoiceImportError.value = ''
  try {
    const result = await accountingService.scanExistingDocument(inv.document)
    expenses.value.push({
      accounting: accounting.value?.id || 0,
      description: result.description || result.supplier || inv.file_name,
      amount: result.amount != null ? result.amount.toFixed(2) : '0.00',
      notes: '',
      paid_from: 'other',
      tax_sphere: result.tax_sphere ?? null,
      vat_rate: result.vat_rate ?? null,
    })
    importedInvoiceIds.value.push(inv.id)
  } catch (err: any) {
    invoiceImportError.value = err.response?.data?.error || 'Übernahme fehlgeschlagen'
  } finally {
    invoiceImportBusyId.value = null
  }
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

// Namensdopplungen in %-Split-Tabellen (Doordeal, Gewinnverteilung) sind so
// gut wie immer ein Versehen (zwei Zeilen für dieselbe Partei splitten den
// Betrag künstlich auf zwei Zahlen, statt einfach einen höheren %-Satz zu
// nehmen) — im Gegensatz zu Ausgaben-Beschreibungen, wo Duplikate normal sind
// (z.B. zweimal Kaufland für Catering). Daher NUR hier geprüft, nicht generell.
// (findDuplicateNames lebt in utils/artistDeals.ts — dort auch unit-getestet.)
const duplicateDoorDealNames = computed(() => findDuplicateNames(doorDealSplits.value.map(p => p.name)))
const duplicateSplitNames = computed(() => findDuplicateNames(splits.value.map(s => s.participant_name)))

// Verteilungsbasis ist das Ergebnis nach USt — die USt-Zahllast gehört dem
// Finanzamt und ist kein Gewinn der Beteiligten. Sie wird in der UI als
// separate, nicht-editierbare „Finanzamt"-Position oben in der Splits-Tabelle
// angezeigt; die %-Splits rechnen auf `resultAfterDoorDeal`.
function splitAmount(split: AccountingSplit): number {
  const pct = parseFloat(split.share_percentage || '0')
  return resultAfterDoorDeal.value * (pct / 100)
}

const totalSplitPercentage = computed(() => {
  return splits.value.reduce((sum, s) => sum + parseFloat(s.share_percentage || '0'), 0)
})

// Ergebnis nach USt und nach Doordeal-Auszahlung — das ist die Basis für
// die Gewinnverteilung (Bernd/Carousel). Der Künstleranteil ist kein Vereinsgewinn.
// doorDealArtistAmount ist bereits 0, wenn keine Partei einen Namen hat —
// kein separates "enabled"-Flag nötig.
const resultAfterDoorDeal = computed(() => {
  return resultAfterVat.value - doorDealArtistAmount.value
})

const remainingAfterSplits = computed(() => {
  return resultAfterDoorDeal.value - splits.value.reduce((sum, s) => sum + splitAmount(s), 0)
})

// ── Doordeal computeds ───────────────────────────────────────────

// Einnahmen aus Eintritt (Einlass + VVK), netto (USt rausgerechnet)
const doorDealEntranceRevenue = computed(() => {
  const entranceSources: RevenueSource[] = ['entrance_cash', 'entrance_paypal', 'entrance_sumup', 'vvk_pretix', 'vvk_paypal', 'vvk_stripe']
  // Aus der Einlasskasse gezahlte Ausgaben mindern den gezählten Bestand — für
  // die tatsächliche Türeinnahme wieder aufaddieren (spiegelt tax_export.py
  // `entrance_payouts` und adjustedRevenue).
  const entrancePayouts = expensesFromSource('entrance_cash')
  return revenues.value
    .filter(r => entranceSources.includes(r.source))
    .reduce((sum, r) => {
      const gross = revenueNet(r) + (r.source === 'entrance_cash' ? entrancePayouts : 0)
      const vatKey = r.vat_rate ?? REVENUE_VAT_RATE_DEFAULTS[r.source] ?? 'none'
      const rate = vatKey === '7' ? 0.07 : vatKey === '19' ? 0.19 : 0
      return sum + (rate ? gross / (1 + rate) : gross)
    }, 0)
})

// Abzugsfähige Kosten (z.B. GEMA, KSK) die vor der Doordeal-Aufteilung abgezogen werden
const doorDealDeductions = computed(() => {
  return expenses.value
    .filter(e => e.door_deal_deductible)
    .reduce((sum, e) => {
      const gross = parseFloat(e.amount || '0')
      const rate = e.vat_rate === '7' ? 0.07 : e.vat_rate === '19' ? 0.19 : 0
      return sum + (rate ? gross / (1 + rate) : gross)
    }, 0)
})

// Verteilungsbasis = Türeinnahmen − Abzüge
const doorDealBase = computed(() => {
  return Math.max(0, doorDealEntranceRevenue.value - doorDealDeductions.value)
})

// Gesamtbetrag aller Doordeal-Parteien (nur Zeilen mit echtem Namen — der
// leere Default-Platzhalter beim Laden soll nichts abziehen)
const doorDealArtistAmount = computed(() => {
  return doorDealSplits.value
    .filter(p => p.name.trim() !== '')
    .reduce((sum, p) => sum + doorDealBase.value * (p.share / 100), 0)
})

// Carousel-Anteil = was nach allen (benannten) Parteien übrig bleibt
const doorDealVenueShare = computed(() => {
  return 100 - doorDealSplits.value
    .filter(p => p.name.trim() !== '')
    .reduce((sum, p) => sum + p.share, 0)
})

const doorDealVenueAmount = computed(() => {
  return doorDealBase.value * (doorDealVenueShare.value / 100) - comboDoorDealShareAmount.value
})

// Anzeige-% für "Carousel-Anteil" — im Gegensatz zu doorDealVenueShare (das
// nur die benannten Section-2-Parteien kennt) bezieht das hier auch ab, was
// Garantie+Doordeal-Bands (Section 1) schon vom selben Topf abbekommen haben.
const doorDealVenueDisplayPct = computed(() => {
  if (doorDealBase.value <= 0) return doorDealVenueShare.value
  return (doorDealVenueAmount.value / doorDealBase.value) * 100
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
    .filter(r => r.source === 'entrance_cash' || r.source === 'entrance_paypal' || r.source === 'entrance_sumup' || r.source === 'vvk_pretix')
    .reduce((sum, r) => sum + revenueNet(r), 0)
  // Add back expenses paid from entrance cash (these were admission revenue used for payouts)
  return admissionNet + expensesFromSource('entrance_cash')
})

const grantBarContribution = computed(() => {
  const barTotal = revenues.value
    .filter(r => r.source === 'bar_cash' || r.source === 'bar_paypal' || r.source === 'bar_sumup')
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

// True only when real grant data has been entered. Mirrors the backend
// `GrantApplication.is_submitted` heuristic so we never create an empty
// placeholder record just from opening/auto-saving the accounting.
// Deliberately excludes the auto-generated Sachbericht, own_revenue and the
// default Mietpauschale — those are auto/default values, not user intent.
const grantHasContent = computed(() => {
  if (approvedAmount.value != null) return true
  if (zuwendungsbescheidDate.value) return true
  if (auszahlungAmount.value != null) return true
  return [...budgetKuenstler.value, ...budgetSachkosten.value, ...budgetSonstiges.value]
    .some(i => i.name.trim() !== '' || (parseFloat(i.amount) || 0) > 0)
})

// ── Format helpers ───────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatQty(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '0' : n.toLocaleString('de-DE')
}

const QUARTER_GLYPHS: Record<number, string> = { 1: '¼', 2: '½', 3: '¾' }

/** Der Viertel-Rest einer angebrochenen Flasche als Glyph — das Gegenstück zur
 *  Flaschen-Spalte im Kistenmodus. Krumme Altbestände (kein ganzes Viertel)
 *  werden als Flaschen-Nachkommastelle gezeigt. */
function quarterGlyph(minor: number | undefined): string {
  if (!minor) return ''
  return QUARTER_GLYPHS[minor] ?? `+${formatQty(Math.round(minor * 25) / 100)}`
}

/** Menge eines Portionsgetränks lesbar als "19 ¾" statt "19,75". Alle anderen
 *  Getränke — und krumme Altbestände, die auf keinem Viertel liegen — fallen
 *  auf `formatQty` zurück. Negative Werte (Verbrauch < 0 bei zu hoch gezähltem
 *  Restbestand) laufen über den Betrag, sonst liefert der Floor-Split "-1 ½"
 *  für -0,5. */
function formatBottleQty(val: number | string | undefined, beverage: BeverageItem): string {
  const mode = splitMode(beverage)
  if (!mode || mode.minorSize === 1) return formatQty(val ?? '0')
  const n = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  if (isNaN(n)) return '0'
  const sign = n < 0 ? '−' : ''
  const { major, minor } = splitQuantity(Math.abs(n), mode)
  const glyph = QUARTER_GLYPHS[minor]
  if (minor === 0) return sign + formatQty(major)
  if (!glyph) return formatQty(n)
  return major > 0 ? `${sign}${formatQty(major)} ${glyph}` : sign + glyph
}

/** Flaschengröße als " 0,5l" (mit führendem Leerzeichen) oder '' — direkt an
 *  den Namen gehängt, damit gleichnamige Getränke unterschiedlicher Größe
 *  (z.B. zwei "Pils") in der Inventurliste auf einen Blick unterscheidbar
 *  sind, ohne erst die kleine Info-Zeile lesen zu müssen. */
function bevSize(beverage: { bottle_size?: string | null }): string {
  if (!beverage.bottle_size) return ''
  return ` ${parseFloat(beverage.bottle_size).toLocaleString('de-DE')}l`
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
      // Backfill missing rows for all revenue sources up front, while
      // auto-save is still suppressed. `getRevenue()` used to do this
      // lazily from the template (v-model="getRevenue(source).total"),
      // which meant merely *viewing* the Kassenbericht tab pushed rows
      // into the watched `revenues` array and fired a phantom auto-save.
      for (const source of allRevenueSources) {
        if (!revenues.value.some(r => r.source === source)) {
          revenues.value.push({
            accounting: acc.id || 0,
            source,
            total: '0.00',
            change_money: '0.00',
            fees: '0.00',
          })
        }
      }
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
        // Gagen sind immer Zweckbetrieb und nie von der Doordeal-Basis abzugsfähig —
        // unabhängig davon, wie/wann grant_category gesetzt wurde.
        if (exp.grant_category === 'kuenstlerhonorar') {
          exp.tax_sphere = 'zweckbetrieb'
          exp.door_deal_deductible = false
        }
      }
      splits.value = (acc.splits ?? [])
        .filter(s => s.participant_name?.toLowerCase() !== 'carousel e.v.')
        .map(s => ({ ...s, share_percentage: String(Math.round(parseFloat(s.share_percentage || '0'))) }))

      // Doordeal fields — "enabled" ist jetzt abgeleitet (doorDealActive/Länge), nicht
      // geladen. Alte Datensätze (aus der Zeit des manuellen An/Aus-Togglers) haben oft
      // einen leeren "{name:'', share:70}"-Platzhalter gespeichert, der beim Deaktivieren
      // nie aufgeräumt wurde — namenlose Zeilen beim Laden verwerfen, statt selbst wieder
      // einen leeren Platzhalter nachzuschieben (die Sektion zeigt sich sonst für JEDES
      // Event, auch ganz ohne Doordeal — siehe leerer .config-table-Zweig unten).
      doorDealSplits.value = (Array.isArray(acc.door_deal_splits) ? acc.door_deal_splits : [])
        .filter(s => s.name.trim() !== '')

      // Consumption baseline for Inventur miscount warnings (optional).
      try {
        consumptionStats.value = await accountingService.getConsumptionStats(acc.id)
      } catch { /* stats are optional */ }
    } catch (e: any) {
      error.value = e.message || 'Abrechnung konnte nicht geladen werden'
    }

    // Default: Bernd 33%, Rest geht automatisch an Carousel (Verbleibend)
    if (accounting.value && splits.value.length === 0 && authStore.isTreasurer) {
      splits.value.push({
        accounting: accounting.value?.id || 0,
        participant_name: 'Bernd',
        share_percentage: '33',
      })
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
    // Defer past Vue's watcher flush so load-time writes (e.g. grant fields
    // populated by generateDefaultSachbericht) don't fire a phantom save on
    // open. Same guard refreshStockAndCorrect uses.
    setTimeout(() => { suppressAutoSave = false }, 0)
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

async function toggleFinalStatus() {
  if (!accounting.value?.id) return
  const newStatus = accounting.value.status === 'final' ? 'draft' : 'final'
  isFinalizingStatus.value = true
  try {
    const result = await accountingService.setStatus(accounting.value.id, newStatus)
    accounting.value.status = result.status as 'draft' | 'final'
    emit('status-changed', accounting.value.status)
  } catch (e: any) {
    error.value = e.message || 'Status konnte nicht geändert werden'
  } finally {
    isFinalizingStatus.value = false
  }
}

// AccountingView bleibt beim Tab-Wechsel innerhalb der Event-Seite dauerhaft
// gemountet (v-if einmal true + v-show), lädt `event` also nur einmal beim
// ersten Öffnen. Ohne diesen expliziten Reload würden Änderungen an den
// Band-Deals (Garantie/Doordeal) im "Veranstaltung"-Tab hier nie ankommen,
// solange man nicht die ganze Seite neu lädt. Wird vom Parent beim Wechsel
// auf den Accounting-Tab aufgerufen (siehe EventFormView.vue).
async function refreshEventData() {
  try {
    event.value = await eventService.getById(props.eventId)
  } catch { /* Event bleibt auf dem letzten bekannten Stand, kein Hard-Fail */ }
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
  saveNetworkError.value = false

  try {
    const accId = accounting.value.id

    // Build all nested data and save in one PUT.
    // Splits are only sent for treasurers — for everyone else we omit the
    // field entirely so the backend doesn't see splits=[] (which the backend
    // already ignores for non-treasurers, but omitting is cleaner).
    const payload: any = {
      notes: accounting.value.notes,
      door_deal_enabled: doorDealActive.value,
      door_deal_splits: doorDealSplits.value,
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
    // Optimistic concurrency control: include the `updated_at` we last saw
    // from the server. If another user changed the Abrechnung in the meantime,
    // the backend responds with HTTP 409 and we surface a "reload" banner —
    // see the catch block below. Without this, two users editing the same
    // Abrechnung in parallel can silently overwrite each other's changes (the
    // FIFO row lock alone cannot solve this since both PUT bodies are valid
    // replacements).
    if (accounting.value.updated_at) {
      payload.if_unmodified_since = accounting.value.updated_at
    }
    const saved = await accountingService.update(accId, payload)

    // Capture the new `updated_at` so the *next* save sees a fresh stamp.
    if (saved.updated_at && accounting.value) {
      accounting.value.updated_at = saved.updated_at
    }

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

    // Also save grant data — but only persist a record when the event
    // actually has grant content. An existing record is kept in sync (so the
    // Verwendungsnachweis gets fresh actuals); a new one is created only when
    // real data was entered (see grantHasContent). This prevents phantom
    // placeholder grants from merely opening/auto-saving the accounting.
    if (grantRecord.value?.id || grantHasContent.value) {
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

      const eventYear = event.value?.date ? new Date(event.value.date).getFullYear() : new Date().getFullYear()
      grantSummary.value = await grantService.getSummary(eventYear)
    }

    if (!silent) {
      saveSuccess.value = 'Gespeichert!'
      setTimeout(() => { saveSuccess.value = '' }, 3000)
    }
  } catch (e: any) {
    // OCC conflict (409): another user updated this Abrechnung in parallel.
    // We CANNOT silently retry — the user's edits assume a different base
    // state. Show a banner and pause auto-save until the user reloads.
    if (e.response?.status === 409 && e.response?.data?.stale_abrechnung) {
      staleAbrechnungConflict.value = true
      autoSavePausedByConflict.value = true
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      autoSaveDirty.value = false
      return
    }
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
      autoSavePausedByConflict.value = true
      // Clear the dirty timer so we don't keep retrying with the same values
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      autoSaveDirty.value = false
    } else if (!e.response) {
      // No HTTP response (timeout / connection reset / edge 5xx). The write may
      // or may not have committed — never keep auto-saving blindly, or a
      // parallel editor's changes can be silently overwritten (2026-09 incident).
      autoSavePausedByConflict.value = true
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      autoSaveDirty.value = false
      // Reconcile against the server: if it advanced past our last confirmed
      // save, our edits are now stale → force the same reload path as a 409.
      try {
        const accId = accounting.value?.id
        const fresh = accId ? await accountingService.getById(accId) : null
        if (fresh?.updated_at && accounting.value?.updated_at
            && fresh.updated_at !== accounting.value.updated_at) {
          staleAbrechnungConflict.value = true
        } else {
          saveNetworkError.value = true
        }
      } catch {
        // Still unreachable → surface the connection error, stay paused.
        saveNetworkError.value = true
      }
    } else {
      if (!silent) error.value = e.message || 'Fehler beim Speichern'
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * Resolve a stale-Abrechnung 409 by reloading the page.
 *
 * Why a full reload and not just `loadData()`? The user's in-memory edits to
 * `revenues`, `inventory`, `expenses`, `splits` etc. are stale by definition
 * — the other writer changed something we don't yet know about. The safest
 * UX is to drop everything and re-fetch from scratch, which matches what
 * `window.location.reload()` does. The user is warned in the banner that
 * unsaved edits will be lost.
 */
function reloadAfterStaleConflict() {
  window.location.reload()
}

/**
 * Resolve a save network-error by retrying once, explicitly (non-silent).
 *
 * Only reachable when the post-error reconcile found the server unchanged
 * (our write did not land), so a retry is safe and won't overwrite anyone.
 */
async function retryAfterNetworkError() {
  saveNetworkError.value = false
  autoSavePausedByConflict.value = false
  await saveAll(false)
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

function startRenameDocument(doc: EventDocument) {
  renamingDocId.value = doc.id
  renameDraft.value = doc.file_name
  renameError.value = ''
}

function cancelRenameDocument() {
  renamingDocId.value = null
  renameDraft.value = ''
  renameError.value = ''
}

async function saveRenameDocument(doc: EventDocument) {
  const name = renameDraft.value.trim()
  if (!name || name === doc.file_name) {
    cancelRenameDocument()
    return
  }
  renameBusy.value = true
  renameError.value = ''
  try {
    const updated = await documentService.rename(props.eventId, doc.id, name)
    const idx = documents.value.findIndex(d => d.id === doc.id)
    if (idx !== -1) documents.value[idx] = updated
    cancelRenameDocument()
  } catch (err: any) {
    renameError.value = err.response?.data?.error || 'Umbenennen fehlgeschlagen'
  } finally {
    renameBusy.value = false
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
const autoSavePausedByConflict = ref(false)

function scheduleAutoSave() {
  if (suppressAutoSave) return
  if (autoSavePausedByConflict.value) return
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
    autoSavePausedByConflict.value = false
    scheduleAutoSave()
  },
  { deep: true }
)
// Everything else (notes, door deal, grant fields) just triggers a save.
// scheduleAutoSave() itself ignores writes during the initial load.
watch(
  [() => accounting.value?.notes, doorDealSplits,
   sachbericht, grantNotes, budgetKuenstler, budgetSachkosten, budgetSonstiges,
   budgetRevEintritt, budgetRevGetraenke, budgetRevEigenmittel, budgetRevDrittmittel,
   budgetRevSonstige, approvedAmount, zuwendungsbescheidDate, auszahlungAmount, rentFlatAmount],
  () => { scheduleAutoSave() },
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

      const bev = beverages.value.find(b => b.id === serverEntry.beverage_item)
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
      }
      if (bev) changedItems.push(bev.name)
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

let stockPollInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadData()
  loadDocuments()
  loadEventInvoices()
  document.addEventListener('click', closeOverflow)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)
  stockPollInterval = setInterval(() => {
    if (document.visibilityState === 'visible') refreshStockAndCorrect()
  }, 30000)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  flushAutoSave()
  document.removeEventListener('click', closeOverflow)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (stockPollInterval) clearInterval(stockPollInterval)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})

defineExpose({ toggleFinalStatus, refreshEventData })

// Zahlenfelder beim Reinklicken markieren, damit man direkt tippen kann statt
// erst die 0,00 wegzulöschen. Per Delegation, damit es für alle Felder gilt.
// Chrome setzt den Cursor beim Klick erst im mouseup, also NACH dem focus —
// das hob die Markierung je nach Klickposition wieder auf. Deshalb wird das
// mouseup des fokussierenden Klicks unterdrückt und im click nochmal markiert.
// Beides nur beim ERSTEN Klick, sonst könnte man den Cursor nie mehr setzen.
let pendingNumberSelect: HTMLInputElement | null = null

function selectNumberOnFocus(e: FocusEvent) {
  const el = e.target as HTMLInputElement | null
  if (el?.tagName !== 'INPUT' || el.type !== 'number') return
  el.select()
  pendingNumberSelect = el
}

function keepNumberSelection(e: MouseEvent) {
  if (e.target === pendingNumberSelect) e.preventDefault()
}

function selectNumberOnClick(e: MouseEvent) {
  if (!pendingNumberSelect || e.target !== pendingNumberSelect) return
  pendingNumberSelect.select()
  pendingNumberSelect = null
}

function clearPendingNumberSelect() {
  pendingNumberSelect = null
}
</script>

<template lang="pug">
.accounting-view(@focusin="selectNumberOnFocus" @mouseup="keepNumberSelection" @click="selectNumberOnClick" @focusout="clearPendingNumberSelect")
  .loading(v-if="isLoading") Abrechnung wird geladen...
  template(v-else-if="accounting")
    .accounting-header
      .tabs
        button.tab(
          :class="{ active: activeTab === 'expenses' }"
          @click="activeTab = 'expenses'"
        ) 🧾 Gagen & Ausgaben
        button.tab(
          :class="{ active: activeTab === 'cashcount' }"
          @click="activeTab = 'cashcount'"
        ) 💰 Kassenzählung
        button.tab(
          :class="{ active: activeTab === 'inventory' }"
          @click="activeTab = 'inventory'"
        ) 📦 Inventur
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
        button.btn-overflow(@click="showOverflow = !showOverflow") ⋯
        .overflow-dropdown(v-if="showOverflow")
          button.overflow-item.overflow-danger(@click="deleteAccounting") Abrechnung löschen

    .error(v-if="error") {{ error }}

    //- ── Stale Abrechnung Banner (OCC 409) ──
    //- Shown when another user updated this Abrechnung in parallel. The only
    //- safe resolution is a reload — proceeding would silently overwrite the
    //- other user's edits (see backend tests_abrechnung_occ.py).
    .stale-banner(v-if="staleAbrechnungConflict")
      .stale-banner-icon ⚠️
      .stale-banner-text
        strong Diese Abrechnung wurde parallel bearbeitet.
        span  Jemand anders hat in einem anderen Tab oder Gerät gespeichert.
          | Damit deine Änderungen nicht die andere Person überschreiben,
          | lade bitte neu. Deine ungespeicherten Eingaben gehen dabei verloren.
      button.btn-primary(@click="reloadAfterStaleConflict") Neu laden

    //- ── Save Connection-Error Banner ──
    //- Shown when a save got no response (timeout / connection lost). The write
    //- outcome is unknown; auto-save is paused so we can't silently overwrite a
    //- parallel editor. The user retries deliberately once the connection is back.
    .stale-banner(v-if="saveNetworkError")
      .stale-banner-icon 📡
      .stale-banner-text
        strong Speichern fehlgeschlagen – keine Verbindung.
        span  Deine letzte Änderung wurde nicht bestätigt. Automatisches
          | Speichern ist pausiert. Prüfe die Verbindung und versuche es erneut.
      button.btn-primary(@click="retryAfterNetworkError") Erneut speichern

    //- ── Cash Count Tab ──
    .tab-content(v-if="activeTab === 'cashcount'")
      .external-data-bar
        button.btn-fetch-all(
          @click="fetchAndApplyAllExternal"
          :disabled="externalDataLoading"
        ) {{ externalDataLoading ? 'Laden...' : externalDataLoaded ? '↻ Externe Daten neu laden' : '⬇ Externe Daten laden (Pretix + PayPal + SumUp)' }}
        .external-data-status(v-if="externalDataLoaded && !externalDataLoading")
          span.success(v-if="!pretixError && !paypalBarError && !sumupBarError") ✓ Daten übernommen
          span.pretix-error(v-if="pretixError") Pretix: {{ pretixError }}
          span.pretix-error(v-if="paypalBarError") PayPal: {{ paypalBarError }}
          span.pretix-error(v-if="sumupBarError") SumUp: {{ sumupBarError }}
        //- Abweichungen werden nicht automatisch übernommen, sonst gingen
        //- manuelle Korrekturen (z.B. Bar→Einlass) beim Neuladen verloren.
        .external-diffs(v-if="externalDiffs.length")
          p.external-diffs-head ⚠️ Abweichung zu deinen erfassten Werten – nichts wurde überschrieben:
          .external-diff-row(v-for="d in externalDiffs" :key="d.source")
            span.external-diff-label {{ d.label }}
            span.external-diff-vals
              | erfasst {{ formatCurrency(d.storedTotal) }} ({{ formatCurrency(d.storedFees) }} Geb.)
              | → laut API {{ formatCurrency(d.fetchedTotal) }} ({{ formatCurrency(d.fetchedFees) }} Geb.)
            button.btn-add-sm.btn-add-primary(@click="applyExternalDiff(d)") Übernehmen
            button.btn-add-sm.btn-add-ghost(@click="dismissExternalDiff(d)") Behalten
        .pretix-warnings(v-if="pretixData?.warnings?.length")
          .pretix-warning(v-for="w in pretixData.warnings" :key="w") ⚠️ {{ w }}
        .external-data-summary(v-if="externalDataLoaded && !pretixError && !paypalBarError && !sumupBarError")
          .summary-line(v-if="pretixData") 🎟️ Pretix: {{ pretixData.total_tickets }} Tickets ({{ formatCurrency(pretixData.total_revenue) }})
          .summary-line(
            v-if="paypalBarData"
            title="Kategorisierung ist eine Schätzung anhand des Betrags (Vielfaches des Eintrittspreises = Einlass). Bei Bedarf in der Liste unten manuell korrigieren."
          ) 💙 PayPal: 🍺 {{ paypalBarCategoryTotals.bar.count }} Bar ({{ formatCurrency(paypalBarCategoryTotals.bar.amount) }}) · 🚪 {{ paypalBarCategoryTotals.entrance.count }} Einlass ({{ formatCurrency(paypalBarCategoryTotals.entrance.amount) }})
          .summary-line(
            v-if="sumupBarData"
            title="Kategorisierung ist eine Schätzung anhand des Betrags (Vielfaches des Eintrittspreises = Einlass). Bei Bedarf in der Liste unten manuell korrigieren."
          ) 💳 SumUp: 🍺 {{ sumupBarCategoryTotals.bar.count }} Bar ({{ formatCurrency(sumupBarCategoryTotals.bar.amount) }}) · 🚪 {{ sumupBarCategoryTotals.entrance.count }} Einlass ({{ formatCurrency(sumupBarCategoryTotals.entrance.amount) }})

      .section(v-for="group in REVENUE_GROUPS" :key="group.label")
        .section-title-row
          h3.section-title {{ group.label }}
        .revenue-table
          .revenue-header
            .col-source Quelle
            .col-amount Gesamt
            .col-amount Wechselgeld
            .col-amount Gebühren
            .col-amount Brutto

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
              .col-amount.col-computed(data-label="Brutto") {{ formatCurrency(revenueNet(getRevenue(source))) }}
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
            template(v-if="(source === 'bar_sumup' || source === 'entrance_sumup') && sumupBarData && sumupTransactionsFor(source === 'bar_sumup' ? 'bar' : 'entrance').length")
              .revenue-row.sub-row.paypal-cat-actions.expandable(@click="toggleSourceExpanded(source)")
                .col-source.sub-source
                  span {{ expandedSources.has(source) ? '▾' : '▸' }} {{ sumupTransactionsFor(source === 'bar_sumup' ? 'bar' : 'entrance').length }} Transaktionen
                  button.btn-cat-all(@click.stop="setAllSumupCategory(source === 'bar_sumup' ? 'entrance' : 'bar')") Alle → {{ source === 'bar_sumup' ? '🚪 Einlass' : '🍺 Bar' }}
                  span.entry-price-hint(v-if="source === 'entrance_sumup' && sumupBarData.entry_price") Eintritt: {{ sumupBarData.entry_price }}€{{ sumupBarData.entry_price_ak ? ' / AK ' + sumupBarData.entry_price_ak + '€' : '' }}
              template(v-if="expandedSources.has(source)")
                .revenue-row.sub-row.sub-detail(
                  v-for="{ txn, idx } in sumupTransactionsFor(source === 'bar_sumup' ? 'bar' : 'entrance')"
                  :key="idx"
                  :class="{ 'cat-entrance': txn.category === 'entrance', 'cat-bar': txn.category === 'bar' }"
                )
                  .col-source.sub-source.sub-detail-source
                    button.btn-cat-toggle(
                      @click.stop="toggleSumupCategory(idx)"
                      :title="source === 'bar_sumup' ? '→ Einlass verschieben' : '→ Bar verschieben'"
                    ) {{ source === 'bar_sumup' ? '→ 🚪' : '→ 🍺' }}
                    span {{ txn.name }} · {{ formatTime(txn.timestamp) }}
                  .col-amount.sub-val {{ formatCurrency(txn.amount) }}
                  .col-amount.sub-val —
                  .col-amount.sub-val {{ formatCurrency(txn.fee) }}
                  .col-amount.sub-val {{ formatCurrency(txn.net) }}
                  button.btn-remove-txn(@click.stop="removeSumupBarTransaction(idx)" title="Transaktion entfernen") ✕
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
            .summary-line.summary-sub
              span.summary-label Gezählt (Kasse, brutto)
              span.summary-value {{ formatCurrency(groupRevenue(cashSourcesOf(REVENUE_GROUPS[0].sources))) }}
            .summary-line.summary-sub(v-if="expensesFromSource('bar_cash') > 0")
              span.summary-label + Aus Kasse bezahlt
              span.summary-value + {{ formatCurrency(expensesFromSource('bar_cash')) }}
            .summary-line.summary-sub(v-if="groupRevenue(digitalSourcesOf(REVENUE_GROUPS[0].sources)) > 0")
              span.summary-label + Digital (PayPal/SumUp)
              span.summary-value + {{ formatCurrency(groupRevenue(digitalSourcesOf(REVENUE_GROUPS[0].sources))) }}
            .summary-line.summary-sub.summary-highlight
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
            .summary-line.summary-sub
              span.summary-label Gezählt (Kasse, brutto)
              span.summary-value {{ formatCurrency(groupRevenue(cashSourcesOf(REVENUE_GROUPS[1].sources))) }}
            .summary-line.summary-sub(v-if="expensesFromSource('entrance_cash') > 0")
              span.summary-label + Aus Kasse bezahlt (z.B. Honorare)
              span.summary-value + {{ formatCurrency(expensesFromSource('entrance_cash')) }}
            .summary-line.summary-sub(v-if="groupRevenue(digitalSourcesOf(REVENUE_GROUPS[1].sources)) > 0")
              span.summary-label + Digital (PayPal/SumUp/VVK)
              span.summary-value + {{ formatCurrency(groupRevenue(digitalSourcesOf(REVENUE_GROUPS[1].sources))) }}
            .summary-line.summary-sub.summary-highlight
              span.summary-label = Eintritt brutto
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources)) }}
            .summary-line.summary-sub
              span.summary-label davon USt (7%)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources) - groupRevenueGross(REVENUE_GROUPS[1].sources) / 1.07) }}
            .summary-line.summary-sub
              span.summary-label Netto (abzgl. 7% USt)
              span.summary-value {{ formatCurrency(groupRevenueGross(REVENUE_GROUPS[1].sources) / 1.07) }}
            .summary-hint(v-if="entranceVisitorEstimate") Entspricht ca. {{ entranceVisitorEstimate }} Besuchern (basierend auf VVK-/AK-Preis)
          .summary-line.summary-total
            span.summary-label Gesamteinnahmen (gezählt)
            span.summary-value {{ formatCurrency(totalRevenue) }}

    //- ── Inventory Tab ──
    .tab-content(v-if="activeTab === 'inventory'")
      .inventory-toolbar
        button.inv-reset-btn(
          type="button"
          :class="{ active: hideZeroStock }"
          :title="hideZeroStock ? 'Leere Zeilen einblenden' : 'Zeilen ohne Vorher-Bestand ausblenden'"
          @click="hideZeroStock = !hideZeroStock"
        ) Leere ausblenden
        button.inv-reset-btn(
          type="button"
          :class="{ active: inventoryZeroed }"
          :title="inventoryZeroed ? 'Vorher-Werte wiederherstellen' : 'Alle Nachher-Felder auf 0 setzen — zum Hochzählen vom Nullpunkt'"
          @click="toggleInventoryZero()"
        ) {{ inventoryZeroed ? 'Vorher wiederherstellen' : 'Alle auf 0' }}

      .conflict-banner(v-if="inventoryConflicts.size > 0")
        .conflict-banner-icon ⚠️
        .conflict-banner-text
          strong {{ inventoryConflicts.size === 1 ? '1 Bestandskonflikt' : `${inventoryConflicts.size} Bestandskonflikte` }}
          span  – Während du editiert hast, hat jemand anders parallel verbraucht. Bitte die rot markierten Werte unten anpassen.
          template(v-if="autoSavePausedByConflict")
            span  ·&nbsp;
            button.conflict-retry(@click="saveAll(false)") Erneut versuchen

      .section(v-for="(items, group) in inventoryBySupplier" :key="group")
        h3.section-title {{ group }}
          span.inv-progress {{ inventoryProgress(items) }}

        //- Desktop table
        .inventory-table.desktop-only
          .inventory-header
            .col-inv-name.sortable(@click="cycleInventoryNameSort") {{ inventoryNameHeader }}
            .col-inv-info Gebinde
            .col-inv-compare
              span.sortable(@click="invSort.toggle('before')") Vorher{{ invSort.indicator('before') }}
              span.compare-sep →
              span.sortable(@click="invSort.toggle('after')") Nachher{{ invSort.indicator('after') }}
            .col-inv-num Gesamt
            .col-inv-num.sortable(@click="invSort.toggle('consumed')") Verbraucht{{ invSort.indicator('consumed') }}
            .col-inv-amount.sortable(@click="invSort.toggle('value')") Wert{{ invSort.indicator('value') }}

          template(v-for="{ beverage, entry } in sortedInventory(items)" :key="beverage.id")
            .inventory-row(
              v-show="inventoryItemVisible(entry)"
              data-testid="inv-row"
              :data-drink="beverage.name"
              :class="{ 'inv-confirmed': isInventoryConfirmed(entry), 'inv-pending': !isInventoryConfirmed(entry), 'inv-conflict': inventoryConflicts.has(beverage.id), 'inv-miscount': !!consumptionAnomaly(entry, beverage) }"
            )
              .col-inv-name
                router-link.bev-name.bev-name-link(
                  v-if="authStore.isInventoryManager && beverage.id"
                  :to="beverageLinkTo(beverage)"
                  :title="`„${beverage.name}\" im Stamm bearbeiten`"
                ) {{ beverage.name }}{{ bevSize(beverage) }}
                .bev-name(v-else) {{ beverage.name }}{{ bevSize(beverage) }}
                .bev-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}St. · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }} · Pf. {{ formatCurrency(parseFloat(beverage.deposit || '0')) }}
                .bev-info(v-else) Flasche · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }}
              .col-inv-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}St.
              .col-inv-info(v-else) Fl.

              //- Vorher und Nachher stehen in EINER Spalte, getrennt durch einen
              //- Pfeil — den Vergleich braucht man beim Zählen staendig.
              //- Alle drei Zählmodi folgen dabei derselben Struktur: eine
              //- `.crate-input`-Einheit für die Hauptmenge, daneben die
              //- Nebeneinheit (zweites Feld im Kistenmodus, Viertel-Segmente bei
              //- Portionsgetränken, nichts bei Ganzflaschen).
              .col-inv-compare

                //- Crate mode (units_per_crate > 1)
                template(v-if="(beverage.units_per_crate || 1) > 1")
                  .col-inv-pair.readonly-before(data-testid="inv-before")
                    .crate-input
                      span.qty-display {{ getOrInitSplit(beverage, entry)?.beforeCrates }}
                      span.input-label K
                    .crate-input
                      span.qty-display {{ formatQty(getOrInitSplit(beverage, entry)?.beforeBottles) }}
                      span.input-label Fl
                  span.compare-sep →
                  .col-inv-pair
                    .crate-input
                      input.qty-input(
                        v-model.number="getOrInitSplit(beverage, entry).afterCrates"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        data-testid="inv-after-major"
                        @wheel="onQtyWheel($event)"
                        @mousedown="onQtyMousedown()"
                        @input="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id); blurIfSpinner($event)"
                      )
                      span.input-label K
                    .crate-input
                      input.qty-input(
                        v-model.number="getOrInitSplit(beverage, entry).afterBottles"
                        type="number"
                        step="1"
                        placeholder="0"
                        data-testid="inv-after-minor"
                        @wheel="onQtyWheel($event)"
                        @mousedown="onQtyMousedown()"
                        @keydown="onBottleKeydown($event, beverage, entry, 'after')"
                        @input="onBottleInput(beverage, entry); blurIfSpinner($event)"
                        @change="onBottleChange(beverage, entry, 'after')"
                      )
                      span.input-label Fl

                //- Portion mode: Einzelflasche, die portionsweise ausgeschenkt wird
                //- → ganze Flaschen + Viertel-Segmente statt freiem Dezimalfeld.
                template(v-else-if="splitMode(beverage)")
                  .col-inv-pair.readonly-before(data-testid="inv-before")
                    .crate-input
                      span.qty-display {{ getOrInitSplit(beverage, entry)?.beforeCrates }}
                      span.input-label Fl
                    .crate-input(v-if="quarterGlyph(getOrInitSplit(beverage, entry)?.beforeBottles)")
                      span.qty-display {{ quarterGlyph(getOrInitSplit(beverage, entry)?.beforeBottles) }}
                  span.compare-sep →
                  .col-inv-pair
                    .crate-input
                      input.qty-input(
                        v-model.number="getOrInitSplit(beverage, entry).afterCrates"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        data-testid="inv-after-major"
                        @wheel="onQtyWheel($event)"
                        @mousedown="onQtyMousedown()"
                        @input="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id); blurIfSpinner($event)"
                      )
                      span.input-label Fl
                    .crate-input
                      .quarter-seg
                        button.quarter-btn(
                          v-for="q in [1, 2, 3]"
                          :key="q"
                          type="button"
                          :class="{ active: isQuarterActive(beverage, entry, q) }"
                          :title="`Angebrochene Flasche ${['', 'ein Viertel', 'halb', 'drei Viertel'][q]} voll – nochmal klicken zum Leeren`"
                          @click="setQuarter(beverage, entry, q)"
                        ) {{ ['', '¼', '½', '¾'][q] }}

                //- Whole-bottle mode (Piccolo & Co.) — einziges Getränk ohne
                //- Nebeneinheit. Die leere zweite Position hält das Feld auf
                //- derselben Höhe wie bei Kisten- und Portionsgetränken.
                template(v-else)
                  .col-inv-pair.readonly-before(data-testid="inv-before")
                    .crate-input
                      span.qty-display {{ formatQty(entry.quantity_before || '0') }}
                      span.input-label Fl.
                  span.compare-sep →
                  .col-inv-pair
                    .crate-input
                      input.qty-input(
                        v-model="entry.quantity_after"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        data-testid="inv-after-major"
                        @wheel="onQtyWheel($event)"
                        @mousedown="onQtyMousedown()"
                        @keydown="onBottleKeydown($event, beverage, entry, 'after')"
                        @input="recomputeConsumed(entry); confirmedInventory.add(beverage.id); blurIfSpinner($event)"
                      )
                      span.input-label Fl.
                    .crate-input

              .col-inv-num(data-testid="inv-total") {{ formatBottleQty(entry.quantity_before, beverage) }}
              .col-inv-num(
                data-testid="inv-consumed"
                :class="{ 'negative-consumption': inventoryConsumption(entry) < 0 }"
              ) {{ formatBottleQty(inventoryConsumption(entry), beverage) }}
                span.consumption-warning(v-if="inventoryConsumption(entry) < 0") ⚠
                span.miscount-warning(v-if="consumptionAnomaly(entry, beverage)" :title="`Ungewöhnlich hoher Verbrauch – üblich Ø ${consumptionAnomaly(entry, beverage)?.mean}, max ${consumptionAnomaly(entry, beverage)?.max}. Restbestand vergessen?`") ⚠
              .col-inv-amount {{ formatCurrency(inventoryValue(entry, beverage)) }}

            .inventory-row-conflict(v-if="inventoryConflicts.has(beverage.id)" v-show="inventoryItemVisible(entry)")
              span.conflict-icon ⚠️
              span.conflict-text
                | {{ beverage.name }}: Du möchtest #[strong {{ inventoryConflicts.get(beverage.id)?.requested }}] verbrauchen, aber aktuell sind nur noch #[strong {{ inventoryConflicts.get(beverage.id)?.available }}] verfügbar. Bitte „Nachher" um mindestens #[strong {{ ((inventoryConflicts.get(beverage.id)?.requested ?? 0) - (inventoryConflicts.get(beverage.id)?.available ?? 0)) }}] erhöhen.

            .inventory-row-miscount(v-if="consumptionAnomaly(entry, beverage) && !inventoryConflicts.has(beverage.id)" v-show="inventoryItemVisible(entry)")
              span.miscount-icon 💡
              span.miscount-text
                | {{ beverage.name }}: #[strong {{ formatQty(consumptionAnomaly(entry, beverage)?.consumed) }}] verbraucht – üblich sind Ø #[strong {{ consumptionAnomaly(entry, beverage)?.mean }}] (max #[strong {{ consumptionAnomaly(entry, beverage)?.max }}]). Wurde evtl. Restbestand nicht gezählt?

        //- Mobile cards
        .inventory-cards.mobile-only
          .inv-card(v-for="{ beverage, entry } in sortedInventory(items)" :key="beverage.id" v-show="inventoryItemVisible(entry)" :class="{ 'inv-confirmed': isInventoryConfirmed(entry), 'inv-pending': !isInventoryConfirmed(entry), 'inv-conflict': inventoryConflicts.has(beverage.id), 'inv-miscount': !!consumptionAnomaly(entry, beverage) }")
            .inv-card-header
              .inv-card-name
                router-link.inv-card-name-link(
                  v-if="authStore.isInventoryManager && beverage.id"
                  :to="beverageLinkTo(beverage)"
                  :title="`„${beverage.name}\" im Stamm bearbeiten`"
                ) {{ beverage.name }}{{ bevSize(beverage) }}
                template(v-else) {{ beverage.name }}{{ bevSize(beverage) }}
            .inv-card-conflict(v-if="inventoryConflicts.has(beverage.id)")
              span ⚠️
              | {{ beverage.name }}: angefordert #[strong {{ inventoryConflicts.get(beverage.id)?.requested }}], verfügbar #[strong {{ inventoryConflicts.get(beverage.id)?.available }}]. Nachher erhöhen.
            .inv-card-miscount(v-if="consumptionAnomaly(entry, beverage) && !inventoryConflicts.has(beverage.id)")
              span 💡
              | #[strong {{ formatQty(consumptionAnomaly(entry, beverage)?.consumed) }}] verbraucht – üblich Ø #[strong {{ consumptionAnomaly(entry, beverage)?.mean }}] (max #[strong {{ consumptionAnomaly(entry, beverage)?.max }}]). Restbestand vergessen?
            .inv-card-info
              span.inv-info-item
                span.inv-info-label V:
                template(v-if="(beverage.units_per_crate || 1) > 1")
                  | {{ getOrInitSplit(beverage, entry)?.beforeCrates }}K {{ formatQty(getOrInitSplit(beverage, entry)?.beforeBottles) }}Fl
                template(v-else)
                  | {{ formatBottleQty(entry.quantity_before, beverage) }}Fl
              span.inv-info-sep ·
              span.inv-info-item(:class="{ 'negative-consumption': inventoryConsumption(entry) < 0 }") Δ {{ formatBottleQty(inventoryConsumption(entry), beverage) }}
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
                      v-model.number="getOrInitSplit(beverage, entry).afterCrates"
                      type="number"
                      min="0"
                      step="1"
                      @wheel.prevent
                      @change="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    button.stepper-btn(@click="stepCrate(beverage, entry, 'after', 1)") +
                    span.stepper-unit K
                  .stepper-group
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="getOrInitSplit(beverage, entry).afterBottles"
                      type="number"
                      step="1"
                      @wheel.prevent
                      @keydown="onBottleKeydown($event, beverage, entry, 'after')"
                      @input="onBottleInput(beverage, entry)"
                      @change="onBottleChange(beverage, entry, 'after')"
                    )
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', 1)") +
                    span.stepper-unit Fl
              //- Portion stepper: ganze Flaschen + Viertel-Segmente
              template(v-else-if="splitMode(beverage)")
                .stepper-row
                  .stepper-group
                    button.stepper-btn(@click="stepCrate(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="getOrInitSplit(beverage, entry).afterCrates"
                      type="number"
                      min="0"
                      step="1"
                      @wheel.prevent
                      @change="updateEntryFromCrates(entry, beverage); confirmedInventory.add(beverage.id)"
                    )
                    button.stepper-btn(@click="stepCrate(beverage, entry, 'after', 1)") +
                    span.stepper-unit Fl.
                .quarter-seg.quarter-seg-mobile
                  button.quarter-btn(
                    v-for="q in [1, 2, 3]"
                    :key="q"
                    type="button"
                    :class="{ active: isQuarterActive(beverage, entry, q) }"
                    @click="setQuarter(beverage, entry, q)"
                  ) {{ ['', '¼', '½', '¾'][q] }}
              //- Bottle stepper
              template(v-else)
                .stepper-row
                  .stepper-group
                    button.stepper-btn(@click="stepBottle(beverage, entry, 'after', -1)") −
                    input.stepper-value(
                      v-model.number="entry.quantity_after"
                      type="number"
                      min="0"
                      step="1"
                      @wheel.prevent
                      @keydown="onBottleKeydown($event, beverage, entry, 'after')"
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

    //- ── Expenses & Receipts Tab ──
    .tab-content(v-if="activeTab === 'expenses'")

      //- Versteckte Datei-Inputs für Scan & Upload
      input(
        ref="expenseScanInput"
        type="file"
        accept="image/*"
        capture="environment"
        @change="handleExpenseScan"
        hidden
      )
      input.file-input(
        ref="fileInputRef"
        type="file"
        multiple
        @change="handleFileUpload"
        style="display: none"
      )

      //- == Gagen ==
      //- Eigener Abschnitt vor den übrigen Ausgaben: erst der Rechner für den
      //- Abend, dann der Soll/Ist-Abgleich je Band, dann die gebuchten Gagen.
      .section(v-if="bandDealOverview.length || gageExpenses.length")
        .section-title-row
          h3.section-title 🎤 Gagen
        p.section-subtitle(v-if="bandDealOverview.length") Rechner für den Abend: trag ein, was im Einlass liegt, bevor ausgezahlt wird. Der Wert fließt nicht in die Abrechnung ein.
        .deal-calc(v-if="bandDealOverview.length")
          .deal-calc-head
            label.deal-calc-label(for="deal-calc-base") Gezähltes Bargeld in der Einlasskasse
            .amount-wrap
              input#deal-calc-base.amount-input(
                type="number" step="0.01" min="0"
                :value="dealCalcFrozen ?? dealCalcCashDefault.toFixed(2)"
                @input="setDealCalcBase"
              )
              span €
          .deal-calc-line.deal-calc-change-row
            label.deal-calc-label(for="deal-calc-change") − Wechselgeld zurückbehalten
            .amount-wrap
              input#deal-calc-change.amount-input(
                type="number" step="0.01" min="0"
                v-model="dealCalcChange"
                placeholder="0,00"
              )
              span €
          .deal-calc-line.deal-calc-digital(v-if="dealCalcDigital > 0")
            span + VVK & digitale Zahlungen
            span +{{ formatCurrency(dealCalcDigital) }}
          .deal-calc-line.deal-calc-digital(v-if="dealCalcDigitalFees > 0")
            span − Gebühren für VVK & digitale Zahlungen
            span −{{ formatCurrency(dealCalcDigitalFees) }}
          //- Die Kassenzählung wird oft erst am Folgetag gemacht — die
          //- digitalen Einnahmen müssen also auch hier abrufbar sein.
          .deal-calc-fetch
            button.btn-fetch-digital(
              type="button"
              @click="fetchAndApplyAllExternal"
              :disabled="externalDataLoading"
            ) {{ externalDataLoading ? 'Lade…' : dealCalcDigital > 0 ? '↻ VVK & digitale Zahlungen neu laden' : '⬇ VVK & digitale Zahlungen laden' }}
            span.deal-calc-fetch-hint(v-if="!externalDataLoading && !externalDataLoaded && dealCalcDigital === 0")
              | Pretix, PayPal und SumUp noch nicht abgerufen
            span.deal-calc-fetch-error(v-if="pretixError") Pretix: {{ pretixError }}
            span.deal-calc-fetch-error(v-if="paypalBarError") PayPal: {{ paypalBarError }}
            span.deal-calc-fetch-error(v-if="sumupBarError") SumUp: {{ sumupBarError }}
          .external-diffs(v-if="externalDiffs.length")
            p.external-diffs-head ⚠️ Abweichung zu deinen erfassten Werten – nichts wurde überschrieben:
            .external-diff-row(v-for="d in externalDiffs" :key="d.source")
              span.external-diff-label {{ d.label }}
              span.external-diff-vals
                | erfasst {{ formatCurrency(d.storedTotal) }} → laut API {{ formatCurrency(d.fetchedTotal) }}
              button.btn-add-sm.btn-add-primary(@click="applyExternalDiff(d)") Übernehmen
              button.btn-add-sm.btn-add-ghost(@click="dismissExternalDiff(d)") Behalten
          .deal-calc-line.deal-calc-subtotal
            span = Türeinnahme brutto
            span {{ formatCurrency(dealCalcSubtotal) }}
          .deal-calc-line
            span − 7 % Umsatzsteuer (Eintritt)
            span −{{ formatCurrency(dealCalcVat) }}
          .deal-calc-line.deal-calc-total
            span = Grundlage für die Gagen
            span.deal-calc-net {{ formatCurrency(dealCalcBase) }}

        .band-deal-table
          .band-deal-header
            span Band
            span Deal
            span Betrag
            span Status
          .band-deal-row(v-for="row in bandDealOverview" :key="row.artistId" :class="{ 'is-open': !row.allGood }")
            .band-deal-name {{ row.artistName }}
            .band-deal-deal
              span {{ dealShortLabel(row) }}
              span.band-deal-winner(v-if="dealWinnerHint(row)") {{ dealWinnerHint(row) }}
            .band-deal-amount {{ formatCurrency(row.resolvedAmount) }}
            .band-deal-status
              template(v-if="row.allGood")
                span.band-deal-tag.tag-ok ✓ gebucht
              template(v-else-if="row.issues.orphanSplit")
                span.band-deal-tag.tag-warn ⚠ externer Split ({{ row.splitShare }} %)
                button.btn-add-sm.btn-add-primary(@click="convertSplitToExpenseRow(row)") {{ row.currentAmount != null ? 'Split entfernen' : 'In Gage umwandeln' }}
              template(v-else-if="row.issues.amountMismatch")
                span.band-deal-tag.tag-warn ⚠ gebucht {{ formatCurrency(row.currentAmount || 0) }}
                button.btn-add-sm.btn-add-ghost(@click="keepPaidAmountRow(row)") behalten
                button.btn-add-sm.btn-add-primary(@click="applyResolvedAmountRow(row)") auf {{ formatCurrency(row.resolvedAmount) }}
              template(v-else-if="row.issues.suggestExpense")
                button.btn-add-sm.btn-add-primary(@click="applyExpenseRow(row)") + Als Gage buchen

        .expenses-table(v-if="gageExpenses.length" :class="{ 'door-deal-active': doorDealActive }")
          .expense-header
            span.sortable(@click="expSort.toggle('desc')") Beschreibung{{ expSort.indicator('desc') }}
            span.sortable(@click="expSort.toggle('amount')") Betrag{{ expSort.indicator('amount') }}
            span Bezahlt aus
            span Sphäre
            span.col-doordeal(v-if="doorDealActive" title="Von der Türeinnahme abziehen, bevor die externen Doordeal-Anteile gerechnet werden (z.B. GEMA, KSK)") 🚪
            span

          .expense-row(v-for="exp in gageExpenses" :key="expenses.indexOf(exp)")
            span.field-label Beschreibung
            input.text-input(
              v-model="exp.description"
              type="text"
              placeholder="z.B. Rewe, Hotel..."
            )
            span.field-label Betrag
            .amount-wrap
              input.amount-input(
                v-model="exp.amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              )
            span.field-label Bezahlt aus
            select.select-input(v-model="exp.paid_from")
              option(v-for="(label, source) in EXPENSE_PAID_FROM_LABELS" :key="source" :value="source")
                | {{ label }}
            span.field-label Sphäre
            select.select-input(v-model="exp.tax_sphere" :class="{ 'missing': !exp.tax_sphere }")
              option(:value="null" disabled hidden) Sphäre wählen
              option(v-for="(label, key) in TAX_SPHERE_LABELS" :key="key" :value="key")
                | {{ label }}
            span.field-label(v-if="doorDealActive") 🚪 Abziehen
            .col-doordeal(v-if="doorDealActive")
              input(
                type="checkbox"
                v-model="exp.door_deal_deductible"
                title="Von der Türeinnahme abziehen, bevor die externen Doordeal-Anteile gerechnet werden (z.B. GEMA, KSK)"
              )
            button.btn-remove(@click="removeExpense(exp)") ×
        .band-deal-empty(v-else-if="bandDealOverview.length") Noch keine Gage gebucht – oben „+ Als Gage buchen“ klicken.
        .group-total
          span Gagen gesamt:
          strong {{ formatCurrency(totalGageExpenses) }}

      //- == Weitere Ausgaben ==
      .section
        .section-title-row
          h3.section-title 🧾 Weitere Ausgaben

        //- Beleg erfassen: manuell, per KI-Foto, als Datei-Upload oder per Drag & Drop.
        //- Der Drop-Bereich umfasst Buttons + Hinweiszeile, damit man überall in der Fläche ablegen kann.
        .capture-wrapper(
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
          :class="{ 'drag-over': dragOver }"
        )
          .capture-bar
            button.capture-card(@click="addExpense") ✏️ Manuell
            button.capture-card.capture-ai(@click="triggerExpenseScan" :disabled="scanningExpense")
              | {{ scanningExpense ? '🤖 Wird gelesen…' : '📸 Foto scannen (KI)' }}
            button.capture-card(@click="triggerFileUpload") 📎 Datei hochladen
          p.dragdrop-hint {{ dragOver ? 'Loslassen zum Hochladen…' : '📥 Beleg-Datei oder Foto lässt sich auch per Drag & Drop hierher ziehen' }}
        p.reminder-text 💡 Denk an: Hotel · GEMA · Werbung (Flyer/Poster) · Catering
        p.scan-error(v-if="scanExpenseError") ⚠️ {{ scanExpenseError }}

        .upload-progress(v-if="uploadingFiles.length")
          .upload-item(v-for="f in uploadingFiles" :key="f.name")
            span {{ f.name }}
            span.status ⏳ wird hochgeladen…

        .upload-error(v-if="uploadError")
          p ⚠️ {{ uploadError }}

        .expenses-table(v-if="otherExpenses.length" :class="{ 'door-deal-active': doorDealActive }")
          .expense-header
            span.sortable(@click="expSort.toggle('desc')") Beschreibung{{ expSort.indicator('desc') }}
            span.sortable(@click="expSort.toggle('amount')") Betrag{{ expSort.indicator('amount') }}
            span Bezahlt aus
            span Sphäre
            span.col-doordeal(v-if="doorDealActive" title="Von der Türeinnahme abziehen, bevor die externen Doordeal-Anteile gerechnet werden (z.B. GEMA, KSK)") 🚪
            span

          .expense-row(v-for="exp in otherExpenses" :key="expenses.indexOf(exp)")
            span.field-label Beschreibung
            input.text-input(
              v-model="exp.description"
              type="text"
              placeholder="z.B. Rewe, Hotel..."
            )
            span.field-label Betrag
            .amount-wrap
              input.amount-input(
                v-model="exp.amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              )
            span.field-label Bezahlt aus
            select.select-input(v-model="exp.paid_from")
              option(v-for="(label, source) in EXPENSE_PAID_FROM_LABELS" :key="source" :value="source")
                | {{ label }}
            span.field-label Sphäre
            select.select-input(v-model="exp.tax_sphere" :class="{ 'missing': !exp.tax_sphere }")
              option(:value="null" disabled hidden) Sphäre wählen
              option(v-for="(label, key) in TAX_SPHERE_LABELS" :key="key" :value="key")
                | {{ label }}
            span.field-label(v-if="doorDealActive") 🚪 Abziehen
            .col-doordeal(v-if="doorDealActive")
              input(
                type="checkbox"
                v-model="exp.door_deal_deductible"
                title="Von der Türeinnahme abziehen, bevor die externen Doordeal-Anteile gerechnet werden (z.B. GEMA, KSK)"
              )
            button.btn-remove(@click="removeExpense(exp)") ×
        p.empty-hint(v-else) Noch keine Ausgabe erfasst – oben manuell eintragen oder einen Beleg abfotografieren.
        .group-total
          span Weitere Ausgaben:
          strong {{ formatCurrency(totalOtherExpenses) }}

      .grand-total
        span Gesamtausgaben:
        strong {{ formatCurrency(totalExpenses) }}

      //- Rechnungen aus dem Postfach, die dieser Veranstaltung zugeordnet wurden
      .section.inbox-invoices(v-if="eventInvoices.length")
        .section-title-row
          h3.section-title Rechnungen aus dem Postfach
        p.inbox-invoices-hint Diese Rechnungen wurden im Rechnungseingang dieser Veranstaltung zugeordnet. „Als Ausgabe" liest den Betrag per KI aus und legt eine Ausgaben-Zeile an.
        .inbox-invoice-row(v-for="inv in eventInvoices" :key="inv.id")
          span.inbox-badge {{ invoiceSourceLabel(inv) }}
          a.doc-link(v-if="inv.drive_url" :href="inv.drive_url" target="_blank") {{ inv.file_name }}
          span.inbox-file(v-else) {{ inv.file_name }}
          span.inbox-imported(v-if="importedInvoiceIds.includes(inv.id)") ✓ übernommen
          button.btn-scan-doc(
            v-else
            @click="importInvoiceAsExpense(inv)"
            :disabled="invoiceImportBusyId === inv.id || !inv.document"
            title="Betrag per KI auslesen und als Ausgabe übernehmen"
          )
            span(v-if="invoiceImportBusyId === inv.id") 🤖…
            span(v-else) 🧾 Als Ausgabe
        .scan-error(v-if="invoiceImportError") ⚠️ {{ invoiceImportError }}

      //- Hochgeladene Belege
      .section.documents-tab.expenses-documents
        .section-title-row
          h3.section-title Belege
          .header-actions
            router-link.btn-secondary(:to="`/admin/events/${eventId}/documents`") Alle Dokumente →

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
                  .doc-rename(v-if="renamingDocId === doc.id")
                    input.doc-rename-input(
                      v-model="renameDraft"
                      :disabled="renameBusy"
                      @keydown.enter.prevent="saveRenameDocument(doc)"
                      @keydown.esc.prevent="cancelRenameDocument()"
                      autofocus
                    )
                    button.btn-rename-save(@click="saveRenameDocument(doc)" :disabled="renameBusy" title="Speichern") ✓
                    button.btn-rename-cancel(@click="cancelRenameDocument()" :disabled="renameBusy" title="Abbrechen") ✕
                  template(v-else)
                    a.doc-link(v-if="doc.drive_url" :href="doc.drive_url" target="_blank") {{ doc.file_name }}
                    span(v-else) {{ doc.file_name }}
                td {{ new Date(doc.uploaded_at).toLocaleString('de-DE') }}
                td {{ doc.uploaded_by_name }}
                td.doc-actions
                  button.btn-scan-doc(
                    @click="scanDocument(doc)"
                    :disabled="scanningDocId === doc.id"
                    title="Als Ausgabe übernehmen (KI)"
                  )
                    span(v-if="scanningDocId === doc.id") 🤖…
                    span(v-else) 🧾 Als Ausgabe
                  button.btn-rename(
                    v-if="renamingDocId !== doc.id"
                    @click="startRenameDocument(doc)"
                    title="Beleg umbenennen"
                  ) ✏️
                  button.btn-delete(@click="deleteDocument(doc)") ✕

        .scan-error(v-if="renameError") ⚠️ {{ renameError }}
        .scan-error(v-if="scanDocError") ⚠️ {{ scanDocError }}
        .scan-success(v-if="scanDocSuccess") ✓ {{ scanDocSuccess }}

        .empty-state(v-else-if="!isLoadingDocs")
          p Noch keine Belege hochgeladen.

        .loading(v-if="isLoadingDocs") Belege werden geladen…

      //- Hinweise
      .expense-notes
        .sphere-info
          strong.sphere-title Sphären-Zuordnung (Pflichtfeld)
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

      //- ═══ A) Ergebnis-Tabelle (Read-Only) ══════════════════════
      .section
        .section-title-row
          h3.section-title 🧮 Ergebnis
        .summary-table

          //- Einnahmen (zeigen tatsächliche Einnahmen = gezählt + aus Kasse bezahlt)
          .summary-row.summary-expandable(@click="resultExpandRevenue = !resultExpandRevenue")
            span.summary-label {{ resultExpandRevenue ? '▼' : '▶' }} 💰 Einnahmen
            span.summary-value {{ formatCurrency(adjustedRevenue) }}
          template(v-if="resultExpandRevenue")
            template(v-for="group in REVENUE_GROUPS" :key="group.label")
              .summary-row.summary-detail.summary-group-subtotal(v-if="groupRevenue(group.sources) !== 0")
                span.summary-label
                  | {{ group.sources[0].startsWith('bar_') ? '🍺 Bar' : '🚪 Einlass' }}
                  span.summary-inline-hint(v-if="group.sources[0].startsWith('bar_') && authStore.isTreasurer && (totalExpectedRevenue > 0 || missingSellingPriceBeverages.length)") (Verbrauch hätte {{ formatCurrency(totalExpectedRevenue) }} an Einnahmen erzeugen müssen{{ missingSellingPriceBeverages.length ? ` – ohne VK-Preis: ${missingSellingPriceBeverages.join(', ')}` : '' }})
                span.summary-value {{ formatCurrency(groupRevenue(group.sources)) }}
              .summary-row.summary-detail.summary-detail-nested(v-for="rev in revenues.filter(r => group.sources.includes(r.source))" :key="rev.source" v-show="revenueNet(rev) !== 0")
                span.summary-label {{ REVENUE_SOURCE_LABELS[rev.source] }}
                span.summary-value {{ formatCurrency(revenueNet(rev)) }}
            .summary-row.summary-detail.summary-subtotal-minor(v-if="expensesPaidFromRegister === 0")
              span.summary-label = Gezählte Einnahmen
              span.summary-value {{ formatCurrency(totalRevenue) }}
            template(v-if="expensesPaidFromRegister > 0")
              .summary-row.summary-detail.summary-subtotal-minor
                span.summary-label = Gezählte Einnahmen
                span.summary-value {{ formatCurrency(totalRevenue) }}
              .summary-row.summary-detail
                span.summary-label + Aus Kassen bezahlte Ausgaben
                span.summary-value {{ formatCurrency(expensesPaidFromRegister) }}
              .summary-row.summary-detail.summary-subtotal-minor
                span.summary-label = Tatsächliche Einnahmen
                span.summary-value {{ formatCurrency(adjustedRevenue) }}

          //- Wareneinsatz
          .summary-row.summary-expandable(@click="resultExpandInventory = !resultExpandInventory")
            span.summary-label {{ resultExpandInventory ? '▼' : '▶' }} 📦 − Wareneinsatz
            span.summary-value −{{ formatCurrency(totalInventoryValue) }}
          template(v-if="resultExpandInventory")
            .summary-row.summary-detail(v-for="(items, group) in inventoryBySupplier" :key="group" v-show="groupInventoryValue(items) !== 0")
              span.summary-label {{ group }}
              span.summary-value −{{ formatCurrency(groupInventoryValue(items)) }}

          //- Ausgaben
          .summary-row.summary-expandable(@click="resultExpandExpenses = !resultExpandExpenses")
            span.summary-label {{ resultExpandExpenses ? '▼' : '▶' }} 🧾 − Ausgaben
            span.summary-value −{{ formatCurrency(totalExpenses) }}
          template(v-if="resultExpandExpenses")
            .summary-row.summary-detail(v-for="exp in expenses" :key="exp.id || exp.description" v-show="parseFloat(exp.amount || '0') !== 0")
              span.summary-label
                | {{ exp.description || '(ohne Beschreibung)' }}
                //- Garantie+Doordeal-Details direkt an der betroffenen Ausgabe
                //- statt in einer separaten Liste weiter unten (siehe Team-Absprache) —
                //- rein informativ, ändert nichts an der Ausgabe selbst.
                span.summary-inline-hint(v-if="expenseComboHint(exp)")
                  |  ({{ expenseComboHint(exp) }})
              span.summary-value −{{ formatCurrency(parseFloat(exp.amount || '0')) }}

          //- ═══ Ergebnis vor USt ═══
          .summary-row.summary-total
            span.summary-label Ergebnis (vor USt)
            span.summary-value(:class="result >= 0 ? 'positive' : 'negative'") {{ formatCurrency(result) }}

          //- USt (nur wenn relevant)
          template(v-if="vatOutput !== 0 || vatInput !== 0")
            .summary-row.summary-expandable(@click="resultExpandVat = !resultExpandVat")
              span.summary-label {{ resultExpandVat ? '▼' : '▶' }} 🧮 − USt-Zahllast
              span.summary-value −{{ formatCurrency(vatLiability) }}
            template(v-if="resultExpandVat")
              .summary-row.summary-detail(v-if="vat7Entrance !== 0")
                span.summary-label Output-USt (7% Eintritt)
                span.summary-value {{ formatCurrency(vat7Entrance) }}
              .summary-row.summary-detail(v-if="vat19Bar !== 0")
                span.summary-label Output-USt (19% Getränke)
                span.summary-value {{ formatCurrency(vat19Bar) }}
              .summary-row.summary-detail(v-if="vatInput !== 0")
                span.summary-label − Vorsteuer
                span.summary-value −{{ formatCurrency(vatInput) }}
            //- ═══ Ergebnis nach USt ═══
            .summary-row.summary-total
              span.summary-label Ergebnis (nach USt)
              span.summary-value(:class="resultAfterVat >= 0 ? 'positive' : 'negative'") {{ formatCurrency(resultAfterVat) }}

          //- Doordeal-Sub-Rechnung (nur wenn mind. eine benannte %-Partei existiert).
          //- Breakdown auf/zuklappbar wie der Rest der Tabelle; die Ergebnis-Zeile
          //- danach bleibt IMMER sichtbar, unabhängig vom Klapp-Zustand — genau wie
          //- "Ergebnis (vor/nach USt)" oben nie vom Aufklappen der jeweiligen
          //- Breakdown-Sektion abhängt. Kopfzeilen-Betrag = NUR doorDealArtistAmount,
          //- denn genau das (und nichts anderes) zieht resultAfterDoorDeal von
          //- resultAfterVat ab — comboDoorDealShareAmount ist schon vorher über die
          //- normale Ausgaben-Zeile in "Ergebnis vor USt" abgezogen, hier nur noch
          //- zur Erklärung des Carousel-Anteils in der Aufklapp-Ansicht sichtbar.
          template(v-if="doorDealActive")
            .summary-row.summary-expandable(@click="resultExpandDoorDeal = !resultExpandDoorDeal")
              span.summary-label {{ resultExpandDoorDeal ? '▼' : '▶' }} 🚪 − Doordeal-Verteilung
              span.summary-value −{{ formatCurrency(doorDealArtistAmount) }}
            template(v-if="resultExpandDoorDeal")
              .summary-row.summary-sub-detail
                span.summary-label Türeinnahmen (Einlass + VVK, netto)
                span.summary-value {{ formatCurrency(doorDealEntranceRevenue) }}
              .summary-row.summary-sub-detail(v-if="doorDealDeductions > 0")
                span.summary-label − Abzugsfähige Ausgaben
                span.summary-value −{{ formatCurrency(doorDealDeductions) }}
              .summary-row.summary-sub-base
                span.summary-label = Verteilungsbasis
                span.summary-value {{ formatCurrency(doorDealBase) }}
              .summary-row.summary-sub-detail(v-for="party in doorDealSplits.filter(p => p.name.trim() !== '')" :key="'p' + party.name")
                span.summary-label {{ party.name }}
                .summary-value-group
                  span.summary-pct {{ party.share }}%
                  span.summary-value −{{ formatCurrency(doorDealBase * party.share / 100) }}
              //- Was Garantie+Doordeal-Bands (oben) schon vom selben Topf bekommen
              //- haben — ohne das würde "verbleibt im Topf" unten so tun, als wäre
              //- dieses Geld noch da (siehe Team-Absprache).
              .summary-row.summary-sub-detail(v-if="comboDoorDealShareAmount > 0")
                span.summary-label 🎤 Garantie+Doordeal-Bands (bereits ausgezahlt)
                span.summary-value −{{ formatCurrency(comboDoorDealShareAmount) }}
              .summary-row.summary-sub-remaining
                span.summary-label 🏠 Carousel-Anteil (verbleibt im Topf)
                .summary-value-group
                  span.summary-pct {{ doorDealVenueDisplayPct.toFixed(0) }}%
                  span.summary-value(:class="doorDealVenueAmount < 0 ? 'negative' : ''") {{ formatCurrency(doorDealVenueAmount) }}
            //- ═══ Ergebnis nach Doordeal ═══
            .summary-row.summary-total
              span.summary-label Ergebnis (nach Doordeal)
              span.summary-value(:class="resultAfterDoorDeal >= 0 ? 'positive' : 'negative'") {{ formatCurrency(resultAfterDoorDeal) }}


          //- Gewinnverteilung-Auszahlung (treasurer + Splits konfiguriert)
          template(v-if="authStore.isTreasurer && splits.length")
            .summary-row.summary-subblock-header
              span.summary-label 🤝 Gewinnverteilung
            .summary-row.summary-sub-detail(v-for="split in splits" :key="'r' + split.participant_name")
              span.summary-label {{ split.participant_name || '(kein Name)' }}
              .summary-value-group
                span.summary-pct {{ Math.round(parseFloat(split.share_percentage)) }}%
                span.summary-value {{ formatCurrency(splitAmount(split)) }}
            .summary-row.summary-sub-remaining
              span.summary-label 🏠 Carousel e.V. (verbleibt)
              .summary-value-group
                span.summary-pct {{ (100 - totalSplitPercentage).toFixed(0) }}%
                span.summary-value(:class="remainingAfterSplits >= 0 ? 'positive' : 'negative'")
                  | {{ formatCurrency(remainingAfterSplits) }}

      //- ═══ B) Externer Türeinnahmen-Split (Mitveranstalter) ══════
      //- NUR für externe Parteien (Mitveranstalter). Band-Gagen — auch reine
      //- Doordeals — laufen im Modell A+B komplett über die Ausgaben (siehe
      //- 🎤 Band-Deals im Ausgaben-Tab), nie über diese Liste.
      .section
        .section-title-row
          h3.section-title 🤝 Externer Türeinnahmen-Split (Mitveranstalter)
        p.section-subtitle Nur für externe Parteien (z.B. Mitveranstalter), mit denen die Türeinnahmen geteilt werden. Band-Gagen — auch reine Doordeals — gehören in die Ausgaben (siehe 🎤 Band-Deals im Ausgaben-Tab), nicht hierher.
        .config-warning(v-if="bandNamesInExternalSplit.length") ⚠️ {{ bandNamesInExternalSplit.join(', ') }} ist eine Band mit Deal — bitte im Ausgaben-Tab (🎤 Band-Deals) „In Ausgabe umwandeln" statt hier als externen Split zu führen.
        template(v-if="doorDealSplits.length")
          .config-table
            .config-header
              span Partei
              span Anteil
              span
            .config-row(v-for="(party, index) in doorDealSplits" :key="index" :class="{ 'config-row-duplicate': duplicateDoorDealNames.has(party.name.trim().toLowerCase()) }")
              input.text-input(v-model="party.name" type="text" placeholder="Name")
              .input-group
                input.amount-input(v-model.number="party.share" type="number" min="0" max="100" step="1")
                span.unit %
              button.btn-remove(@click="doorDealSplits.splice(index, 1)") ×
            .config-row-add
              button.btn-add-sm(@click="doorDealSplits.push({ name: '', share: 0 })") + hinzufügen
            .config-warning(v-if="duplicateDoorDealNames.size") ⚠️ Doppelter Name: {{ Array.from(duplicateDoorDealNames).join(', ') }} — wird sonst doppelt abgezogen.
            .config-hint(v-if="doorDealVenueShare >= 0") Rest ({{ doorDealVenueShare.toFixed(0) }}%) verbleibt automatisch bei 🏠 Carousel e.V.
            .config-warning(v-else) ⚠️ Türanteile summieren sich auf {{ (100 - doorDealVenueShare).toFixed(0) }}% — mehr als die verfügbaren 100% der Türeinnahmen.
            .config-deductions(v-if="expenses.filter(e => e.description && e.grant_category !== 'kuenstlerhonorar').length")
              .config-deductions-header Vom Doordeal abzugsfähige Ausgaben
              label.config-deduction-item(
                v-for="exp in expenses.filter(e => e.description && e.grant_category !== 'kuenstlerhonorar')"
                :key="exp.id || exp.description"
              )
                input(type="checkbox" v-model="exp.door_deal_deductible")
                span.config-deduction-name {{ exp.description }}
                span.config-deduction-amount −{{ formatCurrency(parseFloat(exp.amount || '0')) }}
        .empty-hint(v-else)
          span Kein externer Türeinnahmen-Split (Mitveranstalter) für dieses Event.
          button.btn-add-sm(@click="doorDealSplits.push({ name: '', share: 0 })") + Externen Split hinzufügen

      //- ═══ C) Gewinnverteilung-Konfiguration ════════════════════
      //- Nur für Treasurer sichtbar — Backend liefert splits=[] für andere
      .section(v-if="authStore.isTreasurer")
        .section-title-row
          h3.section-title 🤝 Gewinnverteilung
        .config-table
          .config-header
            span Empfänger
            span Anteil
            span
          .config-row(v-for="(split, index) in splits" :key="index" :class="{ 'config-row-duplicate': duplicateSplitNames.has(split.participant_name.trim().toLowerCase()) }")
            input.text-input(v-model="split.participant_name" type="text" placeholder="Name")
            .input-group
              input.amount-input(v-model.number="split.share_percentage" type="number" min="0" max="100" step="1")
              span.unit %
            button.btn-remove(@click="removeSplit(index)") ×
          .config-row-add
            button.btn-add-sm(@click="addSplit") + hinzufügen
          .config-warning(v-if="duplicateSplitNames.size") ⚠️ Doppelter Name: {{ Array.from(duplicateSplitNames).join(', ') }} — wird sonst doppelt ausgezahlt.
          .config-hint Rest ({{ (100 - totalSplitPercentage).toFixed(0) }}%) verbleibt automatisch bei 🏠 Carousel e.V.

      //- ═══ D) Notizen ═══════════════════════════════════════════
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
              strong −{{ formatCurrency(budgetTotalRevenues) }}
            .result-row
              span Förderfähiger Betrag
              strong {{ formatCurrency(budgetEligibleAmount) }}
            .result-row.result-total
              span Beantragter Zuschuss
              strong {{ formatCurrency(budgetGrantAmount) }}
            .hint Max. 1.000 € pro Veranstaltung / 3.000 € pro Jahr (6.000 € bei >24 Veranstaltungen/Jahr)

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
                  select.select-input(v-model="exp.grant_category" @change="onGrantCategoryChange(exp)")
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
              strong −{{ formatCurrency(grantTotalOwnRevenue) }}
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
  font-size: 1rem;
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
  margin: 0;
}

.section-subtitle {
  font-size: 0.85rem;
  color: #666;
  margin: 0.5rem 1rem 0;
}

.deal-calc {
  padding: 0.75rem 1rem 1rem;
  border-bottom: 1px solid #ddd;
  background: #fafafa;
  text-align: left;
  font-size: 0.9rem;
}

.deal-calc-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.35rem;
  font-size: inherit;
}

.deal-calc-label {
  font-weight: 900;
  font-size: inherit;
  flex: 1 1 auto;
}

.deal-calc .amount-wrap {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 0 0 auto;
  font-size: inherit;
  font-weight: 900;
  color: black;
}

/* Feste Breite, damit die €-Zeichen beider Eingabezeilen — und damit die
   Eingabefelder selbst — bündig unter den Beträgen der Textzeilen stehen. */
.deal-calc .amount-wrap > span {
  width: 0.9rem;
  flex: 0 0 auto;
}

.deal-calc .amount-input {
  width: 100px;
  height: 2rem;
  box-sizing: border-box;
  text-align: right;
  font-size: inherit;
}

.deal-calc-line {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: inherit;
  color: #555;
  padding: 0.1rem 0;
}

.deal-calc-line.deal-calc-total {
  border-top: 1px solid #ccc;
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  font-size: 1.05rem;
  font-weight: 900;
  color: black;
}

.deal-calc-hint {
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  color: #555;
}

.deal-calc-line.deal-calc-digital {
  color: #777;
}

.deal-calc-fetch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.35rem 0 0.15rem;
}

/* Gleicher Look wie die Link-Buttons in den Veranstaltungsdetails. */
.btn-fetch-digital {
  padding: 0.4rem 0.9rem;
  border: 0.15rem solid black;
  background: white;
  color: black;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: normal;
  transition: background 0.2s, color 0.2s;
}

.btn-fetch-digital:hover:not(:disabled) {
  background: black;
  color: white;
}

.btn-fetch-digital:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.deal-calc-fetch-hint {
  font-size: 0.8rem;
  color: #888;
}

.deal-calc-fetch-error {
  font-size: 0.8rem;
  font-weight: 700;
  color: #dc2626;
}

.external-diffs {
  border: 2px solid #f59e0b;
  background: #fffbeb;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  text-align: left;
}

.external-diffs-head {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  font-weight: 900;
  color: #92400e;
}

.external-diff-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
  padding: 0.2rem 0;
  font-size: 0.8rem;
}

.external-diff-label {
  font-weight: 700;
  min-width: 9rem;
}

.external-diff-vals {
  flex: 1 1 14rem;
  color: #555;
}

.external-diff-row .btn-add-sm {
  letter-spacing: normal;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
}

.deal-calc-line.deal-calc-subtotal {
  border-top: 1px solid #ddd;
  margin-top: 0.2rem;
  padding-top: 0.3rem;
  font-weight: 700;
  color: #333;
}

.deal-calc-line.deal-calc-change-row {
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem 0.75rem;
  padding: 0.25rem 0 0.4rem;
}

.deal-calc-change-row .deal-calc-label {
  font-weight: 900;
  font-size: inherit;
  flex: 1 1 auto;
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
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
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

.config-warning {
  padding: 0.5rem 1rem;
  color: #f57c00;
  font-size: 0.85rem;
  font-weight: 600;
  border-top: 1px solid #ddd;
}

.config-row-duplicate {
  background: #fff3e0;
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

.hint {
  font-size: 0.8rem;
  color: #666;
  padding: 0.5rem 1rem;
  border-top: 1px solid #ddd;
  line-height: 1.4;
}

.expense-notes {
  margin-top: 1.25rem;
  border-top: 1px solid #eee;
  padding-top: 1rem;
}
.capture-wrapper {
  width: 100%;
  margin: 0.75rem 0 1.25rem;
  padding: 0.5rem;
  border: 0.25rem solid transparent;
  border-radius: 4px;
  transition: border-color 0.2s, background 0.2s;
}
.capture-wrapper.drag-over {
  border-color: var(--color-accent, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}
.capture-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  gap: 0.5rem;
}
.capture-card {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
  padding: 0.5rem 0.85rem;
  background: white !important;
  background-color: white !important;
  color: black !important;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.88rem;
  letter-spacing: 0;
  transition: background 0.15s, color 0.15s;
}
.capture-card:hover:not(:disabled) {
  background: black !important;
  background-color: black !important;
  color: white !important;
}
.capture-card.capture-ai {
  background: white !important;
  background-color: white !important;
  color: black !important;
}
.capture-card.capture-ai:hover:not(:disabled) {
  background: black !important;
  background-color: black !important;
  color: white !important;
}

.empty-hint {
  padding: 1.4rem 1rem;
  border: 0.125rem dashed #bbb;
  color: #777;
  font-size: 0.9rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.dragdrop-hint {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-accent, #4f46e5);
  border: 0.0625rem dashed var(--color-accent, #4f46e5);
  border-radius: 4px;
  background: rgba(79, 70, 229, 0.06);
  padding: 0.4rem 0.75rem;
  margin: 0.5rem 0 0;
  text-align: center;
  transition: font-size 0.15s;
}
.capture-wrapper.drag-over .dragdrop-hint {
  font-size: 0.95rem;
}
.reminder-text {
  font-size: 0.8rem;
  color: #888;
  margin: 0 0 0.75rem;
}
.band-deal-table {
  border: 0.25rem solid black;
  background: white;
  margin: 0 0 0.75rem;
}
.band-deal-header,
.band-deal-row {
  display: grid;
  grid-template-columns: 1fr 1.6fr 110px minmax(200px, 1.3fr);
  gap: 0.5rem 0.75rem;
  align-items: center;
  padding: 0.5rem 1rem;
  text-align: left;
  font-size: 0.9rem;
}
.band-deal-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}
/* Kopf folgt der Ausrichtung seiner Spalte. */
.band-deal-header > span:nth-child(3),
.band-deal-header > span:nth-child(4) {
  text-align: right;
}
.band-deal-row {
  border-bottom: 1px solid #ddd;
  background: white;
}
.band-deal-row:last-child {
  border-bottom: none;
}
/* Offene Posten hervorheben, damit man nachts sieht, wo noch etwas fehlt. */
.band-deal-row.is-open {
  background: #fffbeb;
}
.band-deal-name {
  font-weight: 700;
  min-width: 0;
  overflow-wrap: anywhere;
}
.band-deal-deal {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  color: #333;
}
.band-deal-winner {
  font-size: 0.8rem;
  color: #666;
}
.band-deal-amount {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.band-deal-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}
.band-deal-tag {
  font-size: 0.85rem;
  font-weight: 700;
}
.band-deal-tag.tag-ok {
  color: #16a34a;
}
.band-deal-tag.tag-suggest {
  color: #92700a;
}
.band-deal-tag.tag-warn {
  color: #dc2626;
}
/* Sub-Header innerhalb der Ausgaben-Tabelle (Band-Deals / Erfasste Ausgaben) */
.expenses-subhead {
  font-weight: 900;
  font-size: 0.8rem;
  padding: 0.5rem 1rem;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
}
.expenses-subhead ~ .expenses-subhead,
.band-deal-row + .expenses-subhead {
  border-top: 0.25rem solid black;
}
.band-deal-empty {
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: #888;
}
.sphere-info {
  margin-top: 1.25rem;
  font-size: 0.8rem;
  color: #666;
  line-height: 1.5;
}
.sphere-info .sphere-title {
  display: block;
  margin-bottom: 0.25rem;
  color: #444;
}
.sphere-info ul {
  margin: 0;
  padding-left: 1.1rem;
}
.sphere-info li {
  margin: 0.1rem 0;
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
  justify-content: flex-end;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.inv-reset-btn {
  font-size: 0.8rem;
  font-weight: 700;
  color: #555;
  letter-spacing: normal;
  padding: 0.25rem 0.6rem;
  border: 1px solid #bbb;
  background: #f5f5f5;
  cursor: pointer;
}

.inv-reset-btn:hover {
  background: #e8e8e8;
  border-color: #888;
}

.inv-reset-btn.active {
  background: black;
  color: white;
  border-color: black;
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
  /* Vorher und Nachher teilen sich eine Spalte — beim Zaehlen vergleicht man
   * die beiden staendig, deshalb stehen sie direkt nebeneinander. */
  grid-template-columns: 2fr 45px 2.2fr 0.6fr 0.8fr 1fr;
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

/* Gemeinsame Spalte fuer "Vorher -> Nachher". Beide Haelften teilen sich die
 * Zelle und ruecken an den Pfeil heran: dadurch sitzt der Pfeil in jeder Zeile
 * an derselben Stelle und die Eingabefelder fluchten, obwohl der Vorher-Text
 * unterschiedlich breit ist. */
.col-inv-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.col-inv-compare > .col-inv-pair {
  flex: 1;
  justify-content: flex-start;
}

.col-inv-compare > .readonly-before {
  justify-content: flex-end;
}

.compare-sep {
  font-size: 0.8rem;
  font-weight: 900;
  color: #aaa;
  flex-shrink: 0;
}

.inventory-header .col-inv-compare .sortable {
  white-space: nowrap;
}

/* Jede Zaehlposition ist gleich breit — dadurch fluchten die Felder auch bei
 * Getraenken ohne Nebeneinheit (Piccolo), deren zweite Position leer bleibt. */
.crate-input {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  width: 80px;
  flex-shrink: 0;
}

/* "Vorher" zeigt nur Text statt Eingabefeldern — dort wuerde die feste Breite
 * die Werte unnoetig weit auseinanderziehen. */
.readonly-before .crate-input {
  width: auto;
}

.crate-input .qty-input {
  min-width: 58px;
  width: auto;
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

/* Viertel-Segmente fuer Portionsgetraenke: die angebrochene Flasche wird
 * geklickt statt als Dezimalzahl getippt. Klick auf das aktive Segment leert
 * wieder — deshalb braucht es keinen eigenen "leer"-Button. */
.quarter-seg {
  display: flex;
  flex-shrink: 0;
}

/* In der Tabelle fuellen die Segmente ihre Zaehlposition aus; auf den
 * Mobile-Cards spannen sie ueber die volle Kartenbreite. */
.crate-input .quarter-seg {
  flex: 1;
}

.crate-input .quarter-btn {
  flex: 1;
  min-width: 0;
}

.quarter-btn {
  all: unset;
  min-width: 1.4rem;
  height: 1.55rem;
  border: 0.12rem solid black;
  margin-left: -0.12rem;
  background: white;
  color: black;
  font-size: 0.8rem;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, color 0.1s;
}

.quarter-btn:first-child {
  margin-left: 0;
}

.quarter-btn:hover {
  background: #eee;
}

.quarter-btn.active {
  background: black;
  color: white;
}

.quarter-seg-mobile {
  margin-top: 0.4rem;
}

.quarter-seg-mobile .quarter-btn {
  flex: 1;
  min-width: 0;
  height: 2.4rem;
  border-width: 2px;
  margin-left: -2px;
  font-size: 1rem;
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

/* Auffälliger Verbrauch als linker Balken (wie die Status-Markierung im
 * Kalender), nicht als Hintergrund: sonst überschreibt er das Grün der
 * gezählten Zeile und die sieht aus wie eine noch ungezählte.
 * Als inset-shadow statt border-left, damit der Zeileninhalt nicht
 * gegenüber den übrigen Zeilen verspringt. */
.inventory-row.inv-miscount {
  box-shadow: inset 0.3rem 0 0 #e8710a;
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

/* Per-row miscount hint — the entered consumption is far above this drink's
   historical norm, so remaining stock was probably not counted. */
.miscount-warning {
  font-size: 0.75rem;
  color: #e8710a;
  margin-left: 0.25rem;
  cursor: help;
}

.inventory-row-miscount {
  background: #fff0e2;
  border-left: 4px solid #e8710a;
  padding: 0.5em 1em;
  font-size: 0.9em;
  color: #8a4500;
  display: flex;
  gap: 0.5em;
  align-items: flex-start;
}

.inventory-row-miscount .miscount-icon {
  flex-shrink: 0;
  font-size: 1.1em;
}

.inventory-row-miscount .miscount-text {
  line-height: 1.4;
}

.inventory-row-miscount .miscount-text strong {
  color: #8a4500;
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

.conflict-retry {
  background: none;
  border: none;
  color: #d32f2f;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  font-size: inherit;
  text-decoration: underline;
}

/* Stale-Abrechnung banner — shown when the OCC check rejects the save with
   HTTP 409 because another user updated the same Abrechnung in parallel.
   Visually distinct from inventory conflicts (red, not orange) because
   it is a stronger signal: the only resolution is a full reload. */
.stale-banner {
  background: #ffebee;
  border: 1px solid #d32f2f;
  border-radius: 6px;
  padding: 0.85em 1em;
  margin: 0.75em 0 1em;
  display: flex;
  gap: 0.75em;
  align-items: center;
  flex-wrap: wrap;
}

.stale-banner-icon {
  font-size: 1.4em;
  flex-shrink: 0;
}

.stale-banner-text {
  flex: 1;
  min-width: 18em;
  line-height: 1.4;
  color: #5d1f1f;
}

.stale-banner-text strong {
  color: #b71c1c;
  display: block;
  margin-bottom: 0.2em;
}

.stale-banner .btn-primary {
  background: #d32f2f;
  border: none;
  color: #fff;
  padding: 0.5em 1.2em;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.stale-banner .btn-primary:hover {
  background: #b71c1c;
}

/* Mobile card variant */
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

.inv-card-miscount {
  background: #ffe0c2;
  color: #8a4500;
  font-size: 0.85em;
  padding: 0.4em 0.6em;
  border-radius: 4px;
  margin: 0.4em 0;
  line-height: 1.3;
}

.inv-card-miscount strong {
  color: #8a4500;
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

/* Warn-Zustände müssen nach pending/confirmed stehen, sonst überschreiben
 * deren border-color die Warnung. Reihenfolge = Dringlichkeit. */
.inv-card.inv-miscount {
  border-color: #e8710a;
}

.inv-card.inv-conflict {
  background: #ffebee;
  border-color: #d32f2f;
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

/* Wenn der Name f\u00fcr inventory_manager als Link gerendert wird, soll er sich
 * weiterhin in die Karte einf\u00fcgen \u2014 also Default-Link-Look \u00fcberschreiben
 * (kein Underline by default, Farbe vom Elternelement \u00fcbernehmen, beim Hover
 * dezent unterstreichen, um die Klickbarkeit zu signalisieren). */
.inv-card-name-link,
.bev-name-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.inv-card-name-link:hover,
.bev-name-link:hover {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
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

.inv-card-after {
  margin-bottom: 0.5rem;
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
  margin-bottom: 1rem;
}

.expense-row input,
.expense-row select {
  height: 2rem;
  line-height: 1.2;
  box-sizing: border-box;
  min-width: 0;
}

.expense-header, .expense-row {  display: grid;
  grid-template-columns: 1fr 100px 140px 140px 36px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
}

/* Beschriftung nur mobil — am Desktop trägt sie die Kopfzeile. */
.expense-row > .field-label {
  display: none;
}

.door-deal-active .expense-header,
.door-deal-active .expense-row {
  grid-template-columns: 1fr 100px 140px 140px 36px 36px;
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

/* ── Konfig-Tabellen (Doordeal + Gewinnverteilung) ── */
.config-table {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 2rem;
}

.config-header {
  display: grid;
  grid-template-columns: 1fr 110px 36px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 110px 36px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
  border-bottom: 1px solid #ddd;
}

.config-row .text-input {
  width: 100%;
}

.config-row .input-group {
  width: auto;
}

.config-row-add {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ddd;
}

.config-hint {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  color: #666;
  background: #fafafa;
}

/* Doordeal-Abzugs-Checkboxen */
.config-deductions {
  padding: 0.75rem 1rem;
  border-top: 1px solid #ddd;
  background: #fafafa;
}

.config-deductions-header {
  font-size: 0.8rem;
  font-weight: 900;
  color: #555;
  margin-bottom: 0.5rem;
}

.config-deduction-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.9rem;
  cursor: pointer;
  color: #333;
}

.config-deduction-item input[type="checkbox"] {
  cursor: pointer;
  flex-shrink: 0;
  margin: 0;
}

.config-deduction-name {
  flex: 1;
  text-align: left;
}

.config-deduction-amount {
  color: #999;
  font-size: 0.85rem;
  white-space: nowrap;
}

/* ── Inputs ── */

.col-source {
  font-weight: 600;
  font-size: 0.9rem;
}

.col-amount {
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

.col-desc {
  font-size: 0.9rem;
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

.unit {
  font-weight: 900;
  font-size: 0.9rem;
}

.scan-error {
  margin-top: 0.5rem;
  color: #b00020;
  font-weight: 600;
  font-size: 0.85rem;
}

.scan-success {
  margin-top: 0.5rem;
  color: #0a7d28;
  font-weight: 600;
  font-size: 0.85rem;
}

.doc-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.btn-scan-doc {
  padding: 0.25rem 0.5rem;
  background: white;
  color: black;
  border: 0.15rem solid black;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
}

.btn-scan-doc:hover:not(:disabled) {
  background: black;
  color: white;
}

.btn-scan-doc:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-rename {
  padding: 0.25rem 0.4rem;
  background: white;
  border: 0.15rem solid black;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
}

.btn-rename:hover {
  background: black;
}

.doc-rename {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.doc-rename-input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 0.15rem solid black;
  font-family: inherit;
  font-size: 0.85rem;
}

.btn-rename-save,
.btn-rename-cancel {
  padding: 0.25rem 0.5rem;
  border: 0.15rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 0.85rem;
  line-height: 1;
}

.btn-rename-save {
  background: black;
  color: white;
}

.btn-rename-cancel {
  background: white;
  color: black;
}

.btn-rename-save:disabled,
.btn-rename-cancel:disabled {
  opacity: 0.6;
  cursor: default;
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

/* ── Summary Table (Read-Only Ergebnis-Tabelle) ── */

.summary-table {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 2rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #ddd;
  font-size: 1rem;
  gap: 1rem;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  flex: 1;
}

.summary-value {
  font-weight: 700;
  white-space: nowrap;
}

.summary-value-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.summary-pct {
  color: #888;
  font-size: 0.85rem;
  min-width: 2.5rem;
  text-align: right;
}

/* Expandierbare Hauptzeilen */
.summary-row.summary-expandable {
  cursor: pointer;
  user-select: none;
}

.summary-row.summary-expandable:hover {
  background: #f5f5f5;
}

/* Drilldown-Detailzeilen einer Hauptzeile */
.summary-row.summary-detail {
  padding-left: 2rem;
  color: #555;
  font-size: 0.9rem;
  background: #fafafa;
}

.summary-row.summary-subtotal-minor {
  font-weight: 700;
  border-top: 1px solid #ccc;
}

/* Zwischensumme je Einnahmen-Bereich (Bar / Einlass) innerhalb der Drilldown-Liste */
.summary-row.summary-group-subtotal {
  font-weight: 700;
  color: #333;
  background: #f0f0f0;
}

/* Einzelne Quelle unterhalb einer Bereichs-Zwischensumme, stärker eingerückt */
.summary-row.summary-detail-nested {
  padding-left: 3rem;
}

/* Plausibilitäts-Hinweis unter der Einnahmen-Zeile (Verbrauch → erwartete Einnahmen) */
.summary-hint {
  padding: 0 1rem 0.5rem;
  font-size: 0.8rem;
  font-style: italic;
  color: #888;
}

/* Unauffälliger Klammer-Hinweis direkt hinter dem Bar-Label */
.summary-inline-hint {
  margin-left: 0.4rem;
  font-size: 0.75rem;
  font-weight: 400;
  font-style: italic;
  color: #999;
}

/* Schwarzer Balken: Ergebnis-Subtotals (vor USt / nach USt / nach Doordeal) */
.summary-row.summary-total {
  background: black;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  border-bottom: none;
}

.summary-row.summary-total + .summary-row {
  border-top: none;
}

.summary-row.summary-total .positive { color: #4ade80; }
.summary-row.summary-total .negative { color: #f87171; }

/* Sub-Block-Header: Doordeal-Verteilung / Gewinnverteilung */
.summary-row.summary-subblock-header {
  background: #f0f0f0;
  font-weight: 700;
  border-top: 0.25rem solid black;
}

/* Sub-Rechnung-Zeilen (innerhalb Doordeal/Splits-Block) */
.summary-row.summary-sub-detail {
  background: #f5f5f5;
  padding-left: 2rem;
  font-size: 0.95rem;
}

/* "= Verteilungsbasis"-Zeile innerhalb Doordeal */
.summary-row.summary-sub-base {
  background: #f5f5f5;
  padding-left: 2rem;
  font-size: 0.95rem;
  font-weight: 700;
  border-top: 1px solid black;
}

/* Carousel-Anteil als Aufteilungs-Info (nicht Final-Total) */
.summary-row.summary-sub-remaining {
  background: #f5f5f5;
  padding-left: 2rem;
  font-size: 0.95rem;
  font-style: italic;
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

.hint ul {
  margin: 0.25rem 0;
  padding-left: 1.2rem;
}

.hint li {
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
  color: #16a34a;
}

.negative {
  font-weight: 900;
  color: #dc2626;
}

@media (max-width: 700px) {

  .tab {
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
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

  /* Ohne Kopfzeile braucht jedes Feld eine eigene Beschriftung; der
     Löschen-Button gehört in die erste Zeile statt über die volle Breite. */
  .expense-row,
  .door-deal-active .expense-row {
    grid-template-columns: 5.5rem 1fr 2rem;
    gap: 0.4rem 0.5rem;
    padding: 0.75rem 1rem;
  }

  .expense-row > .field-label {
    display: block;
    grid-column: 1;
    font-size: 0.75rem;
    font-weight: 700;
    color: #555;
  }

  .expense-row > .text-input,
  .expense-row > .amount-wrap,
  .expense-row > .select-input,
  .expense-row > .col-doordeal {
    grid-column: 2;
  }

  .expense-row > .btn-remove {
    grid-column: 3;
    grid-row: 1;
    align-self: center;
  }

  /* Band-Deals als Karte: Name + Betrag in die Kopfzeile, Deal und
     Aktion darunter über die volle Breite. */
  .band-deal-header {
    display: none;
  }

  .band-deal-row {
    grid-template-columns: 1fr auto;
    gap: 0.15rem 0.5rem;
    padding: 0.75rem 1rem;
  }

  .band-deal-amount {
    grid-column: 2;
    grid-row: 1;
  }

  .band-deal-deal,
  .band-deal-status {
    grid-column: 1 / -1;
  }

  .band-deal-status {
    justify-content: flex-start;
    margin-top: 0.4rem;
  }

  .external-diff-label {
    min-width: 0;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .col-amount {
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

.band-deal-status .btn-add-sm {
  white-space: nowrap;
  /* Die globale Sperrschrift bläht die Buttons hier auf das Doppelte auf. */
  letter-spacing: normal;
  padding: 0.3rem 0.6rem;
}

/* Bei einer Betragsabweichung stehen zwei Aktionen nebeneinander — nur die
   empfohlene ist gefüllt, damit die Wahl eindeutig bleibt. */
.btn-add-sm.btn-add-ghost {
  background: white;
  color: black;
}
.btn-add-sm.btn-add-ghost:hover {
  background: #eee;
  filter: none;
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
.expenses-documents {
  margin-top: 2.5rem;
}
.documents-tab .header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 1rem;
  background: black;
}
/* Liegt in der schwarzen Titelleiste — braucht deshalb invertierte Farben. */
.documents-tab .header-actions .btn-secondary {
  background: transparent;
  color: white;
  border: 1px solid white;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  white-space: nowrap;
}
.documents-tab .header-actions .btn-secondary:hover {
  background: white;
  color: black;
}
.inbox-invoices {
  margin-top: 2.5rem;
}
.inbox-invoices-hint {
  font-size: 0.85rem;
  color: #555;
  margin: 0.5rem 1rem 1rem;
}
.inbox-invoice-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #333;
  font-size: 0.9rem;
}
.inbox-badge {
  background: black;
  color: white;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}
.inbox-file {
  overflow-wrap: anywhere;
}
.inbox-imported {
  margin-left: auto;
  font-weight: 600;
  color: #2e7d32;
}
.inbox-invoice-row .btn-scan-doc {
  margin-left: auto;
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
.accounting-view .expense-header {
  font-size: var(--fs-sm);
  font-weight: 900;
}

/* Standard-Inhaltszeilen / -Inputs. */
.accounting-view .revenue-row,
.accounting-view .inventory-row,
.accounting-view .expense-row,
.accounting-view .detail-row,
.accounting-view .summary-line,
.accounting-view .result-row,
.accounting-view .group-total,
.accounting-view .grand-total,
.accounting-view .text-input,
.accounting-view .amount-input,
.accounting-view .qty-input,
.accounting-view .select-input,
.accounting-view .col-source,
.accounting-view .col-amount,
.accounting-view .col-desc,
.accounting-view .col-inv-name,
.accounting-view .col-inv-amount {
  font-size: var(--fs-base);
}

/* Sub-Rows, Details, kleine Hinweise auf Reihen-Ebene. */
.accounting-view .summary-line.summary-sub,
.accounting-view .revenue-row.sub-row,
.accounting-view .col-inv-num,
.accounting-view .col-inv-info,
.accounting-view .bev-info {
  font-size: var(--fs-sm);
}

/* Total-/Summen-Zeilen — durch Größe + Border, nicht durch Schwarz. */
.accounting-view .summary-line.summary-total,
.accounting-view .summary-row.summary-total,
.accounting-view .grant-summary .result-row.result-total,
.accounting-view .grant-summary .result-row,
.accounting-view .expense-row.expense-total,
.accounting-view .detail-row.detail-total {
  font-size: var(--fs-md);
}

/* Hilfstexte, Footnotes, kleine Hinweise. */
.accounting-view .hint,
.accounting-view .hint p,
.accounting-view .hint li,
.accounting-view .auto-save-indicator,
.accounting-view .entry-price-hint,
.accounting-view .external-data-summary,
.accounting-view .external-data-status,
.accounting-view .pretix-error,
.accounting-view .pretix-warning,
.accounting-view .save-success,
.accounting-view .stock-changed-warning,
.accounting-view .inv-progress,
.accounting-view .inv-card-info {
  font-size: var(--fs-xs);
}

/* Sehr kleine deeply-nested Details (z.B. PayPal-Transaktionszeilen). */
.accounting-view .revenue-row.sub-detail {
  font-size: var(--fs-xs);
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
