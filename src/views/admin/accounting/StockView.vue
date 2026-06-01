<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { stockService, beverageService } from '@/services'
import type { StockEntry } from '@/types/accounting'
import { useSort } from '@/composables/useSort'

const route = useRoute()
const router = useRouter()
const sort = useSort<StockEntry>()
const stockEntries = ref<StockEntry[]>([])
const isLoading = ref(false)
const error = ref('')
const showInactive = ref(false)
const searchQuery = ref('')

const visibleEntries = computed(() => {
  let entries = stockEntries.value
  if (!showInactive.value) {
    entries = entries.filter(e => e.is_active)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    entries = entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      e.supplier_group.toLowerCase().includes(q)
    )
  }
  return entries
})

const stockByCategory = computed(() => {
  const groups: Record<string, { emoji: string; items: StockEntry[] }> = {}
  for (const e of visibleEntries.value) {
    const cat = e.category || 'Sonstige'
    if (!groups[cat]) groups[cat] = { emoji: e.category_emoji || '📦', items: [] }
    groups[cat].items.push(e)
  }
  for (const key in groups) {
    groups[key].items = sort.sorted(groups[key].items, (item, k) => {
      switch (k) {
        case 'name': return item.name.toLowerCase()
        case 'size': return parseFloat(String(item.bottle_size || '0'))
        case 'stock': return item.quantity || 0
        case 'fifo': return parseFloat(String(item.fifo_price || '0'))
        case 'deposit': return parseFloat(String(item.deposit || '0'))
        case 'value': return parseFloat(String(item.stock_value || '0'))
        case 'deposit-val': return parseFloat(String(item.deposit_value || '0'))
        default: return 0
      }
    })
  }
  // Sort groups alphabetically
  const sorted: Record<string, { emoji: string; items: StockEntry[] }> = {}
  for (const key of Object.keys(groups).sort((a, b) => a.localeCompare(b, 'de'))) {
    sorted[key] = groups[key]
  }
  return sorted
})

const totalQuantity = computed(() =>
  Math.round(visibleEntries.value.reduce((s, e) => s + (e.quantity || 0), 0) * 100) / 100
)

const totalStockValue = computed(() =>
  visibleEntries.value.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0)
)

const totalDepositValue = computed(() =>
  visibleEntries.value.reduce((s, e) => s + parseFloat(e.deposit_value || '0'), 0)
)

function formatCurrency(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatPrice(val: string | number): string {
  return formatCurrency(parseFloat(String(val) || '0'))
}

function formatQty(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '0' : n.toLocaleString('de-DE')
}

function groupQuantity(items: StockEntry[]): string {
  return formatQty(Math.round(items.reduce((s, e) => s + (e.quantity || 0), 0) * 100) / 100)
}

function groupStockValue(items: StockEntry[]): number {
  return items.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0)
}

function groupDepositValue(items: StockEntry[]): number {
  return items.reduce((s, e) => s + parseFloat(e.deposit_value || '0'), 0)
}

function stockLevel(item: StockEntry): string {
  if (item.quantity <= 0) return 'empty'
  if (item.quantity <= 3) return 'low'
  if (item.quantity <= 10) return 'medium'
  return 'full'
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    stockEntries.value = await stockService.getAll()
  } catch (e: any) {
    error.value = e.message || 'Lagerbestand konnte nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

async function toggleActive(item: StockEntry, event: Event) {
  event.stopPropagation()
  const action = item.is_active ? 'deaktivieren' : 'aktivieren'
  if (!confirm(`„${item.name}" ${action}?`)) return
  try {
    await beverageService.update(item.id, { is_active: !item.is_active })
    item.is_active = !item.is_active
  } catch (e: any) {
    alert(e.message || 'Fehler beim Ändern des Status')
  }
}

async function deleteDrink(item: StockEntry, event: Event) {
  event.stopPropagation()
  if (!confirm(`„${item.name}" wirklich löschen?`)) return
  try {
    await beverageService.delete(item.id)
    stockEntries.value = stockEntries.value.filter(e => e.id !== item.id)
  } catch (e: any) {
    const data = e.response?.data || e.data
    if (data?.references) {
      alert(data.error || 'Getränk kann nicht gelöscht werden — es hat Referenzen.')
    } else {
      alert(data?.error || e.message || 'Fehler beim Löschen')
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.stock-view
  .stock-toolbar
    input.search-input(
      v-model="searchQuery"
      type="text"
      placeholder="Getränk suchen..."
    )
    label.toggle-inactive
      input(type="checkbox" v-model="showInactive")
      |  Inaktive anzeigen
    .toolbar-actions
      router-link.btn-secondary(to="/admin/purchases/create") + Neuer Einkauf
      router-link.btn-primary(to="/admin/beverages/create") + Neues Getränk

  .loading(v-if="isLoading") Lagerbestand wird geladen...
  .error(v-else-if="error") {{ error }}

  template(v-else)
    .summary-bar(v-if="visibleEntries.length")
      .summary-item
        .summary-value {{ formatQty(totalQuantity) }}
        .summary-label Flaschen gesamt
      .summary-item
        .summary-value {{ formatPrice(totalStockValue) }}
        .summary-label Warenwert
      .summary-item
        .summary-value {{ formatPrice(totalDepositValue) }}
        .summary-label Pfandwert
      .summary-item
        .summary-value {{ formatPrice(totalStockValue + totalDepositValue) }}
        .summary-label Gesamtwert

    template(v-if="visibleEntries.length")
      .stock-group(v-for="(group, catName) in stockByCategory" :key="catName")
        h3.group-title
          span.group-emoji {{ group.emoji }}
          |  {{ catName }}
          span.group-count ({{ group.items.length }})
        .stock-table
          .table-header
            span.col-status
            span.col-name.sortable(@click="sort.toggle('name')") Getränk{{ sort.indicator('name') }}
            span.col-size.sortable(@click="sort.toggle('size')") Flasche{{ sort.indicator('size') }}
            span.col-stock.sortable(@click="sort.toggle('stock')") Bestand{{ sort.indicator('stock') }}
            span.col-fifo.sortable(@click="sort.toggle('fifo')") FIFO-Preis{{ sort.indicator('fifo') }}
            span.col-deposit.sortable(@click="sort.toggle('deposit')") Pfand{{ sort.indicator('deposit') }}
            span.col-value.sortable(@click="sort.toggle('value')") Warenwert{{ sort.indicator('value') }}
            span.col-deposit-val.sortable(@click="sort.toggle('deposit-val')") Pfandwert{{ sort.indicator('deposit-val') }}
            span.col-actions
          .table-row(
            v-for="(item, idx) in group.items"
            :key="item.id"
            :class="['level-' + stockLevel(item), { 'row-even': idx % 2 === 1, 'row-inactive': !item.is_active, 'on-menu-empty': item.is_active && item.quantity === 0 }]"
            @click="router.push('/admin/beverages/' + item.id)"
            style="cursor: pointer"
          )
            span.col-status
              span.status-dot(:class="'dot-' + stockLevel(item)")
            span.col-name
              | {{ item.name }}
              span.badge-inactive(v-if="!item.is_active")  inaktiv
            span.col-size {{ item.bottle_size ? formatQty(item.bottle_size) + 'L' : '—' }}
            .col-stock
              span.stock-qty {{ formatQty(item.quantity) }}
              span.stock-hint(v-if="item.units_per_crate > 1 && item.crates && item.quantity > 0")
                | ({{ item.crates }}×{{ item.units_per_crate }}{{ item.loose_bottles ? ' +' + item.loose_bottles : '' }})
              span.stock-hint(v-else-if="item.units_per_crate <= 1 && item.quantity > 0")
                | Fl.
            span.col-fifo {{ formatPrice(item.fifo_price) }}
            span.col-deposit {{ formatPrice(item.deposit) }}
            span.col-value {{ formatPrice(item.stock_value) }}
            span.col-deposit-val {{ formatPrice(item.deposit_value) }}
            span.col-actions
              button.action-btn(
                @click="toggleActive(item, $event)"
                :title="item.is_active ? 'Deaktivieren' : 'Aktivieren'"
              ) {{ item.is_active ? '●' : '○' }}
              button.action-btn.action-delete(
                @click="deleteDrink(item, $event)"
                title="Löschen"
              ) ✕
          .table-row.row-subtotal
            span.col-status
            span.col-name {{ group.emoji }} Σ {{ catName }}
            span.col-size
            .col-stock
              span.stock-qty {{ groupQuantity(group.items) }}
            span.col-fifo
            span.col-deposit
            span.col-value {{ formatPrice(groupStockValue(group.items)) }}
            span.col-deposit-val {{ formatPrice(groupDepositValue(group.items)) }}
            span.col-actions

      .stock-table.total-table
        .table-row.row-total
          span.col-status
          span.col-name Gesamt
          span.col-size
          .col-stock
            span.stock-qty {{ formatQty(totalQuantity) }}
          span.col-fifo
          span.col-deposit
          span.col-value {{ formatPrice(totalStockValue) }}
          span.col-deposit-val {{ formatPrice(totalDepositValue) }}
          span.col-actions

    .empty(v-else) Keine Getränke gefunden.
</template>

<style scoped>
.stock-view {
  background: white;
}

.stock-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 180px;
  font-weight: 600;
  flex: 1;
  max-width: 400px;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.toggle-inactive {
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-primary:hover {
  background: #333;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: white;
  color: black;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
  border: 0.2rem solid black;
  cursor: pointer;
  white-space: nowrap;
}

.btn-secondary:hover {
  background: #f0f0f0;
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.error {
  background: white;
  border: 0.5rem solid black;
}

/* Summary */
.summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.25rem;
  background: black;
  color: white;
}

.summary-item {
  text-align: center;
}

.summary-value {
  font-size: 1.4rem;
  font-weight: 900;
}

.summary-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 0.25rem;
}

/* Stock Groups */
.stock-group {
  margin-bottom: 0;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.group-emoji {
  font-size: 1.1rem;
}

.group-count {
  font-weight: 500;
  font-size: 0.75rem;
  opacity: 0.7;
  margin-left: 0.5rem;
}

.stock-table {
  width: 100%;
  overflow-x: auto;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 20px 2.5fr 0.7fr 1.5fr 1.2fr 1fr 1.3fr 1.3fr 60px;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  align-items: center;
}

.table-header {
  border-bottom: 0.25rem solid black;
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable:hover {
  text-decoration: underline;
}

.table-row {
  border-bottom: 1px solid #ddd;
  font-size: 0.875rem;
}

.row-even {
  background: #f0f0f0;
}

.level-empty {
  opacity: 0.4;
}

.level-empty.on-menu-empty {
  opacity: 1;
  background: #fff3e0;
  border-left: 3px solid #e67e22;
}

.row-inactive {
  opacity: 0.45;
}

.row-inactive .col-name {
  font-style: italic;
}

.badge-inactive {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #666;
  color: white;
  padding: 0.1rem 0.35rem;
  margin-left: 0.4rem;
  vertical-align: middle;
}

.level-low {
  background: #fff5f5;
}

.level-low.row-even {
  background: #ffebee;
}

.row-subtotal {
  font-weight: 900;
  border-top: 0.15rem solid black;
  border-bottom: none;
  background: #eee;
  font-size: 0.875rem;
}

.row-total {
  font-weight: 900;
  font-size: 0.95rem;
  background: black;
  color: white;
}

.total-table {
  margin-top: 0;
}

/* Status dot */
.col-status {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-full { background: #4caf50; }
.dot-medium { background: #ff9800; }
.dot-low { background: #f44336; animation: pulse 1.5s infinite; }
.dot-empty { background: #ccc; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.col-size,
.col-stock,
.col-fifo,
.col-deposit,
.col-value,
.col-deposit-val {
  text-align: right;
  white-space: nowrap;
}

.col-name {
  font-weight: 600;
  text-align: left;
}

.table-header .col-name {
  font-weight: 900;
  text-align: left;
}

.stock-qty {
  font-weight: 900;
}

.stock-hint {
  font-size: 0.75rem;
  color: #666;
  margin-left: 0.3rem;
}

.row-total .stock-hint {
  color: #aaa;
}

/* Actions */
.col-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0;
  opacity: 0.4;
  transition: opacity 0.15s;
}

.table-row:hover .action-btn {
  opacity: 1;
}

.action-btn:hover {
  opacity: 1;
}

.action-delete:hover {
  color: #e53935;
}

@media (max-width: 900px) {
  .table-header,
  .table-row {
    grid-template-columns: 16px 2.5fr 0.7fr 1.3fr 1fr 0.9fr 1.2fr 1.2fr 50px;
    font-size: 0.75rem;
    gap: 0.25rem;
    padding: 0.35rem 0.5rem;
  }

  .summary-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .table-header,
  .table-row {
    grid-template-columns: 16px 1fr 80px 50px;
  }

  .col-fifo, .col-deposit, .col-deposit-val, .col-size, .col-value {
    display: none;
  }
}
</style>