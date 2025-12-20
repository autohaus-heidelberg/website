<template lang="pug">
.sync-log
  h2 Sync Log
  .log-container(ref="logContainer")
    .log-entry(v-for="(entry, index) in logs" :key="index" :class="getLogClass(entry.event)")
      .log-timestamp {{ entry.timestamp }}
      .log-badge(:class="getBadgeClass(entry.event)") {{ entry.event }}
      .log-message {{ entry.message }}
    .empty-state(v-if="logs.length === 0")
      p No log entries yet. Start a sync operation to see progress.
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { SSELogEntry } from '@/composables/useEventSource'

const props = defineProps<{
  logs: SSELogEntry[]
}>()

const logContainer = ref<HTMLElement | null>(null)

// Auto-scroll to bottom when new logs are added
watch(() => props.logs.length, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})

function getLogClass(event: string): string {
  if (event.includes('error')) return 'log-error'
  if (event.includes('complete')) return 'log-success'
  if (event.includes('start')) return 'log-info'
  return 'log-default'
}

function getBadgeClass(event: string): string {
  if (event.includes('error')) return 'badge-error'
  if (event.includes('complete')) return 'badge-success'
  if (event.includes('start')) return 'badge-info'
  if (event === 'heartbeat') return 'badge-heartbeat'
  return 'badge-default'
}
</script>

<style scoped>
.sync-log {
  margin-top: 2rem;
}

h2 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.log-container {
  max-height: 400px;
  overflow-y: auto;
  border: 2px solid #333;
  padding: 1rem;
  background-color: #f9f9f9;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.log-entry {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 0.75rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  align-items: center;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-timestamp {
  color: #666;
  font-weight: bold;
}

.log-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.75rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-info {
  background-color: #3498db;
  color: white;
}

.badge-success {
  background-color: #2ecc71;
  color: white;
}

.badge-error {
  background-color: #e74c3c;
  color: white;
}

.badge-default {
  background-color: #95a5a6;
  color: white;
}

.badge-heartbeat {
  background-color: #f39c12;
  color: white;
}

.log-message {
  word-break: break-word;
}

.log-error {
  background-color: #ffebee;
}

.log-success {
  background-color: #e8f5e9;
}

.log-info {
  background-color: #e3f2fd;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.empty-state p {
  margin: 0;
  font-style: italic;
}
</style>
