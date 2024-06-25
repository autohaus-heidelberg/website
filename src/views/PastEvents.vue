<template lang="pug">
h1 Vergangene Events
.event.mb-1(v-for="event in upcoming" :key="event.id")
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