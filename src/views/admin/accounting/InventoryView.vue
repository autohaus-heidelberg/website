<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StockView from './StockView.vue'
import PurchaseListView from './PurchaseListView.vue'

const route = useRoute()
const router = useRouter()

type Tab = 'bestand' | 'einkaufe'

const tabs: { id: Tab; label: string }[] = [
  { id: 'bestand', label: 'Bestand' },
  { id: 'einkaufe', label: 'Einkäufe' },
]

const activeTab = computed<Tab>(() => {
  const t = route.query.tab as string
  if (t === 'einkaufe') return t
  return 'bestand'
})

function switchTab(tab: Tab) {
  router.replace({ query: { tab } })
}
</script>

<template lang="pug">
.inventory-view
  .inventory-header
    h2 Lagerverwaltung
    .tab-bar
      button.tab(
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      ) {{ tab.label }}

  .sub-toolbar
    router-link.btn-action(v-if="activeTab === 'bestand'" to="/admin/beverages/create") + Getränk
    router-link.btn-action(v-if="activeTab === 'einkaufe'" to="/admin/purchases/create") + Einkauf

  StockView(v-if="activeTab === 'bestand'")
  PurchaseListView(v-else-if="activeTab === 'einkaufe'")
</template>

<style scoped>
.inventory-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.sub-toolbar {
  margin-bottom: 1rem;
  text-align: right;
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

.btn-action {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-action:hover {
  background: #333;
}
</style>
