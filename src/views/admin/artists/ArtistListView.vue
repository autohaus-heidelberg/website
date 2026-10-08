<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { artistService, type ArtistWithEventCount } from '@/services/artists'
import type { Artist } from '@/services/events'
import type { PaginatedResponse } from '@/types/api'
import SupportBandsPanel from './SupportBandsPanel.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref<'artists' | 'support' | 'duplicates'>('artists')
const artistsData = ref<PaginatedResponse<Artist> | null>(null)
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

// Duplicates tab state
const dupGroups = ref<ArtistWithEventCount[][]>([])
const dupLoading = ref(false)
const dupError = ref('')
const merging = ref<number | null>(null)  // sourceId being merged right now

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
  if (!confirm(`Künstler "${artist.name}" löschen?`)) return

  try {
    await artistService.delete(artist.id!)
    // Remove from local data
    if (artistsData.value) {
      artistsData.value.results = artistsData.value.results.filter(a => a.id !== artist.id)
      artistsData.value.count--
    }
  } catch (e: any) {
    alert('Fehler beim Löschen: ' + e.message)
  }
}

async function loadDuplicates() {
  dupLoading.value = true
  dupError.value = ''
  try {
    dupGroups.value = await artistService.getDuplicates()
  } catch (e: any) {
    dupError.value = e.message || 'Fehler beim Laden'
  } finally {
    dupLoading.value = false
  }
}

async function mergeInto(sourceId: number, targetId: number, sourceName: string, targetName: string) {
  if (!confirm(`"${sourceName}" in "${targetName}" zusammenführen?\n\nDie Quelldaten (${sourceName}) werden dabei gelöscht, alle Event-Verknüpfungen auf "${targetName}" umgehängt.`)) return
  merging.value = sourceId
  try {
    await artistService.merge(sourceId, targetId)
    await loadDuplicates()
    await loadArtists()
  } catch (e: any) {
    alert('Fehler beim Mergen: ' + e.message)
  } finally {
    merging.value = null
  }
}

async function deleteOneFromGroup(artist: ArtistWithEventCount) {
  if (!confirm(`Künstler "${artist.name}" (ID ${artist.id}) löschen?`)) return
  try {
    await artistService.delete(artist.id!)
    await loadDuplicates()
    await loadArtists()
  } catch (e: any) {
    alert('Fehler beim Löschen: ' + e.message)
  }
}

function switchTab(tab: 'artists' | 'support' | 'duplicates') {
  activeTab.value = tab
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  if (tab === 'artists') delete query.tab
  else query.tab = tab
  router.replace({ query })
  if (tab === 'duplicates' && dupGroups.value.length === 0 && !dupLoading.value) {
    loadDuplicates()
  }
}

onMounted(() => {
  const tab = route.query.tab as string | undefined
  if (tab === 'support' || tab === 'duplicates') {
    activeTab.value = tab
    if (tab === 'duplicates') loadDuplicates()
  }
  loadArtists()
})
</script>

<template lang="pug">
.artist-list-view
  .header
    h2 Künstler

  .tabs
    button.tab(:class="{ active: activeTab === 'artists' }" @click="switchTab('artists')") 🎤 Künstler
    button.tab(:class="{ active: activeTab === 'support' }" @click="switchTab('support')") 🎸 Support-Pool
    button.tab(:class="{ active: activeTab === 'duplicates' }" @click="switchTab('duplicates')") 🔍 Duplikate

  template(v-if="activeTab === 'artists'")
    .toolbar
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Künstler suchen..."
      )
      router-link.btn-primary(to="/admin/artists/create") + Neuer Künstler

    .loading(v-if="isLoading") Künstler werden geladen...
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
            a.link(v-if="artist.link" :href="artist.link" target="_blank") Website
            a.link(v-if="artist.soundcloud" :href="artist.soundcloud" target="_blank") SoundCloud
            a.link(v-if="artist.youtube" :href="artist.youtube" target="_blank") YouTube
            a.link(v-if="artist.bandcamp" :href="artist.bandcamp" target="_blank") Bandcamp

        .artist-actions
          router-link.btn-edit(:to="`/admin/artists/${artist.id}`") Bearbeiten
          button.btn-delete(@click="deleteArtist(artist)") Löschen

    .empty(v-else) Keine Künstler gefunden

  SupportBandsPanel(v-else-if="activeTab === 'support'")

  //- ── DUPLIKATE TAB ──────────────────────────────────────────────
  template(v-else-if="activeTab === 'duplicates'")
    .dup-toolbar
      p.dup-hint Künstler mit identischem Namen (Groß-/Kleinschreibung ignoriert). Wähle pro Gruppe, welcher Eintrag übrig bleibt – alle Events werden umgehängt.
      button.btn-reload(@click="loadDuplicates" :disabled="dupLoading") ↺ Neu laden

    .loading(v-if="dupLoading") Suche Duplikate…
    .error(v-else-if="dupError") {{ dupError }}
    .dup-empty(v-else-if="dupGroups.length === 0")
      span ✅ Keine Duplikate gefunden.
    .dup-groups(v-else)
      .dup-group(v-for="(group, gi) in dupGroups" :key="gi")
        .dup-group-header
          strong {{ group[0].name }}
          span.dup-count {{ group.length }} Einträge
        .dup-rows
          .dup-row(v-for="artist in group" :key="artist.id")
            .dup-info
              span.dup-id \#{{ artist.id }}
              span.dup-events {{ artist.event_count }} Event(s)
              span.dup-flags(v-if="artist.image_url || artist.soundcloud || artist.bandcamp || artist.link || artist.youtube")
                span(v-if="artist.image_url") 🖼
                span(v-if="artist.soundcloud || artist.bandcamp || artist.link || artist.youtube") 🔗
              span.dup-desc(v-if="artist.description" :title="artist.description") {{ artist.description.slice(0, 60) }}{{ artist.description.length > 60 ? '…' : '' }}
            .dup-actions
              //- Merge-buttons: alle anderen Einträge der Gruppe als Ziel anbieten
              template(v-for="target in group" :key="target.id")
                button.btn-merge(
                  v-if="target.id !== artist.id"
                  :disabled="merging !== null"
                  @click="mergeInto(artist.id, target.id, artist.name + ' #' + artist.id, target.name + ' #' + target.id)"
                ) → in \#{{ target.id }}
              button.btn-del-dup(
                :disabled="merging !== null || artist.event_count > 0"
                :title="artist.event_count > 0 ? 'Hat Events – erst mergen' : 'Löschen'"
                @click="deleteOneFromGroup(artist)"
              ) 🗑
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
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
}

.tab {
  padding: 0.625rem 1.25rem;
  border: 0.25rem solid black;
  border-bottom: none;
  background: #f0f0f0;
  color: #666;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: -0.25rem;
}

.tab:hover:not(.active) {
  background: #e0e0e0;
  color: black;
}

.tab.active {
  background: black;
  color: white;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  min-width: 250px;
  font-weight: 600;
  flex: 1;
  max-width: 400px;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-primary:hover {
  background: #333;
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
  transition: all 0.2s;
}

.btn-edit {
  background: white;
  color: black;
}

.btn-delete {
  background: white;
  color: #c00;
  border-color: #c00;
}

.btn-edit:hover {
  filter: brightness(120%);
}

.btn-delete:hover {
  background: #c00;
  color: white;
}

@media (max-width: 768px) {
  .artists-grid {
    grid-template-columns: 1fr;
  }

  h2 {
    font-size: 1.4rem;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    min-width: unset;
    max-width: 100%;
  }

  .btn-primary {
    white-space: normal;
    text-align: center;
  }
}

/* ── Duplikate Tab ─────────────────────────────────────────── */
.dup-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.dup-hint {
  flex: 1;
  font-size: 0.9rem;
  color: #444;
  margin: 0;
  line-height: 1.5;
}

.btn-reload {
  padding: 0.5rem 1rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: normal;
}
.btn-reload:hover:not(:disabled) { background: #eee; }
.btn-reload:disabled { opacity: 0.5; cursor: not-allowed; }

.dup-empty {
  padding: 3rem;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2a7a2a;
}

.dup-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dup-group {
  border: 0.25rem solid black;
}

.dup-group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: black;
  color: white;
  padding: 0.5rem 1rem;
  font-size: 1rem;
}

.dup-count {
  font-size: 0.8rem;
  opacity: 0.7;
  font-weight: 400;
}

.dup-rows {
  display: flex;
  flex-direction: column;
}

.dup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 1rem;
  border-bottom: 0.15rem solid #eee;
  flex-wrap: wrap;
}
.dup-row:last-child { border-bottom: none; }

.dup-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1;
  font-size: 0.9rem;
}

.dup-id { font-weight: 700; color: #888; }

.dup-events {
  background: #f0f0f0;
  border: 0.15rem solid #ccc;
  padding: 0.1rem 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.dup-flags { font-size: 1rem; }

.dup-desc {
  color: #555;
  font-size: 0.8rem;
  font-style: italic;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dup-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.btn-merge {
  padding: 0.3rem 0.7rem;
  border: 0.2rem solid black;
  background: white;
  color: black;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: normal;
}
.btn-merge:hover:not(:disabled) { background: black; color: white; }
.btn-merge:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-del-dup {
  padding: 0.3rem 0.6rem;
  border: 0.2rem solid #c00;
  background: white;
  color: #c00;
  font-size: 0.85rem;
  cursor: pointer;
  letter-spacing: normal;
}
.btn-del-dup:hover:not(:disabled) { background: #c00; color: white; }
.btn-del-dup:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
