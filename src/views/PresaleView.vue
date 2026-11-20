<template lang="pug">
.fz
  FanzineNav(label="Presale")
  header.fz-page-head
    h1.fz-page-title(aria-label="Presale")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Presale')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub(v-if="error") Dieser Presale-Link existiert nicht oder ist abgelaufen.
    p.fz-page-sub(v-else) Vorverkaufs-Info für Bands und Veranstalter*innen.

  section.fz-section(v-if="loading")
    p Lade Presale-Daten...

  section.fz-section(v-else-if="error")
    .fz-box.fz-dots.presale-help
      .fz-stamp Pannenhilfe
      h2.fz-h2 Presale-Link ungültig
      p Bitte beim Verein nach einem neuen Link fragen.

  template(v-else-if="data")
    section.fz-section.presale-event
      .fz-photo.presale-photo(v-if="data.event_image_url")
        .fz-tape.tl
        .fz-tape.tr
        img(:src="data.event_image_url" :alt="data.event_title" crossorigin="anonymous")
      div
        .fz-feature-date {{ formattedDate }}
        h2.fz-feature-title {{ data.event_title }}
        p(v-if="data.artists?.length") {{ data.artists.join(' · ') }}

    section.fz-section
      .fz-label VVK-Übersicht
      .presale-stats
        .fz-box.stat-card
          .stat-value {{ data.total_tickets }}
          .stat-label Tickets verkauft
        .fz-box.stat-card(v-if="data.fee")
          .stat-value {{ data.fee }} €
          .stat-label VVK-Preis
      .btn-row(v-if="data.shop_link")
        a.btn(:href="data.shop_link" target="_blank" rel="noopener") Zum Ticketshop

    p.presale-footer Carousel Heidelberg - Presale Info
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { eventService } from '@/services'
import type { PresaleInfo } from '@/services/events'
import dayjs from 'dayjs'
import FanzineNav from '@/components/FanzineNav.vue'
import { ransomChars } from '@/utils/ransom'
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
.presale-event {
  display: grid;
  gap: 2rem 3rem;
  align-items: start;
}

@media (min-width: 800px) {
  .presale-event:has(.presale-photo) { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
}

.presale-photo { margin: 0.5rem 0.5rem 0; transform: rotate(-1.4deg); }
.presale-photo img { display: block; width: 100%; height: auto; }

/* Das Poster zeigt hier immer das Original */
.fz .presale-photo img { filter: none; }
.fz .presale-photo::after { display: none; }

.presale-stats {
  display: grid;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

@media (min-width: 600px) {
  .presale-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 40rem; }
}

.stat-card { text-align: center; }

.stat-value {
  font-size: clamp(2.2rem, 7vw, 3.5rem);
  font-weight: 900;
  line-height: 1;
  margin-bottom: 0.4rem;
}

.stat-label {
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.presale-help { max-width: 36rem; }
.presale-help .fz-stamp { margin-bottom: 1rem; }
.presale-help .fz-h2 { margin-bottom: 0.5rem; }
.presale-help p { padding-right: 4rem; }

.presale-footer {
  margin-top: 3rem !important;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
