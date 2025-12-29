<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { settingsService } from '@/services'

// State
const activeTab = ref('helferpad')
const helferpadContent = ref('')
const settingId = ref<number>()
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref('')
const success = ref('')

// Load helferpad setting on mount
onMounted(async () => {
  isLoading.value = true
  error.value = ''

  try {
    const setting = await settingsService.getByName('helferpad')
    helferpadContent.value = setting.setting.content || ''
    settingId.value = setting.id
  } catch (err: any) {
    if (err.response?.status === 404) {
      // Setting doesn't exist yet - will create on first save
      helferpadContent.value = 'HelferPad'
    } else {
      error.value = 'Failed to load settings'
      console.error('Error loading settings:', err)
    }
  } finally {
    isLoading.value = false
  }
})

// Save helferpad setting
async function handleSave() {
  isSaving.value = true
  error.value = ''
  success.value = ''

  try {
    if (settingId.value) {
      // Update existing setting
      await settingsService.update(settingId.value, { content: helferpadContent.value })
    } else {
      // Create new setting
      const created = await settingsService.create('helferpad', { content: helferpadContent.value })
      settingId.value = created.id
    }

    success.value = 'Settings saved successfully!'
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save settings'
    console.error('Error saving settings:', err)
  } finally {
    isSaving.value = false
  }
}
</script>

<template lang="pug">
.settings-view
  .settings-header
    h2 Settings

  .tabs-nav
    button.tab-button(
      :class="{ active: activeTab === 'helferpad' }"
      @click="activeTab = 'helferpad'"
    )
      | Helferpad

  .tab-content(v-show="activeTab === 'helferpad'")
    .section-description
      p Default content that appears in new Helferpad documents

    form.setting-form(@submit.prevent="handleSave")
      .form-group
        label(for="helferpad-content") Default Content
        textarea#helferpad-content(
          v-model="helferpadContent"
          :disabled="isLoading || isSaving"
          rows="15"
          placeholder="Enter default Helferpad content..."
        )
        .field-hint Plain text only

      .error(v-if="error") {{ error }}
      .success(v-if="success") {{ success }}

      .form-actions
        button.btn-primary(
          type="submit"
          :disabled="isSaving || isLoading"
        )
          | {{ isSaving ? 'Saving...' : 'Save Changes' }}
</template>

<style scoped>
.settings-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 900px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.settings-header h2 {
  font-size: 1.75rem;
  color: black;
  font-weight: 900;
  margin: 0;
}

.tabs-nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 0.5rem solid black;
  margin-bottom: 2rem;
}

.tab-button {
  padding: 0.875rem 1.5rem;
  border: 0.25rem solid black;
  background: white;
  color: black;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 1rem;
}

.tab-button:hover {
  background: black;
  color: white;
}

.tab-button.active {
  background: black;
  color: white;
  transform: rotate(-1deg);
}

.tab-content {
  padding-top: 1rem;
}

.section-description {
  margin-bottom: 1.5rem;
}

.section-description p {
  color: black;
  margin: 0;
}

.setting-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: black;
  font-size: 1rem;
}

textarea {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: monospace;
  transition: background 0.2s;
  resize: vertical;
}

textarea:focus {
  outline: none;
  background: black;
  color: white;
}

textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.error {
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid black;
  color: black;
  font-weight: 600;
}

.success {
  padding: 0.875rem;
  background: white;
  border: 0.25rem solid #22c55e;
  color: #22c55e;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 0.25rem solid black;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: black;
  color: white;
  border: 0.25rem solid black;
  font-size: 1rem;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(120%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .settings-view {
    border-width: 0.25rem;
    padding: 1rem;
  }

  .tabs-nav {
    border-bottom-width: 0.25rem;
  }

  .tab-button {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }
}
</style>
