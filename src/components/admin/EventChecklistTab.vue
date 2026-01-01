<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { checklistInstanceService, type ChecklistInstanceItem } from '@/services'

const props = defineProps<{
  eventId: string
}>()

const items = ref<ChecklistInstanceItem[]>([])
const isLoading = ref(false)
const error = ref('')

const phaseLabels: Record<string, string> = {
  before: 'BEFORE - Vor der Veranstaltung',
  during: 'DURING - Während der Veranstaltung',
  after: 'AFTER - Nach der Veranstaltung'
}

const statusLabels: Record<string, string> = {
  initial: 'Nicht gestartet',
  inProgress: 'In Bearbeitung',
  blocked: 'Blockiert',
  done: 'Fertig'
}

const statusOptions = [
  { value: 'initial', label: 'Nicht gestartet', color: '#ffffff' },
  { value: 'inProgress', label: 'In Bearbeitung', color: '#fed7aa' },
  { value: 'blocked', label: 'Blockiert', color: '#fecaca' },
  { value: 'done', label: 'Fertig', color: '#bbf7d0' }
]

// Group items by phase
const itemsByPhase = computed(() => {
  const grouped: Record<string, ChecklistInstanceItem[]> = {
    before: [],
    during: [],
    after: []
  }

  items.value.forEach(item => {
    grouped[item.phase].push(item)
  })

  return grouped
})

// Calculate completion stats
const stats = computed(() => {
  const total = items.value.length
  const done = items.value.filter(i => i.status === 'done').length
  const inProgress = items.value.filter(i => i.status === 'inProgress').length
  const blocked = items.value.filter(i => i.status === 'blocked').length

  return {
    total,
    done,
    inProgress,
    blocked,
    percentage: total > 0 ? Math.round((done / total) * 100) : 0
  }
})

async function loadChecklistItems() {
  isLoading.value = true
  error.value = ''

  try {
    const response = await checklistInstanceService.getByEventId(props.eventId)
    items.value = response.results || []
  } catch (e: any) {
    error.value = e.message || 'Failed to load checklist items'
  } finally {
    isLoading.value = false
  }
}

async function updateItemStatus(item: ChecklistInstanceItem, newStatus: ChecklistInstanceItem['status']) {
  const oldStatus = item.status

  // Optimistic update
  item.status = newStatus

  try {
    await checklistInstanceService.updateStatus(item.id!, newStatus)
    // Reload to get updated modified time and editor
    await loadChecklistItems()
  } catch (e: any) {
    // Revert on error
    item.status = oldStatus
    alert('Failed to update status: ' + e.message)
  }
}

function getStatusColor(status: ChecklistInstanceItem['status']): string {
  return statusOptions.find(s => s.value === status)?.color || '#ffffff'
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'gerade eben'
  if (diffMins < 60) return `vor ${diffMins} Min`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `vor ${diffHours} Std`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

onMounted(() => {
  loadChecklistItems()
})
</script>

<template lang="pug">
.event-checklist-tab
  .checklist-header
    h3 Event Checklist
    .checklist-stats
      .stat-row
        strong {{ stats.done }} / {{ stats.total }}
        | abgeschlossen ({{ stats.percentage }}%)
      .progress-bar
        .progress-fill(:style="{ width: stats.percentage + '%' }")
      .stat-badges
        .stat-badge.badge-done(v-if="stats.done > 0") {{ stats.done }} Fertig
        .stat-badge.badge-progress(v-if="stats.inProgress > 0") {{ stats.inProgress }} In Bearbeitung
        .stat-badge.badge-blocked(v-if="stats.blocked > 0") {{ stats.blocked }} Blockiert

  .help-text
    | Status per Dropdown ändern • Automatisches Speichern

  .loading(v-if="isLoading") Lade Checkliste...
  .error(v-else-if="error") {{ error }}

  .checklist-content(v-else)
    .phase-section(v-for="(phaseItems, phase) in itemsByPhase" :key="phase")
      .phase-header
        h4.phase-title {{ phaseLabels[phase] }}
        .phase-count {{ phaseItems.length }} Items

      table.checklist-table(v-if="phaseItems.length")
        thead
          tr
            th Aufgabe
            th Bereich
            th Status
            th Zuletzt geändert
            th Bearbeitet von

        tbody
          tr(
            v-for="item in phaseItems"
            :key="item.id"
            :style="{ backgroundColor: getStatusColor(item.status) }"
          )
            td.name-cell
              span {{ item.name }}

            td.stage-cell
              span {{ item.stage }}

            td.status-cell
              select.status-select(
                :value="item.status"
                @change="(e) => updateItemStatus(item, e.target.value)"
                @click.stop
              )
                option(
                  v-for="option in statusOptions"
                  :key="option.value"
                  :value="option.value"
                ) {{ option.label }}

            td.modified-cell
              span(v-if="item.modified") {{ formatDate(item.modified) }}

            td.editor-cell
              span(v-if="item.edited_by_username") {{ item.edited_by_username }}

      .empty(v-else)
        | Keine Items für diese Phase

    .empty(v-if="!items.length")
      | Keine Checklisten-Items vorhanden. Diese werden automatisch beim Erstellen eines Events angelegt.
</template>

<style scoped>
.event-checklist-tab {
  background: white;
  border: 0.25rem solid black;
}

.checklist-header {
  padding: 1.5rem;
  border-bottom: 0.25rem solid black;
  background: white;
}

h3 {
  font-size: 1.5rem;
  font-weight: 900;
  color: black;
  margin: 0 0 1rem 0;
}

.checklist-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stat-row {
  font-size: 0.95rem;
  color: black;
  font-weight: 600;
}

.progress-bar {
  height: 1.5rem;
  background: white;
  border: 0.25rem solid black;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: black;
  transition: width 0.3s ease;
}

.stat-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-badge {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  border: 0.25rem solid black;
}

.badge-done {
  background: #16a34a;
}

.badge-progress {
  background: #ea580c;
}

.badge-blocked {
  background: #dc2626;
}

.help-text {
  padding: 0.75rem 1rem;
  background: white;
  border-bottom: 0.25rem solid black;
  font-size: 0.9rem;
  color: black;
  font-weight: 600;
}

.loading, .error {
  padding: 3rem;
  text-align: center;
  color: black;
  font-weight: 600;
}

.error {
  background: white;
  border: 0.25rem solid black;
  margin: 1.5rem;
}

.checklist-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
}

.phase-section {
  border: 0.25rem solid black;
  overflow: hidden;
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: black;
  color: white;
}

.phase-title {
  font-size: 1.1rem;
  font-weight: 900;
  margin: 0;
}

.phase-count {
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  background: white;
  color: black;
  border: 0.25rem solid white;
}

.checklist-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.checklist-table thead {
  background: white;
  border-bottom: 0.25rem solid black;
}

.checklist-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 900;
  font-size: 0.9rem;
  color: black;
}

.checklist-table tbody tr {
  border-bottom: 0.25rem solid black;
  transition: opacity 0.15s;
}

.checklist-table tbody tr:last-child {
  border-bottom: none;
}

.checklist-table tbody tr:hover {
  opacity: 0.9;
}

.checklist-table td {
  padding: 0.875rem 1rem;
  font-size: 0.95rem;
  color: black;
}

.checklist-table td span {
  font-weight: 600;
}

.name-cell {
  width: 45%;
}

.stage-cell {
  width: 20%;
}

.status-cell {
  width: 20%;
}

.modified-cell {
  width: 10%;
  font-size: 0.85rem;
}

.editor-cell {
  width: 5%;
  font-size: 0.85rem;
}

.status-select {
  width: 100%;
  padding: 0.5rem;
  border: 0.25rem solid black;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  background: white;
  cursor: pointer;
}

.status-select:focus {
  outline: none;
  background: black;
  color: white;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: black;
  font-weight: 600;
  background: white;
}

@media (max-width: 1024px) {
  .checklist-table {
    font-size: 0.9rem;
  }

  .checklist-table th,
  .checklist-table td {
    padding: 0.625rem 0.75rem;
  }

  .editor-cell {
    display: none;
  }
}

@media (max-width: 768px) {
  .checklist-content {
    padding: 1rem;
  }

  .checklist-table {
    display: block;
    overflow-x: auto;
  }

  .modified-cell,
  .editor-cell {
    display: none;
  }

  .name-cell {
    width: 45%;
  }

  .stage-cell {
    width: 25%;
  }

  .status-cell {
    width: 30%;
  }
}
</style>
