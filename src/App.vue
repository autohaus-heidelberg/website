<script setup lang="ts">
import {  RouterView } from 'vue-router'
</script>

<template lang="pug">
header
router-link(:to="{name: 'home'}") 
  a home
RouterView
</template>

<style scoped>
header {
  margin-top: 3rem;
}
</style>
