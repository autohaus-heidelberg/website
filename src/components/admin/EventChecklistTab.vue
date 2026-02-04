<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { checklistInstanceService, type ChecklistInstanceItem } from '@/services'

const props = defineProps<{
  eventId: string
}>()

const items = ref<ChecklistInstanceItem[]>([])
const isLoading = ref(false)
const error = ref('')

// Visibility toggles (hidden by default)
const showDone = ref(false)
const showBlocked = ref(false)
const showUnnecessary = ref(false)

const phaseLabels: Record<string, string> = {
  before: 'BEFORE - Vor der Veranstaltung',
  during: 'DURING - Während der Veranstaltung',
  after: 'AFTER - Nach der Veranstaltung'
}

const statusLabels: Record<string, string> = {
  initial: 'Nicht gestartet',
  inProgress: 'In Bearbeitung',
  blocked: 'Blockiert',
  done: 'Fertig',
  unnecessary: 'Unnötig'
}

const statusOptions = [
  { value: 'initial', label: 'Nicht gestartet', shortLabel: 'Offen', color: '#ffffff' },
  { value: 'inProgress', label: 'In Bearbeitung', shortLabel: 'In Arbeit', color: '#fed7aa' },
  { value: 'blocked', label: 'Blockiert', shortLabel: 'Blockiert', color: '#fecaca' },
  { value: 'done', label: 'Fertig', shortLabel: 'Fertig', color: '#bbf7d0' },
  { value: 'unnecessary', label: 'Unnötig', shortLabel: 'Unnötig', color: '#e5e7eb' }
]

// Group items by phase (with visibility filtering)
const itemsByPhase = computed(() => {
  const grouped: Record<string, ChecklistInstanceItem[]> = {
    before: [],
    during: [],
    after: []
  }

  items.value.forEach(item => {
    // Filter based on visibility toggles
    if (item.status === 'done' && !showDone.value) return
    if (item.status === 'blocked' && !showBlocked.value) return
    if (item.status === 'unnecessary' && !showUnnecessary.value) return
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
  const unnecessary = items.value.filter(i => i.status === 'unnecessary').length

  return {
    total,
    done,
    inProgress,
    blocked,
    unnecessary,
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
    const updatedItem = await checklistInstanceService.updateStatus(item.id!, newStatus)
    // Merge server response (modified time, editor) into existing item
    item.modified = updatedItem.modified
    item.edited_by = updatedItem.edited_by
    item.edited_by_username = updatedItem.edited_by_username
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

  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  if (diffMins < 1) return `gerade eben (${time})`
  if (diffMins < 60) return `vor ${diffMins} Min (${time})`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `vor ${diffHours} Std (${time})`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''} (${time})`

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ` (${time})`
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
        button.stat-badge.badge-done(
          v-if="stats.done > 0"
          :class="{ active: showDone }"
          @click="showDone = !showDone"
          :title="showDone ? 'Fertige ausblenden' : 'Fertige einblenden'"
        ) {{ stats.done }} Fertig {{ showDone ? '✓' : '+' }}
        .stat-badge.badge-progress(v-if="stats.inProgress > 0") {{ stats.inProgress }} In Bearbeitung
        button.stat-badge.badge-blocked(
          v-if="stats.blocked > 0"
          :class="{ active: showBlocked }"
          @click="showBlocked = !showBlocked"
          :title="showBlocked ? 'Blockierte ausblenden' : 'Blockierte einblenden'"
        ) {{ stats.blocked }} Blockiert {{ showBlocked ? '✓' : '+' }}
        button.stat-badge.badge-unnecessary(
          v-if="stats.unnecessary > 0"
          :class="{ active: showUnnecessary }"
          @click="showUnnecessary = !showUnnecessary"
          :title="showUnnecessary ? 'Unnötige ausblenden' : 'Unnötige einblenden'"
        ) {{ stats.unnecessary }} Unnötig {{ showUnnecessary ? '✓' : '+' }}

  .loading(v-if="isLoading") Lade Checkliste...
  .error(v-else-if="error") {{ error }}

  .checklist-content(v-else)
    .phase-section(v-for="(phaseItems, phase) in itemsByPhase" :key="phase")
      .phase-header
        h4.phase-title {{ phaseLabels[phase] }}
        .phase-count {{ phaseItems.length }} Items

      .checklist-items(v-if="phaseItems.length")
        .checklist-item(
          v-for="item in phaseItems"
          :key="item.id"
          :style="{ backgroundColor: getStatusColor(item.status) }"
        )
          .item-main
            .item-name {{ item.name }}
          .item-meta(v-if="item.modified || item.edited_by_username")
            span.item-modified(v-if="item.modified") {{ formatDate(item.modified) }}
            span.item-editor(v-if="item.edited_by_username") {{ item.edited_by_username }}
          .item-status-buttons
            button.status-btn(
              v-for="option in statusOptions"
              :key="option.value"
              :class="{ active: item.status === option.value, ['status-' + option.value]: true }"
              @click="updateItemStatus(item, option.value)"
              :title="option.label"
            ) {{ option.shortLabel }}

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

button.stat-badge {
  cursor: pointer;
  opacity: 0.5;
  font-family: inherit;
  transition: opacity 0.15s, transform 0.1s;
}

button.stat-badge:hover {
  transform: scale(1.05);
}

button.stat-badge.active {
  opacity: 1;
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

.badge-unnecessary {
  background: #6b7280;
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

.checklist-items {
  display: flex;
  flex-direction: column;
}

.checklist-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 0.25rem solid black;
  transition: opacity 0.15s;
}

.checklist-item:last-child {
  border-bottom: none;
}

.checklist-item:hover {
  opacity: 0.9;
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: black;
}

.item-stage {
  font-size: 0.85rem;
  color: black;
  font-weight: 600;
  opacity: 0.7;
}

.item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  font-size: 0.8rem;
  color: black;
  font-weight: 600;
  opacity: 0.7;
  white-space: nowrap;
}

.item-status-buttons {
  display: flex;
  gap: 0.25rem;
}

.status-btn {
  padding: 0.25rem 0.5rem;
  border: 0.15rem solid black;
  background: white;
  color: black;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.1s;
  white-space: nowrap;
}

.status-btn:hover {
  transform: scale(1.05);
}

.status-btn.active {
  background: black;
  color: white;
}

.status-btn.status-initial.active {
  background: #6b7280;
  border-color: #6b7280;
}

.status-btn.status-inProgress.active {
  background: #ea580c;
  border-color: #ea580c;
}

.status-btn.status-blocked.active {
  background: #dc2626;
  border-color: #dc2626;
}

.status-btn.status-done.active {
  background: #16a34a;
  border-color: #16a34a;
}

.status-btn.status-unnecessary.active {
  background: #6b7280;
  border-color: #6b7280;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: black;
  font-weight: 600;
  background: white;
}

@media (max-width: 768px) {
  .event-checklist-tab {
    border: none;
  }

  .checklist-header {
    padding: 1rem;
  }

  .checklist-content {
    padding: 0.5rem;
    gap: 1rem;
  }

  .phase-header {
    padding: 0.75rem 1rem;
  }

  .phase-title {
    font-size: 0.95rem;
  }

  .checklist-item {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    gap: 0.75rem;
    padding: 1rem;
  }

  .item-main {
    order: 1;
  }

  .item-meta {
    order: 3;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
  }

  .item-status-buttons {
    order: 2;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .status-btn {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .error {
    margin: 0.5rem;
  }
}
</style>
