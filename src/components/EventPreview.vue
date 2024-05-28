

<template lang="pug">
router-link(:to="{name: 'event', params: { id: eventHash(event) }}")
    .event-preview.border
        h2(v-if="showDatediff") {{ dateDiff }}
        h2 {{ date }} 
        h2 {{ time }}
        h2 {{ event.title }}
        img.event-img(v-if="event.img" :src="event.img")
        button.mb-1 Mehr Infos
</template>

<style scoped>
.event-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.event-img {
    max-width: min(500px, 90vw);
    max-height: min(500px, 90vw);
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
import calendar from 'dayjs/plugin/calendar';
import duration from 'dayjs/plugin/duration';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
import 'dayjs/locale/de';
import dayjs from "dayjs";
import { computed } from "vue";
import { eventHash } from "../utils";

const props = defineProps<{event: Event}>();

dayjs.extend(calendar)
dayjs.extend(duration)
dayjs.extend(isToday)
dayjs.extend(isTomorrow)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
dayjs.updateLocale('de', {
  calendar: {
    sameDay: '[Heute um] LT',
    nextDay: '[Morgen!]'
  }
})
dayjs.updateLocale('de', {
  relativeTime: {
    future: "In %s",
    dd: "%d Tagen"
  }
})
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
    if (dayjs(props.event.date).isTomorrow() || dayjs(props.event.date).isToday()) {
        return dayjs(props.event.date).locale('de').calendar();
    }
    return dayjs(props.event.date).locale('de').fromNow();
})

</script>