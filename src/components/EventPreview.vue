

<template lang="pug">
.event-preview
    router-link(:to="{name: 'event', params: { id: eventHash(event) }}")
        h2(v-if="showDatediff") {{ dateDiff }}
        h2 {{ date }} 
        h2 {{ event.time }}
        h2 {{ event.title }}
        p {{ event.description }}
            button Mehr Infos
</template>

<style scoped>
.event-preview {
    border: 3px dashed;
    border-radius: 2rem;
    padding: 0.5rem;
}
</style>

<script lang="ts" setup>
import type { Event } from "../events";
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/de';
import dayjs from "dayjs";
import { computed } from "vue";
import { eventHash } from "../utils";

const props = defineProps<{event: Event}>();

dayjs.extend(duration)
dayjs.extend(relativeTime);
dayjs.locale('de')

const date = computed(() => {
    const date = dayjs(props.event.date).locale('de');
    return date.format("dddd - DD/MM/YYYY")
  
    }
    )

const showDatediff = computed(() => {
    return dayjs(props.event.date).diff(dayjs(), "day") < 7;
})

const dateDiff = computed(() => {
    return dayjs(props.event.date).locale('de').fromNow();
})

</script>