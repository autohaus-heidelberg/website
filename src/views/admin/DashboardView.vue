<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { eventService, artistService, accountingService, stockService, anfrageService, grantService } from '@/services'
import type { StockEntry, GrantSummary } from '@/types/accounting'

const authStore = useAuthStore()
const eventsCount = ref(0)
const artistsCount = ref(0)
const unreadAnfragen = ref(0)
const upcomingCount = ref(0)
const lowStockCount = ref(0)
const outOfStockOnMenu = ref(0)
const totalRevenue = ref(0)
const nextEvent = ref<{ title: string; date: string } | null>(null)
const stockSummary = ref<{ count: number; value: number } | null>(null)
const grantStats = ref<GrantSummary | null>(null)
const isLoading = ref(true)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

onMounted(async () => {
  try {
    const [eventsData, artistsData, accountingsData, stockData, unreadCount, grantSummary] = await Promise.all([
      eventService.getAll(),
      artistService.getAll(),
      accountingService.getAll(),
      stockService.getAll(),
      anfrageService.getUnreadCount().catch(() => 0),
      grantService.getSummary(new Date().getFullYear()).catch(() => null),
    ])
    eventsCount.value = eventsData.count
    artistsCount.value = artistsData.count
    unreadAnfragen.value = unreadCount as number

    // Upcoming events
    const now = new Date()
    const upcoming = eventsData.results
      .filter(e => new Date(e.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    upcomingCount.value = upcoming.length

    // Low stock count (≤3 bottles)
    const allStock = stockData as StockEntry[]
    lowStockCount.value = allStock.filter(e => e.quantity > 0 && e.quantity <= 3).length

    // Out of stock but on menu (has selling_price or selling_price_portion)
    outOfStockOnMenu.value = allStock.filter(e => e.quantity === 0 && (e.selling_price || e.selling_price_portion)).length

    // Total revenue this year
    const thisYear = now.getFullYear()
    totalRevenue.value = accountingsData.results
      .filter(a => a.revenues && a.revenues.length > 0)
      .reduce((sum, a) => sum + (a.revenues || []).reduce((s, r) => s + parseFloat(r.total || '0'), 0), 0)
    if (upcoming.length > 0) {
      nextEvent.value = { title: upcoming[0].title, date: upcoming[0].date }
    }

    // Stock summary
    const withQty = (stockData as StockEntry[]).filter(e => e.quantity > 0)
    stockSummary.value = {
      count: withQty.length,
      value: withQty.reduce((s, e) => s + parseFloat(e.stock_value || '0'), 0),
    }

    // Grant summary
    if (grantSummary) {
      grantStats.value = grantSummary as GrantSummary
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template lang="pug">
.dashboard
  h2 Willkommen, {{ authStore.user?.username || 'Admin' }}!

  .dashboard-sections(v-if="!isLoading")
    .section
      .section-title Events
      .stats-grid
        .stat-card
          .stat-info
            .stat-value {{ upcomingCount }}
            .stat-label Kommende Events
          router-link.stat-link(to="/admin/events") Events verwalten

        .stat-card
          .stat-info
            .stat-value {{ eventsCount }}
            .stat-label Veranstaltungen gesamt
          router-link.stat-link(to="/admin/events") Alle anzeigen

        .stat-card(v-if="nextEvent")
          .stat-info
            .stat-value-small {{ nextEvent.title }}
            .stat-label Nächstes Event
          .stat-subtitle {{ formatDate(nextEvent.date) }}
          router-link.stat-link(to="/admin/events") Events verwalten

        .stat-card
          .stat-info
            .stat-value {{ artistsCount }}
            .stat-label Künstler
          router-link.stat-link(to="/admin/artists") Künstler verwalten

    .section
      .section-title Finanzen
      .stats-grid
        .stat-card
          .stat-info
            .stat-value {{ formatCurrency(totalRevenue) }}
            .stat-label Umsatz gesamt
          router-link.stat-link(to="/admin/events") Abrechnungen ansehen

        .stat-card(v-if="grantStats")
          .stat-info
            .stat-value {{ grantStats.grant_count }}
            .stat-label Förderanträge {{ new Date().getFullYear() }}
          .stat-subtitle Beantragt: {{ formatCurrency(grantStats.total_requested) }}
          router-link.stat-link(to="/admin/events?view=grants") Förderungen ansehen

    .section
      .section-title Lager
      .stats-grid
        .stat-card(:class="{ highlight: outOfStockOnMenu > 0 }" v-if="outOfStockOnMenu > 0")
          .stat-info
            .stat-value ⚠ {{ outOfStockOnMenu }}
            .stat-label Auf der Karte ohne Bestand
          router-link.stat-link(to="/admin/lager?filter=out-of-stock") Prüfen

        .stat-card(:class="{ highlight: lowStockCount > 0 }")
          .stat-info
            .stat-value {{ lowStockCount }}
            .stat-label Getränke niedrig
          router-link.stat-link(to="/admin/lager") Lager prüfen

        .stat-card(v-if="stockSummary")
          .stat-info
            .stat-value {{ stockSummary.count }}
            .stat-label Getränke im Lager
          .stat-subtitle Warenwert: {{ formatCurrency(stockSummary.value) }}
          router-link.stat-link(to="/admin/lager") Lagerbestand ansehen

    .section
      .section-title Kommunikation
      .stats-grid
        .stat-card(:class="{ highlight: unreadAnfragen > 0 }")
          .stat-info
            .stat-value {{ unreadAnfragen }}
            .stat-label Ungelesene Anfragen
          router-link.stat-link(to="/admin/anfragen") Anfragen ansehen

  .loading(v-else) Lade Statistiken...

  .quick-actions
    h3 Schnellaktionen
    .actions-grid
      router-link.action-btn(to="/admin/events/create")
        span Neue Veranstaltung
      router-link.action-btn(to="/admin/artists/create")
        span Neuer Künstler
      router-link.action-btn(to="/admin/purchases/create")
        span Neuer Einkauf
      router-link.action-btn(to="/admin/lager")
        span Lagerverwaltung
      router-link.action-btn(to="/admin/anfragen")
        span Anfragen
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
}

h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
  color: black;
  font-weight: 900;
}

.dashboard-sections {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: black;
  margin-bottom: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 0.2rem solid black;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border: 0.5rem solid black;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s;
  transform: rotate(0.5deg);
}

.stat-card:nth-child(even) {
  transform: rotate(-0.5deg);
}

.stat-card:hover {
  transform: rotate(0deg);
}

.stat-card.highlight {
  background: black;
  color: white;
}

.stat-card.highlight .stat-value,
.stat-card.highlight .stat-label,
.stat-card.highlight .stat-subtitle {
  color: white;
}

.stat-card.highlight .stat-link {
  color: white;
  border-color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 900;
  color: black;
  line-height: 1;
  margin-bottom: 0.4rem;
}

.stat-value-small {
  font-size: 1.2rem;
  font-weight: 900;
  color: black;
  line-height: 1.2;
  margin-bottom: 0.4rem;
}

.stat-label {
  font-size: 0.85rem;
  color: black;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-subtitle {
  font-size: 0.85rem;
  color: #555;
  font-weight: 600;
}

.stat-link {
  color: black;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.8rem;
  padding-top: 0.5rem;
  border-top: 0.15rem solid black;
  transition: filter 0.2s;
}

.stat-link:hover {
  filter: brightness(80%);
}

.loading {
  padding: 3rem;
  text-align: center;
  color: black;
}

.quick-actions {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

h3 {
  margin-bottom: 1.5rem;
  color: black;
  font-size: 1.25rem;
  font-weight: 900;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: filter 0.2s;
  font-size: 0.9rem;
}

.action-btn:hover {
  filter: brightness(120%);
}
</style>
