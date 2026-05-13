<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { grantService } from '@/services'
import type { GrantApplication } from '@/types/accounting'

const grants = ref<GrantApplication[]>([])
const isLoading = ref(true)
const selectedYear = ref(new Date().getFullYear())

const years = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => current - i)
})

const filteredGrants = computed(() => {
  return grants.value.filter(g => {
    if (!g.event_date) return false
    return new Date(g.event_date).getFullYear() === selectedYear.value
  })
})

const totalRequested = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.requested_amount || '0'), 0)
)

const totalApproved = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.approved_amount || '0'), 0)
)

const totalAuszahlung = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.auszahlung_amount || '0'), 0)
)

function formatCurrency(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('de-DE')
}

async function downloadAntrag(grant: GrantApplication) {
  if (!grant.id) return
  await grantService.downloadAntrag(grant.id, grant.event_title || grant.event)
}

onMounted(async () => {
  try {
    const { results } = await grantService.getAll()
    grants.value = results
  } finally {
    isLoading.value = false
  }
})
</script>

<template lang="pug">
.grant-overview
  .page-header
    h2 🏛️ Förderübersicht
    .year-selector
      button.year-btn(
        v-for="year in years"
        :key="year"
        :class="{ active: selectedYear === year }"
        @click="selectedYear = year"
      ) {{ year }}

  .loading(v-if="isLoading") Wird geladen...

  template(v-else)
    .summary-cards
      .card
        .card-label Anträge
        .card-value {{ filteredGrants.length }}
      .card
        .card-label Beantragt
        .card-value {{ formatCurrency(totalRequested) }}
      .card
        .card-label Bewilligt
        .card-value {{ formatCurrency(totalApproved) }}
      .card
        .card-label Ausgezahlt
        .card-value {{ formatCurrency(totalAuszahlung) }}

    .grants-table(v-if="filteredGrants.length")
      table
        thead
          tr
            th Datum
            th Veranstaltung
            th Beantragt
            th Bewilligt
            th Ausgezahlt
            th Bescheid
            th Abrechnung
            th
        tbody
          tr(v-for="g in filteredGrants" :key="g.id")
            td {{ formatDate(g.event_date) }}
            td
              router-link(:to="`/admin/events/${g.event}?tab=accounting`") {{ g.event_title }}
            td.amount {{ formatCurrency(parseFloat(g.requested_amount || '0')) }}
            td.amount {{ g.approved_amount ? formatCurrency(parseFloat(g.approved_amount)) : '—' }}
            td.amount {{ g.auszahlung_amount ? formatCurrency(parseFloat(g.auszahlung_amount)) : '—' }}
            td {{ g.zuwendungsbescheid_date || '—' }}
            td
              span.badge(:class="g.has_abrechnung ? 'badge-yes' : 'badge-no'") {{ g.has_abrechnung ? '✓' : '✗' }}
            td
              button.btn-download(@click="downloadAntrag(g)") PDF

    .empty-state(v-else)
      p Keine Förderanträge für {{ selectedYear }}.
</template>

<style scoped>
.grant-overview {
  background: white;
  border: 0.5rem solid black;
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  font-weight: 900;
  margin: 0;
}

.year-selector {
  display: flex;
  gap: 0.25rem;
}

.year-btn {
  padding: 0.4rem 0.75rem;
  border: none;
  background: #f0f0f0;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.year-btn.active {
  background: black;
  color: white;
}

.year-btn:hover:not(.active) {
  background: #ddd;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.card {
  border: 0.2rem solid black;
  padding: 1rem;
  text-align: center;
}

.card-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 1.25rem;
  font-weight: 900;
}

.grants-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

thead th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: black;
  color: white;
  font-weight: 600;
  font-size: 0.8rem;
}

tbody tr {
  border-bottom: 1px solid #eee;
}

tbody tr:hover {
  background: #f9f9f9;
}

tbody td {
  padding: 0.5rem 0.75rem;
}

td.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 2px;
}

.badge-yes {
  background: black;
  color: white;
}

.badge-no {
  background: #f0f0f0;
  color: #999;
}

.btn-download {
  padding: 0.25rem 0.5rem;
  border: 0.15rem solid black;
  background: white;
  color: black;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-download:hover {
  background: black;
  color: white;
}

.loading, .empty-state {
  padding: 2rem;
  text-align: center;
  color: #555;
}
</style>
