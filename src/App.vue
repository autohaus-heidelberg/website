<script setup lang="ts">
import { computed } from 'vue'
import {  RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute();
const isHome = computed(() => {
  console.log(route.path)
  return route.path === "/";
})

</script>

<template lang="pug">
header
router-link(v-if="!isHome" :to="{name: 'home'}") 
  a home
RouterView
</template>

<style scoped>
header {
  margin-top: 3rem;
}
</style>
