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
        span.icon 📊
        span Dashboard
      router-link.nav-link(to="/admin/events" active-class="active")
        span.icon 🎵
        span Events
      router-link.nav-link(to="/admin/artists" active-class="active")
        span.icon 🎤
        span Artists
      router-link.nav-link(to="/")
        span.icon 🌐
        span Public Site

  main.admin-content
    router-view
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-nav {
  width: 280px;
  background: #1a1f36;
  color: white;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.admin-nav-header {
  padding: 2rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-nav-header h1 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.username {
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
}

.user-groups {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.group {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: rgba(102, 126, 234, 0.2);
  border-radius: 4px;
  color: #a5b4fc;
}

.btn-logout {
  padding: 0.625rem;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fecaca;
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
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-link .icon {
  font-size: 1.25rem;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.nav-link.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
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
