<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { eventService, accountingService, type Event } from '@/services'
import type { EventAccounting } from '@/types/accounting'
import type { PaginatedResponse } from '@/types/api'

const router = useRouter()
const eventsData = ref<PaginatedResponse<Event> | null>(null)
const accountings = ref<EventAccounting[]>([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')
const activeFilter = ref<'all' | 'draft' | 'final' | 'none'>('all')

const filters = [
  { key: 'all' as const, label: 'Alle' },
  { key: 'draft' as const, label: 'In Abrechnung' },
  { key: 'final' as const, label: 'Abgeschlossen' },
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

  if (activeFilter.value === 'draft') {
    list = list.filter(e => e.accounting?.status === 'draft')
  } else if (activeFilter.value === 'final') {
    list = list.filter(e => e.accounting?.status === 'final')
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
  if (key === 'draft') return list.filter(e => e.accounting?.status === 'draft').length
  if (key === 'final') return list.filter(e => e.accounting?.status === 'final').length
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

async function createAccounting(eventId: string) {
  try {
    await accountingService.create({
      event: eventId,
      status: 'draft',
      notes: '',
      deposit_return: '0.00',
    })
    router.push(`/admin/events/${eventId}?tab=accounting`)
  } catch (e: any) {
    const msg = e.response?.data?.error || e.message
    alert('Fehler beim Erstellen: ' + msg)
  }
}

async function deleteEvent(event: Event) {
  if (!confirm(`Veranstaltung "${event.title}" wirklich löschen?`)) return

  try {
    await eventService.delete(event.id)
    if (eventsData.value) {
      eventsData.value.results = eventsData.value.results.filter(e => e.id !== event.id)
      eventsData.value.count--
    }
  } catch (e: any) {
    alert('Fehler beim Löschen: ' + e.message)
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

function statusLabel(status?: string): string {
  if (!status) return ''
  return status === 'final' ? 'Abgeschlossen' : 'Entwurf'
}

function statusClass(status?: string): string {
  if (!status) return ''
  return status === 'final' ? 'status-final' : 'status-draft'
}

onMounted(() => {
  loadEvents()
})
</script>

<template lang="pug">
.event-list-view
  .header
    h2 Veranstaltungen
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Veranstaltungen suchen..."
      )
      router-link.btn-primary(to="/admin/events/create") Veranstaltung erstellen

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
      :class="{ 'has-draft': event.accounting?.status === 'draft', 'has-final': event.accounting?.status === 'final' }"
    )
      .event-header
        .event-id {{ event.id }}
        .event-header-right
          span.status-badge(v-if="event.accounting" :class="statusClass(event.accounting.status)")
            | {{ statusLabel(event.accounting.status) }}
          .event-date {{ formatDate(event.date) }}

      h3.event-title {{ event.title }}

      .event-artists(v-if="event.artists.length")
        span.artist(v-for="artist in event.artists" :key="artist.id || artist.name")
          | {{ artist.name }}

      .event-footer
        .event-meta
          a.fee(v-if="event.fee && event.shopLink" :href="event.shopLink" target="_blank") VVK: {{ event.fee }} €
          span.fee(v-else-if="event.fee") VVK: {{ event.fee }} €
          span.fee-ak(v-if="event.feeAk")  / AK: {{ event.feeAk }} €

        .event-actions
          router-link.btn-edit(:to="`/admin/events/${event.id}`") Bearbeiten
          router-link.btn-accounting(
            v-if="event.accounting"
            :to="`/admin/events/${event.id}?tab=accounting`"
          ) Abrechnung öffnen
          button.btn-accounting-start(
            v-else
            @click="createAccounting(event.id)"
          ) Abrechnung starten
          button.btn-delete(@click="deleteEvent(event)") Löschen

  .empty(v-else) Keine Veranstaltungen gefunden

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

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 250px;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.btn-primary {
  padding: 0.7em;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.2em;
  transition: filter 0.2s;
}

.btn-primary:hover {
  filter: brightness(120%);
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
}

.event-card.has-draft {
  border-left: 0.5rem solid #e67e22;
}

.event-card.has-final {
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

.btn-edit, .btn-delete, .btn-accounting, .btn-accounting-start, .btn-docs {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  transition: filter 0.2s;
}

.btn-edit {
  background: white;
  color: black;
}

.btn-delete {
  background: black;
  color: white;
}

.btn-accounting {
  background: white;
  color: black;
}

.btn-accounting-start {
  background: white;
  color: black;
  border-style: dashed;
}

.btn-docs {
  background: white;
  color: black;
}

.btn-edit:hover, .btn-delete:hover, .btn-accounting:hover, .btn-accounting-start:hover, .btn-docs:hover {
  filter: brightness(120%);
}
</style>
