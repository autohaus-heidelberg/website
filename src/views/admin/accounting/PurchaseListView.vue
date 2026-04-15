<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { purchaseService, beverageService } from '@/services'
import type { Purchase } from '@/types/accounting'
import type { BeverageItem } from '@/types/accounting'

const purchases = ref<Purchase[]>([])
const beverages = ref<BeverageItem[]>([])
const isLoading = ref(false)
const error = ref('')

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

function statusLabel(status: string): string {
  return status === 'final' ? 'Finalized' : 'Draft'
}

function statusClass(status: string): string {
  return status === 'final' ? 'status-final' : 'status-draft'
}

function itemCount(purchase: Purchase): number {
  return purchase.items?.length ?? 0
}

function beverageName(id: number): string {
  const b = beverages.value.find(bev => bev.id === id)
  return b?.name ?? `#${id}`
}

function formatTotal(p: Purchase): string {
  return parseFloat(p.invoice_total || '0').toFixed(2)
}

function itemLabel(p: Purchase): string {
  const n = itemCount(p)
  return `${n} item${n !== 1 ? 's' : ''}`
}

async function deletePurchase(id: number) {
  if (!confirm('Delete this purchase?')) return
  try {
    await purchaseService.delete(id)
    purchases.value = purchases.value.filter(p => p.id !== id)
  } catch (e: any) {
    alert('Error: ' + e.message)
  }
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    const [purData, bevData] = await Promise.all([
      purchaseService.getAll(),
      beverageService.getAll(),
    ])
    purchases.value = purData.results
    beverages.value = bevData.results
  } catch (e: any) {
    error.value = e.message || 'Failed to load data'
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
    h2 Purchases
    .header-actions
      router-link.btn-primary(to="/admin/purchases/create") + New Purchase

  .loading(v-if="isLoading") Loading...
  .error(v-else-if="error") {{ error }}

  .purchases-container(v-else-if="sortedPurchases.length")
    .purchase-card(v-for="p in sortedPurchases" :key="p.id")
      .purchase-header
        .purchase-date {{ formatDate(p.date) }}
        span.status-badge(:class="statusClass(p.status)")
          | {{ statusLabel(p.status) }}

      h3.purchase-title {{ p.supplier || 'No Supplier' }}
      .purchase-meta(v-if="p.invoice_number")
        | Invoice: {{ p.invoice_number }}

      .purchase-items(v-if="p.items?.length")
        span {{ itemLabel(p) }}
        |  · Gesamt: {{ formatTotal(p) }} €

      .purchase-footer
        .purchase-actions
          router-link.btn-edit(:to="`/admin/purchases/${p.id}`") Open
          button.btn-delete(v-if="p.status === 'draft'" @click="deletePurchase(p.id)") Delete

  .empty(v-else) No purchases found
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

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.status-draft {
  background: black;
  color: white;
}

.status-final {
  background: black;
  color: white;
  text-decoration: underline;
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
</style>
