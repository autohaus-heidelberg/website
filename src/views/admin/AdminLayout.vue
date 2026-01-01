<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

function handleLogout() {
  authStore.logout()
  router.push('/')
}
</script>

<template lang="pug">
.admin-layout
  nav.admin-nav
    .admin-nav-header
      h1 Event Management
      .user-info
        .username {{ authStore.user?.username }}
        .user-groups(v-if="authStore.user?.groups.length")
          span.group(v-for="group in authStore.user.groups" :key="group") {{ group }}
        button.btn-logout(@click="handleLogout") Logout

    .admin-nav-links
      router-link.nav-link(to="/admin" exact-active-class="active")
        span Dashboard
      router-link.nav-link(to="/admin/events" active-class="active")
        span Events
      router-link.nav-link(to="/admin/artists" active-class="active")
        span Artists
      router-link.nav-link(to="/admin/sync" active-class="active")
        span Event Sync
      router-link.nav-link(to="/admin/settings" active-class="active")
        span Settings
      router-link.nav-link(to="/admin/checklist-templates" active-class="active")
        span Checklist Templates
      router-link.nav-link(to="/")
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

@media (max-width: 768px) {
  .admin-nav {
    width: 100%;
    position: relative;
    height: auto;
  }

  .admin-content {
    margin-left: 0;
  }
}
</style>
