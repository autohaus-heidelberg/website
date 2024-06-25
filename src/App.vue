<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute();
const isHome = computed(() => {
  console.log(route.path)
  return route.path === "/";
})

</script>

<template lang="pug">
header
  a(v-if="!isHome" @click="$router.go(-1)") 
    .header-link 
      //- !--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--
      svg.mr-1(xmlns="http://www.w3.org/2000/svg" fill="var(--link-color)" stroke="var(--link-color)" viewBox="0 0 320 512" height="30")
        path(d="M267.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160L64 241V96c0-17.7-14.3-32-32-32S0 78.3 0 96V416c0 17.7 14.3 32 32 32s32-14.3 32-32V271l11.5 9.6 192 160z")
      a Zurück
RouterView
</template>

<style scoped>
header {
  padding-top: 3rem;
  max-width: 75ch;
  margin: auto
}

.header-link {
  display: flex;
  align-items: center;
}

.header-link svg {
  margin-right: 1rem;
}

.header-link a {
  margin-top: 0.2rem;
}
</style>
