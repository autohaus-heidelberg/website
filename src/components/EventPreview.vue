

<template lang="pug">
.event-preview.border
    router-link(:to="{name: 'event', params: { id: eventHash(event) }}")
        h2(v-if="showDatediff") {{ dateDiff }}
        h2 {{ date }} 
        h2 {{ time }}
        h2 {{ event.title }}
        p {{ event.description }}
            button Mehr Infos
</template>

<style scoped>
.event-preview {
}

.border {
    /* border: 3px dashed; */
    /* border-radius: 2rem; */
    padding: 0.5rem;

background-image: linear-gradient(90deg, silver 50%, transparent 50%), linear-gradient(90deg, silver 50%, transparent 50%), linear-gradient(0deg, silver 50%, transparent 50%), linear-gradient(0deg, silver 50%, transparent 50%);
background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
background-size: 15px 3px, 15px 3px, 3px 15px, 3px 15px;
background-position: left top, right bottom, left bottom, right top;
animation: border-dance 1s infinite linear;
}

@keyframes border-dance {
0% {
    background-position: left top, right bottom, left bottom, right top;
}

100% {
    background-position: left 15px top, right 15px bottom, left bottom 15px, right top 15px;
}
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

const time = computed(() => {
    return dayjs(props.event.date).format("HH:mm")
})

const showDatediff = computed(() => {
    return dayjs(props.event.date).diff(dayjs(), "day") < 7;
})

const dateDiff = computed(() => {
    return dayjs(props.event.date).locale('de').fromNow();
})

</script>