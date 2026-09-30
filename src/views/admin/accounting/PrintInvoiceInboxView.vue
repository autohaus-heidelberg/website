<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  printInvoiceService,
  PRINT_INVOICE_SOURCE_LABELS,
  type PrintInvoice,
  type PrintInvoiceStatus,
} from '@/services/printInvoices'
import { eventService, type Event } from '@/services/events'

const invoices = ref<PrintInvoice[]>([])
const events = ref<Event[]>([])
const isLoading = ref(false)
const error = ref('')
const filterStatus = ref<PrintInvoiceStatus>('pending')
// Per-invoice chosen event id (defaults to the suggestion when present).
const selectedEvent = ref<Record<number, string>>({})
const busyId = ref<number | null>(null)
const toast = ref('')

const statusFilters: { v: PrintInvoiceStatus; l: string }[] = [
  { v: 'pending', l: 'Offen' },
  { v: 'assigned', l: 'Zugeordnet' },
  { v: 'ignored', l: 'Ignoriert' },
]

function setFilter(v: PrintInvoiceStatus) {
  filterStatus.value = v
  load()
}

const eventOptions = computed(() =>
  [...events.value].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
)

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const [invRes] = await Promise.all([
      printInvoiceService.getAll(filterStatus.value),
      events.value.length ? Promise.resolve(null) : loadEvents(),
    ])
    invoices.value = invRes.results
    const defaults: Record<number, string> = {}
    for (const inv of invoices.value) {
      if (inv.suggested_event) defaults[inv.id] = inv.suggested_event
    }
    selectedEvent.value = defaults
  } catch (e: any) {
    error.value = e.message || 'Rechnungen konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

async function loadEvents() {
  const res = await eventService.getAll()
  events.value = res.results
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { if (toast.value === msg) toast.value = '' }, 4000)
}

async function assign(inv: PrintInvoice, eventId?: string | null) {
  const target = eventId || selectedEvent.value[inv.id]
  if (!target) return
  busyId.value = inv.id
  error.value = ''
  try {
    await printInvoiceService.assign(inv.id, target)
    invoices.value = invoices.value.filter(i => i.id !== inv.id)
    const ev = events.value.find(e => e.id === target)
    showToast(`Rechnung „${inv.file_name}" zu „${ev?.title ?? 'Veranstaltung'}" kopiert.`)
  } catch (e: any) {
    error.value = e.message || 'Zuordnung fehlgeschlagen'
  } finally {
    busyId.value = null
  }
}

async function ignore(inv: PrintInvoice) {
  busyId.value = inv.id
  try {
    await printInvoiceService.ignore(inv.id)
    invoices.value = invoices.value.filter(i => i.id !== inv.id)
    showToast('Rechnung ignoriert.')
  } catch (e: any) {
    error.value = e.message || 'Aktion fehlgeschlagen'
  } finally {
    busyId.value = null
  }
}

async function remove(inv: PrintInvoice) {
  if (!confirm(`Rechnung „${inv.file_name}" endgültig löschen?`)) return
  busyId.value = inv.id
  try {
    await printInvoiceService.remove(inv.id)
    invoices.value = invoices.value.filter(i => i.id !== inv.id)
    showToast('Rechnung gelöscht.')
  } catch (e: any) {
    error.value = e.message || 'Löschen fehlgeschlagen'
  } finally {
    busyId.value = null
  }
}

async function preview(inv: PrintInvoice) {
  try {
    await printInvoiceService.openPdf(inv.id)
  } catch (e: any) {
    error.value = e.message || 'Vorschau fehlgeschlagen'
  }
}

function sourceLabel(inv: PrintInvoice): string {
  return PRINT_INVOICE_SOURCE_LABELS[inv.source] ?? inv.source
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

onMounted(load)
</script>

<template lang="pug">
.invoice-inbox
  header.page-header
    h1 Rechnungseingang
    p.subtitle Rechnungen aus dem Postfach einer Veranstaltung zuordnen — die PDF wird in deren Google-Drive-Ordner kopiert.

  .toolbar
    .filters
      button.filter-btn(
        v-for="opt in statusFilters"
        :key="opt.v"
        :class="{ active: filterStatus === opt.v }"
        @click="setFilter(opt.v)"
      ) {{ opt.l }}

  .toast(v-if="toast") {{ toast }}
  .error(v-if="error") {{ error }}

  .loading(v-if="isLoading") Lädt…
  .empty(v-else-if="!invoices.length")
    template(v-if="filterStatus === 'pending'") Keine offenen Rechnungen. 🎉
    template(v-else) Keine Einträge.

  .invoice-list(v-else)
    .invoice-card(v-for="inv in invoices" :key="inv.id")
      .card-head
        span.badge {{ sourceLabel(inv) }}
        span.file-name {{ inv.file_name }}
        span.date(v-if="inv.email_date") {{ formatDate(inv.email_date) }}

      .card-meta
        .subject(v-if="inv.subject") {{ inv.subject }}
        .from(v-if="inv.from_email") {{ inv.from_email }}

      //- Auto-suggestion (GEMA / MEININGER)
      .suggestion(v-if="filterStatus === 'pending' && inv.suggested_event")
        span.suggestion-label 💡 Vorschlag:
        strong {{ inv.suggested_event_title }}
        span.match-info(v-if="inv.match_info") ({{ inv.match_info }})
        button.btn.btn-primary.btn-sm(
          :disabled="busyId === inv.id"
          @click="assign(inv, inv.suggested_event)"
        ) Übernehmen

      //- Manual assignment
      .assign-row(v-if="filterStatus === 'pending'")
        select.event-select(v-model="selectedEvent[inv.id]")
          option(value="") — Veranstaltung wählen —
          option(v-for="ev in eventOptions" :key="ev.id" :value="ev.id")
            | {{ formatDate(ev.date) }} · {{ ev.title }}
        button.btn.btn-primary(
          :disabled="busyId === inv.id || !selectedEvent[inv.id]"
          @click="assign(inv)"
        ) Zuordnen

      //- Assigned / ignored info
      .assigned-info(v-else-if="filterStatus === 'assigned'")
        span Zugeordnet zu
        strong {{ inv.event_title }}
        span(v-if="inv.assigned_by_name") · {{ inv.assigned_by_name }}
        a.drive-link(v-if="inv.drive_url" :href="inv.drive_url" target="_blank" rel="noopener") Drive öffnen ↗

      .card-actions
        button.btn(@click="preview(inv)") Vorschau
        button.btn(
          v-if="filterStatus === 'pending'"
          :disabled="busyId === inv.id"
          @click="ignore(inv)"
        ) Ignorieren
        button.btn.btn-danger(
          :disabled="busyId === inv.id"
          @click="remove(inv)"
        ) Löschen
</template>

<style scoped>
.invoice-inbox {
  padding: 2rem;
  max-width: 900px;
  text-align: left;
  /* Pin the base size: the global body font scales with the viewport
     (clamp(1rem,1.5vw,2rem)), which blows up all inherited text on wide
     screens. */
  font-size: 1rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 900;
  margin: 0;
}

.subtitle {
  margin: 0.5rem 0 1.5rem;
  color: #333;
}

.toolbar {
  margin-bottom: 1.5rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  font-weight: 600;
  letter-spacing: normal;
  cursor: pointer;
}

.filter-btn.active {
  background: black;
  color: white;
}

.toast {
  padding: 0.75rem 1rem;
  background: black;
  color: white;
  font-weight: 600;
  margin-bottom: 1rem;
}

.error {
  padding: 0.75rem 1rem;
  border: 0.25rem solid #c00;
  color: #c00;
  font-weight: 600;
  margin-bottom: 1rem;
}

.loading,
.empty {
  padding: 2rem;
  border: 0.25rem dashed black;
  text-align: center;
  font-weight: 600;
}

.invoice-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invoice-card {
  border: 0.25rem solid black;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.badge {
  background: black;
  color: white;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.file-name {
  font-weight: 700;
  word-break: break-all;
}

.date {
  margin-left: auto;
  color: #555;
  font-size: 0.875rem;
}

.card-meta {
  font-size: 0.9rem;
  color: #333;
}

.card-meta .from {
  color: #777;
  font-size: 0.8rem;
}

.suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.8rem;
  background: #f4f4f0;
  border: 0.15rem solid black;
}

.suggestion-label {
  font-weight: 600;
}

.match-info {
  color: #666;
  font-size: 0.85rem;
}

.assign-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.event-select {
  flex: 1;
  min-width: 220px;
  padding: 0.5rem;
  border: 0.25rem solid black;
  font-size: 0.9rem;
  background: white;
}

.assigned-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

.drive-link {
  margin-left: auto;
  font-weight: 600;
  color: black;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  font-weight: 600;
  letter-spacing: normal;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover:not(:disabled) {
  background: black;
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  margin-left: auto;
}

.btn-primary {
  background: black;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(130%);
}

.btn-danger:hover:not(:disabled) {
  background: #c00;
  border-color: #c00;
  color: white;
}
</style>
