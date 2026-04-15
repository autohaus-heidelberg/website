<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { stockService } from '@/services'
import type { StockEntry } from '@/types/accounting'

const entries = ref<StockEntry[]>([])
const isLoading = ref(false)
const error = ref('')

const grouped = computed(() => {
  const groups: Record<string, StockEntry[]> = {}
  for (const e of entries.value) {
    const key = e.supplier_group || 'Sonstige'
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
})

const totalStockValue = computed(() => {
  return entries.value
    .reduce((sum, e) => sum + parseFloat(e.stock_value || '0'), 0)
    .toFixed(2)
})

const totalDepositValue = computed(() => {
  return entries.value
    .reduce((sum, e) => sum + parseFloat(e.deposit_value || '0'), 0)
    .toFixed(2)
})

function formatPrice(val: string | number): string {
  return parseFloat(String(val) || '0').toFixed(2)
}

function groupStockValue(items: StockEntry[]): number {
  return items.reduce((sum, e) => sum + parseFloat(e.stock_value || '0'), 0)
}

function groupDepositValue(items: StockEntry[]): number {
  return items.reduce((sum, e) => sum + parseFloat(e.deposit_value || '0'), 0)
}

function groupQuantity(items: StockEntry[]): number {
  return items.reduce((sum, e) => sum + (e.quantity || 0), 0)
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    entries.value = await stockService.getAll()
  } catch (e: any) {
    error.value = e.message || 'Bestand konnte nicht geladen werden'
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
    h2 Bestand
    .header-summary
      span.summary-item Warenwert: {{ totalStockValue }} €
      span.summary-item Pfand: {{ totalDepositValue }} €

  .loading(v-if="isLoading") Lade Bestand...
  .error(v-else-if="error") {{ error }}

  template(v-else)
    .group(v-for="(items, groupName) in grouped" :key="groupName")
      h3.group-title {{ groupName }}
      .stock-table
        .table-header
          span.col-name Getränk
          span.col-size Fl.
          span.col-stock Bestand
          span.col-value Warenwert
          span.col-deposit Pfand
        .table-row(v-for="(item, idx) in items" :key="item.id" :class="{ 'row-even': idx % 2 === 1 }")
          span.col-name {{ item.name }}
          span.col-size(v-if="item.bottle_size") {{ item.bottle_size }}L
          span.col-size(v-else)
          .col-stock
            span.stock-qty {{ item.quantity }}
            span.stock-hint(v-if="item.crates") ({{ item.crates }}×{{ item.units_per_crate }}er{{ item.loose_bottles ? ' +' + item.loose_bottles : '' }})
          span.col-value {{ formatPrice(item.stock_value) }} €
          span.col-deposit {{ formatPrice(item.deposit_value) }} €
        .table-row.row-subtotal
          span.col-name Summe {{ groupName }}
          span.col-size
          .col-stock
            span.stock-qty {{ groupQuantity(items) }}
          span.col-value {{ formatPrice(groupStockValue(items)) }} €
          span.col-deposit {{ formatPrice(groupDepositValue(items)) }} €

    .stock-table.total-table(v-if="entries.length")
      .table-row.row-total
        span.col-name Gesamt
        span.col-size
        .col-stock
          span.stock-qty {{ entries.reduce((s, e) => s + (e.quantity || 0), 0) }}
        span.col-value {{ totalStockValue }} €
        span.col-deposit {{ totalDepositValue }} €

    .empty(v-if="entries.length === 0") Keine Bestandsdaten vorhanden
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

.header-summary {
  display: flex;
  gap: 1.5rem;
}

.summary-item {
  font-weight: 900;
  font-size: 0.95rem;
  padding: 0.375rem 0.75rem;
  border: 0.25rem solid black;
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.group {
  margin-bottom: 2rem;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  margin-bottom: 0;
}

.stock-table {
  width: 100%;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1fr 50px 170px 90px 90px;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
}

.table-header {
  border-bottom: 0.25rem solid black;
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  border-bottom: 1px solid black;
  font-weight: 600;
  font-size: 0.875rem;
}

.row-even {
  background: #f0f0f0;
}

.table-row:hover {
  background: #e0e0e0;
}

.row-subtotal {
  font-weight: 900;
  border-bottom: 0.25rem solid black;
  border-top: 0.15rem solid black;
  background: #f5f5f5;
}

.row-total {
  font-weight: 900;
  font-size: 1rem;
  border: 0.25rem solid black;
  padding: 0.75rem 0;
  background: black;
  color: white;
}

.total-table {
  margin-top: 1rem;
}

.col-size,
.col-stock,
.col-value,
.col-deposit {
  text-align: right;
}

.col-stock {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.35rem;
}

.stock-qty {
  font-weight: 700;
}

.stock-hint {
  color: #999;
  font-size: 0.75rem;
  font-weight: 400;
}

.row-total .stock-hint {
  color: #ccc;
}
</style>
