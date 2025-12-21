<template lang="pug">
EventDisplay(v-if="event" :event="event")
.error(v-else)
  p Event not found
</template>


<script lang="ts" setup>
import EventDisplay from '@/components/EventDisplay.vue'
import { events } from "../events"
import { computed } from "vue"

const props = defineProps<{id: string}>()

const event = computed(() => {
  return events.find(item => item.id === decodeURI(props.id))
})
</script>


<style scoped>
.error {
  text-align: center;
  padding: 4rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
}
</style>