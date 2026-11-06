<script setup lang="ts">
import { ransomChars } from "@/utils/ransom";
import FanzineNav from "@/components/FanzineNav.vue";
</script>

<template lang="pug">
.fz
  FanzineNav(label="Sackgasse")
  header.fz-page-head
    h1.fz-page-title.long(aria-label="Diese Ausfahrt gibt es nicht")
      span.fz-line(aria-hidden="true" v-for="(line, li) in ['Diese Ausfahrt', 'gibt es nicht']" :key="li")
        span.fz-ch(v-for="(c, i) in ransomChars(line, li)" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub Diese Seite ist nicht mehr befahrbar. Wer hier raus will, nimmt die Bahn.
  section.fz-section
    p
      b Zurück auf die Autobahn:
    .btn-row
      router-link.btn(:to="{ name: 'home' }") Zurück zur Startseite
      router-link.btn(:to="{ name: 'calendar' }") Zum Kalender
</template>

