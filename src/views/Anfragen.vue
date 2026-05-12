<template lang="pug">
.anfragen
  .success-message(v-if="submitted")
    h1 ✓ Anfrage gesendet
    p Vielen Dank! Wir werden uns in Kürze bei dir melden.
    button.btn-back(@click="reset") Neue Anfrage stellen

  template(v-else)
    h1 Anfrage stellen

    h3 Infos zur Location
    .info-grid
      span.info-label 🏠 Kapazität
      span.info-value 200 Personen (stehend)
      span.info-label 🎤 Bühne
      span.info-value 5m × 3m, Höhe ca. 43cm (3 Europaletten)
      span.info-label 🔊 PA
      span.info-value 2 Subs + 4 Tops, Allen & Heath SQ5
      span.info-label 🎧 Monitoring
      span.info-value 4 Monitorwege
      span.info-label 💡 Licht
      span.info-value Grundausstattung vorhanden
      span.info-label 🥁 Backline
      span.info-value Drumkit + Bass-Amp nach Absprache
      span.info-label 🚗 Load-In
      span.info-value Ebenerdig, Parkplatz direkt vor der Tür
      span.info-label 💰 Gagenmodell
      span.info-value Tür-Split, VVK-Split oder Festgage — nach Absprache

    h2 Anfrage

    form.request-form(@submit.prevent="submitForm")
      .form-group
        label Art der Anfrage *
        select(v-model="form.type" required)
          option(value="" disabled) Bitte wählen
          option(value="band") Band / Booking
          option(value="event") Veranstaltung
          option(value="rent") Vermietung
          option(value="other") Sonstiges

      .form-group
        label {{ form.type === 'band' ? 'Bandname *' : 'Name / Organisation *' }}
        input(v-model="form.name" required :placeholder="form.type === 'band' ? 'Bandname' : 'Dein Name oder Organisation'")

      .form-group
        label E-Mail *
        input(v-model="form.contactEmail" type="email" required placeholder="deine@email.de")

      //- ── Band-spezifische Felder ──
      template(v-if="form.type === 'band'")
        .form-group
          label Link zur Musik *
          input(v-model="form.musicLink" required placeholder="Bandcamp, Spotify, YouTube, etc.")
          .form-hint So können wir uns einen Eindruck verschaffen

        .form-row
          .form-group.half
            label Genre
            select(v-model="form.genre")
              option(value="") —
              option(v-for="g in genres" :key="g" :value="g") {{ g }}
          .form-group.half
            label Anzahl Personen
            input(v-model="form.persons" type="number" min="1" max="30" placeholder="z.B. 4")

        .form-group
          label Woher kommt ihr?
          input(v-model="form.origin" placeholder="Stadt / Land")

        .form-group
          label Wunschzeitraum
          .date-row
            .date-field
              label.date-label von
              input(type="date" v-model="form.dateStart")
            .date-field
              label.date-label bis
              input(type="date" v-model="form.dateEnd")
          .form-hint Oder einfach in der Nachricht beschreiben

        .form-group
          label Technische Anforderungen
          textarea(v-model="form.technicalRequirements" rows="3" placeholder="Eigene Backline? Besondere Monitoring-Wünsche? DI-Boxen? Wie viele Mikros?")

        .form-group
          label Gagenvorstellung
          input(v-model="form.budget" placeholder="z.B. Hutkonzert, Tür-Split, 300€ Festgage...")

      //- ── Event/Vermietung-spezifische Felder ──
      template(v-if="form.type === 'event' || form.type === 'rent'")
        .form-group
          label Datum
          .date-row
            .date-field
              label.date-label von
              input(type="date" v-model="form.dateStart")
            .date-field
              label.date-label bis
              input(type="date" v-model="form.dateEnd")

        .form-group
          label Erwartete Besucherzahl
          input(v-model="form.persons" type="number" min="1" placeholder="z.B. 80")

        .form-group
          label Budget
          input(v-model="form.budget" placeholder="z.B. 500€, nach Absprache...")

      //- ── Sonstige ──
      template(v-if="form.type === 'other'")
        .form-group
          label Zeitraum
          .date-row
            .date-field
              label.date-label von
              input(type="date" v-model="form.dateStart")
            .date-field
              label.date-label bis
              input(type="date" v-model="form.dateEnd")

      .form-group
        label Nachricht *
        textarea(v-model="form.message" required rows="6" :placeholder="messagePlaceholder")

      //- Honeypot (hidden from users, visible to bots)
      input.hp-field(v-model="form.honeypot" tabindex="-1" autocomplete="off")

      .form-error(v-if="error") {{ error }}

      button.btn-submit(:disabled="submitting" type="submit")
        | {{ submitting ? 'Wird gesendet...' : 'Anfrage absenden' }}
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
import { API_BASE_URL } from '@/services/api'
import axios from 'axios'

const genres = [
  'Punk', 'Rock', 'Metal', 'Pop', 'Jazz', 'Blues',
  'Funk', 'Reggae', 'Hip Hop / Rap', 'Elektronisch', 'Singer-Songwriter', 'Sonstiges',
]

const form = reactive({
  type: '',
  name: '',
  contactEmail: '',
  genre: '',
  dateStart: '',
  dateEnd: '',
  technicalRequirements: '',
  message: '',
  budget: '',
  honeypot: '',
  // Band-specific (composed into message)
  musicLink: '',
  persons: '',
  origin: '',
})

const messagePlaceholder = computed(() => {
  switch (form.type) {
    case 'band': return 'Erzähl uns kurz was über euch, eure Tour, etc.'
    case 'event': return 'Was für eine Veranstaltung plant ihr? (Konzert, Party, Lesung, ...)'
    case 'rent': return 'Wofür möchtet ihr den Raum nutzen?'
    default: return 'Was können wir für dich tun?'
  }
})

const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

function buildMessage(): string {
  let msg = form.message
  const extras: string[] = []

  if (form.musicLink) extras.push(`Musik: ${form.musicLink}`)
  if (form.origin) extras.push(`Herkunft: ${form.origin}`)
  if (form.persons) extras.push(`Personen: ${form.persons}`)

  if (extras.length) {
    msg = extras.join('\n') + '\n\n' + msg
  }
  return msg
}

async function submitForm() {
  error.value = ''
  submitting.value = true

  try {
    const payload: Record<string, string | null> = {
      type: form.type,
      name: form.name,
      contactEmail: form.contactEmail,
      message: buildMessage(),
      budget: form.budget || '',
      honeypot: form.honeypot,
      genre: form.genre || null,
      dateStart: form.dateStart || null,
      dateEnd: form.dateEnd || null,
      technicalRequirements: form.technicalRequirements || null,
    }

    await axios.post(`${API_BASE_URL}/api/anfragen/`, payload, {
      headers: { 'Content-Type': 'application/json' },
    })

    submitted.value = true
  } catch (e: any) {
    if (e.response?.data) {
      const data = e.response.data
      if (typeof data === 'object') {
        const messages = Object.entries(data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n')
        error.value = messages
      } else {
        error.value = String(data)
      }
    } else {
      error.value = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
    }
  } finally {
    submitting.value = false
  }
}

function reset() {
  submitted.value = false
  form.type = ''
  form.name = ''
  form.contactEmail = ''
  form.genre = ''
  form.dateStart = ''
  form.dateEnd = ''
  form.technicalRequirements = ''
  form.message = ''
  form.budget = ''
  form.honeypot = ''
  form.musicLink = ''
  form.persons = ''
  form.origin = ''
}
</script>

<style scoped>
.anfragen {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  font-weight: 900;
  text-transform: uppercase;
}

h2 {
  margin-top: 2rem;
  font-weight: 900;
}

h3 {
  font-weight: 700;
  margin-top: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  margin: 1rem 0;
  border: 0.15rem solid black;
}

.info-label,
.info-value {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #ddd;
}

.info-grid > :nth-last-child(-n+2) {
  border-bottom: none;
}

.info-label {
  font-weight: 800;
  font-size: 0.8rem;
  text-transform: uppercase;
  white-space: nowrap;
  background: #f5f5f5;
}

.info-value {
  font-size: 0.85rem;
}

.request-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-weight: 700;
  font-size: 0.9rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group.half {
  flex: 1;
}

.form-hint {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.2rem;
}

input, select, textarea {
  padding: 0.6rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 1rem;
  font-family: inherit;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #333;
  box-shadow: 3px 3px 0 black;
}

textarea {
  resize: vertical;
}

.date-row {
  display: flex;
  gap: 1rem;
}

.date-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-label {
  font-weight: 400 !important;
  font-size: 0.85rem !important;
}

.btn-submit {
  padding: 0.75rem 2rem;
  border: 0.3rem solid black;
  background: black;
  color: white;
  font-weight: 900;
  font-size: 1.1rem;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.1s;
}

.btn-submit:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 black;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-error {
  background: #fee;
  border: 0.2rem solid #c00;
  padding: 0.75rem;
  font-weight: 600;
  white-space: pre-line;
}

.success-message {
  text-align: center;
  padding: 3rem 1rem;
}

.success-message h1 {
  color: #090;
  font-size: 2rem;
}

.success-message p {
  font-size: 1.2rem;
  margin: 1rem 0 2rem;
}

.btn-back {
  padding: 0.5rem 1.5rem;
  border: 0.2rem solid black;
  background: white;
  font-weight: 700;
  cursor: pointer;
}

.btn-back:hover {
  background: black;
  color: white;
}

/* Honeypot: hidden from humans */
.hp-field {
  position: absolute;
  left: -9999px;
  opacity: 0;
  height: 0;
  width: 0;
  overflow: hidden;
}
</style>