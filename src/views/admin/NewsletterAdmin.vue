<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/de'
import { eventService } from '@/services/events'
import type { Event, Artist } from '@/services/events'

dayjs.locale('de')

const title = ref('')
const content = ref('')
const textContent = ref('')
const isGenerating = ref(false)
const isSending = ref(false)
const sendSuccess = ref<'test' | 'live' | null>(null)
const error = ref('')

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

    html += `<h2>Diese Woche im Autohaus: ${dateStr} – ${event.title}</h2>\n`
    html += `<p><strong>Einlass: ${timeStr} Uhr</strong></p>\n`

    if (event.image_url) {
      html += `<p><img src="${event.image_url}" alt="${event.title}" style="max-width:100%;height:auto;"></p>\n`
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

    text += `Diese Woche im Autohaus: ${dateStr} – ${event.title}\n`
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

async function generateProposal() {
  isGenerating.value = true
  error.value = ''
  sendSuccess.value = null

  try {
    const { start, end } = getNextWeekRange()
    const response = await eventService.getAll()
    const allEvents: Event[] = response.results || []

    const weekEvents = allEvents
      .filter(e => {
        const d = dayjs(e.date)
        return d.isAfter(start.subtract(1, 'ms')) && d.isBefore(end.add(1, 'ms'))
      })
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())

    if (weekEvents.length === 0) {
      error.value = `Keine Events in der Woche ${start.format('DD.MM.')} – ${end.format('DD.MM.YYYY')} gefunden.`
      return
    }

    const titleParts = weekEvents.map(e => {
      const dateShort = dayjs(e.date).locale('de').format('DD.MM.')
      return `${dateShort} ${e.title}`
    })
    title.value = titleParts.join('  /  ')
    content.value = buildNewsletterHtml(weekEvents)
    textContent.value = buildNewsletterText(weekEvents)
  } catch (e: any) {
    error.value = 'Fehler beim Laden der Events: ' + (e?.message || e)
  } finally {
    isGenerating.value = false
  }
}

async function sendNewsletter(test = false) {
  if (!title.value || !content.value) return
  isSending.value = true
  error.value = ''
  sendSuccess.value = null

  try {
    await eventService.sendNewsletter(title.value, content.value, textContent.value, test)
    sendSuccess.value = test ? 'test' : 'live'
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
    h1 Newsletter versenden

  .proposal-section
    button.btn-primary(
      @click="generateProposal"
      :disabled="isGenerating || isSending"
    ) {{ isGenerating ? 'Wird geladen...' : 'Vorschlag erstellen' }}
    p.week-info(v-if="!isGenerating")
      | Nächste Woche: {{ getNextWeekRange().start.format('DD.MM.') }} – {{ getNextWeekRange().end.format('DD.MM.YYYY') }}

  .error-message(v-if="error") {{ error }}
  .success-message(v-if="sendSuccess === 'test'") Test-Newsletter erfolgreich versendet!
  .success-message(v-if="sendSuccess === 'live'") Newsletter erfolgreich versendet!

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
</template>

<style scoped>
.newsletter-admin {
  max-width: 900px;
}

.page-header {
  margin-bottom: 2rem;
  border-bottom: 0.5rem solid black;
  padding-bottom: 1rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 900;
  margin: 0;
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
