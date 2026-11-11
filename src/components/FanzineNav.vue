<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template lang="pug">
//- Kopfleiste der Unterseiten im Fanzine-Stil; ersetzt den allgemeinen Zurück-/Logo-Header
nav.fz-strip.fz-nav(aria-label="Navigation")
  router-link(:to="{ name: 'home' }") &larr; Titelseite
  span Carousel im alten Autohaus
  span {{ label }}
</template>
