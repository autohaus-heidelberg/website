<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { artistService, type Artist } from '@/services'
import type { PaginatedResponse } from '@/types/api'

const router = useRouter()
const { t } = useI18n()
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
  if (!confirm(t('artists.confirmDelete', { name: artist.name }))) return

  try {
    await artistService.delete(artist.id!)
    // Remove from local data
    if (artistsData.value) {
      artistsData.value.results = artistsData.value.results.filter(a => a.id !== artist.id)
      artistsData.value.count--
    }
  } catch (e: any) {
    alert(t('artists.errorDeleting') + e.message)
  }
}

onMounted(() => {
  loadArtists()
})
</script>

<template lang="pug">
.artist-list-view
  .header
    h2 {{ $t('artists.title') }}
    .header-actions
      input.search-input(
        v-model="searchQuery"
        type="text"
        :placeholder="$t('artists.searchPlaceholder')"
      )
      router-link.btn-primary(to="/admin/artists/create") {{ $t('artists.createArtist') }}

  .loading(v-if="isLoading") {{ $t('artists.loadingArtists') }}
  .error(v-else-if="error") {{ error }}

  .artists-grid(v-else-if="filteredArtists.length")
    .artist-card(v-for="artist in filteredArtists" :key="artist.id")
      .artist-image(v-if="artist.image_url")
        img(:src="artist.image_url" :alt="artist.name")
      .artist-placeholder(v-else)

      .artist-content
        h3.artist-name {{ artist.name }}
        p.artist-description(v-if="artist.description") {{ artist.description }}

        .artist-links(v-if="artist.link || artist.soundcloud || artist.youtube || artist.bandcamp")
          a.link(v-if="artist.link" :href="artist.link" target="_blank") {{ $t('artists.website') }}
          a.link(v-if="artist.soundcloud" :href="artist.soundcloud" target="_blank") {{ $t('artists.soundcloud') }}
          a.link(v-if="artist.youtube" :href="artist.youtube" target="_blank") {{ $t('artists.youtube') }}
          a.link(v-if="artist.bandcamp" :href="artist.bandcamp" target="_blank") {{ $t('artists.bandcamp') }}

      .artist-actions
        router-link.btn-edit(:to="`/admin/artists/${artist.id}`") {{ $t('events.edit') }}
        button.btn-delete(@click="deleteArtist(artist)") {{ $t('common.delete') }}

  .empty(v-else) {{ $t('artists.noArtists') }}
</template>

<style scoped>
.artist-list-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
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
  color: black;
  margin: 0;
  font-weight: 900;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 250px;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: filter 0.2s;
  white-space: nowrap;
  letter-spacing: 0.2em;
}

.btn-primary:hover {
  filter: brightness(120%);
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.error {
  color: black;
  background: white;
  border: 0.5rem solid black;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.artist-card {
  border: 0.25rem solid black;
  overflow: hidden;
  transition: all 0.2s;
  transform: rotate(0.5deg);
}

.artist-card:hover {
  transform: rotate(-0.5deg);
}

.artist-image {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: white;
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
  background: white;
  border-bottom: 0.25rem solid black;
}

.artist-content {
  padding: 1.5rem;
}

.artist-name {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: black;
  font-weight: 900;
}

.artist-description {
  font-size: 0.95rem;
  color: black;
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
  color: white;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  background: black;
  font-weight: 600;
}

.link:hover {
  filter: brightness(120%);
}

.artist-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 0.25rem solid black;
}

.btn-edit, .btn-delete {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  transition: filter 0.2s;
}

.btn-edit {
  background: white;
  color: black;
}

.btn-delete {
  background: black;
  color: white;
}

.btn-edit:hover, .btn-delete:hover {
  filter: brightness(120%);
}

@media (max-width: 768px) {
  .artists-grid {
    grid-template-columns: 1fr;
  }
}
</style>
