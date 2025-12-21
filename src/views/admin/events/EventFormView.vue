<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { eventService } from '@/services'
import type { Event } from '@/services'
import ArtistSelector from '@/components/admin/ArtistSelector.vue'

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

const isLoading = ref(false)
const error = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isCreatingShopLink = ref(false)
const shopLinkSuccess = ref('')

function handleIdInput(e: Event) {
  const target = e.target as HTMLInputElement
  // Only allow A-Z, a-z, 0-9, and hyphen (-)
  const sanitized = target.value.replace(/[^A-Za-z0-9-]/g, '')
  form.value.id = sanitized
  target.value = sanitized
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
    // Set image preview if there's an existing image
    if (event.image_url) {
      imagePreview.value = event.image_url
    }
  } catch (e: any) {
    error.value = 'Failed to load event'
  }
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

async function createShopLink() {
  // Validate required fields for Pretix
  if (!form.value.id) {
    error.value = 'Event ID is required to create shop link'
    return
  }
  if (!form.value.title) {
    error.value = 'Event Title is required to create shop link'
    return
  }
  if (!form.value.date) {
    error.value = 'Event Date is required to create shop link'
    return
  }
  if (!form.value.fee) {
    error.value = 'Entry Fee is required to create shop link'
    return
  }

  isCreatingShopLink.value = true
  error.value = ''
  shopLinkSuccess.value = ''

  try {
    // If event is new (not editing), save it first
    if (!isEditing) {
      if (!form.value.descriptionShort) {
        error.value = 'Short Description is required before creating shop link'
        return
      }

      // Prepare data for submission
      const { image, image_url, artists, ...formData } = form.value
      formData.date = new Date(form.value.date!).toISOString()

      await eventService.create(formData)

      // Upload image if provided
      if (imageFile.value) {
        await eventService.uploadImage(formData.id!, imageFile.value)
      }
    }

    // Create the Pretix shop
    const result = await eventService.cloneToPretix(form.value.id!)
    form.value.shopLink = result.shopLink
    shopLinkSuccess.value = 'Shop link created successfully!'

    // Clear success message after 3 seconds
    setTimeout(() => {
      shopLinkSuccess.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Failed to create shop link'
  } finally {
    isCreatingShopLink.value = false
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
    // Prepare data for submission
    const { image, image_url, artists, ...formData } = form.value

    // Format date to ISO
    formData.date = new Date(form.value.date!).toISOString()

    if (isEditing) {
      // For editing, only send fields that can be updated (exclude image and image_url)
      await eventService.update(props.id!, formData)

      // Handle image upload separately if a new image was selected
      if (imageFile.value) {
        await eventService.uploadImage(props.id!, imageFile.value)
      }
    } else {
      // For creation, send all data
      await eventService.create(formData)

      // Upload image after creation if provided
      if (imageFile.value) {
        await eventService.uploadImage(formData.id!, imageFile.value)
      }
    }

    router.push('/admin/events')
  } catch (e: any) {
    error.value = e.message || 'Failed to save event'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
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
          @input="handleIdInput"
        )
        .field-hint Unique identifier (cannot be changed after creation)
        .field-hint Erlaubte Zeichen: A-Z, a-z, 0-9 und - (keine underscores _)

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
      .field-hint Beschreibung (akzeptiert html)

    .form-group
      label(for="descriptionLong") Long Description
      textarea#descriptionLong(
        v-model="form.descriptionLong"
        rows="6"
        placeholder="Detailed description"
      )
      .field-hint Lange Beschreibung, kann aktuell weggelassen werden

    .form-row
      .form-group
        label(for="fee") VVK Preis
        input#fee(
          v-model="form.fee"
          placeholder="e.g., 10"
        )
        .field-hint Fee muss eine Zahl sein (z.B. 10 für 10€)

      .form-group
        label(for="feeAk") AK Preis
        input#feeAk(
          v-model="form.feeAk"
          placeholder="e.g., 8"
        )
        .field-hint Fee muss eine Zahl sein (z.B. 8 für 8€)

    .form-group
      label(for="shopLink") Ticket Shop Link
      input#shopLink(
        v-model="form.shopLink"
        type="url"
        placeholder="https://..."
      )
      .shop-link-actions
        button.btn-shop-link(
          type="button"
          @click="createShopLink"
          :disabled="isCreatingShopLink"
        )
          | {{ isCreatingShopLink ? 'Creating...' : 'Create Pretix Shop Link' }}
        .field-hint Benötigt: Event ID, Title, Date und Fee (muss eine Zahl sein)
      .success-message(v-if="shopLinkSuccess") {{ shopLinkSuccess }}

    .form-group
      label Artist Selection
      ArtistSelector(
        v-model="form.artist_ids"
        v-model:artistOrder="form.artistOrder"
      )

    .form-group
      label(for="image") Event Image
      .image-preview(v-if="imagePreview")
        img(:src="imagePreview" alt="Event image preview")
        .preview-label {{ imageFile ? 'Neues Bild (wird hochgeladen)' : 'Aktuelles Bild' }}
      input#image(
        type="file"
        accept="image/*"
        @change="handleImageChange"
      )
      .field-hint Bild: wird resized auf 1000x1000px

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
  border: 0.5rem solid black;
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
  color: black;
  margin: 0;
  font-weight: 900;
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

input:disabled {
  background: white;
  cursor: not-allowed;
  opacity: 0.6;
}

.field-hint {
  font-size: 0.85rem;
  color: black;
}

.image-preview {
  margin-bottom: 1rem;
  border: 0.25rem solid black;
  padding: 1rem;
  background: white;
}

.image-preview img {
  max-width: 100%;
  max-height: 300px;
  display: block;
  margin: 0 auto;
}

.preview-label {
  text-align: center;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: black;
}

.shop-link-actions {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-shop-link {
  padding: 0.75rem 1.5rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
  align-self: flex-start;
}

.btn-shop-link:hover:not(:disabled) {
  background: black;
  color: white;
}

.btn-shop-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  color: black;
  font-size: 0.95rem;
  padding: 0.75rem;
  background: #d4edda;
  border: 0.25rem solid black;
  margin-top: 0.5rem;
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

  .artist-select {
    grid-template-columns: 1fr;
  }
}
</style>
