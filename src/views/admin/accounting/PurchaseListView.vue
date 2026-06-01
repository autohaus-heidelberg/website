<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { purchaseService } from '@/services'
import type { Purchase } from '@/types/accounting'


const purchases = ref<Purchase[]>([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

const sortedPurchases = computed(() => {
  let list = [...purchases.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.supplier.toLowerCase().includes(q) ||
      p.invoice_number.toLowerCase().includes(q) ||
      p.date.includes(q)
    )
  }
  return list.sort(
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
    const purData = await purchaseService.getAll()
    purchases.value = purData.results
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
  .purchase-toolbar
    input.search-input(
      v-model="searchQuery"
      type="text"
      placeholder="Einkäufe suchen..."
    )

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
          button.btn-delete(@click="deletePurchase(p.id)") Einkauf löschen

  .empty(v-else) Keine Einkäufe gefunden
</template>

<style scoped>
.purchase-list-view {
  background: white;
}

.purchase-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
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
  border: 0.25rem solid #c00;
  background: white;
  color: #c00;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #c00;
  color: white;
}
</style>
