<script setup lang="ts">
import FanzineNav from "@/components/FanzineNav.vue";
import { ransomChars } from "@/utils/ransom";
import { hausCarousel, hausCommunity, hausIntro, hausProgram, hausRequest, hausSommerfest, hausWorkers } from "@/utils/autohausContent";
</script>

<template lang="pug">
.fz
  FanzineNav(label="Das Autohaus")
  header.fz-page-head
    h1.fz-page-title(aria-label="Das Autohaus")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Das Autohaus')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub {{ hausIntro }}

  section.fz-section
    .fz-label Wer hier Gas gibt
    ol.fz-run
      li(v-for="w in hausWorkers" :key="w.label")
        span.run-when {{ w.label }}
        span.run-what {{ w.text }}

  section.fz-section
    .fz-label {{ hausSommerfest.label }}
    p {{ hausSommerfest.text }}

  section.fz-section#carousel
    .fz-label {{ hausCarousel.label }}
    p(v-for="(t, i) in hausCarousel.paragraphs" :key="i") {{ t }}
    h2.fz-h2(style="margin-top: 1.75rem; margin-bottom: 1rem") {{ hausCarousel.programTitle }}
    ol.fz-run
      li(v-for="p in hausProgram" :key="p.label")
        span.run-when {{ p.label }}
        span.run-what {{ p.text }}
    .btn-row
      router-link.btn(:to="{ name: 'calendar' }") {{ hausCarousel.ctaProgram }}
      router-link.btn(:to="{ name: 'requests' }") {{ hausCarousel.ctaRequest }}

  section.fz-section
    .fz-label {{ hausCommunity.label }}
    p {{ hausCommunity.text }}
    .btn-row
      router-link.btn(:to="{ name: 'community' }") {{ hausCommunity.cta }}

  section.fz-section#raum
    .fz-box
      h2.fz-h2 {{ hausRequest.title }}
      p {{ hausRequest.text }}
      router-link.btn(:to="{ name: 'requests', query: { type: 'space' } }") {{ hausRequest.cta }}
</template>
