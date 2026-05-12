<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { anfrageService, ANFRAGE_TYPE_LABELS, type Anfrage } from '@/services/anfragen'

const anfragen = ref<Anfrage[]>([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')
const filterType = ref<string>('all')
const filterRead = ref<string>('all')
const expandedId = ref<number | null>(null)
const replyingTo = ref<number | null>(null)
const replySubject = ref('')
const replyMessage = ref('')
const replySending = ref(false)
const replySuccess = ref<number | null>(null)
const replyError = ref('')

const filteredAnfragen = computed(() => {
  let list = anfragen.value

  if (filterType.value !== 'all') {
    list = list.filter(a => a.type === filterType.value)
  }

  if (filterRead.value === 'unread') {
    list = list.filter(a => !a.isRead)
  } else if (filterRead.value === 'read') {
    list = list.filter(a => a.isRead)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.contactEmail.toLowerCase().includes(q) ||
      a.message.toLowerCase().includes(q) ||
      (a.genre && a.genre.toLowerCase().includes(q))
    )
  }

  return list
})

const unreadCount = computed(() => anfragen.value.filter(a => !a.isRead).length)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function toggleRead(anfrage: Anfrage) {
  try {
    if (anfrage.isRead) {
      await anfrageService.markUnread(anfrage.id)
      anfrage.isRead = false
    } else {
      await anfrageService.markRead(anfrage.id)
      anfrage.isRead = true
    }
  } catch (e: any) {
    alert('Fehler: ' + (e.message || 'Unbekannter Fehler'))
  }
}

function startReply(anfrage: Anfrage) {
  replyingTo.value = anfrage.id
  replySubject.value = `Re: Anfrage von ${anfrage.name} (${ANFRAGE_TYPE_LABELS[anfrage.type] || anfrage.type})`
  replyMessage.value = ''
  replySuccess.value = null
  replyError.value = ''
}

function cancelReply() {
  replyingTo.value = null
  replySubject.value = ''
  replyMessage.value = ''
  replyError.value = ''
}

async function sendReply(anfrage: Anfrage) {
  if (!replyMessage.value.trim()) return
  replySending.value = true
  replyError.value = ''
  try {
    await anfrageService.reply(anfrage.id, replySubject.value, replyMessage.value)
    anfrage.isRead = true
    anfrage.lastReplySubject = replySubject.value
    anfrage.lastReplyMessage = replyMessage.value
    anfrage.lastReplyAt = new Date().toISOString()
    replySuccess.value = anfrage.id
    replyingTo.value = null
    replyMessage.value = ''
    replySubject.value = ''
    setTimeout(() => { replySuccess.value = null }, 3000)
  } catch (e: any) {
    replyError.value = e.message || 'E-Mail konnte nicht gesendet werden'
  } finally {
    replySending.value = false
  }
}

async function deleteAnfrage(anfrage: Anfrage) {
  if (!confirm(`Anfrage von "${anfrage.name}" wirklich löschen?`)) return
  try {
    await anfrageService.delete(anfrage.id)
    anfragen.value = anfragen.value.filter(a => a.id !== anfrage.id)
  } catch (e: any) {
    alert('Fehler beim Löschen: ' + (e.message || 'Unbekannter Fehler'))
  }
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    const data = await anfrageService.getAll()
    anfragen.value = data.results
  } catch (e: any) {
    error.value = e.message || 'Anfragen konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.anfragen-list-view
  .header
    h2 Anfragen
      span.unread-badge(v-if="unreadCount") {{ unreadCount }}
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Suchen..."
      )

  .filters
    .filter-group
      label Typ:
      select(v-model="filterType")
        option(value="all") Alle
        option(value="band") Band
        option(value="event") Event
        option(value="rent") Vermietung
        option(value="other") Sonstige
    .filter-group
      label Status:
      select(v-model="filterRead")
        option(value="all") Alle
        option(value="unread") Ungelesen
        option(value="read") Gelesen

  .loading(v-if="isLoading") Anfragen werden geladen...
  .error(v-else-if="error") {{ error }}

  .anfragen-container(v-else-if="filteredAnfragen.length")
    .anfrage-card(
      v-for="anfrage in filteredAnfragen"
      :key="anfrage.id"
      :class="{ unread: !anfrage.isRead, expanded: expandedId === anfrage.id }"
    )
      .anfrage-header(@click="toggleExpand(anfrage.id)")
        .anfrage-meta
          span.type-badge(:class="'type-' + anfrage.type") {{ ANFRAGE_TYPE_LABELS[anfrage.type] || anfrage.type }}
          span.anfrage-name {{ anfrage.name }}
          span.anfrage-email {{ anfrage.contactEmail }}
        .anfrage-right
          span.anfrage-date {{ formatDate(anfrage.submittedAt) }}
          span.read-indicator(v-if="!anfrage.isRead") ●

      .anfrage-preview(v-if="expandedId !== anfrage.id")
        | {{ anfrage.message.slice(0, 120) }}{{ anfrage.message.length > 120 ? '...' : '' }}

      .anfrage-details(v-if="expandedId === anfrage.id")
        .detail-grid
          .detail-item(v-if="anfrage.genre")
            label Genre
            span {{ anfrage.genre }}
          .detail-item(v-if="anfrage.budget")
            label Budget
            span {{ anfrage.budget }}
          .detail-item(v-if="anfrage.dateStart")
            label Zeitraum
            span {{ anfrage.dateStart }}{{ anfrage.dateEnd ? ' – ' + anfrage.dateEnd : '' }}
          .detail-item(v-if="anfrage.technicalRequirements")
            label Techn. Anforderungen
            span {{ anfrage.technicalRequirements }}

        .detail-message
          label Nachricht
          p {{ anfrage.message }}

        .anfrage-actions
          button.btn-toggle(@click.stop="toggleRead(anfrage)")
            | {{ anfrage.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren' }}
          button.btn-email(@click.stop="startReply(anfrage)" v-if="replyingTo !== anfrage.id") ✉️ Antworten
          button.btn-delete(@click.stop="deleteAnfrage(anfrage)") Löschen

        .reply-success(v-if="replySuccess === anfrage.id") ✓ Antwort gesendet an {{ anfrage.contactEmail }}

        .last-reply(v-if="anfrage.lastReplyAt")
          .last-reply-header
            strong Letzte Antwort
            span.last-reply-date {{ formatDate(anfrage.lastReplyAt) }}
          .last-reply-subject(v-if="anfrage.lastReplySubject") {{ anfrage.lastReplySubject }}
          p.last-reply-body {{ anfrage.lastReplyMessage }}

        .reply-form(v-if="replyingTo === anfrage.id")
          .reply-header
            span.reply-to An: {{ anfrage.contactEmail }}
            button.reply-cancel(@click.stop="cancelReply") ✕
          input.reply-subject(
            v-model="replySubject"
            placeholder="Betreff"
            @click.stop
          )
          textarea.reply-body(
            v-model="replyMessage"
            placeholder="Deine Antwort..."
            rows="5"
            @click.stop
          )
          .reply-error(v-if="replyError") {{ replyError }}
          .reply-actions
            button.btn-send(
              @click.stop="sendReply(anfrage)"
              :disabled="replySending || !replyMessage.trim()"
            ) {{ replySending ? 'Wird gesendet...' : 'Senden' }}
            button.btn-cancel(@click.stop="cancelReply") Abbrechen

  .empty(v-else) Keine Anfragen gefunden
</template>

<style scoped>
.anfragen-list-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.unread-badge {
  background: black;
  color: white;
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
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
  min-width: 220px;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.filters {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 900;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-group select {
  padding: 0.4rem 0.75rem;
  border: 0.2rem solid black;
  font-weight: 600;
  font-size: 0.85rem;
  background: white;
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

.anfragen-container {
  display: grid;
  gap: 1rem;
}

.anfrage-card {
  border: 0.25rem solid black;
  transition: all 0.15s;
}

.anfrage-card.unread {
  border-left-width: 0.5rem;
}

.anfrage-card.expanded {
  transform: rotate(-0.2deg);
}

.anfrage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  gap: 1rem;
}

.anfrage-header:hover {
  background: #f5f5f5;
}

.anfrage-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.type-badge {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 0.2rem 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: black;
  color: white;
}

.type-band { background: #1a1a1a; }
.type-event { background: #333; }
.type-rent { background: #555; }
.type-other { background: #777; }

.anfrage-name {
  font-weight: 900;
  font-size: 1rem;
}

.anfrage-email {
  font-size: 0.85rem;
  color: #555;
}

.anfrage-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.anfrage-date {
  font-size: 0.8rem;
  color: #555;
  font-weight: 600;
}

.read-indicator {
  color: black;
  font-size: 1.2rem;
  line-height: 1;
}

.anfrage-preview {
  padding: 0 1.25rem 1rem;
  font-size: 0.9rem;
  color: #444;
  line-height: 1.4;
}

.anfrage-details {
  padding: 0 1.25rem 1.25rem;
  border-top: 0.15rem solid black;
  margin-top: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding-top: 1rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.detail-item label {
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
}

.detail-item span {
  font-size: 0.9rem;
}

.detail-message {
  margin-bottom: 1.25rem;
}

.detail-message label {
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
  display: block;
  margin-bottom: 0.4rem;
}

.detail-message p {
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.anfrage-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 0.15rem solid #ddd;
  flex-wrap: wrap;
}

.btn-toggle, .btn-delete, .btn-email {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-toggle {
  background: white;
  color: black;
}

.btn-email {
  background: white;
  color: black;
}

.btn-delete {
  background: black;
  color: white;
}

.btn-toggle:hover, .btn-email:hover {
  background: black;
  color: white;
}

.btn-delete:hover {
  filter: brightness(150%);
}

.reply-success {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: #e8f5e9;
  border: 0.2rem solid #333;
  font-weight: 700;
  font-size: 0.85rem;
}

.last-reply {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f5f5f5;
  border: 0.2rem solid #999;
}

.last-reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.last-reply-date {
  color: #666;
  font-size: 0.8rem;
}

.last-reply-subject {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.last-reply-body {
  font-size: 0.85rem;
  white-space: pre-wrap;
  margin: 0;
}

.reply-form {
  margin-top: 0.75rem;
  border: 0.25rem solid black;
  padding: 1rem;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.reply-to {
  font-weight: 900;
  font-size: 0.85rem;
}

.reply-cancel {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  font-weight: 900;
  padding: 0 0.25rem;
}

.reply-subject {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
}

.reply-body {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  box-sizing: border-box;
}

.reply-body:focus, .reply-subject:focus {
  outline: none;
  border-color: black;
  background: #fafafa;
}

.reply-error {
  color: #c00;
  font-weight: 700;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.reply-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-send {
  padding: 0.5rem 1.5rem;
  border: 0.25rem solid black;
  background: black;
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-send:not(:disabled):hover {
  filter: brightness(150%);
}

.btn-cancel {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

@media (max-width: 768px) {
  .anfrage-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .anfrage-right {
    width: 100%;
    justify-content: space-between;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
