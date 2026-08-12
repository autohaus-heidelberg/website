<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { stockService } from '@/services'
import type { ReorderSuggestion, ReorderResponse } from '@/types/accounting'

const data = ref<ReorderResponse | null>(null)
const isLoading = ref(false)
const error = ref('')
const isSending = ref(false)
const sendSuccess = ref(false)
const sendError = ref('')

// Bestellformular
const deliveryDate = ref('')
const orderQty = ref<Record<number, number>>({})
const notes = ref('')
const checkedItems = ref<Set<number>>(new Set())

// -- Computed: aufgeteilt nach Lieferant, sortiert nach Kategorie --
function sortByCategory(items: ReorderSuggestion[]) {
  return [...items].sort((a, b) => {
    const cat = (a.category || '').localeCompare(b.category || '', 'de')
    if (cat !== 0) return cat
    return a.name.localeCompare(b.name, 'de')
  })
}
const getraenkestationItems = computed(() =>
  sortByCategory((data.value?.items ?? []).filter(s => s.from_getraenkestation && s.avg_consumption > 0))
)
const otherItems = computed(() =>
  sortByCategory((data.value?.items ?? []).filter(s => !s.from_getraenkestation && s.avg_consumption > 0))
)

// Returns true when a new category group starts at index i
function isNewCategory(items: ReorderSuggestion[], i: number): boolean {
  if (i === 0) return true
  return items[i].category !== items[i - 1].category
}

function initOrder() {
  const checked = new Set<number>()
  const qty: Record<number, number> = {}
  for (const s of data.value?.items ?? []) {
    if (s.shortfall > 0 && s.from_getraenkestation) {
      checked.add(s.id)
      qty[s.id] = s.suggested_order_crates
    } else {
      qty[s.id] = 0
    }
  }
  checkedItems.value = checked
  orderQty.value = qty
}

function toggleItem(s: ReorderSuggestion) {
  if (!s.from_getraenkestation) return
  if (checkedItems.value.has(s.id)) {
    checkedItems.value.delete(s.id)
  } else {
    checkedItems.value.add(s.id)
    if (!orderQty.value[s.id]) {
      orderQty.value[s.id] = Math.max(s.suggested_order_crates, 1)
    }
  }
}

const selectedItems = computed(() =>
  (data.value?.items ?? []).filter(s => checkedItems.value.has(s.id) && orderQty.value[s.id] > 0)
)

function formatBottleSize(s: ReorderSuggestion): string {
  if (!s.bottle_size) return ''
  return ` ${parseFloat(s.bottle_size).toLocaleString('de-DE')}l`
}

function orderLabel(s: ReorderSuggestion): string {
  return `${s.name}${formatBottleSize(s)}`
}

function stockLevel(s: ReorderSuggestion): string {
  if (s.current_stock <= 0) return 'empty'
  if (s.shortfall > 0) return 'low'
  return 'full'
}

function fmtNum(n: number, decimals = 1) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: decimals })
}

function eventDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    data.value = await stockService.getReorderSuggestions()
    initOrder()
  } catch (e: any) {
    error.value = e.message || 'Bestellvorschlaege konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
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
    await stockService.sendOrder({ delivery_date: deliveryDate.value, items, notes: notes.value })
    sendSuccess.value = true
  } catch (e: any) {
    sendError.value = e.message || 'Bestellung konnte nicht gesendet werden'
  } finally {
    isSending.value = false
  }
}

onMounted(() => { loadData() })
</script>

<template lang="pug">
.reorder-view
  .reorder-header
    h3 Bestellvorschlaege
    p.hint
      | Berechnet den Bedarf fuer alle noch geplanten Veranstaltungen dieses Monats.
      | Nur 1x im Monat bestellen &mdash; alles auf einmal.

  .loading(v-if="isLoading") Bestellvorschlaege werden berechnet...
  .error-msg(v-else-if="error") {{ error }}

  template(v-else-if="data")

    .month-banner
      .month-title 📅 {{ data.month_label }}
      .event-pills
        template(v-if="data.upcoming_count === 0")
          span.pill.pill-empty Keine weiteren Veranstaltungen dieses Monat
        template(v-else)
          span.pill(v-for="ev in data.upcoming_events" :key="ev.id")
            | {{ ev.title }} &middot; {{ eventDate(ev.date) }}
          span.pill.pill-count {{ data.upcoming_count }} VA{{ data.upcoming_count !== 1 ? 's' : '' }}

    .section
      .section-header
        .section-title
          span.supplier-badge.badge-gs 🏪 Getraenkestation
          |  &mdash; bestellbar bei Matthias (info@getraenkestation.com)
      .no-data(v-if="getraenkestationItems.length === 0") Keine Getraenke mit Verbrauchshistorie.
      template(v-else)
        .suggestions-table
          .table-header
            span.col-check
            span.col-name Getraenk
            span.col-stock Bestand
            span.col-avg Oe / VA
            span.col-need Bedarf ({{ data.upcoming_count }} VA)
            span.col-shortfall Fehlbestand
            span.col-order Kisten bestellen
          template(v-for="(s, i) in getraenkestationItems" :key="s.id")
            .table-cat-header(v-if="isNewCategory(getraenkestationItems, i)")
              | {{ s.category_emoji }} {{ s.category || 'Sonstige' }}
            .table-row(:class="['level-' + stockLevel(s), { selected: checkedItems.has(s.id) }]" @click="toggleItem(s)")
            span.col-check
              input(type="checkbox" :checked="checkedItems.has(s.id)" @change.stop="toggleItem(s)")
            span.col-name
              span.cat-emoji {{ s.category_emoji }}
              | {{ s.name }}
              span.bottle-size(v-if="s.bottle_size")  {{ parseFloat(s.bottle_size).toLocaleString('de-DE') }}l
            .col-stock
              span.stock-val(:class="'level-' + stockLevel(s)") {{ fmtNum(s.current_stock, 0) }} Fl.
              span.crate-hint(v-if="s.units_per_crate > 1")  ({{ Math.floor(s.current_stock / s.units_per_crate) }}K)
            span.col-avg {{ fmtNum(s.avg_consumption) }} Fl.
            span.col-need(v-if="data.upcoming_count > 0") {{ fmtNum(s.needed_this_month, 0) }} Fl.
            span.col-need.muted(v-else) -
            span.col-shortfall(:class="{ negative: s.shortfall > 0 }")
              template(v-if="data.upcoming_count === 0") -
              template(v-else-if="s.shortfall > 0") -{{ fmtNum(s.shortfall, 0) }} Fl.
              template(v-else) ✓
            .col-order(@click.stop)
              input.qty-input(v-if="checkedItems.has(s.id)" type="number" min="0" v-model.number="orderQty[s.id]")
              span(v-else) -

    .section.section-other
      .section-header
        .section-title
          span.supplier-badge.badge-kl 🛒 Kaufland &amp; andere
          |  &mdash; nicht ueber Getraenkestation bestellbar
      .no-data(v-if="otherItems.length === 0") Keine Getraenke mit Verbrauchshistorie.
      template(v-else)
        .suggestions-table
          .table-header
            span.col-check
            span.col-name Getraenk
            span.col-stock Bestand
            span.col-avg Oe / VA
            span.col-need Bedarf ({{ data.upcoming_count }} VA)
            span.col-shortfall Fehlbestand
            span.col-order Info
          template(v-for="(s, i) in otherItems" :key="s.id")
            .table-cat-header(v-if="isNewCategory(otherItems, i)")
              | {{ s.category_emoji }} {{ s.category || 'Sonstige' }}
            .table-row.row-readonly(:class="'level-' + stockLevel(s)")
            span.col-check
              span.lock-icon 🔒
            span.col-name
              span.cat-emoji {{ s.category_emoji }}
              | {{ s.name }}
              span.bottle-size(v-if="s.bottle_size")  {{ parseFloat(s.bottle_size).toLocaleString('de-DE') }}l
            .col-stock
              span.stock-val(:class="'level-' + stockLevel(s)") {{ fmtNum(s.current_stock, 0) }} Fl.
              span.crate-hint(v-if="s.units_per_crate > 1")  ({{ Math.floor(s.current_stock / s.units_per_crate) }}K)
            span.col-avg {{ fmtNum(s.avg_consumption) }} Fl.
            span.col-need(v-if="data.upcoming_count > 0") {{ fmtNum(s.needed_this_month, 0) }} Fl.
            span.col-need.muted(v-else) -
            span.col-shortfall(:class="{ negative: s.shortfall > 0 }")
              template(v-if="data.upcoming_count === 0") -
              template(v-else-if="s.shortfall > 0") -{{ fmtNum(s.shortfall, 0) }} Fl.
              template(v-else) ✓
            span.col-order.supplier-note {{ s.supplier_group || 'Selbst kaufen' }}

    .order-form(v-if="selectedItems.length > 0")
      h4 📧 Bestellung an Getraenkestation

      .form-row
        label Gewuenschter Liefertag (optional)
        input(type="text" v-model="deliveryDate" placeholder="z.B. 27. August")

      .form-row
        label Anmerkung (optional)
        textarea(v-model="notes" placeholder="z.B. Bitte Pfandflaschen mitbringen" rows="2")

      .order-preview
        h5 Vorschau (an info@getraenkestation.com)
        .preview-text
          p(v-if="deliveryDate")
            | Hallo Matthias,
            br
            br
            | wir wuerden gerne folgende Bestellung aufgeben mit Lieferung nach Moeglichkeit am {{ deliveryDate }} (abends) :)
          p(v-else)
            | Hallo Matthias,
            br
            br
            | wir wuerden gerne folgende Bestellung aufgeben:
          br
          .order-lines
            div(v-for="s in selectedItems" :key="s.id")
              strong {{ orderLabel(s) }}: {{ orderQty[s.id] }}
          template(v-if="notes")
            br
            p {{ notes }}
          br
          p
            | Viele Grüße,
            br
            | Carousel e.V.

      .send-row
        button.btn-send(@click="sendOrder" :disabled="isSending || selectedItems.length === 0")
          template(v-if="isSending") Wird gesendet...
          template(v-else) 📧 Bestellung senden

      .success-banner(v-if="sendSuccess") ✅ Bestellung wurde erfolgreich an info@getraenkestation.com gesendet!
      .error-banner(v-if="sendError") {{ sendError }}

    .no-selection(v-else-if="getraenkestationItems.length > 0 && data.upcoming_count > 0")
      | Alle Getraenkestation-Getraenke haben ausreichend Bestand fuer {{ data.upcoming_count }} VA{{ data.upcoming_count !== 1 ? 's' : '' }} ✓

  .no-data(v-else) Keine Daten verfuegbar.
</template>

<style scoped>
.reorder-view { background: white; }

.reorder-header { margin-bottom: 1.5rem; }

h3 { font-size: 1.2rem; font-weight: 900; margin: 0 0 0.4rem; }
h4 { font-weight: 900; font-size: 1rem; margin: 0 0 0.75rem; }
h5 { font-weight: 700; font-size: 0.9rem; margin: 0 0 0.5rem; }

.hint { font-size: 0.85rem; color: #555; margin: 0; }

.loading, .error-msg, .no-data, .no-selection {
  padding: 2rem; text-align: center; color: #666;
}
.error-msg { color: #c00; }

.month-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #f8f8f8;
  border: 0.25rem solid black;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.month-title { font-weight: 900; font-size: 1rem; white-space: nowrap; }
.event-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pill { padding: 0.2rem 0.6rem; background: black; color: white; font-size: 0.8rem; font-weight: 600; }
.pill-empty { background: #ccc; color: #555; }
.pill-count { background: #444; }

.section { margin-bottom: 2rem; }
.section-other { opacity: 0.85; }
.section-header { margin-bottom: 0.75rem; }
.section-title { font-weight: 700; font-size: 0.95rem; color: #333; }

.supplier-badge { display: inline-block; padding: 0.15rem 0.5rem; font-weight: 800; margin-right: 0.5rem; }
.badge-gs { background: black; color: white; }
.badge-kl { background: #e0e0e0; color: #555; }

.suggestions-table { border: 0.25rem solid black; }
.section-other .suggestions-table { border-color: #aaa; }

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 2rem 1fr 7rem 5.5rem 7rem 6.5rem 7rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}
.table-header {
  background: black; color: white; font-weight: 700;
  font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;
}
.section-other .table-header { background: #888; }
.table-row { border-bottom: 1px solid #e0e0e0; font-size: 0.88rem; cursor: pointer; }
.table-row.row-readonly { cursor: default; }
.table-row:last-child { border-bottom: none; }
.table-row:hover:not(.row-readonly) { background: #f8f8f8; }
.table-row.selected { background: #fffbe6; }
.table-row.level-low { border-left: 3px solid #e55; }
.table-row.level-empty { border-left: 3px solid #c00; }
.table-row.level-full { border-left: 3px solid #4a4; }

.stock-val.level-low, .stock-val.level-empty { color: #c00; font-weight: 700; }
.stock-val.level-full { color: #4a4; }

.table-cat-header {
  display: grid;
  grid-template-columns: 1fr;
  padding: 0.3rem 0.75rem;
  background: #f0f0f0;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #444;
  border-bottom: 1px solid #ddd;
}
.section-other .table-cat-header { background: #ececec; }

.col-check { display: flex; align-items: center; justify-content: center; }
.col-name, .col-avg, .col-need, .col-shortfall, .col-order, .col-stock { text-align: left; }
.negative { color: #c00; font-weight: 700; }
.muted { color: #aaa; }
.cat-emoji { margin-right: 0.3rem; }
.bottle-size { color: #666; font-size: 0.8rem; }
.crate-hint { color: #888; font-size: 0.8rem; }
.lock-icon { font-size: 0.75rem; }
.supplier-note { font-size: 0.78rem; color: #888; font-style: italic; }

.qty-input {
  width: 4.5rem; padding: 0.25rem 0.5rem;
  border: 0.2rem solid black; font-weight: 700; text-align: right; font-size: 0.9rem;
}

.order-form { border: 0.25rem solid black; padding: 1.5rem; background: #fafafa; }
.form-row { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.form-row label { font-weight: 700; font-size: 0.85rem; }
.form-row input,
.form-row textarea {
  padding: 0.5rem 0.75rem; border: 0.2rem solid black;
  font-size: 0.9rem; resize: vertical; max-width: 400px;
}
.form-row input:focus, .form-row textarea:focus { outline: none; background: black; color: white; }

.order-preview {
  background: white; border: 1px solid #ccc;
  padding: 1rem 1.25rem; margin-bottom: 1.25rem;
  font-family: monospace; font-size: 0.88rem; line-height: 1.6;
}
.preview-text p { margin: 0 0 0.25rem; }
.order-lines div { margin: 0.1rem 0; }

.send-row { display: flex; gap: 1rem; align-items: center; }
.btn-send { padding: 0.75rem 1.5rem; background: black; color: white; border: none; font-weight: 700; font-size: 0.95rem; cursor: pointer; }
.btn-send:hover:not(:disabled) { background: #333; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.success-banner { margin-top: 1rem; padding: 0.75rem 1rem; background: #e8f5e9; border: 1px solid #4caf50; color: #2e7d32; font-weight: 600; }
.error-banner { margin-top: 1rem; padding: 0.75rem 1rem; background: #ffebee; border: 1px solid #ef9a9a; color: #c62828; font-weight: 600; }
</style>
