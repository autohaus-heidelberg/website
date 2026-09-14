<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/services/api'

interface ChangeEntry {
  entity: string
  label: string
  user: string | null
  at: string
}

const entries = ref<ChangeEntry[]>([])
const expanded = ref(false)
const loading = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

async function load() {
  loading.value = true
  try {
    entries.value = await api.get<ChangeEntry[]>('/api/recent-changes/')
  } catch {
    // Feed is non-critical; stay silent on failure.
  } finally {
    loading.value = false
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMin = Math.round((Date.now() - then) / 60000)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `vor ${diffH} Std`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'gestern'
  if (diffD < 7) return `vor ${diffD} Tagen`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) load()
}

onMounted(() => {
  load()
  // Refresh in the background so the footer stays reasonably current.
  timer = setInterval(load, 60000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template lang="pug">
footer.activity-feed(:class="{ 'is-expanded': expanded }")
  button.activity-summary(@click="toggle" :aria-expanded="expanded")
    span.activity-dot
    template(v-if="entries.length")
      span.activity-latest
        strong {{ entries[0].user || 'Jemand' }}
        |  hat {{ entries[0].entity }}
        |  „{{ entries[0].label }}“ geändert
      span.activity-time {{ relativeTime(entries[0].at) }}
    template(v-else)
      span.activity-latest.muted Keine kürzlichen Änderungen
    span.activity-toggle {{ expanded ? '▾' : '▸' }}

  ul.activity-list(v-if="expanded")
    li.activity-item(v-for="(e, i) in entries" :key="i")
      span.item-entity {{ e.entity }}
      span.item-label {{ e.label }}
      span.item-user {{ e.user || 'Jemand' }}
      span.item-time {{ relativeTime(e.at) }}
    li.activity-item.muted(v-if="!entries.length") Keine kürzlichen Änderungen
</template>

<style scoped>
.activity-feed {
  margin-top: 2rem;
  border-top: 0.25rem solid black;
  font-size: 0.8rem;
  color: #444;
}

.activity-summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: inherit;
  color: inherit;
}

.activity-summary:hover {
  color: black;
}

.activity-dot {
  width: 0.55rem;
  height: 0.55rem;
  background: black;
  border-radius: 50%;
  flex-shrink: 0;
}

.activity-latest {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-latest.muted {
  color: #999;
}

.activity-time {
  color: #999;
  flex-shrink: 0;
}

.activity-toggle {
  color: #999;
  flex-shrink: 0;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.activity-item {
  display: grid;
  grid-template-columns: 7rem 1fr auto auto;
  gap: 0.75rem;
  align-items: baseline;
  padding: 0.35rem 0.25rem;
  border-top: 1px solid #eee;
}

.activity-item.muted {
  color: #999;
  display: block;
}

.item-entity {
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: #666;
}

.item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: black;
}

.item-user {
  font-weight: 600;
  color: black;
}

.item-time {
  color: #999;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .activity-item {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'entity time'
      'label label'
      'user user';
  }

  .item-entity { grid-area: entity; }
  .item-time { grid-area: time; text-align: right; }
  .item-label { grid-area: label; }
  .item-user { grid-area: user; }
}
</style>
