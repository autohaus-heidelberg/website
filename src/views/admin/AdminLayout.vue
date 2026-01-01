<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const isMobileMenuOpen = ref(false)

function handleLogout() {
  authStore.logout()
  router.push('/')
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

function handleNavigation() {
  isMobileMenuOpen.value = false
}

// Close menu on ESC key
function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMenuOpen.value) {
    isMobileMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

// Prevent body scroll when menu is open
watch(isMobileMenuOpen, (isOpen) => {
  if (isOpen) {
    document.body.classList.add('menu-open')
  } else {
    document.body.classList.remove('menu-open')
  }
})
</script>

<template lang="pug">
.admin-layout
  button.burger-menu(
    @click="toggleMobileMenu"
    :class="{ 'is-open': isMobileMenuOpen }"
    aria-label="Toggle navigation menu"
    :aria-expanded="isMobileMenuOpen"
  )
    span.burger-line
    span.burger-line
    span.burger-line

  nav.admin-nav(:class="{ 'is-open': isMobileMenuOpen }")
    .admin-nav-header
      h1 Event Management
      .user-info
        .username {{ authStore.user?.username }}
        .user-groups(v-if="authStore.user?.groups.length")
          span.group(v-for="group in authStore.user.groups" :key="group") {{ group }}
        button.btn-logout(@click="handleLogout") Logout

    .admin-nav-links
      router-link.nav-link(to="/admin" exact-active-class="active" @click="handleNavigation")
        span Dashboard
      router-link.nav-link(to="/admin/events" active-class="active" @click="handleNavigation")
        span Events
      router-link.nav-link(to="/admin/artists" active-class="active" @click="handleNavigation")
        span Artists
      router-link.nav-link(to="/admin/sync" active-class="active" @click="handleNavigation")
        span Event Sync
      router-link.nav-link(to="/admin/settings" active-class="active" @click="handleNavigation")
        span Settings
      router-link.nav-link(to="/admin/checklist-templates" active-class="active" @click="handleNavigation")
        span Checklist Templates
      router-link.nav-link(to="/" @click="handleNavigation")
        span Public Site

  main.admin-content
    router-view
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: white;
}

.admin-nav {
  width: 280px;
  background: white;
  color: black;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-right: 0.5rem solid black;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.admin-nav-header {
  padding: 2rem 1.5rem;
  border-bottom: 0.5rem solid black;
}

.admin-nav-header h1 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  font-weight: 900;
  color: black;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border: 0.25rem solid black;
}

.username {
  font-size: 0.95rem;
  font-weight: 600;
  color: black;
}

.user-groups {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.group {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: black;
  color: white;
}

.btn-logout {
  padding: 0.625rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-logout:hover {
  filter: brightness(120%);
}

.admin-nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  color: black;
  text-decoration: none;
  transition: all 0.2s;
  font-weight: 600;
  border: 0.25rem solid white;
}

.nav-link:hover {
  background: black;
  color: white;
}

.nav-link.active {
  background: black;
  color: white;
  border: 0.25rem solid black;
  transform: rotate(-1deg);
}

.admin-content {
  flex: 1;
  margin-left: 280px;
  padding: 2rem;
  overflow-y: auto;
}

/* Burger Menu Button */
.burger-menu {
  display: none;
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1001;
  width: 3.5rem;
  height: 3.5rem;
  padding: 0.75rem;
  background: white;
  border: 0.25rem solid black;
  cursor: pointer;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
}

.burger-menu:hover {
  filter: brightness(95%);
}

.burger-menu.is-open {
  background: black;
}

.burger-line {
  display: block;
  width: 100%;
  height: 0.25rem;
  background: black;
  transition: background 0.2s, opacity 0.2s;
}

.burger-menu.is-open .burger-line {
  background: white;
}

/* Animate burger to X when open */
.burger-menu.is-open .burger-line:nth-child(1) {
  transform: translateY(0.625rem) rotate(45deg);
}

.burger-menu.is-open .burger-line:nth-child(2) {
  opacity: 0;
  transform: translateX(-100%);
}

.burger-menu.is-open .burger-line:nth-child(3) {
  transform: translateY(-0.625rem) rotate(-45deg);
}

.burger-menu:active {
  transform: unset;
  left: unset;
}

@media (max-width: 768px) {
  /* Show burger menu on mobile */
  .burger-menu {
    display: flex;
  }

  /* Hide navigation by default, slide in when open */
  .admin-nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.3s ease-out;
    z-index: 1000;
    box-shadow: none;
  }

  /* Show navigation when open */
  .admin-nav.is-open {
    transform: translateX(0);
    box-shadow: 0.5rem 0 1rem rgba(0, 0, 0, 0.3);
  }

  /* Add overlay when menu is open */
  .admin-nav.is-open::before {
    content: '';
    position: fixed;
    top: 0;
    left: 280px;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: -1;
  }

  /* Adjust content area */
  .admin-content {
    margin-left: 0;
    padding: 5rem 1rem 2rem;
  }
}

/* Very small screens - full width nav */
@media (max-width: 480px) {
  .admin-nav {
    width: 100%;
  }

  .admin-nav.is-open::before {
    display: none; /* No overlay needed on full-width */
  }
}
</style>
