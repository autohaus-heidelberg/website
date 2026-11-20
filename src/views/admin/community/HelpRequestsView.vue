<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { helpRequestService, type HelpRequest } from '@/services'

const items = ref<HelpRequest[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const success = ref('')

const emptyForm = (): HelpRequest => ({ title: '', text: '', active: true, order: 0 })
const editingId = ref<number | 'new' | null>(null)
const form = ref<HelpRequest>(emptyForm())

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const res = await helpRequestService.getAll()
    items.value = res.results
  } catch (e: any) {
    error.value = e.message || 'Laden fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}

function startNew() {
  const maxOrder = items.value.reduce((m, i) => Math.max(m, i.order), 0)
  form.value = { ...emptyForm(), order: maxOrder + 1 }
  editingId.value = 'new'
}

function startEdit(item: HelpRequest) {
  form.value = { ...item }
  editingId.value = item.id!
}

function cancel() {
  editingId.value = null
}

async function save() {
  if (!form.value.title.trim()) {
    error.value = 'Titel wird benötigt'
    return
  }
  isSaving.value = true
  error.value = ''
  try {
    if (editingId.value === 'new') {
      await helpRequestService.create(form.value)
    } else {
      await helpRequestService.update(editingId.value as number, form.value)
    }
    editingId.value = null
    success.value = 'Gespeichert. Auf der Website erscheint die Änderung nach dem nächsten Veröffentlichen der Events.'
    await load()
  } catch (e: any) {
    error.value = e.message || 'Speichern fehlgeschlagen'
  } finally {
    isSaving.value = false
  }
}

async function toggleActive(item: HelpRequest) {
  try {
    await helpRequestService.update(item.id!, { active: !item.active })
    item.active = !item.active
  } catch (e: any) {
    error.value = e.message || 'Aktualisieren fehlgeschlagen'
  }
}

async function remove(item: HelpRequest) {
  if (!confirm(`"${item.title}" wirklich löschen?`)) return
  try {
    await helpRequestService.delete(item.id!)
    items.value = items.value.filter(i => i.id !== item.id)
  } catch (e: any) {
    error.value = e.message || 'Löschen fehlgeschlagen'
  }
}

onMounted(load)
</script>

<template lang="pug">
.help-requests-view
  .header
    h2 Mithilfe-Gesuche
    button.btn-primary(v-if="editingId === null" @click="startNew") + Neues Gesuch

  p.help-text Diese Einträge erscheinen auf der öffentlichen Community-Seite unter „Wir suchen". Nur aktive Einträge werden veröffentlicht, und zwar beim nächsten Veröffentlichen der Events.

  .error(v-if="error") {{ error }}
  .success(v-if="success") {{ success }}

  form.edit-box(v-if="editingId !== null" @submit.prevent="save")
    .form-group
      label(for="hr-title") Titel *
      input#hr-title(v-model="form.title" placeholder="z.B. Bar-Schichten" required)
    .form-group
      label(for="hr-text") Text
      textarea#hr-text(v-model="form.text" rows="4" placeholder="Was wird gebraucht, wie viel Zeit, wer ist Ansprechperson?")
    .form-row
      .form-group
        label(for="hr-order") Reihenfolge
        input#hr-order(v-model.number="form.order" type="number")
      label.checkbox-label
        input(type="checkbox" v-model="form.active")
        |  Aktiv (auf der Website anzeigen)
    .actions
      button.btn-primary(type="submit" :disabled="isSaving") {{ isSaving ? 'Speichern…' : 'Speichern' }}
      button.btn-secondary(type="button" @click="cancel") Abbrechen

  .loading(v-if="isLoading") Wird geladen...
  .list(v-else-if="items.length")
    .item(v-for="item in items" :key="item.id" :class="{ inactive: !item.active }")
      .item-main
        h3 {{ item.title }}
        p {{ item.text }}
      .item-actions
        span.status {{ item.active ? 'Aktiv' : 'Inaktiv' }}
        button(@click="toggleActive(item)") {{ item.active ? 'Deaktivieren' : 'Aktivieren' }}
        button(@click="startEdit(item)") Bearbeiten
        button.danger(@click="remove(item)") Löschen
  .empty(v-else-if="!isLoading") Noch keine Gesuche angelegt.
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.help-text {
  margin-bottom: 1.5rem;
  text-align: left;
}

.error,
.success {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border: 0.2rem solid black;
  text-align: left;
}

.edit-box {
  border: 0.3rem solid black;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  text-align: left;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 0.15rem solid black;
  font: inherit;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.form-row .form-group {
  margin-bottom: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.list {
  display: grid;
  gap: 1rem;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 0.3rem solid black;
  text-align: left;
}

.item.inactive {
  border-style: dashed;
  opacity: 0.7;
}

.item h3 {
  margin: 0 0 0.25rem;
}

.item p {
  margin: 0;
  white-space: pre-wrap;
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.status {
  font-weight: 700;
  margin-right: 0.5rem;
}

.empty {
  padding: 2rem 0;
  text-align: center;
}
</style>
