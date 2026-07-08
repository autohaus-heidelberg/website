<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { eventService, artistService, pretixService, accountingService } from '@/services'
import type { Event as AppEvent, Artist, HelferpadEventData } from '@/services'
import type { PretixOrderSummary } from '@/services/accounting'
import publishedEvents from '@/events.json'
import { useEventSource } from '@/composables/useEventSource'
import DeployModal from '@/components/admin/DeployModal.vue'
import ArtistSelector from '@/components/admin/ArtistSelector.vue'
import EventDisplay from '@/components/EventDisplay.vue'
import EventChecklistTab from '@/components/admin/EventChecklistTab.vue'
import AccountingView from '@/views/admin/accounting/AccountingView.vue'

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
const isPublished = computed(() => publishedEvents.some((e: any) => e.id === props.id))
const accountingStatus = ref<'none' | 'draft' | 'final'>('none')
const accountingViewRef = ref<InstanceType<typeof AccountingView> | null>(null)
const activeSection = ref<'event' | 'accounting'>('event')
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
const showOverflow = ref(false)
const pendingDelete = ref<{ timer: ReturnType<typeof setTimeout> } | null>(null)
const deleteError = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isCreatingShopLink = ref(false)
const shopLinkSuccess = ref('')
const isCreatingHelferpad = ref(false)
const helferpadSuccess = ref('')
const isGeneratingFlyers = ref(false)
const flyerSuccess = ref('')
const originalDate = ref<string | null>(null)
const previewArtists = ref<Artist[]>([])
const loadingArtists = ref(false)

// Pretix VVK state
const pretixData = ref<PretixOrderSummary | null>(null)
const pretixLoading = ref(false)
const pretixError = ref('')

// TinyMCE configuration
const editorConfig = {
  license_key: 'gpl',
  width: '100%',
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

const SOURCE_LABELS: Record<string, string> = {
  vvk_stripe: 'Stripe',
  vvk_paypal: 'PayPal',
  vvk_pretix: 'Pretix (Überweisung etc.)',
}

async function loadPretixData() {
  if (!props.id || !form.value.shopLink) return
  pretixLoading.value = true
  pretixError.value = ''
  try {
    pretixData.value = await pretixService.getOrderSummary(props.id)
  } catch (e: any) {
    pretixError.value = e.message || 'VVK-Daten konnten nicht geladen werden'
  } finally {
    pretixLoading.value = false
  }
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
    originalDate.value = event.date.substring(0, 16)
    // Set image preview if there's an existing image
    if (event.image_url) {
      imagePreview.value = event.image_url
    }
  } catch (e: any) {
    error.value = 'Veranstaltung konnte nicht geladen werden'
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
    error.value = 'Event-ID wird für Shop-Link benötigt'
    return
  }
  if (!form.value.title) {
    error.value = 'Titel wird für Shop-Link benötigt'
    return
  }
  if (!form.value.date) {
    error.value = 'Datum wird für Shop-Link benötigt'
    return
  }
  if (!form.value.fee) {
    error.value = 'Eintrittspreis wird für Shop-Link benötigt'
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

    shopLinkSuccess.value = 'Shop-Link erfolgreich erstellt!'

    // Clear success message after 3 seconds
    setTimeout(() => {
      shopLinkSuccess.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Veranstaltung konnte nicht gespeichert werden'
  } finally {
    isCreatingShopLink.value = false
  }
}

async function createHelferpad() {
  // Validate required fields
  if (!form.value.id) {
    error.value = 'Event-ID wird für Helferpad benötigt'
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
        error.value = 'Titel wird vor Helferpad-Erstellung benötigt'
        return
      }
      if (!form.value.date) {
        error.value = 'Datum wird vor Helferpad-Erstellung benötigt'
        return
      }
      if (!form.value.descriptionShort) {
        error.value = 'Kurzbeschreibung wird vor Helferpad-Erstellung benötigt'
        return
      }

      // Prepare data for submission
      const { image, image_url, image_original, artists, ...formData } = form.value
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
    helferpadSuccess.value = wasNewEvent ? 'Event und Helferpad erstellt!' : 'Helferpad erfolgreich erstellt!'

    // Clear success message after 3 seconds
    setTimeout(() => {
      helferpadSuccess.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Veranstaltung konnte nicht gespeichert werden'
  } finally {
    isCreatingHelferpad.value = false
  }
}

async function generateFlyers() {
  if (!form.value.id || !isEditing.value) {
    error.value = 'Bitte den Event zuerst speichern, bevor Flyer erzeugt werden.'
    return
  }

  isGeneratingFlyers.value = true
  error.value = ''
  flyerSuccess.value = ''

  try {
    const result = await eventService.generateFlyers(form.value.id!)
    const count = result.flyers?.length ?? 0
    flyerSuccess.value = `${count} Flyer im Google-Drive-Ordner des Events abgelegt.`

    setTimeout(() => {
      flyerSuccess.value = ''
    }, 5000)
  } catch (e: any) {
    error.value = e.message || 'Flyer konnten nicht erzeugt werden'
  } finally {
    isGeneratingFlyers.value = false
  }
}

async function handleSubmit() {
  if (!form.value.id || !form.value.title || !form.value.date || !form.value.descriptionShort) {
    error.value = 'Bitte alle Pflichtfelder ausfüllen'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Prepare data for submission
    const { image, image_url, image_original, artists, ...formData } = form.value

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
    error.value = e.message || 'Veranstaltung konnte nicht gespeichert werden'
  } finally {
    isLoading.value = false
  }
}

// Warn if event time changed after helferpad was created
const helferpadTimeWarning = computed(() => {
  if (!form.value.helferpadLink || !originalDate.value) return false
  return form.value.date !== originalDate.value
})

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

function deleteEvent() {
  showOverflow.value = false
  if (!props.id) return

  // Cancel any previous pending delete
  if (pendingDelete.value) {
    clearTimeout(pendingDelete.value.timer)
    commitDelete()
  }

  // Schedule actual deletion after 5 seconds
  const timer = setTimeout(async () => {
    await commitDelete()
  }, 5000)

  pendingDelete.value = { timer }
}

function undoDelete() {
  if (!pendingDelete.value) return
  clearTimeout(pendingDelete.value.timer)
  pendingDelete.value = null
}

async function commitDelete() {
  if (!props.id) return
  try {
    await eventService.delete(props.id)
    pendingDelete.value = null
    router.push('/admin/events')
  } catch (e: any) {
    const msg = e.response?.data?.error || e.message || 'Unbekannter Fehler'
    deleteError.value = msg
    pendingDelete.value = null
  }
}

function closeOverflow(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.overflow-menu')) {
    showOverflow.value = false
  }
}

onMounted(async () => {
  await loadEvent()

  // Check accounting status
  if (props.id) {
    const acc = await accountingService.getByEvent(props.id)
    if (!acc) accountingStatus.value = 'none'
    else accountingStatus.value = acc.status === 'final' ? 'final' : 'draft'
  }

  // Check for tab query parameter and set active section/tab.
  // `abrTab` (Sub-Tab innerhalb der Abrechnung) impliziert die
  // Abrechnungs-Sektion — auch wenn `tab=accounting` weggelassen wurde,
  // damit Deep-Links wie `?abrTab=expenses` direkt landen.
  const tabParam = route.query.tab as string
  const abrTabParam = route.query.abrTab as string | undefined
  if (tabParam === 'accounting' || abrTabParam) {
    activeSection.value = 'accounting'
  } else if (tabParam && ['details', 'checklist', 'vvk'].includes(tabParam)) {
    activeTab.value = tabParam
    if (tabParam === 'vvk') {
      loadPretixData()
    }
  }

  document.addEventListener('click', closeOverflow)
})

onUnmounted(() => {
  document.removeEventListener('click', closeOverflow)
})

// ── Publish / Unpublish ──
const { logs: deployLogs, error: deploySseError, connect: deployConnect, disconnect: deployDisconnect, clearLogs: deployClearLogs, clearError: deployClearError } = useEventSource()
const isDeploying = ref(false)
const deploySuccess = ref(false)
const deployError = ref<string | null>(null)
const showDeployModal = ref(false)

function handlePublish() {
  if (!props.id) return

  const currentIds = publishedEvents.map((e: any) => e.id)
  let eventIds: string[]

  if (isPublished.value) {
    // Unpublish: remove this event
    eventIds = currentIds.filter((id: string) => id !== props.id)
    if (!confirm('Event von der Website entfernen und deployen?')) return
  } else {
    // Publish: add this event
    eventIds = [...currentIds, props.id]
    if (!confirm('Event auf der Website veröffentlichen und deployen? Das kann einige Minuten dauern.')) return
  }

  runDeploy(eventIds)
}

function handleUpdate() {
  if (!props.id || !isPublished.value) return

  // Re-deploy with the current set of published IDs unchanged. The backend
  // re-reads all events from the database, so this pushes the latest data
  // for this event to the website in a single step.
  const eventIds = publishedEvents.map((e: any) => e.id)
  if (!confirm('Aktualisierte Event-Daten auf der Website veröffentlichen und deployen? Das kann einige Minuten dauern.')) return

  runDeploy(eventIds)
}

function runDeploy(eventIds: string[]) {
  isDeploying.value = true
  deploySuccess.value = false
  deployError.value = null
  showDeployModal.value = true
  deployClearLogs()
  deployClearError()

  const url = eventService.getWriteToWebsiteUrl(eventIds)

  deployConnect(url, {
    write_start: () => {},
    processing: () => {},
    git_pull: () => {},
    json_write: () => {},
    git_add: () => {},
    git_commit: () => {},
    git_push: () => {},
    npm_deploy: () => {},
    heartbeat: () => {},
    write_complete: () => {
      isDeploying.value = false
      deploySuccess.value = true
      deployDisconnect()
    },
    write_error: (data) => {
      isDeploying.value = false
      deployError.value = data.message || 'Deployment fehlgeschlagen'
      deployDisconnect()
    }
  })

  const stopWatching = watch(deploySseError, (newError) => {
    if (newError) {
      isDeploying.value = false
      deployError.value = newError
      stopWatching()
    }
  })
}

function closeDeployModal() {
  showDeployModal.value = false
  if (deploySuccess.value) {
    window.location.reload()
  }
}
</script>

<template lang="pug">
.event-form-view
  .form-header
    .form-header-left
      h2 {{ isEditing ? 'Veranstaltung bearbeiten' : 'Veranstaltung erstellen' }}
      span.event-subtitle(v-if="isEditing && form.title")
        | {{ form.title }}
        template(v-if="form.date")  · {{ new Date(form.date).toLocaleDateString('de-DE') }}
        template(v-if="form.fee")  · VVK {{ form.fee }}€
        template(v-if="form.feeAk")  / AK {{ form.feeAk }}€
    .form-header-right
      button.status-badge.badge-live.clickable(
        v-if="isEditing && isPublished"
        @click="handlePublish"
        :disabled="isDeploying"
      )
        span.badge-default ✓ Live
        span.badge-hover ✗ Entfernen
      button.status-badge.badge-update.clickable(
        v-if="isEditing && isPublished"
        @click="handleUpdate"
        :disabled="isDeploying"
      )
        span.badge-default ↻ Website aktualisieren
        span.badge-hover ▶ Website aktualisieren
      button.status-badge.badge-draft.clickable(
        v-else-if="isEditing"
        @click="handlePublish"
        :disabled="isDeploying"
      )
        span.badge-default Veröffentlichen
        span.badge-hover ▶ Veröffentlichen
      span.status-badge.badge-acc-final.clickable(
        v-if="isEditing && accountingStatus === 'final'"
        @click="accountingViewRef?.toggleFinalStatus()"
      )
        span.badge-default ✓ Abgerechnet
        span.badge-hover Zurück auf Entwurf
      span.status-badge.badge-acc-draft.clickable(
        v-else-if="isEditing && accountingStatus === 'draft'"
        @click="accountingViewRef?.toggleFinalStatus()"
      )
        span.badge-default Abr. offen
        span.badge-hover ▶ Abschließen
      router-link.btn-cancel(to="/admin/events") Abbrechen

  .event-tabs(v-if="isEditing")
    button.tab.tab-section(
      :class="{ active: activeSection === 'event' }"
      @click="activeSection = 'event'"
      type="button"
    ) Veranstaltung
    button.tab.tab-section(
      :class="{ active: activeSection === 'accounting' }"
      @click="activeSection = 'accounting'"
      type="button"
    ) Abrechnung

  //- Sub-tabs for Veranstaltung
  .event-sub-tabs(v-if="isEditing && activeSection === 'event'")
    button.sub-tab(
      :class="{ active: activeTab === 'details' }"
      @click="activeTab = 'details'"
      type="button"
    ) 📝 Details
    button.sub-tab(
      v-if="form.shopLink"
      :class="{ active: activeTab === 'vvk' }"
      @click="activeTab = 'vvk'; loadPretixData()"
      type="button"
    ) 🎟️ VVK
    button.sub-tab(
      :class="{ active: activeTab === 'checklist' }"
      @click="activeTab = 'checklist'"
      type="button"
    ) ✅ Checkliste

  .tab-content(v-show="activeSection === 'event' && activeTab === 'details'")
    .form-container
      .form-section
        form.event-form(@submit.prevent="handleSubmit")
          .form-row
            .form-group
              label(for="id") Event-ID *
              input#id(
                v-model="form.id"
                required
                :disabled="isEditing"
                placeholder="z.B. event-2025-12-31"
                @input="handleIdInput"
              )
              .field-hint Eindeutiger Bezeichner (kann nach Erstellung nicht geändert werden)
              .field-hint Erlaubte Zeichen: A-Z, a-z, 0-9 und - (keine Unterstriche _)

            .form-group
              label(for="date") Datum & Uhrzeit *
              input#date(
                v-model="form.date"
                type="datetime-local"
                required
              )

          .form-group
            label(for="title") Titel *
            input#title(
              v-model="form.title"
              required
              placeholder="Veranstaltungsname"
            )

          .form-group
            label Kurzbeschreibung *
            Editor(
              v-model="form.descriptionShort"
              :init="editorConfig"
              licenseKey="gpl"
            )
            .field-hint Rich-Text-Editor für Veranstaltungsbeschreibung

          .form-row
            .form-group
              label(for="fee") VVK-Preis
              input#fee(
                v-model="form.fee"
                placeholder="z.B. 10"
              )
              .field-hint Preis muss eine Zahl sein (z.B. 10 für 10€)

            .form-group
              label(for="feeAk") AK-Preis
              input#feeAk(
                v-model="form.feeAk"
                placeholder="z.B. 8"
              )
              .field-hint Preis muss eine Zahl sein (z.B. 8 für 8€)

          .form-group
            label(for="shopLink") Ticket-Shop-Link
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
                | {{ isCreatingShopLink ? 'Wird erstellt...' : 'Pretix-Shop-Link erstellen' }}
              .field-hint Benötigt: Event-ID, Titel, Datum und Preis (muss eine Zahl sein). Erstellt keinen Event in der Datenbank.
            .success-message(v-if="shopLinkSuccess") {{ shopLinkSuccess }}

          .form-group
            label(for="helferpadLink") Helferpad-Link
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
                | {{ isCreatingHelferpad ? 'Speichern...' : 'Helferpad erstellen' }}
              .field-hint Benötigt: Event-ID
              .field-hint(v-if="!isEditing") Erstellt auch den Event in der Datenbank.
            .success-message(v-if="helferpadSuccess") {{ helferpadSuccess }}

          .form-group
            label Künstlerauswahl
            ArtistSelector(
              v-model="form.artist_ids"
              v-model:artistOrder="form.artistOrder"
            )

          .form-group
            label(for="image") Veranstaltungsbild
            .image-preview(v-if="imagePreview")
              img(:src="imagePreview" alt="Event image preview")
              .preview-label {{ imageFile ? 'Neues Bild (wird hochgeladen)' : 'Aktuelles Bild' }}
            input#image(
              type="file"
              accept="image/*"
              @change="handleImageChange"
            )
            .field-hint Website-Version: WEBP, max. 1000×1000px. Fürs Flyer-Ergebnis am besten JPG/PNG mit ≥1920px hochladen.
            .shop-link-actions(v-if="isEditing")
              button.btn-shop-link(
                type="button"
                @click="generateFlyers"
                :disabled="isGeneratingFlyers"
              )
                | {{ isGeneratingFlyers ? 'Wird erzeugt...' : 'Social-Media-Flyer erzeugen' }}
              .field-hint Erzeugt RGG-, Instagram- und komprimierte Formate und legt sie im Google-Drive-Ordner des Events ab. Bei geändertem Bild bitte zuerst speichern.
            .success-message(v-if="flyerSuccess") {{ flyerSuccess }}

          .error(v-if="error") {{ error }}

          .form-actions
            button.btn-primary(
              type="submit"
              :disabled="isLoading"
            )
              | {{ isLoading ? 'Speichern...' : (isEditing ? 'Veranstaltung aktualisieren' : 'Veranstaltung erstellen') }}
            router-link.btn-secondary(to="/admin/events") Abbrechen
            .overflow-menu(v-if="isEditing")
              button.btn-overflow(type="button" @click="showOverflow = !showOverflow") ⋯
              .overflow-dropdown(v-if="showOverflow")
                button.overflow-item.overflow-danger(type="button" @click="deleteEvent") Veranstaltung löschen

      .preview-section
        .preview-header
          h3 Live-Vorschau
          .loading-indicator(v-if="loadingArtists") Künstler werden geladen...
        .preview-content
          EventDisplay(:event="previewEvent" v-if="form.title")
          .preview-empty(v-else)
            p Formular ausfüllen für Vorschau

  .tab-content(v-if="isEditing" v-show="activeSection === 'event' && activeTab === 'checklist'")
    EventChecklistTab(:eventId="props.id")

  .tab-content(v-if="isEditing && form.shopLink" v-show="activeSection === 'event' && activeTab === 'vvk'")
    .vvk-overview
      h3 VVK-Übersicht
      .vvk-shop-link
        a(:href="form.shopLink" target="_blank") {{ form.shopLink }}

      .vvk-loading(v-if="pretixLoading") Lade VVK-Daten...
      .vvk-error(v-else-if="pretixError") {{ pretixError }}
      template(v-else-if="pretixData")
        .vvk-summary-cards
          .vvk-card
            .vvk-card-value {{ pretixData.total_tickets }}
            .vvk-card-label Tickets verkauft
          .vvk-card
            .vvk-card-value {{ pretixData.total_revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}
            .vvk-card-label Einnahmen (brutto)
          .vvk-card
            .vvk-card-value {{ pretixData.pretix_fee.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}
            .vvk-card-label Pretix-Gebühr

        .vvk-breakdown(v-if="Object.keys(pretixData.by_source).length")
          h4 Aufschlüsselung nach Zahlungsart
          table.vvk-table
            thead
              tr
                th Zahlungsart
                th Tickets
                th Einnahmen
                th Gebühren
            tbody
              tr(v-for="(data, source) in pretixData.by_source" :key="source")
                td {{ SOURCE_LABELS[source] || source }}
                td {{ data.tickets }}
                td {{ data.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}
                td {{ data.fees.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }}

        .vvk-warnings(v-if="pretixData.warnings?.length")
          p.vvk-warning(v-for="w in pretixData.warnings" :key="w") ⚠️ {{ w }}

      .vvk-empty(v-else)
        p Klicke auf den Tab, um die aktuellen VVK-Daten zu laden.

  .tab-content(v-if="isEditing" v-show="activeSection === 'accounting'")
    AccountingView(ref="accountingViewRef" :eventId="props.id" @status-changed="s => accountingStatus = s")

  //- ── Undo Delete Snackbar ──
  transition(name="snackbar")
    .undo-snackbar(v-if="pendingDelete")
      span „{{ form.title }}" wird gelöscht.
      button.undo-btn(@click="undoDelete") Rückgängig
  transition(name="snackbar")
    .undo-snackbar.snackbar-error(v-if="deleteError")
      span ⚠️ {{ deleteError }}
      button.undo-btn(@click="deleteError = ''") OK
  transition(name="snackbar")
    .undo-snackbar.snackbar-error(v-if="helferpadTimeWarning")
      span ⚠️ Schichtzeiten im Helferpad prüfen! Event-Zeit wurde geändert.

  //- ── Deploy Modal ──
  DeployModal(
    :visible="showDeployModal"
    :logs="deployLogs"
    :isDeploying="isDeploying"
    :deploySuccess="deploySuccess"
    :deployError="deployError"
    @close="closeDeployModal"
  )
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
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
}

.form-header-left {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.form-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 0.125rem solid transparent;
  white-space: nowrap;
  line-height: 1.4;
  box-sizing: border-box;
}

.badge-live {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.badge-update {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

.badge-draft {
  background: #f59e0b;
  color: black;
  border-color: #f59e0b;
}

.badge-acc-draft {
  background: white;
  color: #555;
  border-color: #999;
}

.badge-acc-final {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.event-subtitle {
  font-size: 0.85rem;
  color: #888;
  margin-top: 0.15rem;
}

.event-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0;
  border-bottom: 0.25rem solid black;
  padding-bottom: 0;
}

.event-sub-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  padding: 0.5rem 0 0;
}

.sub-tab {
  padding: 0.5rem 1.25rem;
  border: none;
  background: #f0f0f0;
  color: black;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s;
}

.sub-tab:hover {
  background: #ddd;
}

.sub-tab.active {
  background: black;
  color: white;
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
  overflow: hidden;
}

.form-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 0.25rem solid black;
  padding-right: 2rem;
  overflow: hidden;
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
  width: 100%;
}

input:focus, textarea:focus {
  outline: none;
  background: black;
  color: white;
}

:deep(.tox-tinymce) {
  max-width: 100%;
  width: 100% !important;
}

input:disabled {
  background: white;
  cursor: not-allowed;
  opacity: 0.6;
}

.field-hint {
  font-size: 0.85rem;
  color: black;
  overflow-wrap: break-word;
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

.status-badge.clickable {
  appearance: none;
  -webkit-appearance: none;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.status-badge.clickable .badge-hover {
  display: none;
}

.status-badge.clickable:hover:not(:disabled) .badge-default {
  display: none;
}

.status-badge.clickable:hover:not(:disabled) .badge-hover {
  display: inline;
}

.badge-acc-draft.clickable:hover:not(:disabled) {
  background: #16a34a;
  border-color: #16a34a;
  color: white;
}

.badge-acc-final.clickable:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
  color: white;
}

.badge-live.clickable:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: white;
}

.badge-update.clickable:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: white;
}

.badge-draft.clickable:hover:not(:disabled) {
  background: #16a34a;
  border-color: #16a34a;
  color: white;
}

.status-badge.clickable:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .event-form-view {
    border: none;
    padding: 0px;
  }

  .form-container {
    grid-template-columns: minmax(0, 1fr);
    overflow: hidden;
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

  .form-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-header-right {
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .event-tabs {
    flex-wrap: wrap;
  }

  .tab {
    padding: 0.625rem 1rem;
    font-size: 0.85rem;
  }
}

.overflow-menu {
  position: relative;
  display: flex;
  align-items: stretch;
}

.btn-overflow {
  padding: 0.875rem 1.25rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  font-weight: 900;
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
  transition: all 0.2s;
}

.btn-overflow:hover {
  background: black;
  color: white;
}

.overflow-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  background: white;
  border: 0.25rem solid black;
  z-index: 100;
  min-width: 12rem;
}

.overflow-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: white;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.overflow-danger {
  color: #c00;
}

.overflow-danger:hover {
  background: #c00;
  color: white;
}

.undo-snackbar {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: black;
  color: white;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 500;
  font-size: 0.9rem;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.undo-btn {
  background: transparent;
  color: white;
  border: 0.15rem solid white;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s;
}

.undo-btn:hover {
  background: white;
  color: black;
}

.snackbar-error {
  background: #c00;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

/* VVK Overview */
.vvk-overview {
  padding: 1rem 0;
}

.vvk-overview h3 {
  font-size: 1.5rem;
  font-weight: 900;
  margin: 0 0 1rem;
}

.vvk-overview h4 {
  font-size: 1rem;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
}

.vvk-shop-link {
  margin-bottom: 1.5rem;
}

.vvk-shop-link a {
  color: black;
  font-weight: 600;
  text-decoration: underline;
}

.vvk-loading,
.vvk-empty p {
  font-weight: 600;
  color: #555;
}

.vvk-error {
  padding: 0.75rem;
  background: #fff0f0;
  border: 0.25rem solid black;
  font-weight: 600;
}

.vvk-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.vvk-card {
  border: 0.25rem solid black;
  padding: 1.25rem 1rem;
  text-align: center;
}

.vvk-card-value {
  font-size: 1.5rem;
  font-weight: 900;
}

.vvk-card-label {
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 0.25rem;
  color: #555;
}

.vvk-table {
  width: 100%;
  border-collapse: collapse;
  border: 0.25rem solid black;
}

.vvk-table th,
.vvk-table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  font-size: 0.9rem;
}

.vvk-table th {
  background: black;
  color: white;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vvk-warnings {
  margin-top: 1rem;
}

.vvk-warning {
  font-size: 0.85rem;
  font-weight: 600;
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}
</style>
