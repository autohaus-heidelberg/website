<script setup lang="ts">
import { ransomChars } from "@/utils/ransom";
import FanzineNav from "@/components/FanzineNav.vue";
import FanzineGeese from "@/components/FanzineGeese.vue";
import { computed } from "vue";
import { useRoute } from "vue-router";

// Alte Links auf gelöschte oder umbenannte Events bekommen einen eigenen Hinweis
const route = useRoute();
const isEvent = computed(() => route.path.startsWith("/event/"));
</script>

<template lang="pug">
.fz
  FanzineNav(label="Sackgasse")
  header.fz-page-head.has-geese
    h1.fz-page-title.long(aria-label="Diese Ausfahrt gibt es nicht")
      span.fz-line(aria-hidden="true" v-for="(line, li) in ['Diese Ausfahrt', 'gibt es nicht']" :key="li")
        span.fz-ch(v-for="(c, i) in ransomChars(line, li)" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub(v-if="isEvent") Dieses Event gibt es nicht (mehr). Vielleicht hat sich der Link geändert, ältere Events findest du im Archiv.
    p.fz-page-sub(v-else) Wer soll da noch wissen, wo oben und unten ist? Wir sicher nicht! In Zusammenarbeit mit dem TÜV-Südwest wurde diese Seite stillgelegt.
    .fz-404-foot
      .fz-help
        .fz-stamp Pannenhilfe
        p
          b Wenden und weiter:
        .btn-row
          router-link.btn(:to="{ name: 'home' }") Zurück zur Startseite
          router-link.btn(:to="{ name: 'calendar' }") Zum Kalender
          router-link.btn(v-if="isEvent" :to="{ name: 'pastEvents' }") Zum Archiv
      FanzineGeese
</template>

<style scoped>
/* Pannenhilfe links, Gänse rechts: beide stehen auf der Linie des Seitenkopfs */
.fz-404-foot { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1.5rem 2rem; margin-top: 2rem; }
.fz-help { padding-bottom: 1.75rem; }
.fz-help .fz-stamp { margin-bottom: 1rem; }
@media (max-width: 599px) {
  .fz-404-foot { gap: 0; }
  .fz-help { padding-bottom: 0; }
}
</style>

