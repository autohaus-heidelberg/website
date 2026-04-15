<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { beverageService } from '@/services'
import type { BeverageItem } from '@/types/accounting'
import type { PaginatedResponse } from '@/types/api'
import { useSort } from '@/composables/useSort'

const router = useRouter()
const { t } = useI18n()
const sort = useSort<BeverageItem>()

const beveragesData = ref<PaginatedResponse<BeverageItem> | null>(null)
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

const beverages = computed(() => beveragesData.value?.results || [])

const filteredBeverages = computed(() => {
  if (!searchQuery.value) return beverages.value
  const query = searchQuery.value.toLowerCase()
  return beverages.value.filter(b =>
    b.name.toLowerCase().includes(query) ||
    b.supplier_group.toLowerCase().includes(query)
  )
})

const groupedBeverages = computed(() => {
  const groups: Record<string, BeverageItem[]> = {}
  for (const b of filteredBeverages.value) {
    if (!groups[b.supplier_group]) groups[b.supplier_group] = []
    groups[b.supplier_group].push(b)
  }
  // Apply sort within each group
  for (const key in groups) {
    groups[key] = sort.sorted(groups[key], (item, k) => {
      switch (k) {
        case 'name': return item.name.toLowerCase()
        case 'crate': return item.units_per_crate || 1
        case 'purchase': return parseFloat(item.purchase_price || '0')
        case 'selling': return parseFloat(item.selling_price || item.selling_price_portion || '0')
        case 'deposit': return parseFloat(item.deposit || '0')
        default: return 0
      }
    })
  }
  return groups
})

function formatPrice(value: string | null | undefined): string {
  if (!value) return '–'
  return parseFloat(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

async function loadBeverages() {
  isLoading.value = true
  error.value = ''
  try {
    beveragesData.value = await beverageService.getAll()
  } catch (e: any) {
    error.value = e.message || t('beverages.errorLoading')
  } finally {
    isLoading.value = false
  }
}

async function deleteBeverage(item: BeverageItem) {
  if (!confirm(t('beverages.confirmDelete', { name: item.name }))) return
  try {
    await beverageService.delete(item.id!)
    if (beveragesData.value) {
      beveragesData.value.results = beveragesData.value.results.filter(b => b.id !== item.id)
      beveragesData.value.count--
    }
  } catch (e: any) {
    alert(t('beverages.errorDeleting') + e.message)
  }
}

onMounted(() => {
  loadBeverages()
})
</script>

<template lang="pug">
.beverage-list-view
  .header
    h2 {{ $t('beverages.title') }}
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        :placeholder="$t('common.search')"
      )
      router-link.btn-primary(to="/admin/beverages/create") {{ $t('beverages.newBeverage') }}

  .loading(v-if="isLoading") {{ $t('beverages.loadingBeverages') }}
  .error(v-else-if="error") {{ error }}

  template(v-else-if="filteredBeverages.length")
    .supplier-group(v-for="(items, group) in groupedBeverages" :key="group")
      h3.group-title {{ group }}
      .beverages-table
        .table-header
          .col-name.sortable(@click="sort.toggle('name')") {{ $t('beverages.tableHeaders.name') }}{{ sort.indicator('name') }}
          .col-crate.sortable(@click="sort.toggle('crate')") {{ $t('beverages.tableHeaders.pkg') }}{{ sort.indicator('crate') }}
          .col-size {{ $t('beverages.tableHeaders.btl') }}
          .col-price.sortable(@click="sort.toggle('purchase')") {{ $t('beverages.tableHeaders.purchase') }}{{ sort.indicator('purchase') }}
          .col-price.sortable(@click="sort.toggle('selling')") {{ $t('beverages.tableHeaders.selling') }}{{ sort.indicator('selling') }}
          .col-price.sortable(@click="sort.toggle('deposit')") {{ $t('beverages.tableHeaders.deposit') }}{{ sort.indicator('deposit') }}
          .col-actions

        .table-row(v-for="(item, idx) in items" :key="item.id" :class="{ 'row-even': idx % 2 === 1 }" @click="router.push(`/admin/beverages/${item.id}`)")
          .col-name {{ item.name }}
          .col-crate {{ item.units_per_crate || 1 }}{{ $t('accounting.inventoryTable.pc') }}
          .col-size {{ item.bottle_size ? item.bottle_size + 'L' : '' }}
          .col-price {{ formatPrice(item.purchase_price) }}
          .col-price
            template(v-if="item.selling_price") {{ formatPrice(item.selling_price) }}
            template(v-else-if="item.selling_price_portion")
              | {{ formatPrice(item.selling_price_portion) }}
              span.portion-hint  {{ $t('beverages.portionHint') }}
          .col-price {{ formatPrice(item.deposit) }}
          .col-actions
            router-link.btn-edit(:to="`/admin/beverages/${item.id}`") ✎
            button.btn-delete(@click.stop="deleteBeverage(item)") ✕

  .empty(v-else) {{ $t('beverages.noBeverages') }}
</template>

<style scoped>
.beverage-list-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 200px;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: filter 0.2s;
  white-space: nowrap;
  letter-spacing: 0.2em;
}

.btn-primary:hover {
  filter: brightness(120%);
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.error {
  background: white;
  border: 0.5rem solid black;
}

.supplier-group {
  margin-bottom: 2rem;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  margin-bottom: 0;
}

.beverages-table {
  width: 100%;
}

.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable:hover {
  text-decoration: underline;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1fr 45px 50px 90px 90px 90px 70px;
  gap: 1.25rem;
  padding: 0.5rem 1rem;
}

.table-header {
  border-bottom: 0.25rem solid black;
  font-weight: 900;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  border-bottom: 1px solid black;
  align-items: center;
  font-weight: 600;
  font-size: 0.875rem;
  transition: background 0.1s;
  cursor: pointer;
}

.col-crate {
  text-align: center;
  font-weight: 600;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:nth-child(even) {
  background: #f0f0f0;
}

.table-row:hover {
  background: #f5f5f5;
}

.col-name {
  font-weight: 600;
}

.col-size {
  text-align: right;
  font-size: 0.8rem;
}

.portion-hint {
  font-size: 0.7rem;
  color: #666;
}

.col-price {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.col-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-edit, .btn-delete {
  padding: 0.25rem 0.5rem;
  border: 0.2rem solid black;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  transition: filter 0.2s;
  line-height: 1;
}

.btn-edit {
  background: white;
  color: black;
}

.btn-delete {
  background: black;
  color: white;
}

.btn-edit:hover, .btn-delete:hover {
  filter: brightness(120%);
}

@media (max-width: 768px) {
  .table-header {
    display: none;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .col-price {
    text-align: left;
  }

  .col-actions {
    justify-content: flex-start;
    padding-top: 0.5rem;
  }
}
</style>
