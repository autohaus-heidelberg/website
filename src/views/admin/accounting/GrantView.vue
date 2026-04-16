<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { accountingService, beverageService, eventService, grantService } from '@/services'
import type { Event } from '@/services'
import type {
  EventAccounting,
  RevenueEntry,
  InventoryEntry,
  ExpenseEntry,
  BeverageItem,
  GrantApplication,
  GrantSummary,
} from '@/types/accounting'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  eventId: string
}>()

// ── State ────────────────────────────────────────────────────────
const event = ref<Event | null>(null)
const accounting = ref<EventAccounting | null>(null)
const beverages = ref<BeverageItem[]>([])
const revenues = ref<RevenueEntry[]>([])
const inventory = ref<InventoryEntry[]>([])
const expenses = ref<ExpenseEntry[]>([])

const isLoading = ref(false)
const error = ref('')
const isSaving = ref(false)
const saveSuccess = ref('')

// ── Persisted grant record ───────────────────────────────────────
const grantRecord = ref<GrantApplication | null>(null)
const grantSummary = ref<GrantSummary | null>(null)

// ── User inputs for flat-rate costs ──────────────────────────────
const annualStaffCosts = ref(0)
const annualRentCosts = ref(0)

// ── Helpers ──────────────────────────────────────────────────────

function revenueNet(entry: RevenueEntry): number {
  return parseFloat(entry.total || '0') - parseFloat(entry.change_money || '0') - parseFloat(entry.fees || '0')
}

function inventoryConsumption(entry: InventoryEntry): number {
  return parseFloat(entry.quantity_before || '0') - parseFloat(entry.quantity_after || '0')
}

function inventoryValue(entry: InventoryEntry, beverage: BeverageItem): number {
  const upc = beverage.units_per_crate || 1
  const consumedCrates = inventoryConsumption(entry) / upc
  const price = parseFloat(entry.snapshot_purchase_price || beverage.purchase_price || '0')
  return consumedCrates * price
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// ── Eligible expenses (Zuwendungsfähige Ausgaben) ────────────────

// Recorded expenses from accounting (GEMA, marketing, KSA, etc.)
const recordedExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

// Artist hospitality: 20 €/band
const artistHospitality = computed(() => {
  return (event.value?.artists?.length ?? 0) * 20
})

// 0.5% of annual staff costs
const staffFlatRate = computed(() => {
  return annualStaffCosts.value * 0.005
})

// 0.5% of annual rent
const rentFlatRate = computed(() => {
  return annualRentCosts.value * 0.005
})

const totalEligibleExpenses = computed(() => {
  return recordedExpenses.value + artistHospitality.value + staffFlatRate.value + rentFlatRate.value
})

// ── Own revenue (Eigenanteil) ────────────────────────────────────

// Admission revenue = entrance_cash + entrance_paypal net
const admissionRevenue = computed(() => {
  return revenues.value
    .filter(r => r.source === 'entrance_cash' || r.source === 'entrance_paypal')
    .reduce((sum, r) => sum + revenueNet(r), 0)
})

// 20% of bar evening revenue
const barRevenueContribution = computed(() => {
  const barTotal = revenues.value
    .filter(r => r.source === 'bar_cash' || r.source === 'bar_paypal')
    .reduce((sum, r) => sum + revenueNet(r), 0)
  return barTotal * 0.2
})

const totalOwnRevenue = computed(() => {
  return admissionRevenue.value + barRevenueContribution.value
})

// ── Grant calculation ────────────────────────────────────────────

const eligibleAmount = computed(() => {
  return Math.max(0, totalEligibleExpenses.value - totalOwnRevenue.value)
})

const grantAmount = computed(() => {
  return Math.min(1000, eligibleAmount.value)
})

// ── Load data ────────────────────────────────────────────────────

async function loadData() {
  isLoading.value = true
  error.value = ''
  try {
    const [ev, bevData] = await Promise.all([
      eventService.getById(props.eventId),
      beverageService.getAll(),
    ])
    event.value = ev
    beverages.value = bevData.results

    const acc = await accountingService.getByEvent(props.eventId)
    if (!acc) throw new Error('not found')
    accounting.value = acc
    revenues.value = acc.revenues ?? []
    inventory.value = acc.inventory_entries ?? []
    expenses.value = acc.expenses ?? []

    // Load existing grant record
    const existing = await grantService.getByEvent(props.eventId)
    if (existing) {
      grantRecord.value = existing
      annualStaffCosts.value = parseFloat(existing.annual_staff_costs || '0')
      annualRentCosts.value = parseFloat(existing.annual_rent_costs || '0')
    }

    // Load summary for the event's year
    const eventYear = ev.date ? new Date(ev.date).getFullYear() : new Date().getFullYear()
    grantSummary.value = await grantService.getSummary(eventYear)
  } catch (e: any) {
    error.value = e.message || t('common.errorLoading')
  } finally {
    isLoading.value = false
  }
}

async function saveGrant() {
  isSaving.value = true
  error.value = ''
  saveSuccess.value = ''
  try {
    const data: Partial<GrantApplication> = {
      event: props.eventId,
      requested_amount: grantAmount.value.toFixed(2),
      eligible_expenses: totalEligibleExpenses.value.toFixed(2),
      own_revenue: totalOwnRevenue.value.toFixed(2),
      annual_staff_costs: annualStaffCosts.value.toFixed(2),
      annual_rent_costs: annualRentCosts.value.toFixed(2),
    }
    if (grantRecord.value?.id) {
      grantRecord.value = await grantService.update(grantRecord.value.id, data)
    } else {
      grantRecord.value = await grantService.create(data)
    }
    saveSuccess.value = t('grant.saved')
    setTimeout(() => { saveSuccess.value = '' }, 3000)

    // Refresh summary
    const eventYear = event.value?.date ? new Date(event.value.date).getFullYear() : new Date().getFullYear()
    grantSummary.value = await grantService.getSummary(eventYear)
  } catch (e: any) {
    error.value = e.message || t('common.errorSaving')
  } finally {
    isSaving.value = false
  }
}

function printPage() {
  window.print()
}

onMounted(() => {
  loadData()
})
</script>

<template lang="pug">
.grant-view
  .loading(v-if="isLoading") {{ $t('common.loading') }}
  .error(v-else-if="error") {{ error }}
  template(v-else-if="accounting")
    .page-header
      .header-left
        router-link.btn-back(:to="`/admin/accounting/${eventId}`") {{ $t('common.back') }}
        h2 {{ $t('grant.title') }}
      .header-right
        span.save-success(v-if="saveSuccess") {{ saveSuccess }}
        button.btn-save(@click="saveGrant" :disabled="isSaving")
          | {{ isSaving ? $t('common.saving') : $t('grant.save') }}
        button.btn-print(@click="printPage") {{ $t('grant.print') }}

    .event-info
      .info-row
        span.label {{ $t('grant.eventTitle') }}
        span.value {{ event?.title }}
      .info-row
        span.label {{ $t('grant.eventDate') }}
        span.value {{ event?.date ? new Date(event.date).toLocaleDateString('de-DE') : '–' }}
      .info-row
        span.label {{ $t('grant.artists') }}
        span.value {{ event?.artists?.map(a => a.name).join(', ') || '–' }}

    //- ── Eligible Expenses ──
    h3.section-title {{ $t('grant.eligibleExpenses') }}
    .grant-detail
      template(v-for="exp in expenses" :key="exp.description")
        .detail-row(v-if="parseFloat(exp.amount || '0') !== 0")
          span {{ exp.description || '–' }}
          span.amount {{ formatCurrency(parseFloat(exp.amount || '0')) }}
      .detail-row(v-if="artistHospitality > 0")
        span {{ $t('grant.hospitality', { count: event?.artists?.length ?? 0 }) }}
        span.amount {{ formatCurrency(artistHospitality) }}
      .detail-row.input-row
        span {{ $t('grant.staffFlatRate') }}
        .input-group
          input.amount-input(
            v-model.number="annualStaffCosts"
            type="number"
            step="1"
            min="0"
            :placeholder="$t('grant.annualAmount')"
          )
          span.unit €/a
          span.computed × 0,5% = {{ formatCurrency(staffFlatRate) }}
      .detail-row.input-row
        span {{ $t('grant.rentFlatRate') }}
        .input-group
          input.amount-input(
            v-model.number="annualRentCosts"
            type="number"
            step="1"
            min="0"
            :placeholder="$t('grant.annualAmount')"
          )
          span.unit €/a
          span.computed × 0,5% = {{ formatCurrency(rentFlatRate) }}
      .detail-row.detail-total
        span {{ $t('grant.totalEligible') }}
        strong {{ formatCurrency(totalEligibleExpenses) }}

    //- ── Own Revenue ──
    h3.section-title {{ $t('grant.ownRevenue') }}
    .grant-detail
      .detail-row
        span {{ $t('grant.admissionRevenue') }}
        span.amount {{ formatCurrency(admissionRevenue) }}
      .detail-row
        span {{ $t('grant.barRevenue') }}
        span.amount {{ formatCurrency(barRevenueContribution) }}
      .detail-row.detail-total
        span {{ $t('grant.totalOwnRevenue') }}
        strong {{ formatCurrency(totalOwnRevenue) }}

    //- ── Calculation ──
    h3.section-title {{ $t('grant.calculation') }}
    .grant-summary
      .result-row
        span {{ $t('grant.totalEligible') }}
        strong {{ formatCurrency(totalEligibleExpenses) }}
      .result-row
        span {{ $t('grant.minusOwnRevenue') }}
        strong.negative {{ formatCurrency(totalOwnRevenue) }}
      .result-row
        span {{ $t('grant.eligibleAmount') }}
        strong {{ formatCurrency(eligibleAmount) }}
      .result-row.result-total
        span {{ $t('grant.requestedAmount') }}
        strong {{ formatCurrency(grantAmount) }}
      .max-note {{ $t('grant.maxNote') }}

    //- ── Year Summary ──
    .summary-section(v-if="grantSummary")
      h3.section-title {{ $t('grant.summary') }} ({{ event?.date ? new Date(event.date).getFullYear() : '' }})
      .grant-detail
        .detail-row
          span {{ $t('grant.totalRequested') }}
          span.amount {{ formatCurrency(grantSummary.total_requested) }}
        .detail-row
          span {{ $t('grant.grantCount') }}
          span.amount {{ grantSummary.grant_count }}

  .no-accounting(v-else)
    p {{ $t('grant.noAccounting') }}
    router-link.btn-back(to="/admin/accounting") {{ $t('common.back') }}
</template>

<style scoped>
.grant-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.loading {
  padding: 3rem;
  text-align: center;
}

.error {
  padding: 1rem;
  border: 0.25rem solid black;
  font-weight: 600;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  text-decoration: none;
  color: black;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-back:hover {
  background: black;
  color: white;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.btn-print {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.1em;
  transition: filter 0.2s;
}

.btn-print:hover {
  filter: brightness(120%);
}

.btn-save {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  cursor: pointer;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.1em;
  transition: filter 0.2s;
}

.btn-save:hover {
  filter: brightness(120%);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-success {
  color: black;
  font-weight: 900;
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
}

.summary-section {
  margin-top: 1rem;
}

/* ── Event Info ── */

.event-info {
  border: 0.25rem solid black;
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid black;
  font-size: 0.95rem;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  font-weight: 900;
}

/* ── Section Title ── */

.section-title {
  font-size: 1rem;
  font-weight: 900;
  padding: 0.5rem 1rem;
  background: black;
  color: white;
  margin-bottom: 0;
}

/* ── Grant Detail ── */

.grant-detail {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ddd;
  font-size: 0.9rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.detail-total {
  background: black;
  color: white;
  font-size: 0.95rem;
  border-bottom: none;
}

.input-row {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-group .amount-input {
  width: 140px;
  padding: 0.375rem 0.5rem;
  border: 0.15rem solid black;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.input-group .amount-input:focus {
  outline: none;
  background: black;
  color: white;
}

.unit {
  font-weight: 900;
  font-size: 0.85rem;
}

.computed {
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
}

/* ── Grant Summary ── */

.grant-summary {
  border: 0.25rem solid black;
  border-top: none;
  margin-bottom: 1.5rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid black;
  font-size: 1rem;
}

.result-row:last-child {
  border-bottom: none;
}

.result-total {
  background: black;
  color: white;
  font-size: 1.2rem;
  border-bottom: none;
}

.negative {
  font-weight: 900;
}

.max-note {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  font-style: italic;
  border: 0.25rem solid black;
  border-top: none;
  background: #f5f5f5;
}

/* ── No Accounting ── */

.no-accounting {
  padding: 2rem;
  text-align: center;
}

/* ── Print ── */

@media print {
  .btn-back, .btn-print, .header-right {
    display: none !important;
  }

  .grant-view {
    border: none;
    padding: 0;
  }

  .input-group .amount-input {
    border: none;
    padding: 0;
    font-size: inherit;
  }
}

@media (max-width: 600px) {
  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .input-group {
    flex-wrap: wrap;
  }
}
</style>
