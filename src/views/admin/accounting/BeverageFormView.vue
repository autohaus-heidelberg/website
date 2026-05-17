<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { beverageService } from '@/services'
import type { BeverageItem } from '@/types/accounting'

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
const priceHistory = ref<{ date: string; unit_price: string; quantity: number; supplier: string }[]>([])

const isSingleBottle = computed(() => (form.value.units_per_crate ?? 1) <= 1)
const hasPurchases = computed(() => priceHistory.value.length > 0)
const purchasePriceLabel = computed(() => isSingleBottle.value ? 'EK / Flasche' : 'EK / Kiste')

const supplierSuggestions = [
  'Getränkestation',
  'Kaufland',
  'Rewe',
  'Aldi',
  'Tegut',
]

async function loadBeverage() {
  if (!props.id) return
  try {
    const item = await beverageService.getById(Number(props.id))
    form.value = { ...item }
    const data = await beverageService.getPriceHistory(Number(props.id))
    priceHistory.value = data.history
  } catch (e: any) {
    error.value = 'Failed to load beverage'
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
    router.push('/admin/beverages')
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
    router-link.btn-cancel(to="/admin/beverages") Abbrechen

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

    .error(v-if="error") {{ error }}

    .form-actions
      button.btn-primary(type="submit" :disabled="isLoading")
        | {{ isLoading ? 'Speichern...' : (isEditing ? 'Aktualisieren' : 'Erstellen') }}
      router-link.btn-secondary(to="/admin/beverages") Abbrechen

  .price-history(v-if="isEditing && priceHistory.length")
    h3.section-title Preisverlauf (Einkäufe)
    .history-table
      .history-header
        .history-col-date Datum
        .history-col-price Preis
        .history-col-qty Menge
        .history-col-supplier Lieferant
      .history-row(v-for="(entry, idx) in priceHistory" :key="idx")
        .history-col-date {{ new Date(entry.date).toLocaleDateString('de-DE') }}
        .history-col-price {{ parseFloat(entry.unit_price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}
        .history-col-qty {{ entry.quantity }}
        .history-col-supplier {{ entry.supplier }}
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
  grid-template-columns: 100px 90px 60px 1fr;
  gap: 0.5rem;
  font-weight: 900;
  border-bottom: 2px solid black;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.history-row {
  display: grid;
  grid-template-columns: 100px 90px 60px 1fr;
  gap: 0.5rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid #eee;
}

.history-col-price {
  font-weight: 600;
}

.readonly-field {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}
</style>
