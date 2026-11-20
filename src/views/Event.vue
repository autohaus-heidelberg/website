<template lang="pug">
.fz
  FanzineNav(:label="isCommunity ? 'Treffen' : 'Programm'")
  .admin-controls(v-if="authStore.hasWebsiteGroup && event")
    router-link.admin-chip(v-if="!isCommunity" :to="`/admin/events/${event.id}?tab=checklist`") Checkliste
    router-link.admin-chip(:to="`/admin/events/${event.id}`") Bearbeiten

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
/* Wie das (A) auf der Startseite: eine kleine Marke unten rechts, die nichts verschiebt und den Flyer frei lässt */
.admin-controls {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 20;
  display: flex;
  border: 0.15rem solid #000;
  background: #fff;
  transform: rotate(-2deg);
  transition: transform 0.15s;
}

.admin-controls:hover { transform: rotate(2deg) scale(1.06); }

.admin-chip {
  padding: 0.25rem 0.65rem;
  color: #000;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
}

.admin-chip + .admin-chip { border-left: 0.15rem solid #000; }
.admin-chip:hover { background: #000; color: #fff; }
</style>