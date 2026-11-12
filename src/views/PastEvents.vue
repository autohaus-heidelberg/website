<script lang="ts" setup>
import { computed, ref, watchEffect } from "vue";
import { events, type Event } from "../events";
import { concertsOnly } from "@/utils/community";
import { isPastEvent } from "@/utils/eventTime";
import { ransomChars } from "@/utils/ransom";
import FanzineNav from "@/components/FanzineNav.vue";
import dayjs from "dayjs";
import "dayjs/locale/de";

dayjs.locale("de");

const props = withDefaults(defineProps<{ view?: "list" | "gallery" }>(), {
  view: "list",
});

// Initial tab depends on which route led here; user can still switch freely.
const currentView = ref(props.view);

const past = computed(() =>
  concertsOnly(events)
    // Multi-day events (e.g. exhibitions) only count as over once their endDate passes
    .map((item) => ({ ...item, date_d: dayjs(item.endDate || item.date) }))
    .filter((item) => isPastEvent(item))
    .sort((a, b) => (a.date_d.isBefore(b.date_d) ? 1 : -1))
);

// Archiv nach Jahren gruppiert (neueste zuerst)
const byYear = computed(() => {
  const groups: { year: string; items: typeof past.value }[] = [];
  for (const item of past.value) {
    const year = item.date_d.format("YYYY");
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
});

const flyers = computed(() => past.value.filter((event) => event.img));

const eventLink = (id: string) => ({ name: "event", params: { id: encodeURI(id) } });

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

<template lang="pug">
.fz
  FanzineNav(label="Archiv")
  header.fz-page-head
    h1.fz-page-title(aria-label="Archiv")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Archiv')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub {{ past.length }} Abende, die ihr entweder erlebt oder verpasst habt. Nach Jahren sortiert, oder einfach durch die Flyer blättern.
    .btn-row
      button.btn.fz-toggle(:class="{ on: currentView === 'list' }" :aria-pressed="currentView === 'list'" @click="currentView = 'list'") Liste
      button.btn.fz-toggle(:class="{ on: currentView === 'gallery' }" :aria-pressed="currentView === 'gallery'" @click="currentView = 'gallery'") Galerie

  section.fz-section(v-if="currentView === 'list'")
    template(v-for="group in byYear" :key="group.year")
      h2.fz-h2.fz-year {{ group.year }}
      ul.fz-toc
        li(v-for="ev in group.items" :key="ev.id")
          router-link.plain-link(:to="eventLink(ev.id)")
            span.toc-date {{ ev.date_d.format('dd DD.MM.') }}
            span.toc-title(:class="{ 'fz-cancelled': ev.cancelled }") {{ ev.title }}
            span.toc-lead

  section.fz-section(v-else)
    .fz-gallery
      router-link.flyer.plain-link.fz-photo(
        v-for="event in dedupedFlyers"
        :key="event.id"
        :to="eventLink(event.id)"
        :title="event.title"
      )
        img(:src="event.img" :alt="event.title" loading="lazy" crossorigin="anonymous")
</template>
