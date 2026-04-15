<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { beverageService } from '@/services'
import type { BeverageItem } from '@/types/accounting'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const { t } = useI18n()
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
  } catch (e: any) {
    error.value = 'Failed to load beverage'
  }
}

async function handleSubmit() {
  if (!form.value.name) {
    error.value = t('beverages.form.errorName')
    return
  }
  if (!form.value.supplier_group) {
    error.value = t('beverages.form.errorSupplier')
    return
  }
  if (!form.value.purchase_price) {
    error.value = t('beverages.form.errorPrice')
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    if (isEditing) {
      await beverageService.update(Number(props.id), form.value)
    } else {
      await beverageService.create(form.value)
    }
    router.push('/admin/beverages')
  } catch (e: any) {
    error.value = e.message || t('common.errorSaving')
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
    h2 {{ isEditing ? $t('beverages.editBeverage') : $t('beverages.newBeverage') }}
    router-link.btn-cancel(to="/admin/beverages") {{ $t('common.cancel') }}

  form.beverage-form(@submit.prevent="handleSubmit")
    .form-group
      label(for="name") {{ $t('common.name') }}
      input#name(
        v-model="form.name"
        type="text"
        :placeholder="$t('beverages.form.namePlaceholder')"
        required
      )

    .form-group
      label(for="supplier_group") {{ $t('beverages.form.supplierGroup') }}
      input#supplier_group(
        v-model="form.supplier_group"
        type="text"
        :placeholder="$t('beverages.form.supplierPlaceholder')"
        list="supplier-suggestions"
        required
      )
      datalist#supplier-suggestions
        option(v-for="s in supplierSuggestions" :key="s" :value="s")

    .form-row
      .form-group
        label(for="purchase_price") {{ $t('beverages.form.purchasePrice') }}
        .input-with-unit
          input#purchase_price(
            v-model="form.purchase_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
          )
          span.unit €

      .form-group
        label(for="selling_price") {{ $t('beverages.form.sellingPrice') }}
        .input-with-unit
          input#selling_price(
            v-model="form.selling_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €

      .form-group
        label(for="deposit") {{ $t('beverages.form.deposit') }}
        .input-with-unit
          input#deposit(
            v-model="form.deposit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €

    .form-row
      .form-group
        label(for="units_per_crate") {{ $t('beverages.form.unitsPerPackage') }}
        input#units_per_crate(
          v-model.number="form.units_per_crate"
          type="number"
          min="1"
          :placeholder="$t('beverages.form.unitsPlaceholder')"
        )
        .hint {{ $t('beverages.form.unitsHint') }}

      .form-group
        label(for="bottle_size") {{ $t('beverages.form.bottleSize') }}
        .input-with-unit
          input#bottle_size(
            v-model="form.bottle_size"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('beverages.form.bottleSizePlaceholder')"
          )
          span.unit L
        .hint {{ $t('beverages.form.bottleSizeHint') }}

      .form-group
        label(for="portions_per_bottle") {{ $t('beverages.form.portionsPerBottle') }}
        input#portions_per_bottle(
          v-model.number="form.portions_per_bottle"
          type="number"
          min="1"
          :placeholder="$t('beverages.form.portionsPlaceholder')"
        )
        .hint {{ $t('beverages.form.portionsHint') }}

      .form-group
        label(for="selling_price_portion") {{ $t('beverages.form.pricePerPortion') }}
        .input-with-unit
          input#selling_price_portion(
            v-model="form.selling_price_portion"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          )
          span.unit €
        .hint {{ $t('beverages.form.pricePerPortionHint') }}

    .form-row
      .form-group
        label(for="sort_order") {{ $t('beverages.form.sortOrder') }}
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
          |  {{ $t('common.active') }}

    .error(v-if="error") {{ error }}

    .form-actions
      button.btn-primary(type="submit" :disabled="isLoading")
        | {{ isLoading ? $t('common.saving') : (isEditing ? $t('common.update') : $t('common.create')) }}
      router-link.btn-secondary(to="/admin/beverages") {{ $t('common.cancel') }}
</template>

<style scoped>
.beverage-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 700px;
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
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
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
</style>
