<template lang="pug">
.flyer-gallery
  h1 Flyer Galerie
  .gallery
    router-link.flyer(
      v-for="event in flyers"
      :key="event.id"
      :to="{ name: 'event', params: { id: encodeURI(event.id) } }"
      :title="event.title"
    )
      img(:src="event.img" loading="lazy" crossorigin="anonymous")
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { events } from "../events";
import dayjs from "dayjs";

const flyers = computed(() =>
  events
    .filter((event) => event.img)
    .map((event) => ({ ...event, date_d: dayjs(event.date) }))
    .sort((a, b) => (a.date_d.isBefore(b.date_d) ? 1 : -1))
);
</script>

<style scoped>
.flyer-gallery {
  max-width: min(95vw, 2048px);
  margin: auto;
  padding: 1rem;
}

.gallery {
  column-count: 4;
  column-gap: 1rem;
  margin-top: 2rem;
}

.flyer {
  display: block;
  break-inside: avoid;
  margin-bottom: 1rem;
}

.flyer img {
  display: block;
  width: 100%;
  margin: 0;
}

@media (max-width: 1200px) {
  .gallery {
    column-count: 3;
  }
}

@media (max-width: 800px) {
  .gallery {
    column-count: 2;
  }
}

@media (max-width: 500px) {
  .gallery {
    column-count: 1;
  }
}
</style>
