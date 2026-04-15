<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { purchaseService, beverageService } from '@/services'
import type { Purchase, PurchaseItem, BeverageItem } from '@/types/accounting'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isEditing = !!props.id

const form = ref<Partial<Purchase>>({
  date: new Date().toISOString().slice(0, 10),
  supplier: '',
  invoice_number: '',
  invoice_total: '0.00',
  notes: '',
  status: 'draft',
  items: [],
})

const beverages = ref<BeverageItem[]>([])
const isLoading = ref(false)
const error = ref('')

const activeBeverages = computed(() => beverages.value.filter(b => b.is_active))

const isScanning = ref(false)
const scanError = ref('')

async function scanReceipt(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isScanning.value = true
  scanError.value = ''
  error.value = ''

  try {
    const result = await purchaseService.scanReceipt(file)
    // Clear existing items
    form.value.items = []
    itemCrates.value = []
    itemLoose.value = []

    for (const scanned of (result.items ?? [])) {
      const matchedBev = scanned.drink_id
        ? beverages.value.find(b => b.id === scanned.drink_id)
        : null
      const bev = matchedBev || activeBeverages.value[0]
      const upc = bev?.units_per_crate || 1
      const crates = scanned.quantity_crates || 0
      const unitPrice = scanned.unit_price?.toString() || bev?.purchase_price || '0.00'
      const totalPrice = (parseFloat(unitPrice) * crates).toFixed(2)

      form.value.items!.push({
        beverage_item: bev?.id ?? 0,
        quantity: crates * upc,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
      itemCrates.value.push(crates)
      itemLoose.value.push(0)
    }
  } catch (e: any) {
    scanError.value = e.response?.data?.error || e.message || 'Scan failed'
  } finally {
    isScanning.value = false
    input.value = ''  // Reset file input
  }
}

const computedTotal = computed(() => {
  return (form.value.items ?? [])
    .reduce((sum, item) => sum + parseFloat(item.total_price || '0'), 0)
    .toFixed(2)
})

// Per-row crate/loose state (not sent to API, only for UI)
const itemCrates = ref<number[]>([])
const itemLoose = ref<number[]>([])

function addItem() {
  const items = form.value.items ?? []
  const bev = activeBeverages.value[0]
  items.push({
    beverage_item: bev?.id ?? 0,
    quantity: 0,
    unit_price: bev?.purchase_price ?? '0.00',
    total_price: '0.00',
  })
  form.value.items = items
  itemCrates.value.push(0)
  itemLoose.value.push(0)
}

function removeItem(idx: number) {
  form.value.items = (form.value.items ?? []).filter((_, i) => i !== idx)
  itemCrates.value.splice(idx, 1)
  itemLoose.value.splice(idx, 1)
}

function onBeverageChange(item: PurchaseItem, idx: number) {
  const bev = beverages.value.find(b => b.id === item.beverage_item)
  if (bev) {
    item.unit_price = bev.purchase_price ?? '0.00'
  }
  recalcItem(item, idx)
}

function recalcItem(item: PurchaseItem, idx: number) {
  const bev = beverages.value.find(b => b.id === item.beverage_item)
  const upc = bev?.units_per_crate || 1
  const crates = itemCrates.value[idx] || 0
  const loose = itemLoose.value[idx] || 0
  item.quantity = crates * upc + loose
  item.total_price = (
    parseFloat(item.unit_price || '0') * crates
  ).toFixed(2)
}

function beverageName(id: number): string {
  return beverages.value.find(b => b.id === id)?.name ?? `#${id}`
}

function formatItemTotal(item: PurchaseItem): string {
  return parseFloat(item.total_price || '0').toFixed(2)
}

async function loadData() {
  isLoading.value = true
  try {
    const bevData = await beverageService.getAll()
    beverages.value = bevData.results

    if (props.id) {
      const purchase = await purchaseService.getById(Number(props.id))
      form.value = { ...purchase }
      // Reconstruct crates/loose from stored quantity
      itemCrates.value = []
      itemLoose.value = []
      for (const item of (purchase.items ?? [])) {
        const bev = beverages.value.find(b => b.id === item.beverage_item)
        const upc = bev?.units_per_crate || 1
        itemCrates.value.push(Math.floor(item.quantity / upc))
        itemLoose.value.push(item.quantity % upc)
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load data'
  } finally {
    isLoading.value = false
  }
}

async function handleSubmit() {
  if (!form.value.date) {
    error.value = 'Please enter a date'
    return
  }
  isLoading.value = true
  error.value = ''

  try {
    if (isEditing) {
      await purchaseService.update(Number(props.id), form.value)
    } else {
      await purchaseService.create(form.value)
    }
    router.push('/admin/purchases')
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message || 'Error saving'
  } finally {
    isLoading.value = false
  }
}

async function finalize() {
  if (!confirm('Finalize purchase? Cannot be edited afterwards.')) return
  form.value.status = 'final'
  await handleSubmit()
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.purchase-form-view
  .form-header
    h2 {{ isEditing ? 'Edit Purchase' : 'New Purchase' }}
    router-link.btn-cancel(to="/admin/purchases") Back

  .error-msg(v-if="error") {{ error }}

  form.purchase-form(@submit.prevent="handleSubmit")
    .form-row
      .form-group
        label(for="date") Date
        input#date(v-model="form.date" type="date" required)
      .form-group
        label(for="supplier") Supplier
        input#supplier(v-model="form.supplier" type="text" placeholder="e.g. Getränkestation")
      .form-group
        label(for="invoice_number") Invoice No.
        input#invoice_number(v-model="form.invoice_number" type="text")

    .form-row
      .form-group
        label(for="invoice_total") Invoice Total (€)
        input#invoice_total(v-model="form.invoice_total" type="number" step="0.01" min="0")
      .form-group
        label Calculated Total
        .computed-total {{ computedTotal }} €
      .form-group
        label(for="notes") Notes
        textarea#notes(v-model="form.notes" rows="2")

    h3.section-title Items
    .scan-area
      label.btn-scan(:class="{ scanning: isScanning }")
        input(type="file" accept="image/*" capture="environment" @change="scanReceipt" hidden)
        | {{ isScanning ? '⏳ Analyzing...' : '📷 Scan Receipt' }}
      span.scan-hint Photo of receipt → AI fills in items
    .error-msg(v-if="scanError") {{ scanError }}
    .items-header
      span.col-bev Drink
      span.col-crates Crates
      span.col-loose Loose Btl.
      span.col-qty Units
      span.col-price Price / Crate (€)
      span.col-total Total (€)
      span.col-action &nbsp;

    .item-row(v-for="(item, idx) in form.items" :key="idx")
      select.col-bev(v-model.number="item.beverage_item" @change="onBeverageChange(item, idx)")
        option(v-for="bev in activeBeverages" :key="bev.id" :value="bev.id")
          | {{ bev.name }}
      input.col-crates(
        v-model.number="itemCrates[idx]"
        type="number"
        min="0"
        @input="recalcItem(item, idx)"
      )
      input.col-loose(
        v-model.number="itemLoose[idx]"
        type="number"
        min="0"
        @input="recalcItem(item, idx)"
      )
      span.col-qty {{ item.quantity }}
      input.col-price(
        v-model="item.unit_price"
        type="number"
        step="0.01"
        min="0"
        @input="recalcItem(item, idx)"
      )
      span.col-total {{ formatItemTotal(item) }}
      button.col-action.btn-remove(type="button" @click="removeItem(idx)") ×

    button.btn-add(type="button" @click="addItem") + Add Item

    .form-actions
      button.btn-save(type="submit" :disabled="isLoading")
        | {{ isLoading ? 'Saving...' : 'Save' }}
      button.btn-finalize(
        v-if="form.status === 'draft'"
        type="button"
        @click="finalize"
        :disabled="isLoading"
      ) Finalize
</template>

<style scoped>
.purchase-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
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

.btn-cancel {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  text-decoration: none;
  font-weight: 600;
}

.error-msg {
  padding: 1rem;
  border: 0.25rem solid black;
  background: black;
  color: white;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  padding: 0.625rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-weight: 600;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  background: black;
  color: white;
}

.computed-total {
  padding: 0.625rem;
  border: 0.25rem solid black;
  font-weight: 900;
  font-size: 0.95rem;
  background: #f5f5f5;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 900;
  margin: 2rem 0 1rem;
  border-bottom: 0.25rem solid black;
  padding-bottom: 0.5rem;
}

.scan-area {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.btn-scan {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  border: 0.25rem solid black;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-scan:hover {
  filter: brightness(130%);
}

.btn-scan.scanning {
  opacity: 0.6;
  cursor: wait;
}

.scan-hint {
  font-size: 0.8rem;
  color: #666;
}

.items-header,
.item-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 40px;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.items-header span {
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.item-row select,
.item-row input {
  padding: 0.5rem;
  border: 0.25rem solid black;
  font-size: 0.875rem;
  font-weight: 600;
}

.item-row select:focus,
.item-row input:focus {
  outline: none;
  background: black;
  color: white;
}

.item-row .col-total {
  font-weight: 900;
  text-align: right;
}

.btn-remove {
  background: black;
  color: white;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  font-weight: 900;
  padding: 0.25rem;
}

.btn-add {
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  font-weight: 900;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-add:hover {
  background: black;
  color: white;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 0.25rem solid black;
}

.btn-save {
  padding: 0.75rem 2rem;
  background: black;
  color: white;
  border: none;
  font-weight: 900;
  font-size: 1rem;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-finalize {
  padding: 0.75rem 2rem;
  background: white;
  color: black;
  border: 0.25rem solid black;
  font-weight: 900;
  font-size: 1rem;
  cursor: pointer;
}

.btn-finalize:hover {
  background: black;
  color: white;
}

.btn-finalize:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
