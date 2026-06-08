<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { beverageService } from '@/services'
import type { BeverageItem, StockHistory, StockHistoryEntry } from '@/types/accounting'
import type { PaginatedResponse } from '@/types/api'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isEditing = !!props.id

const form = ref<Partial<BeverageItem>>({
  name: '',
  supplier_group: '',
  purchase_price: '',
  selling_price: '',
  deposit: '0.00',
  units_per_crate: 24,
  bottle_size: '',
  sort_order: 0,
  is_active: true,
  portions_per_bottle: null,
  selling_price_portion: '',
})

const isLoading = ref(false)
const error = ref('')
const priceHistory = ref<{ date: string; unit_price: string; quantity: number; remaining_quantity: number; supplier: string }[]>([])
const stockHistory = ref<StockHistory | null>(null)

const isSingleBottle = computed(() => (form.value.units_per_crate ?? 1) <= 1)
const hasPurchases = computed(() => priceHistory.value.length > 0)
const purchasePriceLabel = computed(() => isSingleBottle.value ? 'EK / Flasche' : 'EK / Kiste')

function formatQty(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? '0' : n.toLocaleString('de-DE')
}

const supplierSuggestions = [
  'Getränkestation',
  'Kaufland',
  'Rewe',
  'Aldi',
  'Tegut',
]

// ── Stock History Chart ────────────────────────────────────────
const CHART_W = 600
const CHART_H = 120
const CHART_PAD = { top: 8, right: 8, bottom: 4, left: 8 }

const chartData = computed(() => {
  const timeline = stockHistory.value?.timeline
  if (!timeline || timeline.length === 0) return null

  const points: { x: number; y: number; entry: StockHistoryEntry }[] = []
  const balances = timeline.map(e => e.balance)
  const minB = Math.min(0, ...balances)
  const maxB = Math.max(0, ...balances)
  const rangeB = maxB - minB || 1

  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom
  const n = timeline.length

  timeline.forEach((entry, i) => {
    // Single point: center horizontally
    const x = CHART_PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const y = CHART_PAD.top + (1 - (entry.balance - minB) / rangeB) * innerH
    points.push({ x, y, entry })
  })

  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const zeroY = CHART_PAD.top + (1 - (0 - minB) / rangeB) * innerH
  const bottomY = CHART_H - CHART_PAD.bottom
  const leftX = CHART_PAD.left
  const rightX = CHART_W - CHART_PAD.right

  // Area polygon: line points + bottom-right + bottom-left
  const areaPoints = polyline + ` ${rightX.toFixed(1)},${bottomY.toFixed(1)} ${leftX.toFixed(1)},${bottomY.toFixed(1)}`

  return { points, polyline, areaPoints, zeroY, minB, maxB, leftX, rightX }
})

function fmtQty(val: number, upc: number): string {
  if (upc <= 1) return val.toLocaleString('de-DE')
  const crates = Math.floor(val / upc)
  const loose = val % upc
  if (crates === 0) return `${loose} Fl.`
  if (loose === 0) return `${crates} Kisten`
  return `${crates} Kisten + ${loose} Fl.`
}

async function loadBeverage() {
  if (!props.id) return
  try {
    const item = await beverageService.getById(Number(props.id))
    form.value = { ...item }
    const [priceData, histData] = await Promise.all([
      beverageService.getPriceHistory(Number(props.id)),
      beverageService.getStockHistory(Number(props.id)),
    ])
    priceHistory.value = priceData.history
    stockHistory.value = histData
  } catch (e: any) {
    error.value = 'Failed to load beverage'
  }
}

// Merge functionality
const showMerge = ref(false)
const mergeTargetId = ref<number | null>(null)
const allBeverages = ref<BeverageItem[]>([])
const mergeLoading = ref(false)

const mergeTargets = computed(() =>
  allBeverages.value.filter(b => b.id !== Number(props.id))
)

async function openMerge() {
  showMerge.value = true
  if (allBeverages.value.length === 0) {
    const data: PaginatedResponse<BeverageItem> = await beverageService.getAll()
    allBeverages.value = data.results
  }
}

async function executeMerge() {
  if (!mergeTargetId.value) return
  const target = allBeverages.value.find(b => b.id === mergeTargetId.value)
  if (!target) return
  if (!confirm(`„${form.value.name}" in „${target.name}" zusammenführen? Alle Einkäufe und Abrechnungen werden übertragen. Dieses Getränk wird gelöscht.`)) return
  mergeLoading.value = true
  try {
    await beverageService.merge(Number(props.id), mergeTargetId.value)
    router.push('/admin/lager')
  } catch (e: any) {
    alert(e.message || 'Fehler beim Zusammenführen')
  } finally {
    mergeLoading.value = false
  }
}

async function handleSubmit() {
  if (!form.value.name) {
    error.value = 'Bitte einen Namen eingeben'
    return
  }
  if (!form.value.supplier_group) {
    error.value = 'Bitte eine Lieferantengruppe eingeben'
    return
  }
  if (!form.value.purchase_price && !hasPurchases.value) {
    error.value = 'Bitte einen Einkaufspreis eingeben'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const payload = { ...form.value }
    // Don't send purchase_price if auto-managed by purchases
    if (hasPurchases.value) {
      delete payload.purchase_price
    }
    if (isEditing) {
      await beverageService.update(Number(props.id), payload)
    } else {
      await beverageService.create(payload)
    }
    router.push('/admin/lager')
  } catch (e: any) {
    error.value = e.message || 'Fehler beim Speichern'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadBeverage()
})
</script>

<template lang="pug">
.beverage-form-view
  .form-header
    h2 {{ isEditing ? 'Getränk bearbeiten' : 'Neues Getränk' }}
    router-link.btn-cancel(to="/admin/lager") Abbrechen

  form.beverage-form(@submit.prevent="handleSubmit")
    .form-group.full
      label(for="name") Name
      input#name(
        v-model="form.name"
        type="text"
        placeholder="z.B. Kurpfalz Helles"
        required
      )

    .form-group.full
      label(for="supplier_group") Lieferant
      input#supplier_group(
        v-model="form.supplier_group"
        type="text"
        placeholder="z.B. Getränkestation"
        list="supplier-suggestions"
        required
      )
      datalist#supplier-suggestions
        option(v-for="s in supplierSuggestions" :key="s" :value="s")

    h3.section-title Gebinde & Flasche
    .hint.section-hint Einzelflasche (z.B. Spirituosen): Fl./Kiste = 1. Kistenware (z.B. Bier): Fl./Kiste = Anzahl Flaschen.
    .form-row
      .form-group
        label(for="units_per_crate") Fl. / Kiste
        input#units_per_crate(
          v-model.number="form.units_per_crate"
          type="number"
          min="1"
          placeholder="24"
        )

      .form-group
        label(for="bottle_size") Größe (L)
        input#bottle_size(
          v-model="form.bottle_size"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.33"
        )

    h3.section-title Preise
    .hint.section-hint(v-if="!hasPurchases") {{ isSingleBottle ? 'Einzelflasche — Einkaufspreis pro Flasche eintragen.' : 'Kistenware — Einkaufspreis für die ganze Kiste eintragen.' }}
    .hint.section-hint(v-else) EK-Preis wird automatisch aus dem letzten Einkauf übernommen.
    .form-row
      .form-group
        label(for="purchase_price") {{ purchasePriceLabel }}
        .input-with-unit
          input#purchase_price(
            v-model="form.purchase_price"
            type="number"
            step="0.01"
            min="0"
            :placeholder="isSingleBottle ? 'z.B. 16.99' : 'z.B. 18.50'"
            :required="!hasPurchases"
            :readonly="hasPurchases"
            :class="{ 'readonly-field': hasPurchases }"
          )
          span.unit €

      .form-group
        label(for="selling_price") VK / Flasche
        .input-with-unit
          input#selling_price(
            v-model="form.selling_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €
        .hint(v-if="isSingleBottle") Leer lassen wenn Ausschank portionsweise

      .form-group
        label(for="deposit") Pfand
        .input-with-unit
          input#deposit(
            v-model="form.deposit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €

    h3.section-title Ausschank
    .hint.section-hint Nur nötig bei Spirituosen o.ä. — wenn aus einer Flasche mehrere Portionen ausgeschenkt werden (z.B. 14× 4cl aus 0,7L Gin)
    .form-row
      .form-group
        label(for="portions_per_bottle") Portionen / Fl.
        input#portions_per_bottle(
          v-model.number="form.portions_per_bottle"
          type="number"
          min="1"
          placeholder="leer = 1"
        )

      .form-group
        label(for="selling_price_portion") VK / Portion
        .input-with-unit
          input#selling_price_portion(
            v-model="form.selling_price_portion"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €

    .form-row
      .form-group
        label(for="sort_order") Sortierung
        input#sort_order(
          v-model.number="form.sort_order"
          type="number"
          min="0"
        )

      .form-group
        label.checkbox-label
          input(
            v-model="form.is_active"
            type="checkbox"
          )
          |  Aktiv
        .hint Aktive Getränke erscheinen auf der Getränkekarte. Inaktive Getränke bleiben im Lagerbestand, sind aber nicht auf der Karte.

    .error(v-if="error") {{ error }}

    .form-actions
      button.btn-primary(type="submit" :disabled="isLoading")
        | {{ isLoading ? 'Speichern...' : (isEditing ? 'Aktualisieren' : 'Erstellen') }}
      router-link.btn-secondary(to="/admin/lager") Abbrechen

  .price-history(v-if="isEditing && priceHistory.length")
    h3.section-title Preisverlauf (Einkäufe)
    .history-table
      .history-header
        .history-col-date Datum
        .history-col-price Preis
        .history-col-qty Menge
        .history-col-remaining Rest
        .history-col-supplier Lieferant
      .history-row(v-for="(entry, idx) in priceHistory" :key="idx")
        .history-col-date {{ new Date(entry.date).toLocaleDateString('de-DE') }}
        .history-col-price {{ parseFloat(entry.unit_price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}
        .history-col-qty {{ formatQty(entry.quantity) }}
        .history-col-remaining(:class="{ 'has-remaining': entry.remaining_quantity > 0 }") {{ formatQty(entry.remaining_quantity) }}
        .history-col-supplier {{ entry.supplier }}

  .stock-history(v-if="isEditing && stockHistory && stockHistory.timeline.length")
    h3.section-title Bestandsverlauf
    svg.stock-chart(
      :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
      preserveAspectRatio="none"
    )
      //- Zero line
      line(
        v-if="chartData"
        :x1="chartData.leftX" :y1="chartData.zeroY.toFixed(1)"
        :x2="chartData.rightX" :y2="chartData.zeroY.toFixed(1)"
        stroke="#ccc" stroke-width="1"
      )
      //- Area fill
      polygon(
        v-if="chartData"
        :points="chartData.areaPoints"
        fill="#e8f5e9" stroke="none"
      )
      //- Line
      polyline(
        v-if="chartData"
        :points="chartData.polyline"
        fill="none" stroke="black" stroke-width="2"
      )
      //- Dots
      template(v-if="chartData")
        circle(
          v-for="(p, i) in chartData.points"
          :key="i"
          :cx="p.x.toFixed(1)" :cy="p.y.toFixed(1)"
          r="3"
          :fill="p.entry.type === 'purchase' ? 'black' : (p.entry.is_draft ? '#ef9a9a' : '#e53935')"
          stroke="white" stroke-width="1.5"
        )
    .chart-legend
      span.legend-purchase Einkauf
      span.legend-consumption Verbrauch (abgeschlossen)
      span.legend-draft Verbrauch (Entwurf)

    .history-table.stock-table
      .history-header
        .col-date Datum
        .col-type Art
        .col-label Bezeichnung
        .col-delta Menge
        .col-balance Bestand
      .history-row(
        v-for="(entry, idx) in stockHistory.timeline"
        :key="idx"
        :class="[entry.type, { 'is-draft': entry.is_draft }]"
      )
        .col-date {{ new Date(entry.date + 'T00:00:00').toLocaleDateString('de-DE') }}
        .col-type
          span.badge(:class="[entry.type, { 'draft': entry.is_draft }]")
            | {{ entry.type === 'purchase' ? 'Kauf' : 'Event' }}
          span.draft-tag(v-if="entry.is_draft") Entwurf
        .col-label {{ entry.label }}
        .col-delta(:class="entry.delta > 0 ? 'positive' : 'negative'")
          | {{ entry.delta > 0 ? '+' : '' }}{{ fmtQty(entry.delta, stockHistory.units_per_crate) }}
        .col-balance(:class="{ 'draft-balance': entry.is_draft }") {{ fmtQty(entry.balance, stockHistory.units_per_crate) }}

  .merge-section(v-if="isEditing")
    h3.section-title Zusammenführen
    p.hint Dieses Getränk mit einem anderen zusammenführen. Alle Einkäufe und Abrechnungen werden auf das Ziel-Getränk übertragen.
    template(v-if="!showMerge")
      button.btn-merge(@click="openMerge") Mit anderem Getränk zusammenführen…
    template(v-else)
      .merge-form
        select.merge-select(v-model="mergeTargetId")
          option(:value="null" disabled) Ziel-Getränk auswählen…
          option(v-for="b in mergeTargets" :key="b.id" :value="b.id") {{ b.name }}
        button.btn-danger(:disabled="!mergeTargetId || mergeLoading" @click="executeMerge")
          | {{ mergeLoading ? 'Wird zusammengeführt...' : 'Zusammenführen' }}
        button.btn-cancel-sm(@click="showMerge = false") Abbrechen
</template>

<style scoped>
.beverage-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 700px;
  overflow: hidden;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.beverage-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group.full {
  grid-column: 1 / -1;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 0.25rem solid black;
  padding-bottom: 0.375rem;
  margin: 0;
}

.section-hint {
  margin-top: -0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  font-size: 0.95rem;
  color: black;
}

input[type="text"],
input[type="number"] {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}

input:focus {
  outline: none;
  background: black;
  color: white;
}

.input-with-unit {
  display: flex;
  align-items: stretch;
}

.input-with-unit input {
  flex: 1;
  border-right: none;
  min-width: 0;
}

.unit {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  border: 0.25rem solid black;
  border-left: none;
  font-weight: 900;
  background: black;
  color: white;
}

.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding-top: 1.75rem;
}

.hint {
  font-size: 0.8rem;
  color: #666;
  font-weight: 400;
}

.error {
  padding: 1rem;
  background: white;
  border: 0.25rem solid black;
  color: black;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.1em;
  transition: filter 0.2s;
}

.btn-primary:hover {
  filter: brightness(120%);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary, .btn-cancel {
  padding: 0.75rem 1.5rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-secondary:hover, .btn-cancel:hover {
  background: black;
  color: white;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.price-history {
  margin-top: 2rem;
  border-top: 0.25rem solid black;
  padding-top: 1.5rem;
}

.history-table {
  margin-top: 1rem;
  font-size: 0.9rem;
}

.history-header {
  display: grid;
  grid-template-columns: 90px 85px 55px 50px 1fr;
  gap: 0.5rem;
  font-weight: 900;
  border-bottom: 2px solid black;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.history-row {
  display: grid;
  grid-template-columns: 90px 85px 55px 50px 1fr;
  gap: 0.5rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid #eee;
}

.history-col-price {
  font-weight: 600;
}

.has-remaining {
  font-weight: 700;
  color: #2e7d32;
}

.readonly-field {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.stock-history {
  margin-top: 2rem;
  border-top: 0.25rem solid black;
  padding-top: 1.5rem;
}

.stock-chart {
  display: block;
  width: 100%;
  height: 120px;
  border: 0.25rem solid black;
  margin-top: 0.75rem;
  background: white;
}

.chart-legend {
  display: flex;
  gap: 1.25rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.legend-purchase::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: black;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.legend-consumption::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53935;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.legend-draft::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef9a9a;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.stock-table {
  margin-top: 1rem;
}

.stock-table .history-header,
.stock-table .history-row {
  grid-template-columns: 80px 55px 1fr 90px 90px;
}

.col-delta {
  text-align: right;
  font-weight: 700;
}

.col-balance {
  text-align: right;
  font-weight: 600;
}

.positive {
  color: #2e7d32;
}

.negative {
  color: #e53935;
}

.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge.purchase {
  background: black;
  color: white;
}

.badge.consumption {
  background: #e53935;
  color: white;
}

.badge.consumption.draft {
  background: #ef9a9a;
  color: white;
}

.draft-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  margin-left: 0.35rem;
  letter-spacing: 0.05em;
}

.is-draft {
  opacity: 0.7;
}

.draft-balance {
  color: #999;
}

/* Merge section */
.merge-section {
  margin-top: 2rem;
  border-top: 0.25rem solid black;
  padding-top: 1.5rem;
}

.merge-section .hint {
  margin-bottom: 1rem;
}

.btn-merge {
  padding: 0.625rem 1.25rem;
  background: white;
  color: black;
  border: 0.2rem solid #666;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-merge:hover {
  border-color: black;
}

.merge-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.merge-select {
  padding: 0.5rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 0.9rem;
  font-weight: 600;
  flex: 1;
  min-width: 200px;
}

.btn-danger {
  padding: 0.625rem 1.25rem;
  background: #e53935;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-danger:hover {
  background: #c62828;
}

.btn-danger:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-cancel-sm {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  color: #666;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel-sm:hover {
  color: black;
}
</style>
