<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { eventService, documentService } from '@/services'
import type { Event } from '@/services/events'
import type { EventDocument } from '@/services/accounting'

const props = defineProps<{
  eventId: string
}>()

const router = useRouter()
const event = ref<Event | null>(null)
const documents = ref<EventDocument[]>([])
const isLoading = ref(false)
const isLoadingDocs = ref(false)
const uploadingFiles = ref<{ name: string }[]>([])
const dragOver = ref(false)
const driveFolderCreating = ref(false)
const uploadError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

async function loadEvent() {
  isLoading.value = true
  try {
    event.value = await eventService.getById(props.eventId)
  } catch {
    // ignore
  } finally {
    isLoading.value = false
  }
}

async function loadDocuments() {
  isLoadingDocs.value = true
  try {
    documents.value = await documentService.list(props.eventId)
  } catch {
    // silently fail
  } finally {
    isLoadingDocs.value = false
  }
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function handleFileUpload(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(Array.from(input.files))
  input.value = ''
}

function handleDrop(e: DragEvent) {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    uploadFiles(Array.from(files))
  }
}

async function uploadFiles(files: File[]) {
  uploadError.value = ''
  for (const file of files) {
    uploadingFiles.value.push({ name: file.name })
    try {
      const doc = await documentService.upload(props.eventId, file)
      documents.value.unshift(doc)
    } catch (err: any) {
      uploadError.value = err.response?.data?.error || 'Upload fehlgeschlagen'
    } finally {
      uploadingFiles.value = uploadingFiles.value.filter(f => f.name !== file.name)
    }
  }
}

async function deleteDocument(doc: EventDocument) {
  if (!confirm(`"${doc.file_name}" wirklich löschen?`)) return
  try {
    await documentService.remove(props.eventId, doc.id)
    documents.value = documents.value.filter(d => d.id !== doc.id)
  } catch (err: any) {
    console.error('Delete failed:', err)
  }
}

async function createDriveFolder() {
  if (event.value?.drive_folder_id) {
    window.open(`https://drive.google.com/drive/folders/${event.value.drive_folder_id}`, '_blank')
    return
  }
  driveFolderCreating.value = true
  try {
    const result = await documentService.createDriveFolder(props.eventId)
    if (event.value) {
      (event.value as any).drive_folder_id = result.drive_folder_id
    }
  } catch (err: any) {
    alert(err.response?.data?.error || 'Ordner-Erstellung fehlgeschlagen')
  } finally {
    driveFolderCreating.value = false
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('de-DE')
}

onMounted(() => {
  loadEvent()
  loadDocuments()
})
</script>

<template lang="pug">
.documents-view
  .page-header
    .header-left
      router-link.btn-back(to="/admin/events") ← Zurück
      h2 {{ event?.title || eventId }}
    .header-right
      button.btn-upload(@click="triggerFileUpload") + Hochladen
      button.btn-secondary(
        @click="createDriveFolder"
        :disabled="driveFolderCreating"
      ) {{ event?.drive_folder_id ? '📂 Drive-Ordner öffnen' : '📁 Drive-Ordner erstellen' }}

  input.file-input(
    ref="fileInputRef"
    type="file"
    multiple
    @change="handleFileUpload"
    style="display: none"
  )

  .drop-zone(
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="handleDrop"
    :class="{ 'drag-over': dragOver }"
  )
    p(v-if="!dragOver") Dateien hierher ziehen oder Button oben nutzen
    p(v-else) Loslassen zum Hochladen…

  .upload-progress(v-if="uploadingFiles.length")
    .upload-item(v-for="f in uploadingFiles" :key="f.name")
      span {{ f.name }}
      span.status ⏳ wird hochgeladen…

    .upload-error(v-if="uploadError")
      p ⚠️ {{ uploadError }}
    table.documents-table
      thead
        tr
          th Datei
          th Hochgeladen
          th Von
          th
      tbody
        tr(v-for="doc in documents" :key="doc.id")
          td
            a.doc-link(v-if="doc.drive_url" :href="doc.drive_url" target="_blank") {{ doc.file_name }}
            span(v-else) {{ doc.file_name }}
          td {{ formatDate(doc.uploaded_at) }}
          td {{ doc.uploaded_by_name }}
          td
            button.btn-delete(@click="deleteDocument(doc)") ✕

  .empty-state(v-else)
    p Noch keine Dokumente für dieses Event.
</template>

<style scoped>
.documents-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
}

.header-right {
  display: flex;
  gap: 0.5rem;
}

.btn-back {
  text-decoration: none;
  color: black;
  font-weight: 700;
}

.btn-upload {
  background: black;
  color: white;
  border: 0.25rem solid black;
  padding: 0.5rem 1rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-secondary {
  background: white;
  color: black;
  border: 0.25rem solid black;
  padding: 0.5rem 1rem;
  font-weight: 700;
  cursor: pointer;
}

.upload-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.upload-bar select {
  padding: 0.4rem 0.6rem;
  border: 0.2rem solid black;
  font-weight: 600;
  background: white;
}

.drop-zone {
  border: 0.25rem dashed #999;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1.5rem;
  font-weight: 600;
  transition: border-color 0.2s, background 0.2s;
}

.drop-zone.drag-over {
  border-color: black;
  background: #f0f0f0;
}

.upload-progress {
  margin-bottom: 1rem;
}

.upload-item {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0;
  font-size: 0.9rem;
  opacity: 0.6;
}

.documents-table {
  width: 100%;
  border-collapse: collapse;
}

.documents-table th,
.documents-table td {
  padding: 0.6rem 0.5rem;
  text-align: left;
  border-bottom: 0.15rem solid black;
  font-weight: 600;
}

.documents-table th {
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.doc-link {
  color: black;
  font-weight: 700;
}

.btn-delete {
  background: none;
  border: none;
  color: black;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 900;
}

.btn-delete:hover {
  color: red;
}

.upload-error {
  background: #fff3cd;
  border: 0.2rem solid black;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  font-weight: 600;
  opacity: 0.5;
}

.loading {
  text-align: center;
  padding: 2rem;
  font-weight: 600;
}
</style>
