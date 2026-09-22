<template lang="pug">
.past-events
  h1 Events
  .view-toggle
    button.toggle-btn(:class="{ active: currentView === 'list' }" @click="currentView = 'list'") Liste
    button.toggle-btn(:class="{ active: currentView === 'gallery' }" @click="currentView = 'gallery'") Galerie

  .events-grid(v-if="currentView === 'list'")
    .event(v-for="event in upcoming" :key="event.id")
      EventPreview(:event="event")

  .gallery(v-else)
    router-link.flyer(
      v-for="event in dedupedFlyers"
      :key="event.id"
      :to="{ name: 'event', params: { id: encodeURI(event.id) } }"
      :title="event.title"
    )
      img(:src="event.img" loading="lazy" crossorigin="anonymous")

</template>

<script lang="ts" setup>
import { computed, ref, watchEffect } from "vue";
import { events, type Event } from "../events";
import EventPreview from "../components/EventPreview.vue";
import dayjs from "dayjs";

const props = withDefaults(defineProps<{ view?: "list" | "gallery" }>(), {
  view: "list",
});

// Initial tab depends on which route led here; user can still switch freely.
const currentView = ref(props.view);

const upcoming = computed(() =>
  events
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    // Only show dates that are newer than yesterday
    .filter((item) => item.date_d.isBefore(dayjs().subtract(1, "day")))
    .sort((a, b) => (a.date_d.isBefore(b.date_d) ? 1 : -1))
);

const flyers = computed(() =>
  upcoming.value.filter((event) => event.img)
);

// Recurring series (e.g. cinema nights) often reuse the exact same artwork
// under a freshly generated filename each time, so dedup by file content
// rather than by URL. Starts out un-deduped, then narrows once hashed.
const dedupedFlyers = ref(flyers.value);

async function hashImage(url: string): Promise<string> {
  const buffer = await (await fetch(url)).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

watchEffect(async () => {
  const list = flyers.value;
  const hashes = await Promise.all(
    list.map((event) => hashImage(event.img!).catch(() => null))
  );
  const seen = new Set<string>();
  const result: (Event & { date_d: dayjs.Dayjs })[] = [];
  list.forEach((event, i) => {
    const hash = hashes[i];
    // Hashing failed (e.g. offline) - keep the image rather than hide it.
    if (hash === null || !seen.has(hash)) result.push(event);
    if (hash !== null) seen.add(hash);
  });
  dedupedFlyers.value = result;
});
</script>

<style scoped>
.past-events {
  max-width: min(95vw, 2048px);
  margin: auto;
  padding: 1rem;
}

.view-toggle {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}

.toggle-btn {
  background-color: var(--background-color);
  color: var(--link-color);
  box-shadow: inset 0 0 0 1px var(--link-color);
}

.toggle-btn.active {
  background-color: var(--link-color);
  color: var(--background-color);
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 500px));
  gap: 2rem;
  justify-content: center;
  margin-top: 2rem;
}

@media (max-width: 600px) {
  .events-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.event {
  display: flex;
  justify-content: center;
}

.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.flyer {
  display: block;
  flex-grow: 1;
}

.flyer img {
  display: block;
  height: 260px;
  width: auto;
  max-width: 100%;
  object-fit: cover;
  margin: 0;
}

@media (max-width: 800px) {
  .flyer img {
    height: 180px;
  }
}

@media (max-width: 500px) {
  .flyer img {
    height: 140px;
  }
}
</style>