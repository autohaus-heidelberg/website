<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { eventService, artistService, type Event, type Artist } from '@/services'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isEditing = !!props.id

const form = ref<Partial<Event>>({
  id: '',
  date: '',
  title: '',
  descriptionShort: '',
  descriptionLong: '',
  fee: '',
  feeAk: '',
  shopLink: '',
  artistOrder: '',
  artist_ids: []
})

const artists = ref<Artist[]>([])
const isLoading = ref(false)
const error = ref('')
const imageFile = ref<File | null>(null)

async function loadArtists() {
  try {
    artists.value = await artistService.getAll()
  } catch (e: any) {
    console.error('Failed to load artists:', e)
  }
}

async function loadEvent() {
  if (!props.id) return

  try {
    const event = await eventService.getById(props.id)
    form.value = {
      ...event,
      // Convert ISO date to datetime-local format
      date: event.date.substring(0, 16),
      artist_ids: event.artists.map(a => a.id!)
    }
  } catch (e: any) {
    error.value = 'Failed to load event'
  }
}

function handleImageChange(e: InputEvent) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    imageFile.value = target.files[0]
  }
}

async function handleSubmit() {
  if (!form.value.id || !form.value.title || !form.value.date || !form.value.descriptionShort) {
    error.value = 'Please fill in all required fields'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Format date to ISO
    const formData = {
      ...form.value,
      date: new Date(form.value.date!).toISOString()
    }

    if (isEditing) {
      await eventService.update(props.id!, formData)
    } else {
      await eventService.create(formData)
    }

    // TODO: Handle image upload separately if needed
    // if (imageFile.value) {
    //   await eventService.uploadImage(form.value.id!, imageFile.value)
    // }

    router.push('/admin/events')
  } catch (e: any) {
    error.value = e.message || 'Failed to save event'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadArtists()
  await loadEvent()
})
</script>

<template lang="pug">
.event-form-view
  .form-header
    h2 {{ isEditing ? 'Edit Event' : 'Create Event' }}
    router-link.btn-cancel(to="/admin/events") Cancel

  form.event-form(@submit.prevent="handleSubmit")
    .form-row
      .form-group
        label(for="id") Event ID *
        input#id(
          v-model="form.id"
          required
          :disabled="isEditing"
          placeholder="e.g., event-2025-12-31"
        )
        .field-hint Unique identifier (cannot be changed after creation)

      .form-group
        label(for="date") Date & Time *
        input#date(
          v-model="form.date"
          type="datetime-local"
          required
        )

    .form-group
      label(for="title") Title *
      input#title(
        v-model="form.title"
        required
        placeholder="Event name"
      )

    .form-group
      label(for="descriptionShort") Short Description *
      textarea#descriptionShort(
        v-model="form.descriptionShort"
        rows="3"
        required
        placeholder="Brief description for listings"
      )

    .form-group
      label(for="descriptionLong") Long Description
      textarea#descriptionLong(
        v-model="form.descriptionLong"
        rows="6"
        placeholder="Detailed description"
      )

    .form-row
      .form-group
        label(for="fee") Entry Fee
        input#fee(
          v-model="form.fee"
          placeholder="e.g., 10€"
        )

      .form-group
        label(for="feeAk") AK Fee
        input#feeAk(
          v-model="form.feeAk"
          placeholder="e.g., 8€"
        )

    .form-group
      label(for="shopLink") Ticket Shop Link
      input#shopLink(
        v-model="form.shopLink"
        type="url"
        placeholder="https://..."
      )

    .form-group
      label(for="artists") Artists
      .artist-select
        label.artist-option(v-for="artist in artists" :key="artist.id")
          input(
            type="checkbox"
            :value="artist.id"
            v-model="form.artist_ids"
          )
          span {{ artist.name }}

    .form-group
      label(for="artistOrder") Artist Order (optional)
      input#artistOrder(
        v-model="form.artistOrder"
        placeholder="Comma-separated artist IDs in order"
      )
      .field-hint Controls the display order of artists

    .form-group
      label(for="image") Event Image
      input#image(
        type="file"
        accept="image/*"
        @change="handleImageChange"
      )

    .error(v-if="error") {{ error }}

    .form-actions
      button.btn-primary(
        type="submit"
        :disabled="isLoading"
      )
        | {{ isLoading ? 'Saving...' : (isEditing ? 'Update Event' : 'Create Event') }}
      router-link.btn-secondary(to="/admin/events") Cancel
</template>

<style scoped>
.event-form-view {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 900px;
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

.event-form {
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

input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.85rem;
  color: #666;
}

.artist-select {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.artist-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.artist-option:hover {
  background: rgba(102, 126, 234, 0.05);
}

.artist-option input[type="checkbox"] {
  width: auto;
  cursor: pointer;
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

  .artist-select {
    grid-template-columns: 1fr;
  }
}
</style>
