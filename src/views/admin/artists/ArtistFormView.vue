<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
</template>

<style scoped>
.artist-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
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

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
