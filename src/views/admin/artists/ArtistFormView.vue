<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { artistService, type Artist } from '@/services'
import ArtistFormFields from '@/components/admin/ArtistFormFields.vue'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isEditing = !!props.id

const form = ref<Partial<Artist>>({
  name: '',
  link: '',
  description: '',
  soundcloud: '',
  youtube: '',
  bandcamp: ''
})

const isLoading = ref(false)
const error = ref('')
const imageFile = ref<File | null>(null)

const previewImageUrl = computed(() => {
  if (imageFile.value) {
    return URL.createObjectURL(imageFile.value)
  }
  return form.value.image_url || form.value.image || null
})

async function loadArtist() {
  if (!props.id) return

  try {
    const artist = await artistService.getById(Number(props.id))
    form.value = { ...artist }
  } catch (e: any) {
    error.value = 'Failed to load artist'
  }
}

function handleImageChange(e: InputEvent) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    imageFile.value = target.files[0]
  }
}

async function handleSubmit() {
  if (!form.value.name) {
    error.value = 'Please enter artist name'
    return
  }

  if (form.value.youtube && !form.value.youtube.startsWith('https://www.youtube.com/embed/')) {
    error.value = 'YouTube URL must start with https://www.youtube.com/embed/'
    return
  }

  if (form.value.bandcamp && !form.value.bandcamp.startsWith('https://bandcamp.com/EmbeddedPlayer')) {
    error.value = 'Bandcamp URL must start with https://bandcamp.com/EmbeddedPlayer'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    let artistId: number

    // Exclude image fields - image uploads are handled separately
    const { image, image_url, ...formData } = form.value

    if (isEditing) {
      await artistService.update(Number(props.id), formData)
      artistId = Number(props.id)
    } else {
      const artist = await artistService.create(formData)
      artistId = artist.id!
    }

    if (imageFile.value) {
      await artistService.uploadImage(artistId, imageFile.value)
    }

    router.push('/admin/artists')
  } catch (e: any) {
    error.value = e.message || 'Failed to save artist'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadArtist()
})
</script>

<template lang="pug">
.artist-form-layout
  .artist-form-view
    .form-header
      h2 {{ isEditing ? 'Edit Artist' : 'Create Artist' }}
      router-link.btn-cancel(to="/admin/artists") Cancel

    form.artist-form(@submit.prevent="handleSubmit")
      ArtistFormFields(v-model="form")
        template(#image-field)
          .form-group
            label(for="image") Artist Image
            input#image(
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
        )
          | {{ isLoading ? 'Saving...' : (isEditing ? 'Update Artist' : 'Create Artist') }}
        router-link.btn-secondary(to="/admin/artists") Cancel

  .artist-preview
    h3.preview-title Preview
    .artist
      h2.accent {{ form.name || 'Artist Name' }}
      img.artist-img(v-if="previewImageUrl" :src="previewImageUrl")
      a(v-if="form.link" :href="form.link") Band website
      p {{ form.description }}
      .video-container(v-if="form.youtube && form.youtube.startsWith('https://www.youtube.com/embed/')")
        iframe.youtube(:src="form.youtube" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen)
      .bandcamp-container(v-if="form.bandcamp && form.bandcamp.startsWith('https://bandcamp.com/EmbeddedPlayer')")
        iframe.bandcamp(:src="form.bandcamp" title="Bandcamp player" frameborder="0" width="350px" height="470px" seamless)
</template>

<style scoped>
.artist-form-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

.artist-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.artist-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  font-size: 0.95rem;
  color: black;
}

input, textarea {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}

input:focus, textarea:focus {
  outline: none;
  background: black;
  color: white;
}

.field-hint {
  font-size: 0.85rem;
  color: black;
}

.error {
  color: black;
  font-size: 0.95rem;
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid black;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.btn-primary, .btn-secondary, .btn-cancel {
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

.btn-secondary, .btn-cancel {
  background: white;
  color: black;
}

.btn-secondary:hover, .btn-cancel:hover {
  background: black;
  color: white;
}

/* Artist Preview Styles */
.artist-preview {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.preview-title {
  font-size: 1.25rem;
  font-weight: 900;
  margin: 0 0 1.5rem 0;
  padding-bottom: 1rem;
  border-bottom: 0.25rem solid black;
}

.artist {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.artist h2.accent {
  margin: 0 0 1rem 0;
  text-align: center;
}

.artist-img {
  max-width: 100%;
  max-height: 300px;
  margin-bottom: 1rem;
}

.artist a {
  color: black;
  margin-bottom: 1rem;
}

.artist p {
  text-align: center;
  margin: 0 0 1rem 0;
}

.video-container {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  width: 100%;
  margin-bottom: 1rem;
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.bandcamp-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

@media (max-width: 900px) {
  .artist-form-layout {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
