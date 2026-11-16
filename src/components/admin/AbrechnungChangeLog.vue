<script setup lang="ts">
import { ref, watch } from 'vue'
import { accountingService } from '@/services/accounting'
import type { AbrechnungChange } from '@/types/accounting'
import { describeChange } from '@/utils/abrechnungChanges'

const props = defineProps<{ accountingId: number }>()

const expanded = ref(false)
const loading = ref(false)
const failed = ref(false)
const changes = ref<AbrechnungChange[]>([])

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    changes.value = await accountingService.getChanges(props.accountingId)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) load()
}

watch(() => props.accountingId, () => {
  changes.value = []
  if (expanded.value) load()
})
</script>

<template lang="pug">
section.change-log
  button.change-log-toggle(type="button" @click="toggle" :aria-expanded="expanded")
    span.change-log-title Änderungsverlauf der Abrechnung
    span.change-log-arrow {{ expanded ? '▾' : '▸' }}
  div(v-if="expanded")
    p.change-log-note(v-if="loading") Lädt…
    p.change-log-note(v-else-if="failed") Verlauf konnte nicht geladen werden.
    p.change-log-note(v-else-if="!changes.length") Noch keine protokollierten Änderungen.
    ul.change-log-list(v-else)
      li.change-log-item(v-for="c in changes" :key="c.id")
        span.change-log-time {{ formatTime(c.at) }}
        span.change-log-user {{ c.user || 'Jemand' }}
        span.change-log-text {{ describeChange(c) }}
</template>

<style scoped>
.change-log {
  margin-top: 2rem;
  border-top: 0.25rem solid black;
  font-size: 0.8rem;
  color: #444;
  text-align: left;
}

.change-log-toggle {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0.6rem 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: inherit;
  color: inherit;
}

.change-log-toggle:hover {
  color: black;
}

.change-log-title {
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: black;
}

.change-log-note {
  margin: 0;
  padding: 0.25rem 0.25rem 0.75rem;
  color: #999;
}

.change-log-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0.75rem;
}

.change-log-item {
  display: grid;
  grid-template-columns: 8.5rem 5rem 1fr;
  gap: 0.75rem;
  padding: 0.35rem 0.25rem;
  border-top: 1px solid #eee;
}

.change-log-time {
  color: #999;
  font-variant-numeric: tabular-nums;
}

.change-log-user {
  font-weight: 700;
  color: black;
}

@media (max-width: 640px) {
  .change-log-item {
    grid-template-columns: 1fr;
    gap: 0.1rem;
  }
}
</style>
