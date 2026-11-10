<template lang="pug">
.fz
  FanzineNav(label="Anfrage")
  header.fz-page-head
    h1.fz-page-title(aria-label="Anfrage")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Anfrage')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub Für Anfragen verwendet bitte dieses Formular. Anfragen per E-Mail werden wir wahrscheinlich nicht sehen.
  .fz-request
    .fz-box.success-message(v-if="submitted")
      h2.fz-h2 Anfrage gesendet
      p Vielen Dank! Wir werden uns in Kürze bei dir melden.
      button.btn-back(@click="reset") Neue Anfrage stellen

    template(v-else)
      .fz-label Infos zur Location
      .fz-box.fz-datasheet
        dl.fz-form-fields
          dt Kapazität
          dd 199 Personen (stehend)
          dt Bühne
          dd 5m × 3m, Höhe ca. 43cm (3 Europaletten)
          dt PA
          dd 2 Subs + 4 Tops, Allen & Heath SQ5
          dt Monitoring
          dd 4 Monitorwege
          dt Licht
          dd Grundausstattung vorhanden
          dt Backline
          dd Nur nach Absprache
          dt Load-In
          dd Ebenerdig, Parkplatz direkt vor der Tür
          dt Gagenmodell
          dd Garantie und/oder Tür-Anteil — nach Absprache

      .fz-label.fz-request-title Deine Anfrage

      form.request-form(@submit.prevent="submitForm")
        .form-group
          label Art der Anfrage *
          select(v-model="form.type" required)
            option(value="" disabled) Bitte wählen
            option(value="band") Band / Booking
            option(value="event") Veranstaltung
            option(value="rent") Vermietung
            option(value="other") Sonstiges
          .form-hint.hint-warning(v-if="form.type === 'rent'") Achtung: Private Feiern (z.B. Geburtstage) bieten wir nicht an. Für kulturelle Veranstaltungen von Vereinen, Initiativen oder Kollektiven ist eine Vermietung nach Absprache aber möglich.
          .form-hint.hint-info(v-if="form.type === 'event'")
            | Tipp: Du hast eine eigene Idee für eine Veranstaltung? Am besten stellst du sie persönlich bei einem unserer Treffen vor. Die Termine geben wir hier bekannt:&nbsp;
            a(href="https://t.me/+PCvpsCalJzkyNzFi" target="_blank" rel="noopener") Telegram-Gruppe

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
            input(v-model="form.budget" placeholder="z.B. gewünschte Garantie und/oder Tür-Anteil")
            .form-hint Garantie und Tür-Anteil sind Verhandlungssache.

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
import FanzineNav from '@/components/FanzineNav.vue'
import { ransomChars } from '@/utils/ransom'

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
      origin: form.origin || null,
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
.fz-request { max-width: 56rem; margin-top: 2.5rem; }

.fz-datasheet { margin-bottom: 2.5rem; }
.fz-datasheet .fz-form-fields { margin: 0; }
.fz-request-title { margin-bottom: 1.5rem; }

.request-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group.half {
  flex: 1;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
  }
}

.form-hint {
  font-size: 0.85rem;
  margin-top: 0.2rem;
}

.hint-warning {
  padding: 0.5rem 0.75rem;
  border: 0.15rem solid #000;
  background: var(--mark);
  font-weight: 900;
}

.hint-info {
  padding-left: 0.75rem;
  border-left: 0.4rem solid #000;
  font-weight: 700;
}

input, select, textarea {
  padding: 0.6rem 0.75rem;
  border: 0.2rem solid black;
  border-radius: 0;
  background: #fff;
  font-size: 1rem;
  font-family: inherit;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  box-shadow: 0.3rem 0.3rem 0 black;
}

textarea {
  resize: vertical;
}

.date-row {
  display: flex;
  flex-wrap: wrap;
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
  text-transform: none !important;
}

.btn-submit {
  align-self: flex-start;
  padding: 0.6em 1.4em;
  font-weight: 900;
  font-size: 0.95rem;
  text-transform: uppercase;
  cursor: pointer;
}

.form-error {
  border: 0.2rem solid black;
  border-left: 0.8rem solid var(--alert);
  padding: 0.75rem;
  font-weight: 700;
  white-space: pre-line;
}

.success-message { border-left: 0.8rem solid var(--multi); background: var(--soft); }

.success-message p {
  margin: 1rem 0 0;
}

.btn-back {
  padding: 0.45em 0.9em;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  cursor: pointer;
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
