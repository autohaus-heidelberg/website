<script setup lang="ts">
import { computed } from 'vue'
import type { Artist, ArtistDeal, ArtistDealType, ArtistDeals } from '@/services'
import { parsePrice, showsGuarantee, showsDoorDeal, comboBreakeven as calcComboBreakeven, estimateTicketRange } from '@/utils/artistDeals'

interface Props {
  artists: Artist[]
  modelValue?: ArtistDeals
  /** VVK-/AK-Ticketpreise des Events (Brutto, inkl. USt), z.B. "12" oder "18,60". */
  vvkPrice?: string
  akPrice?: string
}

interface Emits {
  (e: 'update:modelValue', value: ArtistDeals): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  vvkPrice: '',
  akPrice: '',
})
const emit = defineEmits<Emits>()

function deal(artistId?: number): ArtistDeal | undefined {
  if (artistId == null) return undefined
  return props.modelValue[String(artistId)]
}

function onDealTypeChange(e: Event, artistId?: number) {
  if (artistId == null) return
  const value = (e.target as HTMLSelectElement).value
  const key = String(artistId)
  const next = { ...props.modelValue }
  if (!value) {
    delete next[key]
  } else {
    const type = value as ArtistDealType
    // Werte für nicht mehr sichtbare Felder verwerfen, sonst rechnet
    // breakeven() mit einem stehengebliebenen alten Prozentsatz/Betrag weiter.
    next[key] = {
      ...next[key],
      deal_type: type,
      guarantee_amount: showsGuarantee(type) ? next[key]?.guarantee_amount : undefined,
      door_deal_percentage: showsDoorDeal(type) ? next[key]?.door_deal_percentage : undefined,
    }
  }
  emit('update:modelValue', next)
}

function onFieldInput(e: Event, artistId: number | undefined, field: 'guarantee_amount' | 'door_deal_percentage' | 'notes') {
  if (artistId == null) return
  const value = (e.target as HTMLInputElement).value
  const key = String(artistId)
  const current = props.modelValue[key]
  if (!current) return
  emit('update:modelValue', { ...props.modelValue, [key]: { ...current, [field]: value } })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// Türanteile aller Bands zusammen dürfen die 100% der Türeinnahmen nicht übersteigen.
const totalDoorDealPercentage = computed(() => {
  return props.artists.reduce((sum, a) => {
    const d = deal(a.id)
    if (d && showsDoorDeal(d.deal_type)) {
      return sum + (parseFloat(d.door_deal_percentage || '0') || 0)
    }
    return sum
  }, 0)
})

// Summe ALLER Garantien (auch reine Garantie-Deals ohne Doordeal) — das ist
// die tatsächliche Gesamtverpflichtung, unabhängig vom Türergebnis am
// Veranstaltungstag (reine Garantien werden so oder so fällig).
const totalAllGuarantees = computed(() => {
  return props.artists.reduce((sum, a) => {
    const d = deal(a.id)
    if (d && showsGuarantee(d.deal_type)) {
      return sum + (parseFloat(d.guarantee_amount || '0') || 0)
    }
    return sum
  }, 0)
})

// Summe von Garantie und %-Anteil über ALLE Garantie+Doordeal-Bands (nicht
// pro Band einzeln) — einzelne Breakeven-Punkte sind nicht additiv (jede
// Band bekommt ihren eigenen %-Anteil vom selben Topf, unabhängig von den
// anderen), aber die Summe der Garantien DIESER Bands vs. Summe ihrer
// %-Anteile beantwortet die Frage "ab wann lohnen sich die Doordeals in
// Summe mehr als die Garantien, die sie ersetzen". Reine Garantie-Deals
// (ohne Doordeal-Anteil) haben hier bewusst nichts verloren, siehe
// totalAllGuarantees oben für die Gesamtverpflichtung inkl. dieser Bands.
const comboTotals = computed(() => {
  let totalGuarantee = 0
  let totalPct = 0
  for (const a of props.artists) {
    const d = deal(a.id)
    if (d?.deal_type === 'guarantee_plus_door') {
      totalGuarantee += parseFloat(d.guarantee_amount || '0') || 0
      totalPct += parseFloat(d.door_deal_percentage || '0') || 0
    }
  }
  return { totalGuarantee, totalPct }
})

/** Netto-Eintrittsumsatz (vor abzugsfähigen Kosten wie GEMA), ab dem die
 *  Summe aller Doordeal-Anteile mehr wert ist als die Summe der zugehörigen
 *  Garantien. Grobe Schätzung: die echte Abrechnung zieht abzugsfähige
 *  Kosten vor der Doordeal-Aufteilung ab, der reale Schwellenwert liegt also
 *  etwas höher als hier angezeigt. */
const comboBreakeven = computed(() => {
  return calcComboBreakeven(comboTotals.value.totalGuarantee, comboTotals.value.totalPct)
})

/** Ungefähre Anzahl verkaufter Tickets bis zum kombinierten Breakeven, als
 *  Spanne zwischen reinem VVK- und reinem AK-Verkauf (die tatsächliche
 *  Mischung ist vorher nicht bekannt). null wenn kein Kombi-Deal oder keine
 *  Preise hinterlegt. */
const comboTicketHint = computed(() => {
  return estimateTicketRange(comboBreakeven.value, parsePrice(props.vvkPrice), parsePrice(props.akPrice))
})
</script>

<template lang="pug">
.artist-deals(v-if="artists.length")
  .config-table
    .config-header.artist-deal-header
      span Band
      span Deal-Modell
      span Betrag / Anteil
    .config-row.artist-deal-row(v-for="artist in artists" :key="artist.id")
      span.artist-deal-name {{ artist.name }}
      select.select-input(
        :value="deal(artist.id)?.deal_type || ''"
        @change="onDealTypeChange($event, artist.id)"
      )
        option(value="") Kein Deal hinterlegt
        option(value="guarantee") Garantie (Festgage)
        option(value="door_deal") Doordeal (%)
        option(value="guarantee_plus_door") Garantie + Doordeal
      .artist-deal-values(v-if="deal(artist.id)")
        .input-group(v-if="showsGuarantee(deal(artist.id)?.deal_type)")
          input.amount-input(
            type="number" step="0.01" min="0" placeholder="0,00"
            :value="deal(artist.id)?.guarantee_amount || ''"
            @input="onFieldInput($event, artist.id, 'guarantee_amount')"
          )
          span.unit €
        .input-group(v-if="showsDoorDeal(deal(artist.id)?.deal_type)")
          input.amount-input(
            type="number" step="1" min="0" max="100" placeholder="0"
            :value="deal(artist.id)?.door_deal_percentage || ''"
            @input="onFieldInput($event, artist.id, 'door_deal_percentage')"
          )
          span.unit %
        input.text-input.artist-deal-notes(
          type="text" placeholder="Notiz (optional)"
          :value="deal(artist.id)?.notes || ''"
          @input="onFieldInput($event, artist.id, 'notes')"
        )
      span.artist-deal-values(v-else) —
  p.artist-deal-hint(v-if="totalAllGuarantees > 0") 📌 Gesamte Garantien aller Bands: {{ formatCurrency(totalAllGuarantees) }} — fällig unabhängig vom Türergebnis.
  p.artist-deal-hint(v-if="comboBreakeven !== null")
    | 💡 Ab ca. {{ formatCurrency(comboBreakeven) }} Netto-Eintrittseinnahmen insgesamt (vor abzugsfähigen Kosten wie GEMA) übersteigt die Summe der Doordeal-Anteile ({{ comboTotals.totalPct.toFixed(0) }}%) die Summe der Garantien der Kombi-Deals ({{ formatCurrency(comboTotals.totalGuarantee) }}) — reine Garantie-Bands ohne Doordeal-Anteil zählen hier nicht mit, da sie so oder so fällig werden.
    template(v-if="comboTicketHint")
      |  Das entspricht ca. {{ comboTicketHint }} verkauften Tickets (je nach VVK-/AK-Mix).
  p.artist-deal-warning(v-if="totalDoorDealPercentage > 100") ⚠️ Türanteile summieren sich auf {{ totalDoorDealPercentage.toFixed(0) }}% — mehr als die verfügbaren 100% der Türeinnahmen.
  .field-hint Wird beim Erstellen der Abrechnung im Ausgaben-Tab als übernehmbarer Vorschlag angezeigt.
</template>

<style scoped>
/* ── House style (mirrors AccountingView's config-table pattern) ── */
.config-table {
  border: 0.25rem solid black;
}

.config-header,
.config-row {
  display: grid;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
}

.config-header {
  font-weight: 900;
  font-size: 0.8rem;
  border-bottom: 0.25rem solid black;
}

.config-row {
  border-bottom: 1px solid #ddd;
}

.config-row:last-child {
  border-bottom: none;
}

.select-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  background: white;
  box-sizing: border-box;
}

.text-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  box-sizing: border-box;
}

.amount-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}

.amount-input:focus,
.text-input:focus,
.select-input:focus {
  outline: none;
  background: black;
  color: white;
}

.unit {
  font-weight: 900;
  font-size: 0.9rem;
}

.field-hint {
  font-size: 0.85rem;
  color: black;
  overflow-wrap: break-word;
}

/* ── Component-specific layout ── */
.artist-deal-header,
.artist-deal-row {
  grid-template-columns: minmax(7rem, 1fr) 12rem 1fr;
  align-items: start;
}

.artist-deal-header {
  align-items: center;
}

.artist-deal-name {
  font-weight: 900;
  padding-top: 0.4rem;
}

.artist-deal-values {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.artist-deal-values .input-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.artist-deal-notes {
  width: 100%;
}

.artist-deal-hint {
  margin: 0;
  font-size: 0.8rem;
}

.artist-deal-warning {
  color: #f57c00;
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 1rem;
}
</style>

