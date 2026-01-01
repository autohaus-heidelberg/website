<template lang="pug">
.admin-controls(v-if="authStore.hasWebsiteGroup && event")
  router-link.btn-admin(:to="`/admin/events/${event.id}?tab=checklist`") Checkliste
  router-link.btn-admin(:to="`/admin/events/${event.id}`") Bearbeiten

EventDisplay(v-if="event" :event="event")
.error(v-else)
  p Event not found
</template>


<script lang="ts" setup>
import EventDisplay from '@/components/EventDisplay.vue'
import { events } from "../events"
import { computed } from "vue"
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{id: string}>()

const authStore = useAuthStore()

const event = computed(() => {
  return events.find(item => item.id === decodeURI(props.id))
})
</script>


<style scoped>
.admin-controls {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 0.25rem solid black;
  background: white;
}

.btn-admin {
  padding: 0.875rem 1.75rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  text-decoration: none;
  display: inline-block;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.btn-admin:hover {
  background: black;
  color: white;
}

.error {
  text-align: center;
  padding: 4rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
}
</style>