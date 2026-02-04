<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { eventService, artistService } from '@/services'
import type { Event as AppEvent, Artist, HelferpadEventData } from '@/services'
import ArtistSelector from '@/components/admin/ArtistSelector.vue'
import EventDisplay from '@/components/EventDisplay.vue'
import EventChecklistTab from '@/components/admin/EventChecklistTab.vue'

// Import TinyMCE components (must be before Editor import)
import 'tinymce/tinymce'
import 'tinymce/icons/default/icons'
import 'tinymce/themes/silver/theme'
import 'tinymce/models/dom/model'
import 'tinymce/skins/ui/oxide/skin.css'

// Import plugins
import 'tinymce/plugins/lists'
import 'tinymce/plugins/link'
import 'tinymce/plugins/code'
import 'tinymce/plugins/quickbars'

import Editor from '@tinymce/tinymce-vue'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const route = useRoute()
const isEditing = ref(!!props.id)
const activeTab = ref('details')

const form = ref<Partial<AppEvent>>({
  id: '',
  date: '',
  title: '',
  descriptionShort: '',
  fee: '',
  feeAk: '',
  shopLink: '',
  helferpadLink: '',
  artistOrder: '',
  artist_ids: []
})

const isLoading = ref(false)
const error = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isCreatingShopLink = ref(false)
const shopLinkSuccess = ref('')
const isCreatingHelferpad = ref(false)
const helferpadSuccess = ref('')
const previewArtists = ref<Artist[]>([])
const loadingArtists = ref(false)

// TinyMCE configuration
const editorConfig = {
  license_key: 'gpl',
  height: 300,
  menubar: false,
  plugins: 'lists link code quickbars',
  toolbar: false,
  quickbars_selection_toolbar: 'bold italic underline strikethrough | forecolor backcolor | link | blocks | bullist numlist | hr | removeformat | code',
  content_style: 'body { font-family: inherit; font-size: 14px; }',
  branding: false,
  promotion: false,
  skin: false,
  content_css: false,
}

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

function handleImageChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    imageFile.value = target.files[0]

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
    // If event already exists, use the old endpoint
    if (isEditing.value) {
      const result = await eventService.cloneToPretix(form.value.id!)
      form.value.shopLink = result.shopLink
    } else {
      // If event is new, use the new endpoint that doesn't require creating the event
      const result = await eventService.createPretixShop({
        id: form.value.id!,
        title: form.value.title!,
        date: new Date(form.value.date!).toISOString(),
        fee: form.value.fee!
      })
      form.value.shopLink = result.shopLink
    }

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

async function createHelferpad() {
  // Validate required fields
  if (!form.value.id) {
    error.value = 'Event ID is required to create Helferpad'
    return
  }

  isCreatingHelferpad.value = true
  error.value = ''
  helferpadSuccess.value = ''

  const wasNewEvent = !isEditing.value

  try {
    // If event is new (not editing), save it first
    if (!isEditing.value) {
      if (!form.value.title) {
        error.value = 'Event Title is required before creating Helferpad'
        return
      }
      if (!form.value.date) {
        error.value = 'Event Date is required before creating Helferpad'
        return
      }
      if (!form.value.descriptionShort) {
        error.value = 'Short Description is required before creating Helferpad'
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

      // Mark as editing since the event now exists
      isEditing.value = true
    }

    // Prepare event data for helferpad
    const helferpadData: HelferpadEventData = {
      title: form.value.title || '',
      date: form.value.date ? new Date(form.value.date).toISOString() : new Date().toISOString(),
      fee: form.value.fee,
      shopLink: form.value.shopLink
    }

    // Create the Helferpad with event data
    const result = await eventService.createHelferpad(form.value.id!, helferpadData)
    form.value.helferpadLink = result.helferpadLink
    helferpadSuccess.value = wasNewEvent ? 'Event and Helferpad created successfully!' : 'Helferpad created successfully!'

    // Clear success message after 3 seconds
    setTimeout(() => {
      helferpadSuccess.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Failed to create Helferpad'
  } finally {
    isCreatingHelferpad.value = false
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

    if (isEditing.value) {
      // For editing, only send fields that can be updated (exclude image and image_url)
      await eventService.update(form.value.id!, formData)

      // Handle image upload separately if a new image was selected
      if (imageFile.value) {
        await eventService.uploadImage(form.value.id!, imageFile.value)
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

// Watch artist_ids and fetch full artist data for preview
watch(() => form.value.artist_ids, async (newArtistIds) => {
  if (!newArtistIds || newArtistIds.length === 0) {
    previewArtists.value = []
    return
  }

  loadingArtists.value = true
  try {
    const artistPromises = newArtistIds.map(id => artistService.getById(id))
    previewArtists.value = await Promise.all(artistPromises)
  } catch (e) {
    console.error('Failed to load artists for preview:', e)
    previewArtists.value = []
  } finally {
    loadingArtists.value = false
  }
}, { deep: true })

// Create preview event object from form data
const previewEvent = computed(() => {
  return {
    ...form.value,
    image_url: imagePreview.value || undefined,
    img: imagePreview.value || undefined,
    artists: previewArtists.value,
    descriptionShort: form.value.descriptionShort || '',
    title: form.value.title || 'Untitled Event',
  } as AppEvent
})

onMounted(async () => {
  await loadEvent()

  // Check for tab query parameter and set active tab
  const tabParam = route.query.tab as string
  if (tabParam && ['details', 'checklist'].includes(tabParam)) {
    activeTab.value = tabParam
  }
})
</script>

<template lang="pug">
.event-form-view
  .form-header
    h2 {{ isEditing ? 'Edit Event' : 'Create Event' }}
    router-link.btn-cancel(to="/admin/events") Cancel

  .event-tabs(v-if="isEditing")
    button.tab(
      :class="{ active: activeTab === 'details' }"
      @click="activeTab = 'details'"
      type="button"
    ) Event Details
    button.tab(
      :class="{ active: activeTab === 'checklist' }"
      @click="activeTab = 'checklist'"
      type="button"
    ) Checklist

  .tab-content(v-show="activeTab === 'details'")
    .form-container
      .form-section
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
            Editor(
              v-model="form.descriptionShort"
              :init="editorConfig"
              licenseKey="gpl"
            )
            .field-hint Rich text editor for event description

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
              .field-hint Benötigt: Event ID, Title, Date und Fee (muss eine Zahl sein). Erstellt keinen Event in der Datenbank.
            .success-message(v-if="shopLinkSuccess") {{ shopLinkSuccess }}

          .form-group
            label(for="helferpadLink") Helferpad Link
            input#helferpadLink(
              v-model="form.helferpadLink"
              type="url"
              placeholder="https://..."
            )
            .shop-link-actions
              button.btn-shop-link(
                type="button"
                @click="createHelferpad"
                :disabled="isCreatingHelferpad"
              )
                | {{ isCreatingHelferpad ? 'Creating...' : 'Create Helferpad' }}
              .field-hint Benötigt: Event ID
              .field-hint(v-if="!isEditing") Erstellt auch den Event in der Datenbank.
            .success-message(v-if="helferpadSuccess") {{ helferpadSuccess }}

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

      .preview-section
        .preview-header
          h3 Live Preview
          .loading-indicator(v-if="loadingArtists") Loading artists...
        .preview-content
          EventDisplay(:event="previewEvent" v-if="form.title")
          .preview-empty(v-else)
            p Fill in the form to see preview

  .tab-content(v-if="isEditing" v-show="activeTab === 'checklist'")
    EventChecklistTab(:eventId="props.id")
</template>

<style scoped>
.event-form-view {
  background: white;
  border: 0.5rem solid black;
  max-width: 100%;
  padding: 2rem;
  width: 100%;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
}

.event-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
  padding-bottom: 0;
}

.tab {
  padding: 0.875rem 1.75rem;
  border: 0.25rem solid black;
  border-bottom: none;
  background: white;
  color: black;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
  position: relative;
  bottom: -0.25rem;
}

.tab:hover {
  background: black;
  color: white;
}

.tab.active {
  background: black;
  color: white;
  border-bottom: 0.25rem solid black;
}

.tab-content {
  display: block;
}

.form-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

.form-section {
  display: flex;
  flex-direction: column;
  border-right: 0.25rem solid black;
  padding-right: 2rem;
}

.preview-section {
  position: sticky;
  top: 2rem;
  height: fit-content;
  padding-left: 2rem;
}

.preview-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 0.25rem solid black;
}

.preview-header h3 {
  font-size: 1.5rem;
  font-weight: 900;
  color: black;
  margin: 0;
}

.loading-indicator {
  font-size: 0.9rem;
  font-weight: 600;
  color: black;
  margin-top: 0.5rem;
}

.preview-content {
  /* EventDisplay component has its own styles */
}

.preview-empty {
  padding: 3rem 2rem;
  text-align: center;
  border: 0.25rem solid black;
  background: white;
}

.preview-empty p {
  font-size: 1.1rem;
  font-weight: 600;
  color: black;
  margin: 0;
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
  .event-form-view {
    border: none;
  }

  .form-container {
    grid-template-columns: 1fr;
  }

  .form-section {
    border-right: none;
    border-bottom: 0.25rem solid black;
    padding-right: 0;
    padding-bottom: 2rem;
  }

  .preview-section {
    position: static;
    padding-left: 0;
    padding-top: 2rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .artist-select {
    grid-template-columns: 1fr;
  }
}
</style>
