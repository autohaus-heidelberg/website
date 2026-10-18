<template lang="pug">
.admin-controls(v-if="authStore.hasWebsiteGroup && event")
  router-link.btn.btn-admin(:to="`/admin/events/${event.id}?tab=checklist`") Checkliste
  router-link.btn.btn-admin(:to="`/admin/events/${event.id}`") Bearbeiten

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
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 0.25rem solid black;
  background: white;
}

.btn-admin {
  flex: 1 1 auto;
  text-align: center;
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
  letter-spacing: 0.2em;
  cursor: pointer;
}

@media screen and (max-width: 480px) {
  .admin-controls {
    padding: 1rem;
    gap: 0.75rem;
  }

  .btn-admin {
    padding: 0.75rem 1rem;
    letter-spacing: 0.1em;
  }
}

.error {
  text-align: center;
  padding: 4rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
}
</style>