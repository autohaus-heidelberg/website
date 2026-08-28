<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { anfrageService, type Anfrage } from '@/services/anfragen'

const bands = ref<Anfrage[]>([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')
const sortBy = ref<'origin' | 'name' | 'date'>('origin')

function extractOrigin(anfrage: Anfrage): string {
  if (anfrage.origin && anfrage.origin.trim()) return anfrage.origin.trim()
  const match = anfrage.message.match(/^Herkunft:\s*(.+)$/m)
  return match ? match[1].trim() : ''
}

function extractMusicLink(anfrage: Anfrage): string | null {
  const match = anfrage.message.match(/^Musik:\s*(\S+)/m)
  return match ? match[1].trim() : null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const filteredBands = computed(() => {
  let list = [...bands.value]

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(b =>
      b.name.toLowerCase().includes(q) ||
      extractOrigin(b).toLowerCase().includes(q) ||
      (b.genre && b.genre.toLowerCase().includes(q))
    )
  }

  list.sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name, 'de')
    }
    if (sortBy.value === 'date') {
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    }
    // Sort by Ort: alphabetical, entries without an Ort go last
    const oa = extractOrigin(a)
    const ob = extractOrigin(b)
    if (!oa && !ob) return a.name.localeCompare(b.name, 'de')
    if (!oa) return 1
    if (!ob) return -1
    return oa.localeCompare(ob, 'de')
  })

  return list
})

async function loadBands() {
  isLoading.value = true
  error.value = ''
  try {
    bands.value = await anfrageService.getSupportCandidates()
  } catch (e: any) {
    error.value = e.message || 'Bands konnten nicht geladen werden'
  } finally {
    isLoading.value = false
  }
}

async function removeFromPool(band: Anfrage) {
  if (!confirm(`"${band.name}" aus dem Support-Pool entfernen?`)) return
  try {
    await anfrageService.unmarkSupportCandidate(band.id)
    bands.value = bands.value.filter(b => b.id !== band.id)
  } catch (e: any) {
    alert('Fehler beim Entfernen: ' + (e.message || 'Unbekannter Fehler'))
  }
}

onMounted(() => {
  loadBands()
})
</script>

<template lang="pug">
.support-bands-panel
  .toolbar
    .search-wrapper
      span.search-icon 🔍
      input.search-input(
        v-model="searchQuery"
        type="text"
        placeholder="Ort, Bandname oder Genre..."
      )
    .sort-wrapper
      label.sort-label Sortieren:
      select(v-model="sortBy")
        option(value="origin") 📍 Ort
        option(value="name") Name
        option(value="date") Neueste zuerst

  .hint Bands, die sich beworben haben und als Support-Band in Frage kommen. Über den Anfragen-Bereich lassen sich weitere Bands vormerken.

  .loading(v-if="isLoading") Bands werden geladen...
  .error(v-else-if="error") {{ error }}

  .count-bar(v-else)
    span {{ filteredBands.length }} {{ filteredBands.length === 1 ? 'Band' : 'Bands' }}

  .bands-grid(v-if="!isLoading && !error && filteredBands.length")
    .band-card(v-for="band in filteredBands" :key="band.id")
      .band-head
        h3.band-name {{ band.name }}
        span.band-origin(v-if="extractOrigin(band)") 📍 {{ extractOrigin(band) }}
      .band-meta
        span.band-genre(v-if="band.genre") {{ band.genre }}
        span.band-date eingegangen {{ formatDate(band.submittedAt) }}
      p.band-message {{ band.message }}
      .band-links
        a.link(v-if="extractMusicLink(band)" :href="extractMusicLink(band)!" target="_blank" rel="noopener") 🎵 Musik
        a.link(:href="`mailto:${band.contactEmail}`") ✉️ {{ band.contactEmail }}
      .band-actions
        router-link.btn-view(:to="{ name: 'admin-anfragen' }") In Anfragen öffnen
        button.btn-remove(@click="removeFromPool(band)") Aus Pool entfernen

  .empty(v-else-if="!isLoading && !error")
    template(v-if="searchQuery") Keine Bands gefunden.
    template(v-else) Noch keine Bands im Support-Pool. Merke Bands im Anfragen-Bereich vor.
</template>

<style scoped>
.support-bands-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-wrapper {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
}

.search-input {
  width: 100%;
  padding: 0.625rem 1rem 0.625rem 2.25rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-weight: 600;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.sort-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  font-weight: 700;
  font-size: 0.85rem;
}

.sort-wrapper select {
  padding: 0.5rem 0.75rem;
  border: 0.25rem solid black;
  font-weight: 600;
  background: white;
  cursor: pointer;
}

.hint {
  font-size: 0.85rem;
  color: #444;
  background: #f9fafb;
  border-left: 0.25rem solid black;
  padding: 0.5rem 0.75rem;
}

.loading, .error, .empty {
  padding: 3rem;
  text-align: center;
  color: black;
}

.error {
  background: white;
  border: 0.5rem solid #c00;
  color: #c00;
}

.count-bar {
  font-size: 0.85rem;
  font-weight: 700;
  color: #444;
}

.bands-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.band-card {
  border: 0.25rem solid black;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: white;
}

.band-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.band-name {
  font-size: 1.15rem;
  font-weight: 900;
  margin: 0;
  color: black;
}

.band-origin {
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  background: black;
  color: white;
  padding: 0.15rem 0.5rem;
}

.band-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
  color: #555;
}

.band-genre {
  font-weight: 700;
  color: black;
}

.band-message {
  font-size: 0.9rem;
  line-height: 1.5;
  color: #222;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}

.band-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.link {
  font-size: 0.8rem;
  color: white;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  background: black;
  font-weight: 600;
}

.link:hover {
  filter: brightness(120%);
}

.band-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 0.25rem solid black;
}

.btn-view, .btn-remove {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 0.25rem solid black;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  background: white;
  color: black;
}

.btn-view:hover {
  background: black;
  color: white;
}

.btn-remove {
  color: #c00;
  border-color: #c00;
}

.btn-remove:hover {
  background: #c00;
  color: white;
}

@media (max-width: 768px) {
  .bands-grid {
    grid-template-columns: 1fr;
  }
}
</style>
