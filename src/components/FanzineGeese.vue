<script setup lang="ts">
import { ref } from "vue";

// Gruß an das Fanzine „Good Clean Fun“ (Ausgabe #1, Herbst 2026), dessen Titelbild zwei Gänse hinterm Zaun zeigt.
// Eigene Zeichnung, kein Ausschnitt aus dem Heft.
const open = ref(false);

const GOOSE =
  "M27 34 C25 50 20 64 20 82 C20 104 30 128 46 152 L100 152 C112 128 110 98 94 86 C82 78 66 78 56 80 C46 64 48 48 49 34 C50 22 43 14 35 15 C28 16 25 22 27 28 Z";
const GEESE = [
  { x: 6, y: 4, s: 0.92 },
  { x: 92, y: 12, s: 1 },
];
const POSTS = [12, 36, 60, 84, 108, 132, 156, 180, 204];
</script>

<template lang="pug">
button.fz-geese(type="button" :class="{ open }" @click="open = !open" aria-label="Zwei Gänse hinterm Zaun sagen: Good clean fun.")
  span.fz-geese-say(aria-hidden="true") Good clean fun.
  svg(viewBox="0 0 230 150" focusable="false" aria-hidden="true")
    defs
      pattern#fz-geese-dots(width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)")
        circle(cx="2.5" cy="2.5" r="1.3")
      clipPath#fz-geese-clip
        path(:d="GOOSE")
    g(v-for="(g, i) in GEESE" :key="i" :transform="`translate(${g.x} ${g.y}) scale(${g.s})`")
      path.goose(:d="GOOSE")
      path.shade(d="M58 112 L120 88 L120 156 L28 156 Z" clip-path="url(#fz-geese-clip)")
      path.wing(d="M58 100 C72 93 92 99 98 118")
      path.beak(d="M27 26 L5 33 L27 39 Z")
      circle.eye(cx="36" cy="25" r="2.4")
    //- Maschendraht davor
    g.fence
      path(d="M0 62 C40 58 80 66 120 61 S200 59 230 63")
      path(d="M0 90 C50 94 90 86 130 91 S200 93 230 89")
      path(d="M0 120 C40 117 100 123 150 119 S210 118 230 121")
      path(v-for="x in POSTS" :key="x" :d="`M${x} 50 L${x + 4} 150`")
</template>
