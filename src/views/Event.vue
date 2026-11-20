<template lang="pug">
.fz
  FanzineNav(:label="isCommunity ? 'Treffen' : 'Programm'")
  .admin-controls(v-if="authStore.hasWebsiteGroup && event")
    router-link.btn.btn-admin(v-if="!isCommunity" :to="`/admin/events/${event.id}?tab=checklist`") Checkliste
    router-link.btn.btn-admin(:to="`/admin/events/${event.id}`") Bearbeiten

  //- Unbekannte Events fängt die Route ab und zeigt die 404-Seite
  EventDisplay(v-if="event" :event="event")
</template>


<script lang="ts" setup>
import EventDisplay from '@/components/EventDisplay.vue'
import FanzineNav from '@/components/FanzineNav.vue'
import { isCommunity as isCommunityEvent } from '@/utils/community'
import { findEvent } from "../events"
import { computed } from "vue"
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{id: string}>()

const authStore = useAuthStore()

const event = computed(() => findEvent(props.id))

const isCommunity = computed(() => !!event.value && isCommunityEvent(event.value))
</script>


<style scoped>
.admin-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem;
  margin: 1rem 0 0;
  border: 0.2rem dashed black;
  background: white;
}

.btn-admin {
  flex: 1 1 auto;
  text-align: center;
  padding: 0.45em 0.9em;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
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
</style>