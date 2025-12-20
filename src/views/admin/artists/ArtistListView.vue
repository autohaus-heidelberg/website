<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { artistService, type Artist } from '@/services'
import type { PaginatedResponse } from '@/types/api'

const router = useRouter()
const artistsData = ref<PaginatedResponse<Artist> | null>(null)
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

const artists = computed(() => artistsData.value?.results || [])

const filteredArtists = computed(() => {
  if (!searchQuery.value) return artists.value

  const query = searchQuery.value.toLowerCase()
  return artists.value.filter(artist =>
    artist.name.toLowerCase().includes(query) ||
    artist.description?.toLowerCase().includes(query)
  )
})

async function loadArtists() {
  isLoading.value = true
  error.value = ''

  try {
    artistsData.value = await artistService.getAll()
  } catch (e: any) {
    error.value = e.message || 'Failed to load artists'
  } finally {
    isLoading.value = false
  }
}

async function deleteArtist(artist: Artist) {
  if (!confirm(`Delete artist "${artist.name}"?`)) return

  try {
    await artistService.delete(artist.id!)
    // Remove from local data
    if (artistsData.value) {
      artistsData.value.results = artistsData.value.results.filter(a => a.id !== artist.id)
      artistsData.value.count--
    }
  } catch (e: any) {
    alert('Failed to delete artist: ' + e.message)
  }
}

onMounted(() => {
  loadArtists()
})
</script>

<template lang="pug">
.artist-list-view
  .header
    h2 Artists
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Search artists..."
      )
      router-link.btn-primary(to="/admin/artists/create") ➕ Create Artist

  .loading(v-if="isLoading") Loading artists...
  .error(v-else-if="error") {{ error }}

  .artists-grid(v-else-if="filteredArtists.length")
    .artist-card(v-for="artist in filteredArtists" :key="artist.id")
      .artist-image(v-if="artist.image_url")
        img(:src="artist.image_url" :alt="artist.name")
      .artist-placeholder(v-else) 🎤

      .artist-content
        h3.artist-name {{ artist.name }}
        p.artist-description(v-if="artist.description") {{ artist.description }}

        .artist-links(v-if="artist.link || artist.soundcloud || artist.youtube || artist.bandcamp")
          a.link(v-if="artist.link" :href="artist.link" target="_blank") 🌐 Website
          a.link(v-if="artist.soundcloud" :href="artist.soundcloud" target="_blank") 🎵 SoundCloud
          a.link(v-if="artist.youtube" :href="artist.youtube" target="_blank") ▶️ YouTube
          a.link(v-if="artist.bandcamp" :href="artist.bandcamp" target="_blank") 🎸 Bandcamp

      .artist-actions
        router-link.btn-edit(:to="`/admin/artists/${artist.id}`") Edit
        button.btn-delete(@click="deleteArtist(artist)") Delete

  .empty(v-else) No artists found
</template>

<style scoped>
.artist-list-view {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: #1a1f36;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  min-width: 250px;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
  white-space: nowrap;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.error {
  color: #d32f2f;
  background: #ffebee;
  border-radius: 8px;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.artist-card {
  border: 2px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.artist-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.artist-image {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: #f5f5f5;
}

.artist-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  font-size: 4rem;
}

.artist-content {
  padding: 1.5rem;
}

.artist-name {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: #1a1f36;
}

.artist-description {
  font-size: 0.95rem;
  color: #666;
  margin-bottom: 1rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.artist-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.link {
  font-size: 0.85rem;
  color: #667eea;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 4px;
}

.link:hover {
  background: rgba(102, 126, 234, 0.2);
}

.artist-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f0f0f0;
}

.btn-edit, .btn-delete {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-edit {
  background: #2196f3;
  color: white;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-edit:hover, .btn-delete:hover {
  opacity: 0.85;
}

@media (max-width: 768px) {
  .artists-grid {
    grid-template-columns: 1fr;
  }
}
</style>
