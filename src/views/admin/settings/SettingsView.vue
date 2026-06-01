<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { settingsService } from '@/services'
import { eventService } from '@/services/events'
import { taxExportService, type TaxSummaryResponse } from '@/services/accounting'
import { useEventSource } from '@/composables/useEventSource'
import EventSyncLog from '@/components/admin/EventSyncLog.vue'

const route = useRoute()


// State
const initialTab = route.query.tab === 'euer' ? 'euer' : route.query.tab === 'sync' ? 'sync' : 'helferpad'
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

  .tab-content(v-show="activeTab === 'euer'")
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
</style>
