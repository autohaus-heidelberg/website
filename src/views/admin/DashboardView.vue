<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { eventService, artistService, accountingService, stockService, anfrageService, grantService } from '@/services'
import { taxExportService } from '@/services/accounting'
import type { StockEntry, GrantSummary } from '@/types/accounting'

const authStore = useAuthStore()
const eventsCount = ref(0)
const artistsCount = ref(0)
const unreadAnfragen = ref(0)
const upcomingCount = ref(0)
const lowStockCount = ref(0)
const outOfStockOnMenu = ref(0)
const carouselProfit = ref<number | null>(null)
const nextEvent = ref<{ id: string; title: string; date: string } | null>(null)
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

    // Helper: is the item on the menu?
    const allStock = stockData as StockEntry[]
    const isOnMenu = (e: StockEntry) => e.is_active

    // Compute average consumption per beverage from past events
    const consumptionMap = new Map<number, number[]>()
    for (const acc of accountingsData.results) {
      for (const entry of acc.inventory_entries || []) {
        const consumed = parseFloat(entry.consumed_quantity || '0')
        if (consumed > 0) {
          const list = consumptionMap.get(entry.beverage_item) || []
          list.push(consumed)
          consumptionMap.set(entry.beverage_item, list)
        }
      }
    }
    const avgConsumption = new Map<number, number>()
    for (const [id, values] of consumptionMap) {
      avgConsumption.set(id, values.reduce((a, b) => a + b, 0) / values.length)
    }

    // Low stock: current quantity won't last 1 event (based on avg consumption)
    // Falls back to 1 crate if no consumption history
    const isLowStock = (e: StockEntry) => {
      if (e.quantity === 0) return false
      const avg = avgConsumption.get(e.id)
      if (avg) return e.quantity < avg
      return e.quantity <= (e.units_per_crate || 3)
    }
    lowStockCount.value = allStock.filter(e => isLowStock(e) && isOnMenu(e)).length

    // Out of stock but on menu
    outOfStockOnMenu.value = allStock.filter(e => e.quantity === 0 && isOnMenu(e)).length

    if (upcoming.length > 0) {
      nextEvent.value = { id: upcoming[0].id, title: upcoming[0].title, date: upcoming[0].date }
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

    // Carousel-Gewinn dieses Jahr (nur Treasurer): verbleibender Anteil nach
    // USt und Beteiligungsteilung — nicht der Brutto-Umsatz.
    if (authStore.isTreasurer) {
      try {
        const tax = await taxExportService.getSummary(now.getFullYear())
        carouselProfit.value = (tax.participants || [])
          .filter(p => p.participant.toLowerCase().includes('carousel'))
          .reduce((s, p) => s + p.amount, 0)
      } catch (e) {
        console.error('Failed to load Carousel profit:', e)
      }
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
        router-link.stat-card(v-if="nextEvent" :to="`/admin/events/${nextEvent.id}`")
          .stat-info
            .stat-value-small {{ nextEvent.title }}
            .stat-label Nächstes Event
          .stat-subtitle {{ formatDate(nextEvent.date) }}
          .stat-link Event öffnen

        router-link.stat-card(to="/admin/events?filter=upcoming")
          .stat-info
            .stat-value {{ upcomingCount }}
            .stat-label Kommende Events
          .stat-link Events verwalten

        router-link.stat-card(to="/admin/events?filter=all")
          .stat-info
            .stat-value {{ eventsCount }}
            .stat-label Veranstaltungen gesamt
          .stat-link Alle anzeigen

        router-link.stat-card(to="/admin/artists")
          .stat-info
            .stat-value {{ artistsCount }}
            .stat-label Künstler
          .stat-link Künstler verwalten

    .section(v-if="authStore.isTreasurer")
      .section-title Finanzen
      .stats-grid
        router-link.stat-card(:to="{ name: 'admin-tax-export' }")
          .stat-info
            .stat-value {{ carouselProfit === null ? '–' : formatCurrency(carouselProfit) }}
            .stat-label Gewinn Carousel {{ new Date().getFullYear() }}
          .stat-subtitle nach USt &amp; Beteiligungen
          .stat-link EÜR ansehen

        router-link.stat-card(v-if="grantStats" to="/admin/events?view=grants")
          .stat-info
            .stat-value {{ grantStats.grant_count }}
            .stat-label Förderanträge {{ new Date().getFullYear() }}
          .stat-subtitle Beantragt: {{ formatCurrency(grantStats.total_requested) }}
          .stat-link Förderungen ansehen

    .section
      .section-title Lager
      .stats-grid
        router-link.stat-card(:class="{ highlight: outOfStockOnMenu > 0 }" v-if="outOfStockOnMenu > 0" to="/admin/lager")
          .stat-info
            .stat-value ⚠ {{ outOfStockOnMenu }}
            .stat-label Auf der Karte ohne Bestand
          .stat-link Prüfen

        router-link.stat-card(:class="{ highlight: lowStockCount > 0 }" to="/admin/lager")
          .stat-info
            .stat-value {{ lowStockCount }}
            .stat-label Getränke niedrig
          .stat-link Lager prüfen

        router-link.stat-card(v-if="stockSummary" to="/admin/lager")
          .stat-info
            .stat-value {{ stockSummary.count }}
            .stat-label Getränke im Lager
          .stat-subtitle Warenwert: {{ formatCurrency(stockSummary.value) }}
          .stat-link Lagerbestand ansehen

    .section
      .section-title Kommunikation
      .stats-grid
        router-link.stat-card(:class="{ highlight: unreadAnfragen > 0 }" to="/admin/anfragen")
          .stat-info
            .stat-value {{ unreadAnfragen }}
            .stat-label Ungelesene Anfragen
          .stat-link Anfragen ansehen

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
  text-decoration: none;
  color: inherit;
  cursor: pointer;
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
