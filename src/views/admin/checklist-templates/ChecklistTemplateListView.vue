<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { checklistTemplateService, type ChecklistTemplateItem } from '@/services'
import type { PaginatedResponse } from '@/types/api'

const templatesData = ref<PaginatedResponse<ChecklistTemplateItem> | null>(null)
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

// Editing state
const editingId = ref<number | null>(null)
const editingForm = ref<Partial<ChecklistTemplateItem>>({})
const addingPhase = ref<string | null>(null)
const newItemForm = ref<Partial<ChecklistTemplateItem>>({
  name: '',
  stage: '',
  phase: 'before'
})
const isSaving = ref(false)

const templates = computed(() => templatesData.value?.results || [])

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value

  const query = searchQuery.value.toLowerCase()
  return templates.value.filter(template =>
    template.name.toLowerCase().includes(query) ||
    template.stage.toLowerCase().includes(query)
  )
})

// Group templates by phase
const templatesByPhase = computed(() => {
  const grouped: Record<string, ChecklistTemplateItem[]> = {
    before: [],
    during: [],
    after: []
  }

  filteredTemplates.value.forEach(template => {
    grouped[template.phase].push(template)
  })

  return grouped
})

const phaseLabels: Record<string, string> = {
  before: 'BEFORE - Vor der Veranstaltung',
  during: 'DURING - Während der Veranstaltung',
  after: 'AFTER - Nach der Veranstaltung'
}

const phaseOptions = [
  { value: 'before', label: 'BEFORE' },
  { value: 'during', label: 'DURING' },
  { value: 'after', label: 'AFTER' }
]

async function loadTemplates() {
  isLoading.value = true
  error.value = ''

  try {
    templatesData.value = await checklistTemplateService.getAll()
  } catch (e: any) {
    error.value = e.message || 'Failed to load checklist templates'
  } finally {
    isLoading.value = false
  }
}

function startEdit(template: ChecklistTemplateItem) {
  editingId.value = template.id!
  editingForm.value = { ...template }
  addingPhase.value = null
}

function cancelEdit() {
  editingId.value = null
  editingForm.value = {}
}

async function saveEdit() {
  if (!editingId.value || !editingForm.value.name || !editingForm.value.stage) {
    return
  }

  isSaving.value = true
  try {
    await checklistTemplateService.update(editingId.value, editingForm.value)
    await loadTemplates()
    editingId.value = null
    editingForm.value = {}
  } catch (e: any) {
    alert('Failed to update template: ' + e.message)
  } finally {
    isSaving.value = false
  }
}

function startAdd(phase: string) {
  addingPhase.value = phase
  newItemForm.value = {
    name: '',
    stage: '',
    phase: phase as any
  }
  editingId.value = null
}

function cancelAdd() {
  addingPhase.value = null
  newItemForm.value = {
    name: '',
    stage: '',
    phase: 'before'
  }
}

async function saveNew() {
  if (!newItemForm.value.name || !newItemForm.value.stage) {
    return
  }

  isSaving.value = true
  try {
    await checklistTemplateService.create(newItemForm.value)
    await loadTemplates()
    addingPhase.value = null
    newItemForm.value = {
      name: '',
      stage: '',
      phase: 'before'
    }
  } catch (e: any) {
    alert('Failed to create template: ' + e.message)
  } finally {
    isSaving.value = false
  }
}

async function deleteTemplate(template: ChecklistTemplateItem) {
  if (!confirm(`Delete checklist template "${template.name}"?\n\nNote: This will NOT affect existing events, only future events.`)) return

  try {
    await checklistTemplateService.delete(template.id!)
    if (templatesData.value) {
      templatesData.value.results = templatesData.value.results.filter(t => t.id !== template.id)
      templatesData.value.count--
    }
  } catch (e: any) {
    alert('Failed to delete template: ' + e.message)
  }
}

function handleKeydown(event: KeyboardEvent, action: 'edit' | 'add') {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (action === 'edit') saveEdit()
    else saveNew()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (action === 'edit') cancelEdit()
    else cancelAdd()
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

onMounted(() => {
  loadTemplates()
})
</script>

<template lang="pug">
.checklist-template-list-view
  .header
    h2 Checklist Templates
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Search templates..."
      )

  .help-text
    | Klick auf Zeile zum Bearbeiten • Enter speichern • Escape abbrechen

  .loading(v-if="isLoading") Loading templates...
  .error(v-else-if="error") {{ error }}

  .templates-container(v-else)
    .phase-section(v-for="(phaseTemplates, phase) in templatesByPhase" :key="phase")
      .phase-header
        h3.phase-title {{ phaseLabels[phase] }}
        button.btn-add(
          @click="startAdd(phase)"
          :disabled="addingPhase === phase"
        ) + Neu

      table.templates-table
        thead
          tr
            th Aufgabe
            th Bereich
            th Phase
            th Erstellt
            th Aktionen

        tbody
          tr(
            v-for="template in phaseTemplates"
            :key="template.id"
            :class="{ editing: editingId === template.id }"
            @click="editingId === template.id ? null : startEdit(template)"
          )
            td
              input.inline-input(
                v-if="editingId === template.id"
                v-model="editingForm.name"
                @click.stop
                @keydown="handleKeydown($event, 'edit')"
                placeholder="Aufgabe"
                autofocus
              )
              span(v-else) {{ template.name }}

            td
              input.inline-input(
                v-if="editingId === template.id"
                v-model="editingForm.stage"
                @click.stop
                @keydown="handleKeydown($event, 'edit')"
                placeholder="Bereich"
              )
              span(v-else) {{ template.stage }}

            td
              select.inline-select(
                v-if="editingId === template.id"
                v-model="editingForm.phase"
                @click.stop
                @keydown="handleKeydown($event, 'edit')"
              )
                option(
                  v-for="option in phaseOptions"
                  :key="option.value"
                  :value="option.value"
                ) {{ option.label }}
              span(v-else) {{ phaseLabels[template.phase] }}

            td.created-cell
              span(v-if="template.created") {{ formatDate(template.created) }}

            td.actions-cell(@click.stop)
              .action-buttons(v-if="editingId === template.id")
                button.btn-save(
                  @click="saveEdit"
                  :disabled="isSaving || !editingForm.name || !editingForm.stage"
                ) Speichern
                button.btn-cancel(@click="cancelEdit") Abbrechen
              .action-buttons(v-else)
                button.btn-delete(@click="deleteTemplate(template)") Löschen

          // Add new row
          tr.add-row(v-if="addingPhase === phase")
            td
              input.inline-input(
                v-model="newItemForm.name"
                @keydown="handleKeydown($event, 'add')"
                placeholder="Neue Aufgabe..."
                autofocus
              )

            td
              input.inline-input(
                v-model="newItemForm.stage"
                @keydown="handleKeydown($event, 'add')"
                placeholder="Bereich"
              )

            td
              select.inline-select(
                v-model="newItemForm.phase"
                @keydown="handleKeydown($event, 'add')"
              )
                option(
                  v-for="option in phaseOptions"
                  :key="option.value"
                  :value="option.value"
                ) {{ option.label }}

            td.created-cell
              span.muted Neu

            td.actions-cell
              .action-buttons
                button.btn-save(
                  @click="saveNew"
                  :disabled="isSaving || !newItemForm.name || !newItemForm.stage"
                ) Speichern
                button.btn-cancel(@click="cancelAdd") Abbrechen

      .empty(v-if="!phaseTemplates.length && addingPhase !== phase")
        | Keine Templates für diese Phase

    .empty(v-if="!templates.length && !isLoading")
      | Keine Checklist Templates vorhanden. Klicke "+ Neu" um eines zu erstellen.
</template>

<style scoped>
.checklist-template-list-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
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

.help-text {
  padding: 0.75rem 1rem;
  background: white;
  border: 0.25rem solid black;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: black;
  font-weight: 600;
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
  font-weight: 600;
}

.error {
  background: white;
  border: 0.25rem solid black;
}

.templates-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
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

.btn-add {
  padding: 0.5rem 1rem;
  background: white;
  color: black;
  border: 0.25rem solid white;
  cursor: pointer;
  font-weight: 900;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-add:hover:not(:disabled) {
  background: black;
  color: white;
  border-color: white;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.templates-table {
  width: 100%;
  border-collapse: collapse;
}

.templates-table thead {
  background: white;
  border-bottom: 0.25rem solid black;
}

.templates-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 900;
  font-size: 0.9rem;
  color: black;
}

.templates-table tbody tr {
  border-bottom: 0.25rem solid black;
  transition: background 0.15s;
  cursor: pointer;
}

.templates-table tbody tr:last-child {
  border-bottom: none;
}

.templates-table tbody tr:hover:not(.editing):not(.add-row) {
  background: #f5f5f5;
}

.templates-table tbody tr.editing {
  background: #fed7aa;
  cursor: default;
}

.templates-table tbody tr.add-row {
  background: #bbf7d0;
  cursor: default;
}

.templates-table td {
  padding: 0.875rem 1rem;
  font-size: 0.95rem;
  color: black;
}

.templates-table td span {
  font-weight: 600;
}

.created-cell {
  font-size: 0.85rem;
  color: black;
  width: 120px;
}

.created-cell .muted {
  opacity: 0.6;
  font-style: italic;
}

.actions-cell {
  width: 200px;
  text-align: right;
}

.inline-input {
  width: 100%;
  padding: 0.5rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  background: white;
}

.inline-input:focus {
  outline: none;
  background: black;
  color: white;
}

.inline-select {
  width: 100%;
  padding: 0.5rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  background: white;
  cursor: pointer;
}

.inline-select:focus {
  outline: none;
  background: black;
  color: white;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-save, .btn-cancel, .btn-delete {
  padding: 0.5rem 0.875rem;
  border: 0.25rem solid black;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: filter 0.2s;
}

.btn-save {
  background: black;
  color: white;
}

.btn-save:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: white;
  color: black;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

.btn-delete {
  background: white;
  color: black;
}

.btn-delete:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: black;
  font-weight: 600;
  background: white;
}

@media (max-width: 1024px) {
  .templates-table {
    font-size: 0.9rem;
  }

  .templates-table th,
  .templates-table td {
    padding: 0.625rem 0.75rem;
  }

  .actions-cell {
    width: 150px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
}

@media (max-width: 768px) {
  .checklist-template-list-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    min-width: 100%;
  }

  .templates-table {
    display: block;
    overflow-x: auto;
  }

  .created-cell {
    display: none;
  }
}
</style>
