<script setup lang="ts">
import { computed } from 'vue'
import type { Artist } from '@/services'

interface Props {
  modelValue: Partial<Artist>
  compact?: boolean
  idPrefix?: string
}

interface Emits {
  (e: 'update:modelValue', value: Partial<Artist>): void
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  idPrefix: 'artist'
})

const emit = defineEmits<Emits>()

// Individual computed properties for each field with two-way binding
const name = computed({
  get: () => props.modelValue.name || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, name: value })
})

const description = computed({
  get: () => props.modelValue.description || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, description: value })
})

const link = computed({
  get: () => props.modelValue.link || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, link: value })
})

const soundcloud = computed({
  get: () => props.modelValue.soundcloud || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, soundcloud: value })
})

const youtube = computed({
  get: () => props.modelValue.youtube || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, youtube: value })
})

const bandcamp = computed({
  get: () => props.modelValue.bandcamp || '',
  set: (value) => emit('update:modelValue', { ...props.modelValue, bandcamp: value })
})

// Helper for unique IDs
const makeId = (field: string) => `${props.idPrefix}-${field}`
</script>

<template lang="pug">
.artist-form-fields
  .form-group
    label(:for="makeId('name')") Artist Name *
    input(
      :id="makeId('name')"
      v-model="name"
      required
      placeholder="Band or artist name"
    )

  .form-group
    label(:for="makeId('description')") Description
    textarea(
      :id="makeId('description')"
      v-model="description"
      rows="5"
      placeholder="About the artist..."
    )

  .form-group
    label(:for="makeId('link')") Website
    input(
      :id="makeId('link')"
      v-model="link"
      type="url"
      placeholder="https://..."
    )
    .field-hint Link: muss ein vollständiger link sein, also zb: https://www.duckduckgo.com

  .form-row(v-if="!compact")
    .form-group
      label(:for="makeId('soundcloud')") SoundCloud
      input(
        :id="makeId('soundcloud')"
        v-model="soundcloud"
        type="url"
        placeholder="https://soundcloud.com/..."
      )
      .field-hint Soundcloud: funktioniert nicht

    .form-group
      label(:for="makeId('youtube')") YouTube
      input(
        :id="makeId('youtube')"
        v-model="youtube"
        type="url"
        placeholder="https://youtube.com/..."
      )
      .field-hint YouTube URL: muss ein youtube embed link sein, dafuer auf dem youtube video auf SHARE klicken, dann EMBED und dann den link bei src, ohne den tracker kopieren. z.B: https://www.youtube.com/embed/dWRCooFKk3c

  template(v-if="compact")
    .form-group
      label(:for="makeId('youtube')") YouTube
      input(
        :id="makeId('youtube')"
        v-model="youtube"
        type="url"
        placeholder="https://youtube.com/..."
      )
      .field-hint YouTube URL: muss ein youtube embed link sein, dafuer auf dem youtube video auf SHARE klicken, dann EMBED und dann den link bei src, ohne den tracker kopieren. z.B: https://www.youtube.com/embed/dWRCooFKk3c

    .form-group
      label(:for="makeId('soundcloud')") SoundCloud
      input(
        :id="makeId('soundcloud')"
        v-model="soundcloud"
        type="url"
        placeholder="https://soundcloud.com/..."
      )
      .field-hint Soundcloud: funktioniert nicht

  .form-group
    label(:for="makeId('bandcamp')") Bandcamp
    input(
      :id="makeId('bandcamp')"
      v-model="bandcamp"
      type="url"
      placeholder="https://bandcamp.com/..."
    )
    .field-hint Bandcamp URL: muss der embedded link sein, z.B: https://bandcamp.com/EmbeddedPlayer/album=2131561424/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/

  slot(name="image-field")
</template>

<style scoped>
.artist-form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
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

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
