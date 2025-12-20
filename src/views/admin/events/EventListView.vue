<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { eventService, type Event } from '@/services'
import type { PaginatedResponse } from '@/types/api'

const router = useRouter()
const eventsData = ref<PaginatedResponse<Event> | null>(null)
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

const events = computed(() => eventsData.value?.results || [])

const filteredEvents = computed(() => {
  if (!searchQuery.value) return events.value

  const query = searchQuery.value.toLowerCase()
  return events.value.filter(event =>
    event.title.toLowerCase().includes(query) ||
    event.id.toLowerCase().includes(query) ||
    event.artists.some(a => a.name.toLowerCase().includes(query))
  )
})

async function loadEvents() {
  isLoading.value = true
  error.value = ''

  try {
    eventsData.value = await eventService.getAll()
  } catch (e: any) {
    error.value = e.message || 'Failed to load events'
  } finally {
    isLoading.value = false
  }
}

async function deleteEvent(event: Event) {
  if (!confirm(`Delete event "${event.title}"?`)) return

  try {
    await eventService.delete(event.id)
    // Remove from local data
    if (eventsData.value) {
      eventsData.value.results = eventsData.value.results.filter(e => e.id !== event.id)
      eventsData.value.count--
    }
  } catch (e: any) {
    alert('Failed to delete event: ' + e.message)
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

onMounted(() => {
  loadEvents()
})
</script>

<template lang="pug">
.event-list-view
  .header
    h2 Events
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Search events..."
      )
      router-link.btn-primary(to="/admin/events/create") ➕ Create Event

  .loading(v-if="isLoading") Loading events...
  .error(v-else-if="error") {{ error }}

  .events-container(v-else-if="filteredEvents.length > 0")
    .event-card(v-for="event in filteredEvents" :key="event.id")
      .event-header
        .event-id {{ event.id }}
        .event-date {{ formatDate(event.date) }}

      h3.event-title {{ event.title }}

      .event-artists(v-if="event.artists.length")
        span.artist(v-for="artist in event.artists" :key="artist.id || artist.name")
          | {{ artist.name }}

      .event-footer
        .event-meta
          span.fee(v-if="event.fee") {{ event.fee }}
          a.shop-link(v-if="event.shopLink" :href="event.shopLink" target="_blank") 🎫 Tickets

        .event-actions
          router-link.btn-edit(:to="`/admin/events/${event.id}`") Edit
          button.btn-delete(@click="deleteEvent(event)") Delete

  .empty(v-else) No events found

</template>

<style scoped>
.event-list-view {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  color: #1a1f36;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  min-width: 250px;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}



.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.error {
  color: #d32f2f;
  background: #ffebee;
  border-radius: 8px;
}

.events-container {
  display: grid;
  gap: 1.5rem;
}

.event-card {
  padding: 1.5rem;
  border: 2px solid #f0f0f0;
  border-radius: 12px;
  transition: all 0.2s;
}

.event-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.event-id {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #666;
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.event-date {
  font-size: 0.875rem;
  color: #666;
}

.event-title {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: #1a1f36;
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  color: #667eea;
  border-radius: 6px;
  font-weight: 500;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
}

.event-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.fee {
  font-weight: 600;
  color: #667eea;
}

.shop-link {
  color: #10b981;
  text-decoration: none;
  font-size: 0.875rem;
}

.shop-link:hover {
  text-decoration: underline;
}

.event-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-edit, .btn-delete {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-edit {
  background: #2196f3;
  color: white;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-edit:hover, .btn-delete:hover {
  opacity: 0.85;
}
</style>
