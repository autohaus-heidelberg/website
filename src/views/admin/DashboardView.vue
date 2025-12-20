<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { eventService, artistService } from '@/services'

const authStore = useAuthStore()
const eventsCount = ref(0)
const artistsCount = ref(0)
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [eventsData, artistsData] = await Promise.all([
      eventService.getAll(),
      artistService.getAll()
    ])
    eventsCount.value = eventsData.count
    artistsCount.value = artistsData.count
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template lang="pug">
.dashboard
  h2 Welcome, {{ authStore.user?.username }}!

  .stats-grid(v-if="!isLoading")
    .stat-card
      .stat-icon 🎵
      .stat-info
        .stat-value {{ eventsCount }}
        .stat-label Events
      router-link.stat-link(to="/admin/events") Manage Events →

    .stat-card
      .stat-icon 🎤
      .stat-info
        .stat-value {{ artistsCount }}
        .stat-label Artists
      router-link.stat-link(to="/admin/artists") Manage Artists →

  .loading(v-else) Loading stats...

  .quick-actions
    h3 Quick Actions
    .actions-grid
      router-link.action-btn(to="/admin/events/create")
        span.icon ➕
        span Create New Event
      router-link.action-btn(to="/admin/artists/create")
        span.icon ➕
        span Create New Artist
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
}

h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
  color: #1a1f36;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  font-size: 3rem;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #667eea;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 1rem;
  color: #666;
  font-weight: 500;
}

.stat-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.stat-link:hover {
  color: #764ba2;
}

.loading {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.quick-actions {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-bottom: 1.5rem;
  color: #1a1f36;
  font-size: 1.25rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.action-btn .icon {
  font-size: 1.25rem;
}
</style>
