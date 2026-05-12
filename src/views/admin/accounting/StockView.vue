<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { stockService } from '@/services'
import type { StockEntry } from '@/types/accounting'

const stockEntries = ref<StockEntry[]>([])
const isLoading = ref(false)
const error = ref('')
const showEmpty = ref(false)
const searchQuery = ref('')

const visibleEntries = computed(() => {
  let entries = stockEntries.value
  if (!showEmpty.value) {
    entries = entries.filter(e => (e.quantity || 0) > 0)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    entries = entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.supplier_group.toLowerCase().includes(q)
    )
  }
  return entries
})

const stockGrouped = computed(() => {
  const groups: Record<string, StockEntry[]> = {}
  for (const e of visibleEntries.value) {
    const key = e.supplier_group || 'Sonstige'
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
})

const totalQuantity = computed(() =>
  visibleEntries.value.reduce((s, e) => s + (e.quantity || 0), 0)
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

function groupQuantity(items: StockEntry[]): number {
  return items.reduce((s, e) => s + (e.quantity || 0), 0)
}

function groupStockValue(items: StockEntry[]): number {
  return items.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0)
}

function groupDepositValue(items: StockEntry[]): number {
  return items.reduce((s, e) => s + parseFloat(e.deposit_value || '0'), 0)
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

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.stock-view
  .header
    h2 Lagerbestand
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Getränk suchen..."
      )
      label.toggle-empty
        input(type="checkbox" v-model="showEmpty")
        |  Leere anzeigen
      router-link.btn-primary(to="/admin/purchases/create") + Neuer Einkauf

  .loading(v-if="isLoading") Lagerbestand wird geladen...
  .error(v-else-if="error") {{ error }}

  template(v-else)
    .summary-bar(v-if="visibleEntries.length")
      .summary-item
        .summary-value {{ totalQuantity }}
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
      .stock-group(v-for="(items, groupName) in stockGrouped" :key="groupName")
        h3.group-title {{ groupName }}
        .stock-table
          .table-header
            span.col-name Getränk
            span.col-size Flasche
            span.col-stock Bestand
            span.col-fifo FIFO-Preis
            span.col-deposit Pfand
            span.col-value Warenwert
            span.col-deposit-val Pfandwert
          .table-row(v-for="(item, idx) in items" :key="item.id" :class="{ 'row-even': idx % 2 === 1, 'row-empty': item.quantity === 0 }")
            span.col-name {{ item.name }}
            span.col-size {{ item.bottle_size ? item.bottle_size + 'L' : '—' }}
            .col-stock
              span.stock-qty {{ item.quantity }}
              span.stock-hint(v-if="item.crates && item.quantity > 0")
                | ({{ item.crates }}×{{ item.units_per_crate }}{{ item.loose_bottles ? ' +' + item.loose_bottles : '' }})
            span.col-fifo {{ formatPrice(item.fifo_price) }}
            span.col-deposit {{ formatPrice(item.deposit) }}
            span.col-value {{ formatPrice(item.stock_value) }}
            span.col-deposit-val {{ formatPrice(item.deposit_value) }}
          .table-row.row-subtotal
            span.col-name Σ {{ groupName }}
            span.col-size
            .col-stock
              span.stock-qty {{ groupQuantity(items) }}
            span.col-fifo
            span.col-deposit
            span.col-value {{ formatPrice(groupStockValue(items)) }}
            span.col-deposit-val {{ formatPrice(groupDepositValue(items)) }}

      .stock-table.total-table
        .table-row.row-total
          span.col-name Gesamt
          span.col-size
          .col-stock
            span.stock-qty {{ totalQuantity }}
          span.col-fifo
          span.col-deposit
          span.col-value {{ formatPrice(totalStockValue) }}
          span.col-deposit-val {{ formatPrice(totalDepositValue) }}

    .empty(v-else) Keine Getränke im Lager{{ showEmpty ? '' : ' — aktiviere "Leere anzeigen" für alle Getränke' }}
</template>

<style scoped>
.stock-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 180px;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.toggle-empty {
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 900;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
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
  font-size: 0.9rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: #333;
  color: white;
  margin: 0;
}

.stock-table {
  width: 100%;
  overflow-x: auto;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1fr 60px 130px 90px 80px 90px 90px;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  align-items: center;
}

.table-header {
  border-bottom: 2px solid black;
  font-weight: 900;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  border-bottom: 1px solid #ddd;
  font-size: 0.85rem;
}

.row-even {
  background: #f5f5f5;
}

.row-empty {
  opacity: 0.4;
}

.row-subtotal {
  font-weight: 900;
  border-bottom: 2px solid black;
  background: #eee;
  font-size: 0.85rem;
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

.col-size,
.col-stock,
.col-fifo,
.col-deposit,
.col-value,
.col-deposit-val {
  text-align: right;
}

.col-name {
  font-weight: 600;
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

@media (max-width: 900px) {
  .table-header,
  .table-row {
    grid-template-columns: 1fr 50px 100px 80px 70px 80px 80px;
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
    grid-template-columns: 1fr 80px 80px;
  }

  .col-fifo, .col-deposit, .col-deposit-val, .col-size {
    display: none;
  }
}
</style>
