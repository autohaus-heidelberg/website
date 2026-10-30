<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import 'dayjs/locale/de'
import { eventService } from '@/services/events'
import type { Event, Artist, SentNewsletter } from '@/services/events'

dayjs.locale('de')

const route = useRoute()
const router = useRouter()

type Tab = 'compose' | 'history'
const activeTab = ref<Tab>(route.query.tab === 'history' ? 'history' : 'compose')

function switchTab(tab: Tab) {
  activeTab.value = tab
  const query = { ...route.query }
  if (tab === 'compose') delete query.tab
  else query.tab = tab
  router.replace({ query })
  if (tab === 'history') loadHistory()
}

const title = ref('')
const content = ref('')
const textContent = ref('')
const isGenerating = ref(false)
const isSending = ref(false)
const sendSuccess = ref<'test' | 'live' | null>(null)
const error = ref('')

// Verlauf der zuletzt versendeten Newsletter
const sentNewsletters = ref<SentNewsletter[]>([])
const isLoadingHistory = ref(false)

// Kandidaten (kommende Events) und die vom Nutzer gewählte Teilmenge
const candidateEvents = ref<Event[]>([])
const selectedEventIds = ref<string[]>([])

const selectedEvents = computed(() =>
  candidateEvents.value
    .filter(e => selectedEventIds.value.includes(e.id))
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
)

function getNextWeekRange(): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const today = dayjs()
  return { start: today, end: today.add(7, 'days').endOf('day') }
}

function getOrderedArtists(event: Event): Artist[] {
  if (event.artistOrder) {
    const orderIds = event.artistOrder
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id))
    const ordered = orderIds
      .map(id => event.artists.find(a => a.id === id))
      .filter((a): a is Artist => a !== undefined)
    const remaining = event.artists.filter(a => !orderIds.includes(a.id!))
    return [...ordered, ...remaining]
  }
  return event.artists
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

function buildNewsletterHtml(events: Event[]): string {
  let html = ''

  for (const event of events) {
    const dateStr = dayjs(event.date).locale('de').format('dddd, DD. MMMM YYYY')
    const timeStr = dayjs(event.date).format('HH:mm')

    html += `<h2>${dateStr} – ${event.title}</h2>\n`
    html += `<p><strong>Einlass: ${timeStr} Uhr</strong></p>\n`

    if (event.image) {
      const filename = event.image.replace(/^.*upload\//, '')
      html += `<p><img src="https://altesauto.haus/img/${filename}" alt="${event.title}" style="max-width:100%;height:auto;"></p>\n`
    }

    html += event.descriptionShort + '\n'

    const artists = getOrderedArtists(event)
    for (const artist of artists) {
      html += `\n<h3>${artist.name}</h3>\n`
      if (artist.description) {
        html += `<p>${artist.description}</p>\n`
      }
    }

    html += `\n<p>`
    html += `<a href="https://altesauto.haus/event/${event.id}">Mehr Infos</a>`
    if (event.shopLink) {
      html += ` &nbsp;|&nbsp; <a href="${event.shopLink}">Tickets kaufen</a>`
    }
    html += `</p>\n`
    html += `\n<hr>\n\n`
  }

  html += `<p><a href="https://altesauto.haus">Zur Homepage</a></p>\n`
  html += `<p style="font-size: 0.85em; color: #666;">Du möchtest keine Newsletter mehr erhalten? <a href="{%link_unsubscribe}">Hier abmelden</a></p>\n`

  return html
}

function buildNewsletterText(events: Event[]): string {
  let text = ''

  for (const event of events) {
    const dateStr = dayjs(event.date).locale('de').format('dddd, DD. MMMM YYYY')
    const timeStr = dayjs(event.date).format('HH:mm')

    text += `${dateStr} – ${event.title}\n`
    text += `${'='.repeat(60)}\n\n`
    text += `Einlass: ${timeStr} Uhr\n\n`
    text += stripHtml(event.descriptionShort) + '\n'

    const artists = getOrderedArtists(event)
    for (const artist of artists) {
      text += `\n--- ${artist.name} ---\n`
      if (artist.description) {
        text += stripHtml(artist.description) + '\n'
      }
    }

    text += `\nMehr Infos: https://altesauto.haus/event/${event.id}\n`
    if (event.shopLink) {
      text += `Tickets kaufen: ${event.shopLink}\n`
    }
    text += `\n${'─'.repeat(40)}\n\n`
  }

  text += `Zur Homepage: https://altesauto.haus\n\n`
  text += `Du möchtest keine Newsletter mehr erhalten? {%link_unsubscribe}\n`

  return text
}

function eventDateShort(iso: string): string {
  return dayjs(iso).locale('de').format('DD.MM.')
}

function sentDateOnly(iso: string): string {
  return dayjs(iso).locale('de').format('DD.MM.YYYY')
}

function sentTimeOnly(iso: string): string {
  return dayjs(iso).locale('de').format('HH:mm')
}

// Sichtbare Betreff-Länge in gängigen Postfächern liegt bei ~70 Zeichen.
const MAX_SUBJECT = 70

// 1 Event: Datum + Titel; mehrere: mit dem nächsten Event führen und
// den Rest als "+ N weitere Termine" anhängen. Immer auf MAX_SUBJECT begrenzt.
function buildSubject(evs: Event[]): string {
  if (evs.length === 1) {
    const e = evs[0]
    const prefix = `${eventDateShort(e.date)} `
    return prefix + truncate(e.title, MAX_SUBJECT - prefix.length)
  }
  if (evs.length === 2) {
    const detailed = evs.map(e => `${eventDateShort(e.date)} ${e.title}`).join('  /  ')
    if (detailed.length <= MAX_SUBJECT) return detailed
  }
  return leadSubject(evs)
}

function leadSubject(evs: Event[]): string {
  const first = evs[0]
  const rest = evs.length - 1
  const suffix = rest === 1 ? ' + 1 weiterer Termin' : ` + ${rest} weitere Termine`
  const prefix = `${eventDateShort(first.date)} `
  const title = truncate(first.title, MAX_SUBJECT - prefix.length - suffix.length)
  return prefix + title + suffix
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}

function rebuildNewsletter() {
  const evs = selectedEvents.value
  if (evs.length === 0) {
    title.value = ''
    content.value = ''
    textContent.value = ''
    return
  }
  title.value = buildSubject(evs)
  content.value = buildNewsletterHtml(evs)
  textContent.value = buildNewsletterText(evs)
}

async function generateProposal() {
  isGenerating.value = true
  error.value = ''
  sendSuccess.value = null

  try {
    const { start, end } = getNextWeekRange()
    const response = await eventService.getAll()
    const allEvents: Event[] = response.results || []

    const upcoming = allEvents
      .filter(e => dayjs(e.date).isAfter(start.subtract(1, 'ms')))
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())

    if (upcoming.length === 0) {
      candidateEvents.value = []
      selectedEventIds.value = []
      error.value = 'Keine kommenden Veranstaltungen gefunden.'
      return
    }

    candidateEvents.value = upcoming
    // Standardmäßig die Events der nächsten Woche vorauswählen
    selectedEventIds.value = upcoming
      .filter(e => {
        const d = dayjs(e.date)
        return d.isAfter(start.subtract(1, 'ms')) && d.isBefore(end.add(1, 'ms'))
      })
      .map(e => e.id)

    rebuildNewsletter()
  } catch (e: any) {
    error.value = 'Fehler beim Laden der Events: ' + (e?.message || e)
  } finally {
    isGenerating.value = false
  }
}

function toggleEvent(id: string) {
  if (selectedEventIds.value.includes(id)) {
    selectedEventIds.value = selectedEventIds.value.filter(x => x !== id)
  } else {
    selectedEventIds.value = [...selectedEventIds.value, id]
  }
  rebuildNewsletter()
}

onMounted(() => {
  generateProposal()
  // Verlauf vorab laden, wenn direkt auf dem Verlauf-Tab gestartet wird.
  if (activeTab.value === 'history') loadHistory()
})

async function loadHistory() {
  isLoadingHistory.value = true
  try {
    sentNewsletters.value = await eventService.getSentNewsletters()
  } catch {
    // Verlauf ist optional – Fehler hier nicht aufdringlich anzeigen.
    sentNewsletters.value = []
  } finally {
    isLoadingHistory.value = false
  }
}

async function sendNewsletter(test = false) {
  if (!title.value || !content.value) return
  isSending.value = true
  error.value = ''
  sendSuccess.value = null

  try {
    const eventIds = selectedEvents.value.map(e => e.id)
    await eventService.sendNewsletter(title.value, content.value, textContent.value, test, eventIds)
    sendSuccess.value = test ? 'test' : 'live'
    if (!test) {
      // Verlauf aktualisieren, damit der neue Versand sofort erscheint.
      loadHistory()
    }
  } catch (e: any) {
    error.value = 'Fehler beim Versenden: ' + (e?.message || e)
  } finally {
    isSending.value = false
  }
}
</script>

<template lang="pug">
.newsletter-admin
  .page-header
    h2 Newsletter versenden
    .tab-bar
      button.tab(:class="{ active: activeTab === 'compose' }" @click="switchTab('compose')") ✍️ Erstellen
      button.tab(:class="{ active: activeTab === 'history' }" @click="switchTab('history')") 📨 Verlauf

  template(v-if="activeTab === 'compose'")
    .proposal-section
      button.btn-primary(
        @click="generateProposal"
        :disabled="isGenerating || isSending"
      ) {{ isGenerating ? 'Wird geladen...' : 'Vorschlag erstellen' }}
      p.week-info(v-if="!isGenerating")
        | Vorausgewählt: nächste Woche ({{ getNextWeekRange().start.format('DD.MM.') }} – {{ getNextWeekRange().end.format('DD.MM.YYYY') }})

    .error-message(v-if="error") {{ error }}
    .success-message(v-if="sendSuccess === 'test'") Test-Newsletter erfolgreich versendet!
    .success-message(v-if="sendSuccess === 'live'") Newsletter erfolgreich versendet!

    .event-selector(v-if="candidateEvents.length")
      .selector-head
        span.selector-title 📅 Welche Veranstaltungen aufnehmen?
        span.selector-summary {{ selectedEventIds.length }} von {{ candidateEvents.length }} ausgewählt
      .event-list
        label.event-option(
          v-for="ev in candidateEvents"
          :key="ev.id"
          :class="{ active: selectedEventIds.includes(ev.id) }"
        )
          input(type="checkbox" :checked="selectedEventIds.includes(ev.id)" @change="toggleEvent(ev.id)")
          span.ev-title {{ ev.title }}
          span.ev-date {{ eventDateShort(ev.date) }}
      p.selector-hint Auswahl ändern erzeugt Betreff und Inhalt neu.

    .form-section
      .field
        label(for="newsletter-title") Betreff
        input#newsletter-title(
          type="text"
          v-model="title"
          placeholder="z.B. 21.03. Konzertname  /  22.03. Anderes Event"
        )

      .field
        label(for="newsletter-content") Inhalt (HTML)
        textarea#newsletter-content(
          v-model="content"
          placeholder="Newsletter-Inhalt als HTML..."
          rows="20"
        )

      .field
        label(for="newsletter-text") Textversion (Plain Text)
        textarea#newsletter-text(
          v-model="textContent"
          placeholder="Newsletter-Inhalt als reiner Text..."
          rows="15"
        )

    .send-section(v-if="title && content")
      button.btn-test(
        @click="sendNewsletter(true)"
        :disabled="isSending || isGenerating"
      ) {{ isSending ? 'Wird versendet...' : 'Test versenden' }}
      button.btn-send(
        @click="sendNewsletter(false)"
        :disabled="isSending || isGenerating"
      ) {{ isSending ? 'Wird versendet...' : 'Newsletter jetzt versenden' }}

    .preview-section(v-if="content")
      h2 Vorschau
      .preview-box(v-html="content")

  template(v-else)
    .history-section
      .history-head
        span.history-title 📨 Zuletzt versendete Newsletter
        span.history-summary(v-if="!isLoadingHistory && sentNewsletters.length") {{ sentNewsletters.length }} im Verlauf
      p.history-empty(v-if="isLoadingHistory") Verlauf wird geladen …
      p.history-empty(v-else-if="!sentNewsletters.length") Noch keine Newsletter versendet.
      ul.history-list(v-else)
        li.history-item(v-for="nl in sentNewsletters" :key="nl.id")
          .history-when
            span.when-date {{ sentDateOnly(nl.sent_at) }}
            span.when-time {{ sentTimeOnly(nl.sent_at) }} Uhr
            span.when-by(v-if="nl.sent_by_name") {{ nl.sent_by_name }}
          .history-body
            .history-subject
              span.subject-label Betreff
              span.subject-text {{ nl.subject }}
            .history-events(v-if="nl.event_snapshot.length")
              span.events-label Enthaltene Events
              .events-chips
                span.history-event(v-for="ev in nl.event_snapshot" :key="ev.id")
                  span.he-date(v-if="ev.date") {{ eventDateShort(ev.date) }}
                  |  {{ ev.title }}
            .history-events.muted(v-else) Keine Events verknüpft
</template>

<style scoped>
.newsletter-admin {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.page-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-header h2 {
  font-size: 1.75rem;
  font-weight: 900;
  margin: 0;
}

.tab-bar {
  display: flex;
  align-self: stretch;
  gap: 0.5rem;
  border-bottom: 0.25rem solid black;
}

.tab {
  padding: 0.625rem 1.25rem;
  border: 0.25rem solid black;
  border-bottom: none;
  background: #f0f0f0;
  color: #666;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: -0.25rem;
}

.tab:hover:not(.active) {
  background: #e0e0e0;
  color: black;
}

.tab.active {
  background: black;
  color: white;
}

.proposal-section {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.week-info {
  font-weight: 600;
  margin: 0;
}

.error-message {
  border: 0.25rem solid black;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-weight: 600;
  background: black;
  color: white;
}

.success-message {
  border: 0.25rem solid black;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-weight: 600;
  background: white;
  color: black;
}

.event-selector {
  padding: 0.85rem 1rem;
  background: #f8f8f8;
  border: 0.25rem solid black;
  margin-bottom: 2rem;
}

.selector-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.selector-title { font-weight: 900; font-size: 1rem; }
.selector-summary { font-weight: 700; font-size: 0.8rem; color: #444; white-space: nowrap; }
.selector-hint { font-size: 0.78rem; color: #777; margin: 0.6rem 0 0; }

.event-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.event-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: #eaeaea;
  border: 0.15rem solid #ccc;
  font-size: 0.82rem;
  cursor: pointer;
  user-select: none;
}

.event-option:hover { border-color: #999; }
.event-option.active { background: black; color: white; border-color: black; }
.event-option input { cursor: pointer; }
.event-option .ev-title { font-weight: 700; }
.event-option .ev-date { opacity: 0.7; }

.history-section {
  padding: 0.85rem 1rem;
  background: #f8f8f8;
  border: 0.25rem solid black;
  margin-bottom: 2rem;
}

.history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.history-title { font-weight: 900; font-size: 1rem; }
.history-summary { font-weight: 700; font-size: 0.8rem; color: #444; white-space: nowrap; }
.history-empty { font-size: 0.85rem; color: #777; margin: 0; }

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.history-item {
  display: grid;
  grid-template-columns: 8.5rem 1fr;
  gap: 1rem;
  background: white;
  border: 0.15rem solid #ccc;
  padding: 0.75rem 0.9rem;
}

.history-when {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-right: 1rem;
  border-right: 0.15rem solid #eee;
}

.when-date { font-weight: 900; font-size: 0.9rem; }
.when-time { font-size: 0.78rem; color: #666; }
.when-by {
  margin-top: 0.3rem;
  font-size: 0.72rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.history-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.history-subject {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.history-subject .subject-label,
.events-label {
  font-weight: 700;
  font-size: 0.68rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.history-subject .subject-text {
  font-weight: 900;
  font-size: 0.95rem;
}

.history-events {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.history-events.muted { font-size: 0.8rem; color: #999; }

.events-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.history-event {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: #eaeaea;
  border: 0.1rem solid #ddd;
  font-size: 0.78rem;
}

.history-event .he-date { font-weight: 700; opacity: 0.7; }

@media (max-width: 640px) {
  .newsletter-admin {
    padding: 1rem;
  }
  .tab {
    flex: 1;
    padding: 0.625rem 0.5rem;
    font-size: 0.8rem;
    text-align: center;
  }
  .proposal-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .history-item {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .history-when {
    flex-direction: row;
    align-items: baseline;
    gap: 0.5rem;
    padding-right: 0;
    padding-bottom: 0.4rem;
    border-right: none;
    border-bottom: 0.15rem solid #eee;
  }
  .when-by { margin-top: 0; margin-left: auto; }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 900;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.field input,
.field textarea {
  width: 100%;
  border: 0.25rem solid black;
  padding: 0.75rem;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  resize: vertical;
  box-sizing: border-box;
}

.field textarea {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
}

.btn-primary {
  padding: 0.7em 1.5em;
  background: black;
  color: white;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.99);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 3rem;
}

.btn-test {
  padding: 0.7em 1.5em;
  background: white;
  color: black;
  border: 0.25rem dashed black;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.2s;
}

.btn-test:hover:not(:disabled) {
  background: #eee;
}

.btn-test:active:not(:disabled) {
  transform: scale(0.99);
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  padding: 0.7em 1.5em;
  background: white;
  color: black;
  border: 0.25rem solid black;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.2s;
}

.btn-send:hover:not(:disabled) {
  background: black;
  color: white;
}

.btn-send:active:not(:disabled) {
  transform: scale(0.99);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-section h2 {
  font-size: 1.25rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  border-bottom: 0.25rem solid black;
  padding-bottom: 0.5rem;
}

.preview-box {
  border: 0.5rem solid black;
  padding: 2rem;
  transform: rotate(0.5deg);
}
</style>
