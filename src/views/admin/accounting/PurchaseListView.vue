<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { purchaseService, beverageService, stockService } from '@/services'
import type { Purchase, StockEntry } from '@/types/accounting'
import type { BeverageItem } from '@/types/accounting'


const purchases = ref<Purchase[]>([])
const beverages = ref<BeverageItem[]>([])
const stockEntries = ref<StockEntry[]>([])
const isLoading = ref(false)
const error = ref('')
const showStock = ref(true)

const sortedPurchases = computed(() => {
  return [...purchases.value].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function itemCount(purchase: Purchase): number {
  return purchase.items?.length ?? 0
}

function beverageName(id: number): string {
  const b = beverages.value.find(bev => bev.id === id)
  return b?.name ?? `#${id}`
}

function formatCurrency(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatTotal(p: Purchase): string {
  return formatCurrency(parseFloat(p.invoice_total || '0'))
}

function itemLabel(p: Purchase): string {
  const n = itemCount(p)
  return `${n} Artikel`
}

// ── Stock computeds ──────────────────────────────────────────────
const stockWithQty = computed(() =>
  stockEntries.value.filter(e => (e.quantity || 0) > 0)
)

const stockGrouped = computed(() => {
  const groups: Record<string, StockEntry[]> = {}
  for (const e of stockWithQty.value) {
    const key = e.supplier_group || 'Sonstige'
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
})

const totalStockValue = computed(() =>
  stockWithQty.value.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0)
)

const totalDepositValue = computed(() =>
  stockWithQty.value.reduce((s, e) => s + parseFloat(e.deposit_value || '0'), 0)
)

function formatPrice(val: string | number): string {
  return formatCurrency(parseFloat(String(val) || '0'))
}

function groupQuantity(items: StockEntry[]): number {
  return items.reduce((s, e) => s + (e.quantity || 0), 0)
}

function groupStockValue(items: StockEntry[]): number {
  return items.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0)
}

async function deletePurchase(id: number) {
  if (!confirm('Diesen Einkauf löschen?')) return
  try {
    await purchaseService.delete(id)
    purchases.value = purchases.value.filter(p => p.id !== id)
  } catch (e: any) {
    alert('Fehler: ' + e.message)
  }
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    const [purData, bevData, stockData] = await Promise.all([
      purchaseService.getAll(),
      beverageService.getAll(),
      stockService.getAll(),
    ])
    purchases.value = purData.results
    beverages.value = bevData.results
    stockEntries.value = stockData
  } catch (e: any) {
    error.value = e.message || 'Daten konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.purchase-list-view
  .header
    h2 Einkäufe & Lager
    .header-actions
      router-link.btn-primary(to="/admin/purchases/create") + Neuer Einkauf

  //- ── Stock Summary ──
  .stock-section
    .stock-header(@click="showStock = !showStock")
      h3 Lagerbestand
      .stock-totals(v-if="stockWithQty.length")
        span.summary-item Wert: {{ formatPrice(totalStockValue) }}
        span.summary-item Pfand: {{ formatPrice(totalDepositValue) }}
      span.stock-empty(v-else) Leer
      span.toggle {{ showStock ? '▲' : '▼' }}

    template(v-if="showStock")
      template(v-if="stockWithQty.length")
        .stock-group(v-for="(items, groupName) in stockGrouped" :key="groupName")
          h4.group-title {{ groupName }}
          .stock-table
            .table-header
              span.col-name Getränk
              span.col-size Fl.
              span.col-stock Bestand
              span.col-value Wert
            .table-row(v-for="(item, idx) in items" :key="item.id" :class="{ 'row-even': idx % 2 === 1 }")
              span.col-name {{ item.name }}
              span.col-size {{ item.bottle_size ? item.bottle_size + 'L' : '' }}
              .col-stock
                span.stock-qty {{ item.quantity }}
                span.stock-hint(v-if="item.crates") ({{ item.crates }}×{{ item.units_per_crate }}er{{ item.loose_bottles ? ' +' + item.loose_bottles : '' }})
              span.col-value {{ formatPrice(item.stock_value) }}
            .table-row.row-subtotal
              span.col-name Σ {{ groupName }}
              span.col-size
              .col-stock
                span.stock-qty {{ groupQuantity(items) }}
              span.col-value {{ formatPrice(groupStockValue(items)) }}

        .stock-table.total-table
          .table-row.row-total
            span.col-name Gesamt
            span.col-size
            .col-stock
              span.stock-qty {{ stockWithQty.reduce((s, e) => s + (e.quantity || 0), 0) }}
            span.col-value {{ formatPrice(totalStockValue) }}

      .stock-empty-message(v-else)
        | Lager ist leer — noch keine Einkäufe vorhanden.

  .loading(v-if="isLoading") Laden...
  .error(v-else-if="error") {{ error }}

  .purchases-container(v-else-if="sortedPurchases.length")
    .purchase-card(v-for="p in sortedPurchases" :key="p.id")
      .purchase-header
        .purchase-date {{ formatDate(p.date) }}

      h3.purchase-title {{ p.supplier || 'Kein Lieferant' }}
      .purchase-meta(v-if="p.invoice_number")
        | Rechnung: {{ p.invoice_number }}

      .purchase-items(v-if="p.items?.length")
        span {{ itemLabel(p) }}
        |  · Gesamt: {{ formatTotal(p) }}

      .purchase-footer
        .purchase-actions
          router-link.btn-edit(:to="`/admin/purchases/${p.id}`") Öffnen
          button.btn-delete(@click="deletePurchase(p.id)") Löschen

  .empty(v-else) Keine Einkäufe gefunden
</template>

<style scoped>
.purchase-list-view {
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

.purchases-container {
  display: grid;
  gap: 1.5rem;
}

.purchase-card {
  padding: 1.5rem;
  border: 0.25rem solid black;
  transition: all 0.2s;
}

.purchase-card:hover {
  transform: rotate(-0.3deg);
}

.purchase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.purchase-date {
  font-size: 0.875rem;
  color: black;
  font-weight: 600;
}

.purchase-title {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: black;
  font-weight: 900;
}

.purchase-meta {
  font-size: 0.875rem;
  color: black;
  margin-bottom: 0.5rem;
}

.purchase-items {
  font-size: 0.875rem;
  color: black;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.purchase-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.purchase-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-edit {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: black;
  color: white;
}

.btn-delete {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: black;
  color: white;
}

/* ── Stock Section ── */

.stock-section {
  margin-bottom: 2rem;
  border: 0.25rem solid black;
}

.stock-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: black;
  color: white;
  cursor: pointer;
  user-select: none;
}

.stock-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 900;
}

.stock-empty {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.7;
}

.stock-empty-message {
  padding: 1.5rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}

.stock-totals {
  display: flex;
  gap: 1rem;
  margin-left: auto;
}

.summary-item {
  font-weight: 900;
  font-size: 0.85rem;
}

.toggle {
  font-size: 0.75rem;
}

.stock-group {
  margin: 0;
}

.group-title {
  font-size: 0.9rem;
  font-weight: 900;
  padding: 0.4rem 1rem;
  background: #333;
  color: white;
  margin: 0;
}

.stock-table {
  width: 100%;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1fr 50px 150px 90px;
  gap: 0.75rem;
  padding: 0.35rem 1rem;
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
.col-value {
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
  font-size: 0.7rem;
  font-weight: 400;
}

.row-total .stock-hint {
  color: #ccc;
}
</style>
