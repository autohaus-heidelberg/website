<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { settingsService } from '@/services'
import { eventService } from '@/services/events'
import { taxExportService, type TaxSummaryResponse } from '@/services/accounting'
import { useEventSource } from '@/composables/useEventSource'
import { useAuthStore } from '@/stores/auth'
import EventSyncLog from '@/components/admin/EventSyncLog.vue'

const route = useRoute()
const authStore = useAuthStore()


// State
// Honor ?tab= query param, but fall back to 'helferpad' if a non-treasurer
// asks for the EÜR tab (e.g. shared link). The tab is hidden + the tax_export
// endpoint refuses non-treasurers, so landing on it would just show empty.
const requestedTab = route.query.tab
const initialTab =
  requestedTab === 'euer'
    ? (authStore.isTreasurer ? 'euer' : 'helferpad')
    : requestedTab === 'sync' ? 'sync' : 'helferpad'
const activeTab = ref(initialTab)
const helferpadContent = ref('')
const settingId = ref<number>()
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const success = ref('')

// EÜR state
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const taxSummary = ref<TaxSummaryResponse | null>(null)
const taxLoading = ref(false)
const taxError = ref('')
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

async function loadTaxSummary() {
  taxLoading.value = true
  taxError.value = ''
  try {
    taxSummary.value = await taxExportService.getSummary(selectedYear.value)
  } catch (e: any) {
    taxError.value = e.message || 'Daten konnten nicht geladen werden'
  } finally {
    taxLoading.value = false
  }
}

async function downloadExcel() {
  try {
    await taxExportService.downloadExcel(selectedYear.value)
  } catch (e: any) {
    alert('Export fehlgeschlagen: ' + e.message)
  }
}

async function downloadCsv() {
  try {
    await taxExportService.downloadCsv(selectedYear.value)
  } catch (e: any) {
    alert('Export fehlgeschlagen: ' + e.message)
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatPercent(value: number): string {
  return value.toLocaleString('de-DE', { style: 'percent', maximumFractionDigits: 1 })
}

const profitDistribution = computed(() => {
  if (!taxSummary.value) return []
  const spheres = taxSummary.value.spheres
  const totalResult = Object.values(spheres).reduce((s, v) => s + v.result, 0)
  return Object.entries(spheres)
    .filter(([, v]) => v.income || v.expense)
    .map(([key, v]) => ({
      key,
      label: v.label,
      result: v.result,
      share: totalResult !== 0 ? v.result / totalResult : 0,
    }))
    .sort((a, b) => b.result - a.result)
})

const participantTotal = computed(() => {
  if (!taxSummary.value?.participants) return 0
  return taxSummary.value.participants.reduce((s, p) => s + p.amount, 0)
})

function participantBarWidth(amount: number): number {
  const max = taxSummary.value?.participants
    ? Math.max(...taxSummary.value.participants.map(p => Math.abs(p.amount)))
    : 0
  if (max === 0) return 0
  return Math.min((Math.abs(amount) / max) * 100, 100)
}

// Load helferpad setting on mount
onMounted(async () => {
  isLoading.value = true
  error.value = ''
  if (activeTab.value === 'euer') loadTaxSummary()

  try {
    const setting = await settingsService.getByName('helferpad')
    helferpadContent.value = setting.setting.content || ''
    settingId.value = setting.id
  } catch (err: any) {
    if (err.response?.status === 404) {
      // Setting doesn't exist yet - will create on first save
      helferpadContent.value = 'HelferPad'
    } else {
      error.value = 'Einstellungen konnten nicht geladen werden'
      console.error('Error loading settings:', err)
    }
  } finally {
    isLoading.value = false
  }
})

// Save helferpad setting
async function handleSave() {
  isSaving.value = true
  error.value = ''
  success.value = ''

  try {
    if (settingId.value) {
      // Update existing setting
      await settingsService.update(settingId.value, { content: helferpadContent.value })
    } else {
      // Create new setting
      const created = await settingsService.create('helferpad', { content: helferpadContent.value })
      settingId.value = created.id
    }

    success.value = 'Einstellungen erfolgreich gespeichert!'
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Einstellungen konnten nicht gespeichert werden'
    console.error('Error saving settings:', err)
  } finally {
    isSaving.value = false
  }
}

// ── Sync from Git ──
const { logs: syncLogs, error: syncSseError, connect: syncConnect, disconnect: syncDisconnect, clearLogs: syncClearLogs, clearError: syncClearError } = useEventSource()
const isSyncing = ref(false)
const syncComplete = ref(false)
const syncError = ref<string | null>(null)

function handleSyncFromGit() {
  if (!confirm('Events aus dem Git-Submodule in die Datenbank synchronisieren? Nur benutzen wenn ihr wisst was ihr tut!')) {
    return
  }

  isSyncing.value = true
  syncComplete.value = false
  syncError.value = null
  syncClearLogs()
  syncClearError()

  const url = eventService.getSyncFromGitUrl()

  syncConnect(url, {
    sync_start: () => {},
    git_pull: () => {},
    artist_sync: () => {},
    event_sync: () => {},
    heartbeat: () => {},
    sync_complete: () => {
      isSyncing.value = false
      syncComplete.value = true
      syncDisconnect()
    },
    sync_error: (data) => {
      isSyncing.value = false
      syncError.value = data.message || 'Sync fehlgeschlagen'
      syncDisconnect()
    }
  })

  const stopWatching = watch(syncSseError, (newError) => {
    if (newError) {
      isSyncing.value = false
      syncError.value = newError
      stopWatching()
    }
  })
}
</script>

<template lang="pug">
.settings-view
  .settings-header
    h2 Einstellungen
    .tab-bar
      button.tab(
        :class="{ active: activeTab === 'helferpad' }"
        @click="activeTab = 'helferpad'"
      )
        | Helferpad
      button.tab(
        v-if="authStore.isTreasurer"
        :class="{ active: activeTab === 'euer' }"
        @click="activeTab = 'euer'; if (!taxSummary) loadTaxSummary()"
      )
        | EÜR / Steuer-Export
      button.tab(
        :class="{ active: activeTab === 'sync' }"
        @click="activeTab = 'sync'"
      )
        | Git-Sync

  .tab-content(v-show="activeTab === 'helferpad'")
    .section-description
      p Standardinhalt für neue Helferpad-Dokumente
      p.replacements-title Verfügbare Platzhalter:
      ul.replacements-list(v-pre)
        li #[code {{Eventname}}] - Event title
        li #[code {{EventDate}}] - Event start date/time (German timezone)
        li #[code {{EventGetIn}}] - Event start minus 3 hours (German timezone)
        li #[code {{EventSoundCheck}}] - Event start minus 2 hours (German timezone)
        li #[code {{EventDinner}}] - Event start minus 1 hour (German timezone)
        li #[code {{EntranceFee}}] - AK price (or [TBA] if not set)
        li #[code {{EventLink}}] - Link to event website
        li #[code {{EntranceShifts}}] - Einlass-Schichten (Start zum Event-Datum, 1,5h Schichten)
        li #[code {{BarShifts}}] - Bar-Schichten (Start zum Event-Datum, 1,5h Schichten)
    form.setting-form(@submit.prevent="handleSave")
      .form-group
        label(for="helferpad-content") Standardinhalt
        textarea#helferpad-content(
          v-model="helferpadContent"
          :disabled="isLoading || isSaving"
          rows="15"
          placeholder="Standardinhalt für Helferpad eingeben..."
        )
        .field-hint Nur Klartext

      .error(v-if="error") {{ error }}
      .success(v-if="success") {{ success }}

      .form-actions
        button.btn-primary(
          type="submit"
          :disabled="isSaving || isLoading"
        )
          | {{ isSaving ? 'Speichern...' : 'Änderungen speichern' }}

  .tab-content(v-if="authStore.isTreasurer" v-show="activeTab === 'euer'")
    .euer-header
      select.year-select(v-model="selectedYear" @change="loadTaxSummary")
        option(v-for="y in years" :key="y" :value="y") {{ y }}
      .euer-actions
        button.btn-export(@click="downloadExcel") Excel
        button.btn-export-secondary(@click="downloadCsv") CSV

    .loading(v-if="taxLoading") Laden...
    .error(v-else-if="taxError") {{ taxError }}

    template(v-else-if="taxSummary")
      .summary-section
        h3 Übersicht {{ selectedYear }}
        .sphere-cards
          .sphere-card(
            v-for="(data, key) in taxSummary.spheres"
            :key="key"
            v-show="data.income || data.expense"
          )
            .sphere-label {{ data.label }}
            .sphere-row
              span.label Einnahmen
              span.value.income {{ formatCurrency(data.income) }}
            .sphere-row
              span.label Ausgaben
              span.value.expense {{ formatCurrency(data.expense) }}
            .sphere-row.result
              span.label Ergebnis
              span.value(:class="data.result >= 0 ? 'positive' : 'negative'")
                | {{ formatCurrency(data.result) }}

      .vat-section
        h3 Umsatzsteuer
        .vat-table
          .vat-row
            span.label USt 7% (Eintritt)
            span.value {{ formatCurrency(taxSummary.vat.ust_7) }}
          .vat-row
            span.label USt 19% (Bar)
            span.value {{ formatCurrency(taxSummary.vat.ust_19) }}
          .vat-row.subtotal
            span.label USt gesamt
            span.value {{ formatCurrency(taxSummary.vat.ust_total) }}
          .vat-row
            span.label Vorsteuer
            span.value -{{ formatCurrency(taxSummary.vat.vorsteuer) }}
          .vat-row.total
            span.label Zahllast
            span.value {{ formatCurrency(taxSummary.vat.zahllast) }}

      .profit-section
        h3 Gewinnverteilung
        .profit-table
          .profit-row.profit-header
            span.col-label Sphäre
            span.col-result Ergebnis
            span.col-bar
            span.col-share Anteil
          .profit-row(
            v-for="item in profitDistribution"
            :key="item.key"
            :class="item.result >= 0 ? 'positive-row' : 'negative-row'"
          )
            span.col-label {{ item.label }}
            span.col-result(:class="item.result >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(item.result) }}
            span.col-bar
              .bar-track
                .bar-fill(
                  :style="{ width: Math.min(Math.abs(item.share) * 100, 100) + '%' }"
                  :class="item.result >= 0 ? 'bar-positive' : 'bar-negative'"
                )
            span.col-share {{ formatPercent(item.share) }}
          .profit-row.profit-total
            span.col-label Gesamt
            span.col-result(
              :class="Object.values(taxSummary.spheres).reduce((s, v) => s + v.result, 0) >= 0 ? 'positive' : 'negative'"
            )
              | {{ formatCurrency(Object.values(taxSummary.spheres).reduce((s, v) => s + v.result, 0)) }}
            span.col-bar
            span.col-share

      .events-section
        h3 Ergebnis nach Event
        .events-table
          .event-row.event-header
            span.col-date Datum
            span.col-event Event
            span.col-income Einnahmen
            span.col-expense Ausgaben
            span.col-result Ergebnis
          .event-row(
            v-for="item in taxSummary.events"
            :key="item.event || '_purchases'"
          )
            span.col-date {{ item.date ? new Date(item.date).toLocaleDateString('de-DE') : '–' }}
            span.col-event {{ item.event || 'Sonstige Einkäufe' }}
            span.col-income {{ formatCurrency(item.income) }}
            span.col-expense {{ formatCurrency(item.expense) }}
            span.col-result(:class="item.result >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(item.result) }}
          .event-row.event-sum(v-if="taxSummary.events.length")
            span.col-date
            span.col-event Gesamt
            span.col-income {{ formatCurrency(taxSummary.events.reduce((s, e) => s + e.income, 0)) }}
            span.col-expense {{ formatCurrency(taxSummary.events.reduce((s, e) => s + e.expense, 0)) }}
            span.col-result(:class="taxSummary.events.reduce((s, e) => s + e.result, 0) >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(taxSummary.events.reduce((s, e) => s + e.result, 0)) }}

      .participants-section(v-if="taxSummary.participants && taxSummary.participants.length")
        h3 Gewinnverteilung nach Teilnehmer
        .participants-table
          .participant-row.participant-header
            span.col-name Teilnehmer
            span.col-amount Betrag
            span.col-pbar
            span.col-pshare Anteil
          .participant-row(
            v-for="item in taxSummary.participants"
            :key="item.participant"
          )
            span.col-name {{ item.participant }}
            span.col-amount(:class="item.amount >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(item.amount) }}
            span.col-pbar
              .bar-track
                .bar-fill(
                  :style="{ width: participantBarWidth(item.amount) + '%' }"
                  :class="item.amount >= 0 ? 'bar-positive' : 'bar-negative'"
                )
            span.col-pshare {{ formatPercent(participantTotal !== 0 ? item.amount / participantTotal : 0) }}
          .participant-row.participant-sum
            span.col-name Gesamt
            span.col-amount(:class="participantTotal >= 0 ? 'positive' : 'negative'")
              | {{ formatCurrency(participantTotal) }}
            span.col-pbar
            span.col-pshare

    .empty(v-else) Keine Daten für {{ selectedYear }}

  .tab-content(v-show="activeTab === 'sync'")
    .section-description
      p.sync-warning ⚠️ Diesen Button nur benutzen wenn ihr wisst was ihr tut!
      p Synchronisiert Events aus dem Git-Submodule (website/src/events.json) in die Datenbank. Überschreibt bestehende Events mit den Daten aus der JSON-Datei.

    .sync-actions
      button.btn-danger(
        @click="handleSyncFromGit"
        :disabled="isSyncing"
      )
        span(v-if="!isSyncing") Von Git synchronisieren
        span(v-else) Wird synchronisiert...

    .sync-result(v-if="syncComplete")
      p.success Sync erfolgreich abgeschlossen!
      button.btn-primary(@click="() => window.location.reload()") Seite neu laden

    .sync-result(v-if="syncError")
      p.error {{ syncError }}

    EventSyncLog(:logs="syncLogs")
</template>

<style scoped>
.settings-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 900px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.settings-header h2 {
  font-size: 1.75rem;
  color: black;
  font-weight: 900;
  margin: 0;
}

.tab-bar {
  display: flex;
  gap: 0;
  border: 0.25rem solid black;
}

.tab {
  padding: 0.625rem 1.25rem;
  background: white;
  color: black;
  border: none;
  border-right: 0.25rem solid black;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:last-child {
  border-right: none;
}

.tab:hover {
  background: #f0f0f0;
}

.tab.active {
  background: black;
  color: white;
}

.tab-content {
  padding-top: 1rem;
}

.section-description {
  margin-bottom: 1.5rem;
}

.section-description p {
  color: black;
  margin: 0;
}

.replacements-title {
  margin-top: 1rem !important;
  font-weight: 600;
}

.replacements-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  color: #333;
}

.replacements-list li {
  margin-bottom: 0.25rem;
}

.replacements-list code {
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border: 1px solid #e5e7eb;
  font-family: monospace;
  font-size: 0.8125rem;
}

.setting-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: black;
  font-size: 1rem;
}

textarea {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: monospace;
  transition: background 0.2s;
  resize: vertical;
}

textarea:focus {
  outline: none;
  background: black;
  color: white;
}

textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.error {
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid black;
  color: black;
  font-weight: 600;
}

.success {
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid #22c55e;
  color: #22c55e;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: black;
  color: white;
  border: 0.25rem solid black;
  font-size: 1rem;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.euer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.euer-actions {
  display: flex;
  gap: 0.5rem;
}

.year-select {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-weight: 700;
}

.btn-export, .btn-export-secondary {
  padding: 0.625rem 1.25rem;
  border: 0.25rem solid black;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-export {
  background: black;
  color: white;
}

.btn-export-secondary {
  background: white;
  color: black;
}

.btn-export:hover { opacity: 0.85; }
.btn-export-secondary:hover { background: #f0f0f0; }

.summary-section, .vat-section {
  margin-bottom: 2rem;
}

.summary-section h3, .vat-section h3 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
  font-weight: 700;
}

.sphere-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.sphere-card {
  border: 0.2rem solid black;
  padding: 1.25rem;
}

.sphere-label {
  font-weight: 800;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.sphere-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.95rem;
}

.sphere-row.result {
  border-top: 2px solid black;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  font-weight: 700;
}

.value.income { color: #16a34a; }
.value.expense { color: #dc2626; }
.value.positive { color: #16a34a; }
.value.negative { color: #dc2626; }

.vat-table {
  max-width: 400px;
  border: 0.2rem solid black;
  padding: 1rem 1.25rem;
}

.vat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
}

.vat-row.subtotal {
  border-top: 1px solid #ccc;
  padding-top: 0.6rem;
  margin-top: 0.25rem;
}

.vat-row.total {
  border-top: 2px solid black;
  padding-top: 0.6rem;
  margin-top: 0.25rem;
  font-weight: 800;
  font-size: 1.05rem;
}

.loading, .empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}

@media (max-width: 768px) {
  .settings-view {
    border-width: 0.25rem;
    padding: 1rem;
  }

  .tab-bar {
    border-width: 0.2rem;
  }

  .tab {
    padding: 0.5rem 0.875rem;
    font-size: 0.8rem;
    border-right-width: 0.2rem;
  }
}

/* ── Sync Tab ── */
.sync-warning {
  font-weight: 700;
  color: #dc2626;
  margin-bottom: 0.5rem !important;
}

.sync-actions {
  margin: 1.5rem 0;
}

.btn-danger {
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  cursor: pointer;
  background: #dc2626;
  color: white;
  border: 0.25rem solid #dc2626;
  font-size: 1rem;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-result {
  margin: 1rem 0;
}

/* ── Gewinnverteilung ── */
.profit-section {
  margin-bottom: 2rem;
}

.profit-section h3 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
  font-weight: 700;
}

.profit-table {
  border: 0.2rem solid black;
  max-width: 640px;
}

.profit-row {
  display: grid;
  grid-template-columns: 1fr 130px 120px 70px;
  padding: 0.4rem 1rem;
  align-items: center;
  gap: 0.5rem;
}

.profit-header {
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 0.2rem solid black;
  background: #f5f5f5;
}

.profit-total {
  border-top: 0.2rem solid black;
  font-weight: 800;
}

.col-result { text-align: right; font-variant-numeric: tabular-nums; }
.col-share { text-align: right; font-size: 0.85rem; color: #555; }

.bar-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
}

.bar-positive { background: #16a34a; }
.bar-negative { background: #dc2626; }

/* ── Ergebnis nach Event ── */
.events-section {
  margin-bottom: 2rem;
}

.events-section h3 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
  font-weight: 700;
}

.events-table {
  border: 0.2rem solid black;
  overflow-x: auto;
}

.event-row {
  display: grid;
  grid-template-columns: 100px 1fr 130px 130px 130px;
  padding: 0.4rem 1rem;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.event-row:last-child { border-bottom: none; }

.event-header {
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 0.2rem solid black;
  background: #f5f5f5;
}

.col-date { font-size: 0.85rem; color: #555; }
.col-income, .col-expense { text-align: right; font-variant-numeric: tabular-nums; color: #555; font-size: 0.9rem; }
.col-result { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }

@media (max-width: 640px) {
  .profit-row { grid-template-columns: 1fr 110px 0 60px; }
  .col-bar { display: none; }
  .event-row { grid-template-columns: 80px 1fr 100px; }
  .col-income, .col-expense { display: none; }
}

/* ── Summenzeilen ── */
.profit-row.profit-total,
.event-row.event-sum,
.participant-row.participant-sum {
  border-top: 0.2rem solid black;
  font-weight: 800;
}

/* ── Teilnehmer-Tabelle ── */
.participants-section {
  margin-bottom: 2rem;
}

.participants-section h3 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
  font-weight: 700;
}

.participants-table {
  border: 0.2rem solid black;
  max-width: 560px;
}

.participant-row {
  display: grid;
  grid-template-columns: 1fr 130px 120px 70px;
  padding: 0.4rem 1rem;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.participant-row:last-child { border-bottom: none; }

.participant-header {
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 0.2rem solid black;
  background: #f5f5f5;
}

.col-name { font-weight: 600; }
.col-amount { text-align: right; font-variant-numeric: tabular-nums; }
.col-pshare { text-align: right; font-size: 0.85rem; color: #555; }
.col-pbar .bar-track { height: 8px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
</style>
