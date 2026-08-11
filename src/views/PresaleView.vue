<template lang="pug">
.presale-page
  .presale-loading(v-if="loading") Lade Presale-Daten...
  .presale-error(v-else-if="error")
    h2 Presale-Link ungültig
    p Dieser Presale-Link existiert nicht oder ist abgelaufen.
  .presale-content(v-else-if="data")
    .presale-header
      img.presale-image(v-if="data.event_image_url" :src="data.event_image_url" crossorigin="anonymous")
      h1.accent {{ data.event_title }}
      h2.date.accent {{ formattedDate }}
      p.artists(v-if="data.artists?.length") {{ data.artists.join(' · ') }}
    .presale-stats
      h2 VVK-Übersicht
      .stats-cards
        .stat-card
          .stat-value {{ data.total_tickets }}
          .stat-label Tickets verkauft
        .stat-card(v-if="data.fee")
          .stat-value {{ data.fee }} €
          .stat-label VVK-Preis
      a.shop-link(v-if="data.shop_link" :href="data.shop_link" target="_blank") Zum Ticketshop →
    .presale-footer
      p.branding Carousel Heidelberg — Presale Info
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { eventService } from '@/services'
import type { PresaleInfo } from '@/services/events'
import dayjs from 'dayjs'
import 'dayjs/locale/de'

const props = defineProps<{ token: string }>()

const data = ref<PresaleInfo | null>(null)
const loading = ref(true)
const error = ref(false)

const formattedDate = computed(() => {
  if (!data.value) return ''
  return dayjs(data.value.event_date).locale('de').format('dddd, DD. MMMM YYYY — HH:mm [Uhr]')
})

onMounted(async () => {
  try {
    data.value = await eventService.getPresaleInfo(props.token)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.presale-page {
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

.presale-loading {
  text-align: center;
  padding: 4rem 2rem;
  font-size: 1.2rem;
  font-weight: 600;
}

.presale-error {
  text-align: center;
  padding: 4rem 2rem;
}

.presale-error h2 {
  font-size: 1.5rem;
  font-weight: 900;
  margin-bottom: 0.5rem;
}

.presale-header {
  text-align: center;
  margin-bottom: 2rem;
}

.presale-image {
  max-width: min(400px, 90vw);
  max-height: min(400px, 90vw);
  width: auto;
  height: auto;
  display: block;
  margin: 0 auto 1.5rem;
}

.date {
  font-size: 1.1rem;
  margin-top: 0.5rem;
}

.artists {
  font-size: 1rem;
  margin-top: 0.5rem;
  opacity: 0.85;
}

.presale-stats {
  border: 0.25rem solid black;
  padding: 1.5rem;
}

.presale-stats h2 {
  font-size: 1.25rem;
  font-weight: 900;
  margin: 0 0 1rem;
}

.stats-cards {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  flex: 1;
  text-align: center;
  padding: 1rem;
  border: 0.25rem solid black;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.shop-link {
  display: block;
  text-align: center;
  padding: 0.875rem 1.75rem;
  border: 0.25rem solid black;
  background: black;
  color: white;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  transition: background 0.2s, color 0.2s;
}

.shop-link:hover {
  background: white;
  color: black;
}

.presale-footer {
  margin-top: 2rem;
  text-align: center;
}

.branding {
  font-size: 0.85rem;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.1em;
}
</style>
