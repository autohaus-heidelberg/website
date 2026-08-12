<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { stockService } from '@/services'
import type { ReorderSuggestion } from '@/types/accounting'

const suggestions = ref<ReorderSuggestion[]>([])
const isLoading = ref(false)
const error = ref('')
const isSending = ref(false)
const sendSuccess = ref(false)
const sendError = ref('')

// Bestellformular
const deliveryDate = ref('')
// Pro Getränk: angepasste Bestellmenge (Kisten). Initialisiert aus Vorschlag.
const orderQty = ref<Record<number, number>>({})
const notes = ref('')

// Nur Getränke mit Fehlbestand (shortfall > 0) vorselektiert
const itemsWithShortfall = computed(() =>
  suggestions.value.filter(s => s.shortfall > 0)
)

const allItems = computed(() =>
  suggestions.value.filter(s => s.avg_consumption > 0)
)

// Show all active drinks with consumption history; those with shortfall are pre-checked
const checkedItems = ref<Set<number>>(new Set())

function initOrder() {
  const checked = new Set<number>()
  const qty: Record<number, number> = {}
  for (const s of suggestions.value) {
    if (s.shortfall > 0) {
      checked.add(s.id)
      qty[s.id] = s.suggested_order_crates
    } else {
      qty[s.id] = 0
    }
  }
  checkedItems.value = checked
  orderQty.value = qty
}

function toggleItem(id: number) {
  if (checkedItems.value.has(id)) {
    checkedItems.value.delete(id)
  } else {
    checkedItems.value.add(id)
    if (!orderQty.value[id]) {
      const s = suggestions.value.find(x => x.id === id)
      orderQty.value[id] = s ? Math.max(s.suggested_order_crates, 1) : 1
    }
  }
}

const selectedItems = computed(() =>
  suggestions.value.filter(s => checkedItems.value.has(s.id) && orderQty.value[s.id] > 0)
)

function formatBottleSize(s: ReorderSuggestion): string {
  if (!s.bottle_size) return ''
  return ` ${parseFloat(s.bottle_size).toLocaleString('de-DE')}l`
}

function orderLabel(s: ReorderSuggestion): string {
  const size = formatBottleSize(s)
  return `${s.name}${size}`
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    suggestions.value = await stockService.getReorderSuggestions()
    initOrder()
  } catch (e: any) {
    error.value = e.message || 'Bestellvorschläge konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

function stockLevel(s: ReorderSuggestion): string {
  if (s.current_stock <= 0) return 'empty'
  if (s.shortfall > 0) return 'low'
  return 'full'
}

async function sendOrder() {
  if (selectedItems.value.length === 0) return
  isSending.value = true
  sendSuccess.value = false
  sendError.value = ''
  try {
    const items = selectedItems.value.map(s => ({
      name: orderLabel(s),
      quantity: orderQty.value[s.id],
    }))
    await stockService.sendOrder({
      delivery_date: deliveryDate.value,
      items,
      notes: notes.value,
    })
    sendSuccess.value = true
  } catch (e: any) {
    sendError.value = e.message || 'Bestellung konnte nicht gesendet werden'
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.reorder-view
  .reorder-header
    h3 Bestellvorschläge
    p.hint
      | Basierend auf dem Durchschnittsverbrauch vergangener Veranstaltungen.
      | Vorselektiert sind Getränke, deren Lagerbestand nicht für eine Veranstaltung reicht.

  .loading(v-if="isLoading") Bestellvorschläge werden berechnet...
  .error(v-else-if="error") {{ error }}

  template(v-else)
    .no-data(v-if="allItems.length === 0")
      | Noch keine Verbrauchsdaten vorhanden. Bitte zunächst Abrechnungen für vergangene Veranstaltungen abschließen.

    template(v-else)
      .section
        h4 Alle Getränke mit Verbrauchshistorie
        .suggestions-table
          .table-header
            span.col-check
            span.col-name Getränk
            span.col-stock Bestand
            span.col-avg Ø Verbrauch
            span.col-shortfall Fehlbestand
            span.col-order Kisten bestellen
          .table-row(
            v-for="s in allItems"
            :key="s.id"
            :class="['level-' + stockLevel(s), { selected: checkedItems.has(s.id) }]"
          )
            span.col-check
              input(
                type="checkbox"
                :checked="checkedItems.has(s.id)"
                @change="toggleItem(s.id)"
              )
            span.col-name
              span.cat-emoji {{ s.category_emoji }}
              | {{ s.name }}
              span.bottle-size(v-if="s.bottle_size")  {{ parseFloat(s.bottle_size).toLocaleString('de-DE') }}l
            .col-stock
              span.stock-val(:class="'dot-' + stockLevel(s)") {{ s.current_stock.toLocaleString('de-DE') }} Fl.
              span.crate-hint(v-if="s.units_per_crate > 1")
                |  ({{ Math.floor(s.current_stock / s.units_per_crate) }}K)
            span.col-avg {{ s.avg_consumption.toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} Fl./VA
            span.col-shortfall(:class="{ negative: s.shortfall > 0 }")
              template(v-if="s.shortfall > 0") −{{ s.shortfall.toLocaleString('de-DE', { maximumFractionDigits: 0 }) }} Fl.
              template(v-else) ✓
            .col-order
              input.qty-input(
                v-if="checkedItems.has(s.id)"
                type="number"
                min="0"
                v-model.number="orderQty[s.id]"
              )
              span(v-else) —

      .order-form(v-if="selectedItems.length > 0")
        h4 Bestellung erstellen

        .form-row
          label Gewünschter Liefertag (optional)
          input(
            type="text"
            v-model="deliveryDate"
            placeholder="z.B. 11. September"
          )

        .form-row
          label Anmerkung (optional)
          textarea(v-model="notes" placeholder="z.B. Bitte Pfandflaschen mitbringen" rows="2")

        .order-preview
          h5 Bestellvorschau (an info@getraenkestation.com)
          .preview-text
            p(v-if="deliveryDate")
              | Hallo Matthias,
              br
              br
              | wir würden gerne folgende Bestellung aufgeben mit Lieferung nach Möglichkeit am {{ deliveryDate }} (abends) :)
            p(v-else)
              | Hallo Matthias,
              br
              br
              | wir würden gerne folgende Bestellung aufgeben:
            br
            .order-lines
              div(v-for="s in selectedItems" :key="s.id")
                strong {{ orderLabel(s) }}: {{ orderQty[s.id] }}
            template(v-if="notes")
              br
              p {{ notes }}

        .send-row
          button.btn-send(
            @click="sendOrder"
            :disabled="isSending || selectedItems.length === 0"
          )
            template(v-if="isSending") ⏳ Wird gesendet...
            template(v-else) 📧 Bestellung senden

        .success-banner(v-if="sendSuccess")
          | ✅ Bestellung wurde erfolgreich an info@getraenkestation.com gesendet!
        .error-banner(v-if="sendError") {{ sendError }}

      .no-selection(v-else-if="allItems.length > 0")
        | Wähle oben Getränke aus, die bestellt werden sollen.
</template>

<style scoped>
.reorder-view {
  background: white;
}

.reorder-header {
  margin-bottom: 1.5rem;
}

h3 {
  font-size: 1.2rem;
  font-weight: 900;
  margin: 0 0 0.4rem;
}

h4 {
  font-weight: 900;
  font-size: 1rem;
  margin: 0 0 0.75rem;
}

h5 {
  font-weight: 700;
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.hint {
  font-size: 0.85rem;
  color: #555;
  margin: 0;
}

.loading, .error, .no-data, .no-selection {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.error { color: #c00; }

.section {
  margin-bottom: 2rem;
}

/* ── Tabelle ─────────────────────────── */
.suggestions-table {
  border: 0.25rem solid black;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 2rem 1fr 7rem 8rem 7rem 7rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.table-header {
  background: black;
  color: white;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.table-row {
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.9rem;
  cursor: pointer;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: #f8f8f8;
}

.table-row.selected {
  background: #fffbe6;
}

.table-row.level-low { border-left: 3px solid #e55; }
.table-row.level-empty { border-left: 3px solid #c00; }
.table-row.level-full { border-left: 3px solid #4a4; }

.dot-low { color: #e55; font-weight: 700; }
.dot-empty { color: #c00; font-weight: 700; }
.dot-full { color: #4a4; }

.col-check { display: flex; align-items: center; justify-content: center; }
.col-avg, .col-shortfall, .col-order { text-align: right; }
.col-stock { text-align: right; }

.negative { color: #c00; font-weight: 700; }

.cat-emoji { margin-right: 0.3rem; }
.bottle-size { color: #666; font-size: 0.8rem; }

.crate-hint { color: #888; font-size: 0.8rem; }

.qty-input {
  width: 4.5rem;
  padding: 0.25rem 0.5rem;
  border: 0.2rem solid black;
  font-weight: 700;
  text-align: right;
  font-size: 0.9rem;
}

/* ── Bestellformular ─────────────────── */
.order-form {
  border: 0.25rem solid black;
  padding: 1.5rem;
  background: #fafafa;
}

.form-row {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-row label {
  font-weight: 700;
  font-size: 0.85rem;
}

.form-row input,
.form-row textarea {
  padding: 0.5rem 0.75rem;
  border: 0.2rem solid black;
  font-size: 0.9rem;
  resize: vertical;
  max-width: 400px;
}

.form-row input:focus,
.form-row textarea:focus {
  outline: none;
  background: black;
  color: white;
}

.order-preview {
  background: white;
  border: 1px solid #ccc;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  font-family: monospace;
  font-size: 0.88rem;
  line-height: 1.6;
}

.preview-text p { margin: 0 0 0.25rem; }
.order-lines div { margin: 0.1rem 0; }

.send-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn-send {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-send:hover:not(:disabled) { background: #333; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.success-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #e8f5e9;
  border: 1px solid #4caf50;
  color: #2e7d32;
  font-weight: 600;
}

.error-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #ffebee;
  border: 1px solid #ef9a9a;
  color: #c62828;
  font-weight: 600;
}
</style>
