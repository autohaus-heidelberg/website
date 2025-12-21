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
      .stat-info
        .stat-value {{ eventsCount }}
        .stat-label Events
      router-link.stat-link(to="/admin/events") Manage Events

    .stat-card
      .stat-info
        .stat-value {{ artistsCount }}
        .stat-label Artists
      router-link.stat-link(to="/admin/artists") Manage Artists

  .loading(v-else) Loading stats...

  .quick-actions
    h3 Quick Actions
    .actions-grid
      router-link.action-btn(to="/admin/events/create")
        span Create New Event
      router-link.action-btn(to="/admin/artists/create")
        span Create New Artist
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
}

h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
  color: black;
  font-weight: 900;
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
  border: 0.5rem solid black;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: transform 0.2s;
  transform: rotate(1deg);
}

.stat-card:hover {
  transform: rotate(-1deg);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 900;
  color: black;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 1rem;
  color: black;
  font-weight: 600;
}

.stat-link {
  color: black;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: filter 0.2s;
}

.stat-link:hover {
  filter: brightness(80%);
}

.loading {
  padding: 3rem;
  text-align: center;
  color: black;
}

.quick-actions {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  transform: rotate(-1deg);
}

h3 {
  margin-bottom: 1.5rem;
  color: black;
  font-size: 1.25rem;
  font-weight: 900;
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
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: filter 0.2s;
  letter-spacing: 0.2em;
}

.action-btn:hover {
  filter: brightness(120%);
}
</style>
