<script setup lang="ts">
import FanzineNav from "@/components/FanzineNav.vue";
import { ransomChars } from "@/utils/ransom";
</script>

<template lang="pug">
.fz
  FanzineNav(label="Impressum")
  header.fz-page-head
    h1.fz-page-title(aria-label="Impressum")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Impressum')" :key="i" :class="c.cls") {{ c.ch }}

  .fz-legal
    section
      h2.fz-h2 Angaben gemäß § 5 TMG
      p Carousel e.V. - Hebelstraße 7 - 69115 Heidelberg
      p Registernummer: VR 704131
      p Amtsgericht: Mannheim

    section
      h2.fz-h2 Kontakt
      p E-Mail: carouselev@gmail.com

    section
      h2.fz-h2 EU-Streitschlichtung
      p Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
      p https://ec.europa.eu/consumers/odr/.

    section
      h2.fz-h2 Verbraucherstreitbeilegung/Universalschlichtungsstelle
      p Wir sind nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
</template>
