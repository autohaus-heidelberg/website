<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { checklistTemplateService, type ChecklistTemplateItem } from '@/services'

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const isEditing = !!props.id

const form = ref<Partial<ChecklistTemplateItem>>({
  name: '',
  stage: '',
  phase: 'before'
})

const isLoading = ref(false)
const error = ref('')

const phaseOptions = [
  { value: 'before', label: 'BEFORE - Vor dem Event' },
  { value: 'during', label: 'DURING - Während dem Event' },
  { value: 'after', label: 'AFTER - Nach dem Event' }
]

async function loadTemplate() {
  if (!props.id) return

  try {
    const template = await checklistTemplateService.getById(Number(props.id))
    form.value = { ...template }
  } catch (e: any) {
    error.value = 'Failed to load template'
  }
}

async function handleSubmit() {
  if (!form.value.name || !form.value.stage || !form.value.phase) {
    error.value = 'Please fill in all required fields'
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
    error.value = e.message || 'Failed to save template'
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
      h2 {{ isEditing ? 'Edit Checklist Template' : 'Create Checklist Template' }}
      router-link.btn-cancel(to="/admin/checklist-templates") Cancel

    form.template-form(@submit.prevent="handleSubmit")
      .form-group
        label(for="name") Template Name *
        input#name(
          v-model="form.name"
          required
          placeholder="z.B. Sound Check, Aufbau Bar, Abrechnung"
        )
        .field-hint Beschreibung der Aufgabe/Tätigkeit

      .form-group
        label(for="stage") Stage/Bereich *
        input#stage(
          v-model="form.stage"
          required
          placeholder="z.B. Technik, Bar, Backstage, Kasse"
        )
        .field-hint In welchem Bereich die Aufgabe stattfindet

      .form-group
        label(for="phase") Phase *
        select#phase(
          v-model="form.phase"
          required
        )
          option(
            v-for="option in phaseOptions"
            :key="option.value"
            :value="option.value"
          ) {{ option.label }}
        .field-hint Wann die Aufgabe durchgeführt werden soll

      .error(v-if="error") {{ error }}

      .form-actions
        button.btn-primary(
          type="submit"
          :disabled="isLoading"
        )
          | {{ isLoading ? 'Saving...' : (isEditing ? 'Update Template' : 'Create Template') }}
        router-link.btn-secondary(to="/admin/checklist-templates") Cancel
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
