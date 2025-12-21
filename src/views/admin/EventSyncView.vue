<template lang="pug">
.event-sync
  h1 Event Synchronization

  .actions.mb-2

    button.btn-primary(
      @click="handleWriteToWebsite"
      :disabled="isSyncing || isWriting || selectedEvents.length === 0"
    )
      span(v-if="!isWriting") Write to Website ({{ selectedEvents.length }} selected)
      span(v-else) Writing...

  EventSyncLog(:logs="logs")

  .event-list.mb-2
    h2 Events
    .select-all-container.mb-1
      label.checkbox-label
        input(type="checkbox" v-model="selectAll" @change="toggleSelectAll")
        span Select All ({{ events.length }} events)

    .table-container(v-if="events.length > 0")
      table.event-table
        thead
          tr
            th.col-select
            th.col-id ID
            th.col-date Date
            th.col-title Title
        tbody
          tr(v-for="event in events" :key="event.id")
            td.col-select
              input(type="checkbox" :value="event.id" v-model="selectedEvents")
            td.col-id {{ event.id }}
            td.col-date {{ formatDate(event.date) }}
            td.col-title {{ event.title }}

    .loading(v-else-if="isLoadingEvents")
      p Loading events...

    .empty-state(v-else)
      p No events found in the database.


  button.btn-primary(
    @click="handleSyncFromGit"
    :disabled="isSyncing || isWriting"
  )
    span(v-if="!isSyncing") Sync from Git ( Diesen Button nur benutzen wenn ihr wisst was ihr tut)
    span(v-else) Syncing...

</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { eventService, type Event } from '@/services/events'
import { useEventSource } from '@/composables/useEventSource'
import EventSyncLog from '@/components/admin/EventSyncLog.vue'
import type { PaginatedResponse } from '@/types/api'
import dayjs from 'dayjs'

const eventsData = ref<PaginatedResponse<Event> | null>(null)
const selectedEvents = ref<string[]>([])
const isLoadingEvents = ref(false)

const { logs, connect, disconnect, clearLogs } = useEventSource()
const isSyncing = ref(false)
const isWriting = ref(false)

const events = computed(() => eventsData.value?.results || [])

const selectAll = computed({
  get: () => selectedEvents.value.length === events.value.length && events.value.length > 0,
  set: (value: boolean) => {
    if (value) {
      selectedEvents.value = events.value.map(e => e.id)
    } else {
      selectedEvents.value = []
    }
  }
})

onMounted(async () => {
  await loadEvents()
})

async function loadEvents() {
  try {
    isLoadingEvents.value = true
    eventsData.value = await eventService.getAll()
    // Select all by default
    selectedEvents.value = events.value.map(e => e.id)
  } catch (error) {
    console.error('Failed to load events:', error)
    alert('Failed to load events. Please check your connection.')
  } finally {
    isLoadingEvents.value = false
  }
}

function toggleSelectAll() {
  selectAll.value = !selectAll.value
}

function handleSyncFromGit() {
  if (!confirm('This will sync events from the git submodule to the database. Continue?')) {
    return
  }

  isSyncing.value = true
  clearLogs()

  const url = eventService.getSyncFromGitUrl()

  connect(url, {
    sync_start: (data) => {
      console.log('Sync started:', data)
    },
    git_pull: (data) => {
      console.log('Git pull:', data)
    },
    artist_sync: (data) => {
      console.log('Artist synced:', data)
    },
    event_sync: (data) => {
      console.log('Event synced:', data)
    },
    sync_complete: (data) => {
      console.log('Sync complete:', data)
      isSyncing.value = false
      disconnect()
      setTimeout(() => {
        if (confirm('Sync completed successfully! Reload page to see updated events?')) {
          window.location.reload()
        }
      }, 500)
    },
    sync_error: (data) => {
      console.error('Sync error:', data)
      isSyncing.value = false
      disconnect()
      alert(`Sync failed: ${data.message}`)
    }
  })
}

function handleWriteToWebsite() {
  if (selectedEvents.value.length === 0) {
    alert('Please select at least one event to write to the website.')
    return
  }

  const confirmMsg = `This will write ${selectedEvents.value.length} event(s) to the website, commit, push, and deploy. This may take several minutes. Continue?`
  if (!confirm(confirmMsg)) {
    return
  }

  isWriting.value = true
  clearLogs()

  const url = eventService.getWriteToWebsiteUrl(selectedEvents.value)

  connect(url, {
    write_start: (data) => {
      console.log('Write started:', data)
    },
    processing: (data) => {
      console.log('Processing:', data)
    },
    git_pull: (data) => {
      console.log('Git pull:', data)
    },
    json_write: (data) => {
      console.log('JSON written:', data)
    },
    git_add: (data) => {
      console.log('Git add:', data)
    },
    git_commit: (data) => {
      console.log('Git commit:', data)
    },
    git_push: (data) => {
      console.log('Git push:', data)
    },
    npm_deploy: (data) => {
      console.log('NPM deploy (this may take a while):', data)
    },
    heartbeat: (data) => {
      console.log('Heartbeat:', data)
    },
    write_complete: (data) => {
      console.log('Write complete:', data)
      isWriting.value = false
      disconnect()
      alert('Events successfully written and deployed to the website!')
    },
    write_error: (data) => {
      console.error('Write error:', data)
      isWriting.value = false
      disconnect()
      alert(`Write failed: ${data.message}`)
    }
  })
}

function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('DD.MM.YYYY HH:mm')
}
</script>

<style scoped>
.event-sync {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  font-weight: 900;
  color: black;
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  font-weight: 900;
  color: black;
}

.actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
  font-weight: 600;
  border: 0.25rem solid black;
  background: black;
  color: white;
  cursor: pointer;
  transition: filter 0.2s;
  letter-spacing: 0.2em;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mb-1 {
  margin-bottom: 1rem;
}

.mb-2 {
  margin-bottom: 2rem;
}

.select-all-container {
  padding: 1rem;
  background-color: white;
  border: 0.25rem solid black;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 600;
}

.checkbox-label input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.table-container {
  overflow-x: auto;
  border: 0.25rem solid black;
}

.event-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.event-table thead {
  background-color: black;
  color: white;
}

.event-table th,
.event-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 0.125rem solid black;
  font-weight: 600;
}

.event-table tbody tr:hover {
  background-color: black;
  color: white;
}

.event-table tbody tr:last-child td {
  border-bottom: none;
}

.col-select {
  width: 50px;
  text-align: center;
}

.col-select input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.col-id {
  width: 150px;
  font-family: monospace;
}

.col-date {
  width: 150px;
}

.col-title {
  min-width: 200px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: black;
  border: 0.25rem solid black;
  background-color: white;
}

.loading p,
.empty-state p {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}
</style>
