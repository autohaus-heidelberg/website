<template lang="pug">
.past-events
  h1 Vergangene Events
  .events-grid
    .event(v-for="event in upcoming" :key="event.id")
      EventPreview(:event="event")

</template>

<script lang="ts" setup>
import { computed } from "vue";
import { events } from "../events";
import EventPreview from "../components/EventPreview.vue";
import dayjs from "dayjs";

const upcoming = computed(() =>
  events
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    // Only show dates that are newer than yesterday
    .filter((item) => item.date_d.isBefore(dayjs().subtract(1, "day")))
    .sort((a, b) => (a.date_d.isBefore(b.date_d) ? 1 : -1))
);


</script>

<style scoped>
.past-events {
  max-width: min(95vw, 2048px);
  margin: auto;
  padding: 1rem;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 500px));
  gap: 2rem;
  justify-content: center;
  margin-top: 2rem;
}

.event {
  display: flex;
  justify-content: center;
}
</style>