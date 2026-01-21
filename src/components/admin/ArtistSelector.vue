<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { artistService } from '@/services'
import type { Artist } from '@/services'
import ArtistFormFields from '@/components/admin/ArtistFormFields.vue'

interface Props {
  modelValue?: number[]
  artistOrder?: string
}

interface Emits {
  (e: 'update:modelValue', value: number[]): void
  (e: 'update:artistOrder', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  artistOrder: ''
})

const emit = defineEmits<Emits>()

const allArtists = ref<Artist[]>([])
const searchQuery = ref('')
const orderedArtistIds = ref<number[]>([])
const showModal = ref(false)
const isLoading = ref(false)
const error = ref('')

const modalForm = ref({
  name: '',
  description: '',
  link: '',
  youtube: '',
  soundcloud: '',
  bandcamp: ''
})

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)

const selectedArtists = computed(() => {
  return orderedArtistIds.value
    .map(id => allArtists.value.find(a => a.id === id))
    .filter(a => a !== undefined) as Artist[]
})

const availableArtists = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return allArtists.value
    .filter(artist => !orderedArtistIds.value.includes(artist.id!))
    .filter(artist => artist.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const artistOrderString = computed(() => {
  return orderedArtistIds.value.join(',')
})

async function loadArtists() {
  try {
    const data = await artistService.getAll()
    allArtists.value = data.results || []

    if (props.artistOrder) {
      const orderIds = props.artistOrder.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      orderedArtistIds.value = orderIds.filter(id => allArtists.value.some(a => a.id === id))
    } else if (props.modelValue && props.modelValue.length > 0) {
      orderedArtistIds.value = [...props.modelValue]
    }
  } catch (e: any) {
    console.error('Failed to load artists:', e)
    error.value = 'Failed to load artists'
  }
}

function getArtistById(id: number): Artist | undefined {
  return allArtists.value.find(a => a.id === id)
}

function addArtist(id: number) {
  if (!orderedArtistIds.value.includes(id)) {
    orderedArtistIds.value.push(id)
    syncToParent()
  }
}

function removeArtist(id: number) {
  orderedArtistIds.value = orderedArtistIds.value.filter(artistId => artistId !== id)
  syncToParent()
}

function handleDragEnd() {
  syncToParent()
}

function syncToParent() {
  emit('update:modelValue', [...orderedArtistIds.value])
  emit('update:artistOrder', artistOrderString.value)
}

function openModal() {
  modalForm.value = {
    name: '',
    description: '',
    link: '',
    youtube: '',
    soundcloud: '',
    bandcamp: ''
  }
  imageFile.value = null
  imagePreview.value = null
  error.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  error.value = ''
}

function handleImageChange(e: Event & { target: HTMLInputElement }) {
  if (e.target.files && e.target.files[0]) {
    imageFile.value = e.target.files[0]

    // Create preview for the new image
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(imageFile.value)
  }
}

async function handleQuickAdd() {
  if (!modalForm.value.name.trim()) {
    error.value = 'Artist name is required'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const newArtist = await artistService.create({
      name: modalForm.value.name.trim(),
      description: modalForm.value.description.trim(),
      link: modalForm.value.link.trim(),
      youtube: modalForm.value.youtube.trim(),
      soundcloud: modalForm.value.soundcloud.trim(),
      bandcamp: modalForm.value.bandcamp.trim()
    })

    // Upload image if provided
    if (imageFile.value && newArtist.id) {
      await artistService.uploadImage(newArtist.id, imageFile.value)
      // Refresh the artist to get the image_url
      const updatedArtist = await artistService.getById(newArtist.id)
      allArtists.value.push(updatedArtist)
    } else {
      allArtists.value.push(newArtist)
    }

    if (newArtist.id) {
      addArtist(newArtist.id)
    }

    closeModal()
  } catch (e: any) {
    error.value = e.message || 'Failed to create artist'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.modelValue, (newValue) => {
  if (newValue && !props.artistOrder) {
    orderedArtistIds.value = [...newValue]
  }
}, { deep: true })

// Watch for artistOrder changes (handles case where event loads after artists)
watch(() => props.artistOrder, (newOrder) => {
  if (newOrder && allArtists.value.length > 0) {
    const orderIds = newOrder.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    orderedArtistIds.value = orderIds.filter(id => allArtists.value.some(a => a.id === id))
  }
})

onMounted(() => {
  loadArtists()
})
</script>

<template lang="pug">
.artist-selector
  .search-section
    input.search-input(
      v-model="searchQuery"
      type="text"
      placeholder="Search artists..."
    )
    button.btn-quick-add(
      type="button"
      @click="openModal"
    ) Quick Add Artist

  .available-section
    h3 Available Artists
    .artist-list(v-if="availableArtists.length > 0")
      .artist-item(
        v-for="artist in availableArtists"
        :key="artist.id"
        @click="artist.id && addArtist(artist.id)"
      ) {{ artist.name }}
    .empty-state(v-else-if="searchQuery")
      p No artists found matching "{{ searchQuery }}"
    .empty-state(v-else)
      p All artists selected

  .selected-section
    h3 Selected Artists {{ orderedArtistIds.length > 0 ? '(drag to reorder)' : '' }}
    .empty-state(v-if="orderedArtistIds.length === 0")
      p No artists selected yet
    VueDraggable(
      v-else
      v-model="orderedArtistIds"
      @end="handleDragEnd"
      :animation="150"
      handle=".drag-handle"
    )
      .selected-item(
        v-for="id in orderedArtistIds"
        :key="id"
      )
        .drag-handle ⋮⋮
        .artist-name {{ getArtistById(id)?.name }}
        .artist-actions
          router-link.btn-edit(:to="`/admin/artists/${id}`") Edit
          button.btn-remove(
            type="button"
            @click="removeArtist(id)"
          ) Remove

  .modal(v-if="showModal" @click.self="closeModal")
    .modal-backdrop
    .modal-content(@click.stop)
      h2 Quick Add Artist
      form(@submit.prevent="handleQuickAdd")
        ArtistFormFields(
          v-model="modalForm"
          :compact="true"
          id-prefix="quick-add"
        )
          template(#image-field)
            .form-group
              label(for="quick-add-image") Artist Image
              .image-preview(v-if="imagePreview")
                img(:src="imagePreview" alt="Artist image preview")
              input#quick-add-image(
                type="file"
                accept="image/*"
                @change="handleImageChange"
              )
              .field-hint Bild: wird resized

        .error(v-if="error") {{ error }}

        .form-actions
          button.btn-primary(
            type="submit"
            :disabled="isLoading"
          ) {{ isLoading ? 'Creating...' : 'Create & Add' }}
          button.btn-secondary(
            type="button"
            @click="closeModal"
          ) Cancel
</template>

<style scoped>
.artist-selector {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-section {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  padding: 0.625rem 1rem;
  border: 0.25rem solid black;
  font-size: 0.95rem;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}

.search-input:focus {
  outline: none;
  background: black;
  color: white;
}

.btn-quick-add {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  border: 0.25rem solid black;
  font-weight: 600;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: filter 0.2s;
  white-space: nowrap;
}

.btn-quick-add:hover {
  filter: brightness(120%);
}

.available-section,
.selected-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

h3 {
  font-size: 1.1rem;
  font-weight: 900;
  color: black;
  margin: 0;
}

.artist-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 0.25rem solid black;
}

.artist-item {
  padding: 0.75rem;
  border: 0.125rem solid black;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}

.artist-item:hover {
  background: black;
  color: white;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  border: 0.25rem solid black;
  background: white;
}

.empty-state p {
  margin: 0;
  color: black;
  font-weight: 600;
}

.selected-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 0.25rem solid black;
  background: white;
  margin-bottom: 0.5rem;
  cursor: move;
}

.selected-item:hover {
  background: black;
  color: white;
}

.artist-actions {
  display: flex;
  gap: 0.5rem;
}

.drag-handle {
  font-size: 1.5rem;
  cursor: grab;
  user-select: none;
  font-weight: 900;
  color: black;
}

.selected-item:hover .drag-handle {
  color: white;
}

.drag-handle:active {
  cursor: grabbing;
}

.artist-name {
  font-weight: 600;
  color: inherit;
}

.btn-edit,
.btn-remove {
  padding: 0.375rem 0.75rem;
  background: white;
  color: black;
  border: 0.125rem solid black;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  text-decoration: none;
}

.btn-edit:hover,
.btn-remove:hover {
  background: black;
  color: white;
}

.selected-item:hover .btn-edit,
.selected-item:hover .btn-remove {
  background: white;
  color: black;
  border-color: white;
}

.selected-item:hover .btn-edit:hover,
.selected-item:hover .btn-remove:hover {
  background: black;
  color: white;
  border-color: black;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.modal-content {
  position: relative;
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1001;
}

.modal-content h2 {
  font-size: 1.5rem;
  font-weight: 900;
  color: black;
  margin: 0 0 1.5rem 0;
}

.modal-content .form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.modal-content label {
  font-weight: 600;
  font-size: 0.95rem;
  color: black;
}

.modal-content input,
.modal-content textarea {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}

.modal-content input:focus,
.modal-content textarea:focus {
  outline: none;
  background: black;
  color: white;
}

.modal-content .image-preview {
  margin-bottom: 1rem;
  border: 0.25rem solid black;
  padding: 1rem;
  background: white;
}

.modal-content .image-preview img {
  max-width: 100%;
  max-height: 200px;
  display: block;
  margin: 0 auto;
}

.error {
  color: black;
  font-size: 0.95rem;
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid black;
  margin-bottom: 1rem;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.btn-primary,
.btn-secondary {
  padding: 0.875rem 1.75rem;
  border: 0.25rem solid black;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-size: 1rem;
  font-weight: 600;
  transition: filter 0.2s;
  letter-spacing: 0.2em;
}

.btn-primary {
  background: black;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: black;
}

.btn-secondary:hover {
  background: black;
  color: white;
}

@media (max-width: 768px) {
  .search-section {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    min-width: 100%;
  }

  .artist-list {
    grid-template-columns: 1fr;
  }

  .selected-item {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .artist-actions {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
  }
}
</style>
