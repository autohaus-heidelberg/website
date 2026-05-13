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
  let list = [...anfragen.value]

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

  // Newest first, unread before read
  list.sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  })

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

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
  return formatDate(dateStr)
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
    setTimeout(() => { replySuccess.value = null }, 4000)
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
    .header-title
      h2 Anfragen
      span.unread-badge(v-if="unreadCount") {{ unreadCount }} ungelesen
    .header-actions
      .search-wrapper
        span.search-icon 🔍
        input.search-input(
          v-model="searchQuery"
          type="text"
          placeholder="Name, E-Mail, Nachricht..."
        )

  .toolbar
    .filter-chips
      button.chip(
        :class="{ active: filterRead === 'all' }"
        @click="filterRead = 'all'"
      ) Alle
      button.chip(
        :class="{ active: filterRead === 'unread' }"
        @click="filterRead = 'unread'"
      ) Ungelesen
      button.chip(
        :class="{ active: filterRead === 'read' }"
        @click="filterRead = 'read'"
      ) Gelesen
    .filter-type
      select(v-model="filterType")
        option(value="all") Alle Typen
        option(value="band") 🎸 Band
        option(value="event") 🎪 Event
        option(value="rent") 🏠 Vermietung
        option(value="other") 📋 Sonstige

  .count-bar(v-if="!isLoading && !error")
    span {{ filteredAnfragen.length }} {{ filteredAnfragen.length === 1 ? 'Anfrage' : 'Anfragen' }}

  .loading(v-if="isLoading")
    .loading-spinner
    span Anfragen werden geladen...

  .error-banner(v-else-if="error")
    span.error-icon ⚠️
    span {{ error }}
    button.btn-retry(@click="loadData") Erneut versuchen

  .anfragen-container(v-else-if="filteredAnfragen.length")
    .anfrage-card(
      v-for="anfrage in filteredAnfragen"
      :key="anfrage.id"
      :class="{ unread: !anfrage.isRead, expanded: expandedId === anfrage.id }"
    )
      .anfrage-header(@click="toggleExpand(anfrage.id)")
        .anfrage-left
          .unread-dot(v-if="!anfrage.isRead")
          span.type-badge(:class="'type-' + anfrage.type")
            | {{ ANFRAGE_TYPE_LABELS[anfrage.type] || anfrage.type }}
          .anfrage-info
            span.anfrage-name {{ anfrage.name }}
            span.anfrage-email {{ anfrage.contactEmail }}
        .anfrage-right
          span.anfrage-time(:title="formatDate(anfrage.submittedAt)") {{ timeAgo(anfrage.submittedAt) }}
          span.expand-icon {{ expandedId === anfrage.id ? '▲' : '▼' }}

      .anfrage-preview(v-if="expandedId !== anfrage.id")
        | {{ anfrage.message.slice(0, 150) }}{{ anfrage.message.length > 150 ? '...' : '' }}

      transition(name="slide")
        .anfrage-details(v-if="expandedId === anfrage.id")
          .detail-section(v-if="anfrage.genre || anfrage.budget || anfrage.dateStart || anfrage.technicalRequirements")
            .detail-grid
              .detail-item(v-if="anfrage.genre")
                .detail-label Genre
                .detail-value {{ anfrage.genre }}
              .detail-item(v-if="anfrage.budget")
                .detail-label Budget
                .detail-value {{ anfrage.budget }}
              .detail-item(v-if="anfrage.dateStart")
                .detail-label Zeitraum
                .detail-value {{ anfrage.dateStart }}{{ anfrage.dateEnd ? ' – ' + anfrage.dateEnd : '' }}
              .detail-item(v-if="anfrage.technicalRequirements")
                .detail-label Techn. Anforderungen
                .detail-value {{ anfrage.technicalRequirements }}

          .message-section
            .detail-label Nachricht
            .message-text {{ anfrage.message }}

          .last-reply-section(v-if="anfrage.lastReplyAt")
            .last-reply-header
              span ✉️ Letzte Antwort
              span.last-reply-date {{ timeAgo(anfrage.lastReplyAt) }}
            .last-reply-subject(v-if="anfrage.lastReplySubject") {{ anfrage.lastReplySubject }}
            .last-reply-body {{ anfrage.lastReplyMessage }}

          .anfrage-actions
            button.btn-action.btn-read(@click.stop="toggleRead(anfrage)")
              span {{ anfrage.isRead ? '📩' : '📭' }}
              | {{ anfrage.isRead ? 'Ungelesen' : 'Gelesen' }}
            button.btn-action.btn-reply(
              @click.stop="startReply(anfrage)"
              v-if="replyingTo !== anfrage.id"
            )
              span ✉️
              | Antworten
            button.btn-action.btn-delete(@click.stop="deleteAnfrage(anfrage)")
              span 🗑️
              | Anfrage löschen

          .reply-success(v-if="replySuccess === anfrage.id")
            span ✓ Antwort gesendet an {{ anfrage.contactEmail }}

          .reply-form(v-if="replyingTo === anfrage.id")
            .reply-form-header
              .reply-form-title ✉️ Antwort an {{ anfrage.name }}
              .reply-form-to {{ anfrage.contactEmail }}
              button.reply-close(@click.stop="cancelReply") ✕
            .reply-form-body
              label.reply-label Betreff
              input.reply-subject(
                v-model="replySubject"
                placeholder="Betreff"
                @click.stop
              )
              label.reply-label Nachricht
              textarea.reply-body(
                v-model="replyMessage"
                placeholder="Deine Antwort..."
                rows="6"
                @click.stop
              )
              .reply-error(v-if="replyError") ⚠️ {{ replyError }}
              .reply-form-actions
                button.btn-send(
                  @click.stop="sendReply(anfrage)"
                  :disabled="replySending || !replyMessage.trim()"
                ) {{ replySending ? '⏳ Wird gesendet...' : '📤 Senden' }}
                button.btn-cancel(@click.stop="cancelReply") Abbrechen

  .empty-state(v-else)
    .empty-icon 📭
    p Keine Anfragen gefunden
    p.empty-hint(v-if="searchQuery || filterType !== 'all' || filterRead !== 'all'") Versuche andere Filter oder Suchbegriffe
</template>

<style scoped>
.anfragen-list-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.unread-badge {
  background: black;
  color: white;
  font-size: 0.75rem;
  padding: 0.3rem 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  font-size: 0.85rem;
  pointer-events: none;
}

.search-input {
  padding: 0.6rem 1rem 0.6rem 2.25rem;
  border: 0.2rem solid black;
  font-size: 0.9rem;
  min-width: 260px;
  font-weight: 600;
  transition: all 0.15s;
}

.search-input:focus {
  outline: none;
  border-color: black;
  box-shadow: 3px 3px 0 black;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-chips {
  display: flex;
}

.chip {
  padding: 0.4rem 0.9rem;
  border: 0.2rem solid black;
  background: white;
  color: black;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: -0.2rem;
}

.chip:first-child {
  margin-left: 0;
}

.chip.active {
  background: black;
  color: white;
  position: relative;
  z-index: 1;
}

.chip:hover:not(.active) {
  background: #e8e8e8;
}

.filter-type select {
  padding: 0.4rem 0.75rem;
  border: 0.2rem solid black;
  font-weight: 600;
  font-size: 0.85rem;
  background: white;
  cursor: pointer;
}

.count-bar {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 1rem;
}

/* Loading & Error */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #555;
  font-weight: 600;
}

.loading-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 0.2rem solid #ddd;
  border-top-color: black;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #fff5f5;
  border: 0.25rem solid black;
  font-weight: 600;
}

.error-icon {
  font-size: 1.2rem;
}

.btn-retry {
  margin-left: auto;
  padding: 0.35rem 0.75rem;
  border: 0.2rem solid black;
  background: white;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-retry:hover {
  background: black;
  color: white;
}

/* Cards */
.anfragen-container {
  display: grid;
  gap: 0.75rem;
}

.anfrage-card {
  border: 0.2rem solid black;
  transition: all 0.15s;
  background: white;
}

.anfrage-card.unread {
  border-left: 0.4rem solid black;
  background: #fafafa;
}

.anfrage-card.expanded {
  box-shadow: 4px 4px 0 black;
}

.anfrage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1.25rem;
  cursor: pointer;
  gap: 1rem;
  user-select: none;
}

.anfrage-header:hover {
  background: #f5f5f5;
}

.anfrage-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: black;
  flex-shrink: 0;
}

.type-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.2rem 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.type-band {
  background: #2d1b69;
  color: white;
}

.type-event {
  background: #1a4731;
  color: white;
}

.type-rent {
  background: #6b3a00;
  color: white;
}

.type-other {
  background: #333;
  color: white;
}

.anfrage-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.anfrage-name {
  font-weight: 900;
  font-size: 0.95rem;
  white-space: nowrap;
}

.anfrage-email {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.anfrage-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.anfrage-time {
  font-size: 0.75rem;
  color: #888;
  font-weight: 600;
  white-space: nowrap;
}

.expand-icon {
  font-size: 0.6rem;
  color: #999;
  transition: transform 0.2s;
}

/* Preview */
.anfrage-preview {
  padding: 0 1.25rem 0.9rem;
  padding-left: calc(1.25rem + 8px + 0.75rem);
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
}

.anfrage-card.unread .anfrage-preview {
  color: #444;
}

/* Details */
.anfrage-details {
  padding: 0 1.25rem 1.25rem;
  border-top: 0.15rem solid #e0e0e0;
}

.detail-section {
  padding-top: 1rem;
  margin-bottom: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.detail-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 0.25rem;
}

.detail-value {
  font-size: 0.9rem;
  font-weight: 600;
}

/* Message */
.message-section {
  padding-top: 1rem;
  margin-bottom: 1rem;
}

.message-text {
  font-size: 0.9rem;
  line-height: 1.7;
  white-space: pre-wrap;
  background: #f8f8f8;
  padding: 1rem;
  border-left: 0.25rem solid #ddd;
}

/* Last Reply */
.last-reply-section {
  background: #f0f7f0;
  border: 0.15rem solid #c0d8c0;
  padding: 1rem;
  margin-bottom: 1rem;
}

.last-reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 800;
  font-size: 0.8rem;
}

.last-reply-date {
  font-weight: 600;
  font-size: 0.75rem;
  color: #666;
}

.last-reply-subject {
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}

.last-reply-body {
  font-size: 0.85rem;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #333;
}

/* Actions */
.anfrage-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 0.15rem solid #e0e0e0;
  flex-wrap: wrap;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.9rem;
  border: 0.2rem solid black;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
  color: black;
}

.btn-action:hover {
  box-shadow: 2px 2px 0 black;
  transform: translate(-1px, -1px);
}

.btn-action:active {
  box-shadow: none;
  transform: translate(0, 0);
}

.btn-delete {
  border-color: #c00;
  color: #c00;
}

.btn-delete:hover {
  background: #c00;
  color: white;
  box-shadow: 2px 2px 0 #900;
}

/* Reply Success */
.reply-success {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: #e8f5e9;
  border: 0.15rem solid #4caf50;
  font-weight: 700;
  font-size: 0.85rem;
  color: #2e7d32;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Reply Form */
.reply-form {
  margin-top: 0.75rem;
  border: 0.25rem solid black;
  overflow: hidden;
  animation: fadeIn 0.2s;
}

.reply-form-header {
  background: black;
  color: white;
  padding: 0.75rem 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0.15rem;
  align-items: center;
}

.reply-form-title {
  font-weight: 800;
  font-size: 0.9rem;
}

.reply-form-to {
  font-size: 0.8rem;
  opacity: 0.8;
  grid-column: 1;
}

.reply-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.3rem;
  cursor: pointer;
  font-weight: 900;
  padding: 0 0.25rem;
  grid-row: 1 / 3;
  grid-column: 2;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.reply-close:hover {
  opacity: 1;
}

.reply-form-body {
  padding: 1rem;
}

.reply-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 0.3rem;
}

.reply-label + .reply-label {
  margin-top: 0.75rem;
}

.reply-subject {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0.15rem solid #ccc;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.reply-body {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 0.15rem solid #ccc;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  min-height: 120px;
  box-sizing: border-box;
  line-height: 1.6;
  transition: border-color 0.15s;
}

.reply-body:focus, .reply-subject:focus {
  outline: none;
  border-color: black;
}

.reply-error {
  color: #c00;
  font-weight: 700;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fff5f5;
  border: 0.1rem solid #fcc;
}

.reply-form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-send {
  padding: 0.55rem 1.5rem;
  border: 0.2rem solid black;
  background: black;
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-send:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-send:not(:disabled):hover {
  box-shadow: 2px 2px 0 #333;
  transform: translate(-1px, -1px);
}

.btn-cancel {
  padding: 0.55rem 1rem;
  border: 0.2rem solid #ccc;
  background: white;
  color: #666;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  border-color: black;
  color: black;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin: 0.25rem 0;
  font-weight: 700;
  font-size: 1rem;
  color: #555;
}

.empty-hint {
  font-size: 0.85rem !important;
  font-weight: 500 !important;
  color: #999 !important;
}

/* Transition */
.slide-enter-active, .slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  max-height: 0;
}

/* Mobile */
@media (max-width: 768px) {
  .anfragen-list-view {
    padding: 1rem;
    border-width: 0.35rem;
  }

  .header {
    flex-direction: column;
  }

  .search-input {
    min-width: 100%;
  }

  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .anfrage-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .anfrage-right {
    width: 100%;
    justify-content: space-between;
  }

  .anfrage-preview {
    padding-left: 1.25rem;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .anfrage-actions {
    flex-direction: column;
  }

  .btn-action {
    width: 100%;
    justify-content: center;
  }
}
</style>
