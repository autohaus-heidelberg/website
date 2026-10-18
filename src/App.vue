<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const router = useRouter();

const route = useRoute();
const isHome = computed(() => {
  return route.path === "/";
})

// Public styles (buttons, links) in main.css are scoped to html.public
watchEffect(() => {
  document.documentElement.classList.toggle('public', !route.path.startsWith('/admin'))
})

// Header hides while scrolling down and slides back in when scrolling up
const headerHidden = ref(false)
let lastScrollY = 0

function onScroll() {
  const y = window.scrollY
  if (Math.abs(y - lastScrollY) < 5) return
  headerHidden.value = y > lastScrollY && y > 80
  lastScrollY = y
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function navigateBack() {
if (window.history.state.back === null) {
 router.push("/"); //or whichever path you required
} else {
 router.back();
}
}

</script>

<template lang="pug">
header(v-if="!isHome" :class="{ hidden: headerHidden }")
  button.back-btn(@click="navigateBack")
    .header-link
      //- !--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--
      svg.mr-1(xmlns="http://www.w3.org/2000/svg" fill="var(--link-color)" stroke="var(--link-color)" viewBox="0 0 320 512" height="30")
        path(d="M267.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160L64 241V96c0-17.7-14.3-32-32-32S0 78.3 0 96V416c0 17.7 14.3 32 32 32s32-14.3 32-32V271l11.5 9.6 192 160z")
      span Zurück
  router-link.header-logo(to="/" aria-label="Startseite")
    img(src="/img/logo.svg" alt="Autohaus")
RouterView
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
  height: 80px;
  max-width: 75ch;
  margin: 0 auto 1rem;
  background: var(--background-color);
  border-bottom: 0.3rem solid black;
  transition: transform 0.25s ease;
}

header.hidden {
  transform: translateY(-100%);
}

.header-logo img {
  margin: 0;
  height: 2.5rem;
  width: auto;
}

.back-btn {
  background: none;
  border: none;
  box-shadow: none;
  transform: none;
  padding: 0;
  cursor: pointer;
  color: var(--link-color);
  font-size: 1em;
  font-family: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  min-height: 44px;
  min-width: 44px;
  -webkit-tap-highlight-color: transparent;
}

.back-btn:hover,
.back-btn:active {
  box-shadow: none;
  transform: none;
}

.header-link {
  display: flex;
  align-items: center;
}

.header-link svg {
  height: 1.25em;
  width: auto;
  margin-right: 0.5rem;
}

.header-link span {
  margin-top: 0.2rem;
}
</style>
