<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eventService, accountingService, grantService, type Event } from '@/services'
import type { EventAccounting, GrantApplication } from '@/types/accounting'
import type { PaginatedResponse } from '@/types/api'

const route = useRoute()
const eventsData = ref<PaginatedResponse<Event> | null>(null)
const accountings = ref<EventAccounting[]>([])
const grants = ref<GrantApplication[]>([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')
const activeFilter = ref<'all' | 'with' | 'none'>('all')
const activeView = ref<'events' | 'grants'>('events')
const selectedYear = ref(new Date().getFullYear())

// Undo delete
const pendingDelete = ref<{ event: Event; timer: ReturnType<typeof setTimeout> } | null>(null)

const filters = [
  { key: 'all' as const, label: 'Alle' },
  { key: 'with' as const, label: 'Mit Abrechnung' },
  { key: 'none' as const, label: 'Ohne Abrechnung' },
]

const events = computed(() => eventsData.value?.results || [])

const eventsWithAccounting = computed(() => {
  return events.value.map(event => {
    const accounting = accountings.value.find(a => a.event === event.id)
    return { ...event, accounting }
  })
})

const filteredEvents = computed(() => {
  let list = eventsWithAccounting.value

  if (activeFilter.value === 'with') {
    list = list.filter(e => !!e.accounting)
  } else if (activeFilter.value === 'none') {
    list = list.filter(e => !e.accounting)
  }

  if (!searchQuery.value) return list

  const query = searchQuery.value.toLowerCase()
  return list.filter(event =>
    event.title.toLowerCase().includes(query) ||
    event.id.toLowerCase().includes(query) ||
    event.artists.some(a => a.name.toLowerCase().includes(query))
  )
})

function filterCount(key: string) {
  const list = eventsWithAccounting.value
  if (key === 'all') return list.length
  if (key === 'with') return list.filter(e => !!e.accounting).length
  if (key === 'none') return list.filter(e => !e.accounting).length
  return 0
}

async function loadEvents() {
  isLoading.value = true
  error.value = ''

  try {
    const [evData, accData] = await Promise.all([
      eventService.getAll(),
      accountingService.getAll(),
    ])
    eventsData.value = evData
    accountings.value = accData.results
  } catch (e: any) {
    error.value = e.message || 'Failed to load events'
  } finally {
    isLoading.value = false
  }
}



async function deleteEvent(event: Event) {
  if (!confirm(`Veranstaltung "${event.title}" wirklich löschen?`)) return

  // Remove from UI immediately
  if (eventsData.value) {
    eventsData.value.results = eventsData.value.results.filter(e => e.id !== event.id)
    eventsData.value.count--
  }

  // Cancel any previous pending delete
  if (pendingDelete.value) {
    clearTimeout(pendingDelete.value.timer)
    await commitDelete(pendingDelete.value.event)
  }

  // Schedule actual deletion after 5 seconds
  const timer = setTimeout(async () => {
    await commitDelete(event)
    pendingDelete.value = null
  }, 5000)

  pendingDelete.value = { event, timer }
}

function undoDelete() {
  if (!pendingDelete.value) return
  clearTimeout(pendingDelete.value.timer)
  const event = pendingDelete.value.event
  pendingDelete.value = null

  // Re-add to list
  if (eventsData.value) {
    eventsData.value.results.push(event)
    eventsData.value.results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    eventsData.value.count++
  }
}

async function commitDelete(event: Event) {
  try {
    await eventService.delete(event.id)
  } catch (e: any) {
    alert('Fehler beim Löschen: ' + e.message)
    // Re-add on failure
    if (eventsData.value) {
      eventsData.value.results.push(event)
      eventsData.value.count++
    }
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}



// ── Grants ──
const grantYears = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => current - i)
})

const filteredGrants = computed(() => {
  return grants.value.filter(g => {
    if (!g.event_date) return false
    return new Date(g.event_date).getFullYear() === selectedYear.value
  })
})

const grantTotalRequested = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.requested_amount || '0'), 0)
)

const grantTotalApproved = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.approved_amount || '0'), 0)
)

const grantTotalAuszahlung = computed(() =>
  filteredGrants.value.reduce((sum, g) => sum + parseFloat(g.auszahlung_amount || '0'), 0)
)

function formatCurrency(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

async function downloadAntrag(grant: GrantApplication) {
  if (!grant.id) return
  await grantService.downloadAntrag(grant.id, grant.event_title || grant.event)
}

onMounted(() => {
  if (route.query.view === 'grants') {
    activeView.value = 'grants'
  }
  loadEvents()
  grantService.getAll().then(({ results }) => { grants.value = results })
})
</script>

<template lang="pug">
.event-list-view
  .header
    h2 Veranstaltungen
    .tab-bar
      button.tab(:class="{ active: activeView === 'events' }" @click="activeView = 'events'") Veranstaltungen
      button.tab(:class="{ active: activeView === 'grants' }" @click="activeView = 'grants'") Förderungen

  //- ── Events View ──
  template(v-if="activeView === 'events'")
    .toolbar
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Veranstaltungen suchen..."
      )
      router-link.btn-primary(to="/admin/events/create") + Neue Veranstaltung

    .filter-chips
      button.filter-chip(
        v-for="f in filters"
        :key="f.key"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      ) {{ f.label }} ({{ filterCount(f.key) }})

    .loading(v-if="isLoading") Veranstaltungen werden geladen...
    .error(v-else-if="error") {{ error }}

    .events-container(v-else-if="filteredEvents.length > 0")
      .event-card(
        v-for="event in filteredEvents"
        :key="event.id"
        :class="{ 'has-accounting': !!event.accounting }"
        @click="$router.push(`/admin/events/${event.id}`)"
      )
        .event-header
          .event-id {{ event.id }}
          .event-header-right
            span.status-badge(v-if="event.accounting") ✓ Abrechnung
            .event-date {{ formatDate(event.date) }}

        h3.event-title {{ event.title }}

        .event-artists(v-if="event.artists.length")
          span.artist(v-for="artist in event.artists" :key="artist.id || artist.name")
            | {{ artist.name }}

        .event-footer
          .event-meta
            span.fee-group(v-if="event.fee || event.feeAk")
              a(v-if="event.fee && event.shopLink" :href="event.shopLink" target="_blank" class="fee" @click.stop) VVK: {{ event.fee }} €
              span.fee(v-else-if="event.fee") VVK: {{ event.fee }} €
              span.fee-ak(v-if="event.feeAk")  / AK: {{ event.feeAk }} €

          .event-actions(@click.stop)
            router-link.btn-edit(:to="`/admin/events/${event.id}`") Bearbeiten
            router-link.btn-accounting(
              :to="`/admin/events/${event.id}?tab=accounting`"
            ) {{ event.accounting ? 'Abrechnung öffnen' : 'Abrechnung starten' }}

    .empty(v-else) Keine Veranstaltungen gefunden

  //- ── Grants View ──
  template(v-if="activeView === 'grants'")
    .grants-section
      .year-selector
        button.year-btn(
          v-for="year in grantYears"
          :key="year"
          :class="{ active: selectedYear === year }"
          @click="selectedYear = year"
        ) {{ year }}

      .summary-cards
        .card
          .card-label Anträge
          .card-value {{ filteredGrants.length }}
        .card
          .card-label Beantragt
          .card-value {{ formatCurrency(grantTotalRequested) }}
        .card
          .card-label Bewilligt
          .card-value {{ formatCurrency(grantTotalApproved) }}
        .card
          .card-label Ausgezahlt
          .card-value {{ formatCurrency(grantTotalAuszahlung) }}

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
              th Abr.
              th
          tbody
            tr(v-for="g in filteredGrants" :key="g.id")
              td {{ g.event_date ? new Date(g.event_date).toLocaleDateString('de-DE') : '—' }}
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

      .empty(v-else) Keine Förderanträge für {{ selectedYear }}.

  //- ── Undo Snackbar ──
  transition(name="snackbar")
    .undo-snackbar(v-if="pendingDelete")
      span „{{ pendingDelete.event.title }}" gelöscht.
      button.undo-btn(@click="undoDelete") Rückgängig

</template>

<style scoped>
.event-list-view {
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
}

.toolbar {
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
  min-width: 250px;
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

.filter-chips {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 0.4rem 1rem;
  border: 0.2rem solid black;
  background: white;
  color: black;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: -0.2rem;
}

.filter-chip:first-child {
  margin-left: 0;
}

.filter-chip.active {
  background: black;
  color: white;
}

.filter-chip:hover:not(.active) {
  background: #f0f0f0;
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.error {
  color: black;
  background: white;
  border: 0.5rem solid black;
}

.events-container {
  display: grid;
  gap: 1.5rem;
}

.event-card {
  padding: 1.5rem;
  border: 0.25rem solid black;
  transition: all 0.2s;
  transform: rotate(0.5deg);
  border-left: 0.25rem solid black;
  cursor: pointer;
}

.event-card.has-accounting {
  border-left: 0.5rem solid #27ae60;
}

.event-card:hover {
  transform: rotate(-0.5deg);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.event-header-right {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  background: black;
  color: white;
}

.event-id {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: black;
  background: white;
  padding: 0.25rem 0.5rem;
  border: 0.125rem solid black;
}

.event-date {
  font-size: 0.875rem;
  color: black;
  font-weight: 600;
}

.event-title {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: black;
  font-weight: 900;
}

.event-artists {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.artist {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  background: black;
  color: white;
  font-weight: 600;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.event-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.fee {
  font-weight: 600;
  font-size: 0.875rem;
  color: black;
  text-decoration: none;
}

a.fee:hover {
  text-decoration: underline;
}

.fee-ak {
  font-weight: 600;
  font-size: 0.875rem;
  color: black;
}

.event-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-edit, .btn-delete, .btn-accounting, .btn-docs {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-edit {
  background: white;
  color: black;
}

.btn-delete {
  background: white;
  color: #c00;
  border-color: #c00;
}

.btn-delete:hover {
  background: #c00;
  color: white;
}

.btn-accounting {
  background: white;
  color: black;
}

.btn-docs {
  background: white;
  color: black;
}

.btn-edit:hover, .btn-accounting:hover, .btn-docs:hover {
  filter: brightness(120%);
}

/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  gap: 0;
  border: 0.25rem solid black;
}

.tab {
  padding: 0.625rem 1.25rem;
  background: white;
  color: black;
  border: none;
  border-right: 0.25rem solid black;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:last-child {
  border-right: none;
}

.tab:hover {
  background: #f0f0f0;
}

.tab.active {
  background: black;
  color: white;
}

/* ── Grants ── */
.grants-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.year-selector {
  display: flex;
  gap: 0.5rem;
}

.year-btn {
  padding: 0.5rem 1.25rem;
  border: none;
  background: #f0f0f0;
  color: black;
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
}

.summary-cards .card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.card-label {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 1.2rem;
  font-weight: 600;
}

.grants-table {
  overflow-x: auto;
}

.grants-table table {
  width: 100%;
  border-collapse: collapse;
}

.grants-table th,
.grants-table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  font-size: 0.85rem;
}

.grants-table th {
  font-weight: 600;
  color: #555;
  background: #fafafa;
}

.grants-table td.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.grants-table th:nth-child(3),
.grants-table th:nth-child(4),
.grants-table th:nth-child(5) {
  text-align: right;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-yes {
  background: #d1fae5;
  color: #065f46;
}

.badge-no {
  background: #fee2e2;
  color: #991b1b;
}

.btn-download {
  padding: 0.25rem 0.6rem;
  background: black;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-download:hover {
  filter: brightness(120%);
}

/* ── Undo Snackbar ── */
.undo-snackbar {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: black;
  color: white;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 500;
  font-size: 0.9rem;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.undo-btn {
  background: transparent;
  color: white;
  border: 0.15rem solid white;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s;
}

.undo-btn:hover {
  background: white;
  color: black;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}
</style>
