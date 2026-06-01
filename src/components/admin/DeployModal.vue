<template lang="pug">
teleport(to="body")
  transition(name="modal")
    .deploy-modal-overlay(v-if="visible" @click.self="handleClose")
      .deploy-modal
        .deploy-modal-header
          h2 Website-Deployment
          button.close-btn(v-if="canClose" @click="handleClose") ✕

        .deploy-modal-body
          .deploy-status(v-if="isDeploying")
            .spinner
            span Deployment läuft...

          .deploy-status.success(v-else-if="deploySuccess")
            span ✓ Erfolgreich deployed!

          .deploy-status.error(v-else-if="deployError")
            span ✗ {{ deployError }}

          EventSyncLog(:logs="logs")

        .deploy-modal-footer(v-if="canClose")
          button.btn-primary(@click="handleClose") Schließen
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EventSyncLog from '@/components/admin/EventSyncLog.vue'
import type { SSELogEntry } from '@/composables/useEventSource'

const props = defineProps<{
  visible: boolean
  logs: SSELogEntry[]
  isDeploying: boolean
  deploySuccess: boolean
  deployError: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const canClose = computed(() => !props.isDeploying)

function handleClose() {
  if (canClose.value) {
    emit('close')
  }
}
</script>

<style scoped>
.deploy-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
}

.deploy-modal {
  background: white;
  border: 0.5rem solid black;
  width: 100%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.deploy-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 0.25rem solid black;
}

.deploy-modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  font-weight: 900;
  padding: 0.25rem 0.5rem;
}

.close-btn:hover {
  background: black;
  color: white;
}

.deploy-modal-body {
  padding: 1.5rem 2rem;
  overflow-y: auto;
  flex: 1;
}

.deploy-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 0.25rem solid black;
  font-weight: 700;
}

.deploy-status.success {
  border-color: #16a34a;
  color: #16a34a;
}

.deploy-status.error {
  border-color: #dc2626;
  color: #dc2626;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 3px solid #ccc;
  border-top-color: black;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.deploy-modal-footer {
  padding: 1rem 2rem;
  border-top: 0.25rem solid black;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: black;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-primary:hover {
  background: #333;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .deploy-modal-overlay {
    padding: 1rem;
  }

  .deploy-modal {
    border-width: 0.25rem;
    max-height: 90vh;
  }

  .deploy-modal-header,
  .deploy-modal-body,
  .deploy-modal-footer {
    padding: 1rem;
  }
}
</style>
