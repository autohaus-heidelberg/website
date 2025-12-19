<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { artistService, type Artist } from '@/services'

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

  isLoading.value = true
  error.value = ''

  try {
    if (isEditing) {
      await artistService.update(Number(props.id), form.value)
    } else {
      await artistService.create(form.value)
    }

    // TODO: Handle image upload separately if needed
    // if (imageFile.value) {
    //   await artistService.uploadImage(artist.id!, imageFile.value)
    // }

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
.artist-form-view
  .form-header
    h2 {{ isEditing ? 'Edit Artist' : 'Create Artist' }}
    router-link.btn-cancel(to="/admin/artists") Cancel

  form.artist-form(@submit.prevent="handleSubmit")
    .form-group
      label(for="name") Artist Name *
      input#name(
        v-model="form.name"
        required
        placeholder="Band or artist name"
      )

    .form-group
      label(for="description") Description
      textarea#description(
        v-model="form.description"
        rows="5"
        placeholder="About the artist..."
      )

    .form-group
      label(for="link") Website
      input#link(
        v-model="form.link"
        type="url"
        placeholder="https://..."
      )

    .form-row
      .form-group
        label(for="soundcloud") SoundCloud
        input#soundcloud(
          v-model="form.soundcloud"
          type="url"
          placeholder="https://soundcloud.com/..."
        )

      .form-group
        label(for="youtube") YouTube
        input#youtube(
          v-model="form.youtube"
          type="url"
          placeholder="https://youtube.com/..."
        )

    .form-group
      label(for="bandcamp") Bandcamp
      input#bandcamp(
        v-model="form.bandcamp"
        type="url"
        placeholder="https://bandcamp.com/..."
      )

    .form-group
      label(for="image") Artist Image
      input#image(
        type="file"
        accept="image/*"
        @change="handleImageChange"
      )
      .field-hint Recommended: Square image, at least 500x500px

    .error(v-if="error") {{ error }}

    .form-actions
      button.btn-primary(
        type="submit"
        :disabled="isLoading"
      )
        | {{ isLoading ? 'Saving...' : (isEditing ? 'Update Artist' : 'Create Artist') }}
      router-link.btn-secondary(to="/admin/artists") Cancel
</template>

<style scoped>
.artist-form-view {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 700px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  font-size: 1.75rem;
  color: #1a1f36;
  margin: 0;
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
  color: #333;
}

input, textarea {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #667eea;
}

.field-hint {
  font-size: 0.85rem;
  color: #666;
}

.error {
  color: #d32f2f;
  font-size: 0.95rem;
  padding: 0.875rem;
  background: #ffebee;
  border-radius: 8px;
  border-left: 4px solid #d32f2f;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.btn-primary, .btn-secondary, .btn-cancel {
  padding: 0.875rem 1.75rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary, .btn-cancel {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover, .btn-cancel:hover {
  background: #e0e0e0;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
