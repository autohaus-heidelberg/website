<script setup lang="ts">
withDefaults(defineProps<{ tone?: "mark" | "multi" }>(), { tone: "mark" });

// Unregelmäßiger Zackenstern (außen) und derselbe, um die Mitte verkleinert (weiße Fläche für den Text)
const OUTER =
  "143,30 166,69 213,48 203,78 253,81 219,104 254,123 215,129 226,157 185,149 177,187 153,156 112,183 112,149 57,160 92,129 43,117 86,106 52,80 101,78 89,42 129,69";
const INNER =
  "144,46 163,77 200,60 192,84 232,87 205,105 233,120 202,125 211,148 178,141 172,172 152,147 120,168 120,141 76,150 104,125 64,116 99,107 72,86 111,84 101,56 133,77";
</script>

<template lang="pug">
.fz-burst(:class="tone" aria-hidden="true")
  .fz-burst-dots
  svg(viewBox="0 0 300 220" focusable="false")
    g.fz-burst-lines
      polygon(points="7,17 13,11 58,58")
      polygon(points="31,4 37,0 72,48")
      polygon(points="295,17 289,11 244,58")
      polygon(points="269,4 263,0 228,48")
      polygon(points="7,203 13,209 58,162")
      polygon(points="31,216 37,220 72,172")
      polygon(points="295,203 289,209 244,162")
      polygon(points="269,216 263,220 228,172")
    polygon.fz-burst-out(:points="OUTER")
    polygon.fz-burst-shadow(:points="INNER" transform="translate(-5 5)")
    polygon.fz-burst-in(:points="INNER")
  .fz-burst-text
    slot
</template>
