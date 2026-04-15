<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { checklistTemplateService, type ChecklistTemplateItem } from '@/services'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const { t } = useI18n()
const isEditing = !!props.id

const form = ref<Partial<ChecklistTemplateItem>>({
  name: '',
  stage: '',
  phase: 'before'
})

const isLoading = ref(false)
const error = ref('')

const phaseOptions = computed(() => [
  { value: 'before', label: t('checklists.phaseBefore') },
  { value: 'during', label: t('checklists.phaseDuring') },
  { value: 'after', label: t('checklists.phaseAfter') }
])

async function loadTemplate() {
  if (!props.id) return

  try {
    const template = await checklistTemplateService.getById(Number(props.id))
    form.value = { ...template }
  } catch (e: any) {
    error.value = t('checklists.errorLoadTemplate')
  }
}

async function handleSubmit() {
  if (!form.value.name || !form.value.stage || !form.value.phase) {
    error.value = t('checklists.errorRequired')
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    if (isEditing) {
      await checklistTemplateService.update(Number(props.id), form.value)
    } else {
      await checklistTemplateService.create(form.value)
    }

    router.push('/admin/checklist-templates')
  } catch (e: any) {
    error.value = e.message || t('checklists.errorSaveTemplate')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadTemplate()
})
</script>

<template lang="pug">
.checklist-template-form-view
  .form-container
    .form-header
      h2 {{ isEditing ? $t('checklists.editTemplate') : $t('checklists.createTemplate') }}
      router-link.btn-cancel(to="/admin/checklist-templates") {{ $t('common.cancel') }}

    form.template-form(@submit.prevent="handleSubmit")
      .form-group
        label(for="name") {{ $t('checklists.templateName') }}
        input#name(
          v-model="form.name"
          required
          :placeholder="$t('checklists.templateNamePlaceholder')"
        )
        .field-hint {{ $t('checklists.templateNameHint') }}

      .form-group
        label(for="stage") {{ $t('checklists.stageArea') }}
        input#stage(
          v-model="form.stage"
          required
          :placeholder="$t('checklists.stageAreaPlaceholder')"
        )
        .field-hint {{ $t('checklists.stageAreaHint') }}

      .form-group
        label(for="phase") {{ $t('checklists.phaseLabel') }}
        select#phase(
          v-model="form.phase"
          required
        )
          option(
            v-for="option in phaseOptions"
            :key="option.value"
            :value="option.value"
          ) {{ option.label }}
        .field-hint {{ $t('checklists.phaseHint') }}

      .error(v-if="error") {{ error }}

      .form-actions
        button.btn-primary(
          type="submit"
          :disabled="isLoading"
        )
          | {{ isLoading ? $t('common.saving') : (isEditing ? $t('checklists.updateTemplate') : $t('checklists.createTemplate')) }}
        router-link.btn-secondary(to="/admin/checklist-templates") {{ $t('common.cancel') }}
</template>

<style scoped>
.checklist-template-form-view {
  background: white;
  padding: 2rem;
  border: 0.5rem solid black;
  max-width: 800px;
  margin: 0 auto;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 0.25rem solid black;
}

h2 {
  font-size: 1.75rem;
  color: black;
  margin: 0;
  font-weight: 900;
}

.template-form {
  display: flex;
  flex-direction: column;
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

input, select {
  padding: 0.75rem;
  border: 0.25rem solid black;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}

input:focus, select:focus {
  outline: none;
  background: black;
  color: white;
}

select {
  cursor: pointer;
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
  .checklist-template-form-view {
    padding: 1rem;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
