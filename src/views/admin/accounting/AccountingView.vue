<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { accountingService, beverageService, eventService, pretixService } from '@/services'
import type { Event } from '@/services'
import type { PretixOrderSummary } from '@/services/accounting'
import type {
  EventAccounting,
  RevenueEntry,
  RevenueSource,
  InventoryEntry,
  ExpenseEntry,
  AccountingSplit,
  ExpensePaidFrom,
  BeverageItem,
} from '@/types/accounting'
import {
  REVENUE_SOURCE_LABELS,
  REVENUE_GROUPS,
  EXPENSE_PAID_FROM_LABELS,
} from '@/types/accounting'
import { useSort } from '@/composables/useSort'

const props = defineProps<{
  eventId: string
}>()

const router = useRouter()
const activeTab = ref('cashcount')

// ── State ────────────────────────────────────────────────────────
const event = ref<Event | null>(null)
const accounting = ref<EventAccounting | null>(null)
const beverages = ref<BeverageItem[]>([])
const revenues = ref<RevenueEntry[]>([])
const inventory = ref<InventoryEntry[]>([])
const expenses = ref<ExpenseEntry[]>([])
const splits = ref<AccountingSplit[]>([])

const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const saveSuccess = ref('')

// ── Pretix VVK ───────────────────────────────────────────────────
const pretixData = ref<PretixOrderSummary | null>(null)
const pretixLoading = ref(false)
const pretixError = ref('')

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

function updateEntryFromCrates(entry: InventoryEntry, beverage: BeverageItem) {
  const state = inventoryCrates.value[String(beverage.id)]
  if (!state) return
  const upc = beverage.units_per_crate || 1
  entry.quantity_before = String(state.beforeCrates * upc + state.beforeBottles)
  entry.quantity_after = String(state.afterCrates * upc + state.afterBottles)
}

const inventoryBySupplier = computed(() => {
  const groups: Record<string, { beverage: BeverageItem; entry: InventoryEntry }[]> = {}
  for (const bev of beverages.value) {
    if (!bev.is_active) continue
    const group = bev.supplier_group || 'Other'
    if (!groups[group]) groups[group] = []
    let entry = inventory.value.find(i => i.beverage_item === bev.id)
    if (!entry) {
      entry = {
        accounting: accounting.value?.id || 0,
        beverage_item: bev.id!,
        quantity_before: '0',
        quantity_after: '0',
      }
      inventory.value.push(entry)
    }
    getOrInitCrateState(bev.id!, bev.units_per_crate || 1, entry)
    groups[group].push({ beverage: bev, entry })
  }
  return groups
})

function inventoryConsumption(entry: InventoryEntry): number {
  return parseFloat(entry.quantity_before || '0') - parseFloat(entry.quantity_after || '0')
}

function inventoryValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const consumedCrates = inventoryConsumption(entry) / upc
  const price = parseFloat(entry.snapshot_purchase_price || beverage.purchase_price || '0')
  return consumedCrates * price
}

function inventoryDepositValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const consumedCrates = inventoryConsumption(entry) / upc
  const deposit = parseFloat(entry.snapshot_deposit || beverage.deposit || '0')
  return consumedCrates * deposit
}

function groupInventoryValue(items: { beverage: BeverageItem; entry: InventoryEntry }[]): number {
  return items.reduce((sum, { beverage, entry }) => sum + inventoryValue(entry, beverage), 0)
}

const totalInventoryValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + groupInventoryValue(items), 0
  )
})

const totalDepositValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + items.reduce(
      (s, { beverage, entry }) => s + inventoryDepositValue(entry, beverage), 0
    ), 0
  )
})

function stockValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const afterCrates = parseFloat(entry.quantity_after || '0') / upc
  const price = parseFloat(entry.snapshot_purchase_price || beverage.purchase_price || '0')
  return afterCrates * price
}

function stockDepositValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const afterCrates = parseFloat(entry.quantity_after || '0') / upc
  const deposit = parseFloat(entry.snapshot_deposit || beverage.deposit || '0')
  return afterCrates * deposit
}

const totalStockValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + items.reduce(
      (s, { beverage, entry }) => s + stockValue(entry, beverage), 0
    ), 0
  )
})

const totalStockDepositValue = computed(() => {
  return Object.values(inventoryBySupplier.value).reduce(
    (sum, items) => sum + items.reduce(
      (s, { beverage, entry }) => s + stockDepositValue(entry, beverage), 0
    ), 0
  )
})

// ── Computed: Expenses ───────────────────────────────────────────

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

// Expenses paid from a cash register are already deducted from the cash count,
// so we need to add them back to get the true revenue.
const expensesPaidFromRegister = computed(() => {
  return expenses.value
    .filter(e => e.paid_from === 'entrance_cash' || e.paid_from === 'bar_cash')
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
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
    is_paid_out: false,
  })
}

function removeExpense(index: number) {
  expenses.value.splice(index, 1)
}

// ── Computed: Result ─────────────────────────────────────────────

const depositReturn = computed({
  get: () => accounting.value?.deposit_return || '0.00',
  set: (val) => {
    if (accounting.value) accounting.value.deposit_return = val
  },
})

// True revenue = cash counted + expenses paid from registers (which reduced the count)
const adjustedRevenue = computed(() => {
  return totalRevenue.value + expensesPaidFromRegister.value
})

const result = computed(() => {
  return adjustedRevenue.value - totalExpenses.value - totalInventoryValue.value + parseFloat(depositReturn.value || '0')
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

function splitAmount(split: AccountingSplit): number {
  const pct = parseFloat(split.share_percentage || '0')
  return result.value * (pct / 100)
}

const totalSplitPercentage = computed(() => {
  return splits.value.reduce((sum, s) => sum + parseFloat(s.share_percentage || '0'), 0)
})

const remainingAfterSplits = computed(() => {
  return result.value - splits.value.reduce((sum, s) => sum + splitAmount(s), 0)
})

// ── Format helpers ───────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
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

    try {
      const acc = await accountingService.getByEvent(props.eventId)
      if (!acc) throw new Error('not found')
      accounting.value = acc

      // Nested data is included in the accounting response
      revenues.value = acc.revenues ?? []
      inventory.value = acc.inventory_entries ?? []
      expenses.value = acc.expenses ?? []
      splits.value = acc.splits ?? []
    } catch {
      // No accounting yet — create one
      accounting.value = await accountingService.create({
        event: props.eventId,
        status: 'draft',
        notes: '',
        deposit_return: '0.00',
      })
    }

    // Default split: Bernd 33%
    if (splits.value.length === 0) {
      splits.value.push({
        accounting: accounting.value?.id || 0,
        participant_name: 'Bernd',
        share_percentage: '33',
      })
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load data'
  } finally {
    isLoading.value = false
  }
}

async function saveAll() {
  if (!accounting.value?.id) return
  isSaving.value = true
  error.value = ''
  saveSuccess.value = ''

  try {
    const accId = accounting.value.id

    // Build all nested data and save in one PUT
    await accountingService.update(accId, {
      status: accounting.value.status,
      notes: accounting.value.notes,
      deposit_return: accounting.value.deposit_return,
      revenues: revenues.value
        .filter(rev => parseFloat(rev.total || '0') !== 0 || rev.id),
      inventory_entries: inventory.value
        .filter(inv => parseFloat(inv.quantity_before || '0') !== 0 || parseFloat(inv.quantity_after || '0') !== 0 || inv.id),
      expenses: expenses.value
        .filter(exp => exp.description || exp.id),
      splits: splits.value
        .filter(split => split.participant_name || split.id),
    })

    saveSuccess.value = 'Saved!'
    setTimeout(() => { saveSuccess.value = '' }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Error saving data'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.accounting-view
  .loading(v-if="isLoading") Loading accounting...
  template(v-else-if="accounting")
    .page-header
      .header-left
        router-link.btn-back(to="/admin/accounting") ← Back
        h2 {{ event?.title || props.eventId }}
      .header-right
        span.save-success(v-if="saveSuccess") {{ saveSuccess }}
        button.btn-save(@click="saveAll" :disabled="isSaving")
          | {{ isSaving ? 'Saving...' : 'Save All' }}

    .error(v-if="error") {{ error }}

    .tabs
      button.tab(
        :class="{ active: activeTab === 'cashcount' }"
        @click="activeTab = 'cashcount'"
      ) Cash Count
      button.tab(
        :class="{ active: activeTab === 'inventory' }"
        @click="activeTab = 'inventory'"
      ) Inventory
      button.tab(
        :class="{ active: activeTab === 'expenses' }"
        @click="activeTab = 'expenses'"
      ) Expenses
      button.tab(
        :class="{ active: activeTab === 'result' }"
        @click="activeTab = 'result'"
      ) Result

    //- ── Cash Count Tab ──
    .tab-content(v-if="activeTab === 'cashcount'")
      .section(v-for="group in REVENUE_GROUPS" :key="group.label")
        .section-title-row
          h3.section-title {{ group.label }}
          .pretix-actions(v-if="group.sources.some(s => s.startsWith('vvk_'))")
            button.btn-pretix(
              @click="fetchPretixData"
              :disabled="pretixLoading"
            ) {{ pretixLoading ? 'Loading...' : 'Load presale from Pretix' }}
            button.btn-pretix.btn-apply(
              v-if="pretixData"
              @click="applyPretixData"
            ) Apply ({{ pretixData.total_tickets }} tickets, {{ pretixData.total_revenue.toFixed(2) }} €)
            span.pretix-error(v-if="pretixError") {{ pretixError }}
        .revenue-table
          .revenue-header
            .col-source Source
            .col-amount Total
            .col-amount Change
            .col-amount Fees
            .col-amount Net

          template(v-for="source in group.sources" :key="source")
            .revenue-row
              .col-source {{ REVENUE_SOURCE_LABELS[source] }}
              .col-amount
                input.amount-input(
                  v-model="getRevenue(source).total"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                )
              .col-amount
                input.amount-input(
                  v-if="source.endsWith('_cash')"
                  v-model="getRevenue(source).change_money"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                )
                span.no-field(v-else) —
              .col-amount
                input.amount-input(
                  v-model="getRevenue(source).fees"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                )
              .col-amount.col-computed {{ formatCurrency(revenueNet(getRevenue(source))) }}
            template(v-if="source === 'vvk_pretix' && pretixData")
              .revenue-row.sub-row(v-for="(info, src) in pretixData.by_source" :key="src")
                .col-source.sub-source {{ src === 'vvk_stripe' ? '└ Stripe' : src === 'vvk_paypal' ? '└ PayPal' : '└ ' + src }}
                .col-amount.sub-val {{ info.revenue.toFixed(2) }} €
                .col-amount.sub-val —
                .col-amount.sub-val {{ info.fees.toFixed(2) }} €
                .col-amount.sub-val
              .revenue-row.sub-row
                .col-source.sub-source └ Pretix Fee
                .col-amount.sub-val
                .col-amount.sub-val —
                .col-amount.sub-val {{ pretixData.pretix_fee.toFixed(2) }} €
                .col-amount.sub-val

        .group-total
          span Total {{ group.label }}:
          strong {{ formatCurrency(groupRevenue(group.sources)) }}

      .grand-total
        span Total Revenue:
        strong {{ formatCurrency(totalRevenue) }}

    //- ── Inventory Tab ──
    .tab-content(v-if="activeTab === 'inventory'")
      .section(v-for="(items, group) in inventoryBySupplier" :key="group")
        h3.section-title {{ group }}
        .inventory-table
          .inventory-header
            .col-inv-name.sortable(@click="invSort.toggle('name')") Drink{{ invSort.indicator('name') }}
            .col-inv-info Crate
            .col-inv-pair.sortable(@click="invSort.toggle('before')") Before{{ invSort.indicator('before') }}
            .col-inv-pair.sortable(@click="invSort.toggle('after')") After{{ invSort.indicator('after') }}
            .col-inv-num Total
            .col-inv-num.sortable(@click="invSort.toggle('consumed')") Used{{ invSort.indicator('consumed') }}
            .col-inv-amount.sortable(@click="invSort.toggle('value')") Value{{ invSort.indicator('value') }}

          .inventory-row(v-for="{ beverage, entry } in sortedInventory(items)" :key="beverage.id")
            .col-inv-name
              .bev-name {{ beverage.name }}
              .bev-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}pc · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }} · Dep. {{ formatCurrency(parseFloat(beverage.deposit || '0')) }}
              .bev-info(v-else) Bottle · {{ formatCurrency(parseFloat(beverage.purchase_price || '0')) }}
            .col-inv-info(v-if="(beverage.units_per_crate || 1) > 1") {{ beverage.units_per_crate }}pc
            .col-inv-info(v-else) Btl.

            //- Crate mode (units_per_crate > 1)
            template(v-if="(beverage.units_per_crate || 1) > 1")
              .col-inv-pair
                .crate-input
                  input.qty-input(
                    v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeCrates"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    @input="updateEntryFromCrates(entry, beverage)"
                  )
                  span.input-label K
                .crate-input
                  input.qty-input(
                    v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).beforeBottles"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    @input="updateEntryFromCrates(entry, beverage)"
                  )
                  span.input-label Fl
              .col-inv-pair
                .crate-input
                  input.qty-input(
                    v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterCrates"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    @input="updateEntryFromCrates(entry, beverage)"
                  )
                  span.input-label K
                .crate-input
                  input.qty-input(
                    v-model.number="getOrInitCrateState(beverage.id, beverage.units_per_crate || 1, entry).afterBottles"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    @input="updateEntryFromCrates(entry, beverage)"
                  )
                  span.input-label Fl

            //- Bottle mode (units_per_crate = 1)
            template(v-else)
              .col-inv-pair.bottle-mode
                input.qty-input(
                  v-model="entry.quantity_before"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                )
                span.input-label Fl.
              .col-inv-pair.bottle-mode
                input.qty-input(
                  v-model="entry.quantity_after"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                )
                span.input-label Fl.

            .col-inv-num {{ entry.quantity_before }}
            .col-inv-num {{ inventoryConsumption(entry) }}
            .col-inv-amount {{ formatCurrency(inventoryValue(entry, beverage)) }}

        .group-total
          span Subtotal {{ group }}:
          strong {{ formatCurrency(groupInventoryValue(items)) }}

      .grand-total
        div
          span Stock Value (After):
          strong {{ formatCurrency(totalStockValue) }}
        div
          span Stock Deposit Value:
          strong {{ formatCurrency(totalStockDepositValue) }}
        div.separator
        div
          span Total Cost of Goods:
          strong {{ formatCurrency(totalInventoryValue) }}
        div
          span Total Deposit Turnover:
          strong {{ formatCurrency(totalDepositValue) }}

    //- ── Expenses Tab ──
    .tab-content(v-if="activeTab === 'expenses'")
      .expenses-table
        .expense-header
          .col-desc.sortable(@click="expSort.toggle('desc')") Description{{ expSort.indicator('desc') }}
          .col-amount.sortable(@click="expSort.toggle('amount')") Amount{{ expSort.indicator('amount') }}
          .col-from Paid From
          .col-action

        .expense-row(v-for="(exp, index) in sortedExpenses" :key="index")
          .col-desc
            input.text-input(
              v-model="exp.description"
              type="text"
              placeholder="e.g. Rewe, Hotel..."
            )
          .col-amount
            input.amount-input(
              v-model="exp.amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            )
          .col-from
            select.select-input(v-model="exp.paid_from")
              option(v-for="(label, key) in EXPENSE_PAID_FROM_LABELS" :key="key" :value="key")
                | {{ label }}
          .col-action
            button.btn-remove(@click="removeExpense(index)") ×

      button.btn-add(@click="addExpense") + Add Expense

      .grand-total
        span Total Expenses:
        strong {{ formatCurrency(totalExpenses) }}

    //- ── Result Tab ──
    .tab-content(v-if="activeTab === 'result'")

      //- Revenue breakdown
      h3.section-title Revenue
      .result-detail
        template(v-for="rev in revenues" :key="rev.source")
          .detail-row(v-if="revenueNet(rev) !== 0")
            span {{ REVENUE_SOURCE_LABELS[rev.source] }}
            span.amount {{ formatCurrency(revenueNet(rev)) }}
        .detail-row(v-if="expensesPaidFromRegister > 0")
          span + Paid out from registers
          span.amount {{ formatCurrency(expensesPaidFromRegister) }}
        .detail-row.detail-total
          span True Revenue
          strong.positive {{ formatCurrency(adjustedRevenue) }}

      //- Cost of goods breakdown
      h3.section-title Cost of Goods
      .result-detail
        template(v-for="(items, group) in inventoryBySupplier" :key="group")
          .detail-row(v-if="groupInventoryValue(items) !== 0")
            span {{ group }}
            span.amount -{{ formatCurrency(groupInventoryValue(items)) }}
        .detail-row.detail-total
          span Total Cost of Goods
          strong.negative {{ formatCurrency(totalInventoryValue) }}

      //- Expenses breakdown
      h3.section-title Expenses
      .result-detail
        template(v-for="exp in expenses" :key="exp.description")
          .detail-row(v-if="parseFloat(exp.amount || '0') !== 0")
            span {{ exp.description || '(no description)' }}
            span.amount {{ formatCurrency(parseFloat(exp.amount || '0')) }}
        .detail-row.detail-total
          span Total Expenses
          strong.negative {{ formatCurrency(totalExpenses) }}

      //- Final result
      .result-summary
        .result-row
          span Revenue (counted)
          strong {{ formatCurrency(totalRevenue) }}
        .result-row(v-if="expensesPaidFromRegister > 0")
          span + Paid from registers
          strong {{ formatCurrency(expensesPaidFromRegister) }}
        .result-row
          span = True Revenue
          strong.positive {{ formatCurrency(adjustedRevenue) }}
        .result-row
          span − Cost of Goods
          strong.negative {{ formatCurrency(totalInventoryValue) }}
        .result-row
          span − Expenses
          strong.negative {{ formatCurrency(totalExpenses) }}
        .result-row
          span Deposit Return
          .input-inline
            input.amount-input(
              v-model="depositReturn"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            )
            span.unit €
        .result-row.result-total
          span Result
          strong(:class="result >= 0 ? 'positive' : 'negative'")
            | {{ formatCurrency(result) }}

      h3.section-title Profit Split
      .splits-table
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

      button.btn-add(@click="addSplit") + Add Split

      .splits-summary(v-if="splits.length")
        .result-row
          span Total Distributed ({{ totalSplitPercentage.toFixed(1) }}%)
          strong {{ formatCurrency(result - remainingAfterSplits) }}
        .result-row.result-total
          span Remaining
          strong(:class="remainingAfterSplits >= 0 ? 'positive' : 'negative'")
            | {{ formatCurrency(remainingAfterSplits) }}

      .notes-section
        h3.section-title Notes
        textarea.notes-input(
          v-model="accounting.notes"
          placeholder="Notes about this accounting..."
          rows="4"
        )
</template>

<style scoped>
.accounting-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.loading {
  padding: 3rem;
  text-align: center;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  text-decoration: none;
  color: black;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-back:hover {
  background: black;
  color: white;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.save-success {
  color: black;
  font-weight: 900;
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
}

.btn-save {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.1em;
  transition: filter 0.2s;
}

.btn-save:hover {
  filter: brightness(120%);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  gap: 0;
  margin-bottom: 0;
  border-bottom: 0.25rem solid black;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  border-bottom: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s;
  margin-bottom: -0.25rem;
}

.tab:hover {
  background: #f5f5f5;
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

.pretix-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: black;
  padding: 0 1rem 0 0;
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

/* ── Revenue Table ── */

.revenue-table {
  border: 0.25rem solid black;
  border-top: none;
}

.revenue-header, .revenue-row {
  display: grid;
  grid-template-columns: 180px 1fr 1fr 1fr 120px;
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
  border-bottom: 1px solid black;
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

.sub-source {
  padding-left: 1rem;
}

.sub-val {
  font-variant-numeric: tabular-nums;
}

/* ── Inventory Table ── */

.inventory-table {
  border: 0.25rem solid black;
  border-top: none;
}

.inventory-header, .inventory-row {
  display: grid;
  grid-template-columns: 1fr 50px 160px 160px 60px 60px 90px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
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
  gap: 0.25rem;
}

.crate-input {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 1;
}

.crate-input .qty-input {
  width: 100%;
  min-width: 0;
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
  gap: 0.25rem;
}

.bottle-mode .qty-input {
  flex: 1;
  min-width: 0;
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
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 0.85rem;
}

.col-inv-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.inventory-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.inventory-row {
  border-bottom: 1px solid black;
}

.inventory-row:last-child {
  border-bottom: none;
}

/* ── Expenses Table ── */

.expenses-table {
  border: 0.25rem solid black;
  margin-bottom: 1rem;
}

.expense-header, .expense-row {
  display: grid;
  grid-template-columns: 1fr 120px 150px 40px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
}

.expense-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.expense-row {
  border-bottom: 1px solid black;
}

.expense-row:last-child {
  border-bottom: none;
}

/* ── Splits Table ── */

.splits-table {
  border: 0.25rem solid black;
  margin-bottom: 1rem;
}

.split-row {
  display: grid;
  grid-template-columns: 1fr 120px 120px 40px;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  align-items: center;
  border-bottom: 1px solid black;
}

.split-row:last-child {
  border-bottom: none;
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

.col-desc, .col-from, .col-action, .col-pct {
  font-size: 0.9rem;
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
}

.text-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
}

.select-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  background: white;
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
  border: 0.25rem solid black;
  border-top: none;
  font-size: 0.95rem;
}

.grand-total {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: black;
  color: white;
  font-size: 1.1rem;
  margin-top: 1rem;
}

.grand-total > div, .grand-total > span {
  display: flex;
  justify-content: space-between;
}

.grand-total .separator {
  border-top: 1px solid rgba(255,255,255,0.3);
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

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.detail-total {
  background: black;
  color: white;
  font-size: 0.95rem;
  border-bottom: none;
}

.result-summary {
  border: 0.25rem solid black;
  margin-bottom: 2rem;
  margin-top: 1.5rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid black;
  font-size: 1rem;
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
}
</style>
