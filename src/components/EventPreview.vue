

<template lang="pug">
router-link(:to="{name: 'event', params: { id: encodeURI(event.id) }}")
    .event-preview.border
        .title(v-resize-text) {{ event.title }}
        .date()
            .date(v-resize-text="{ratio: 2}")  
                span {{ date.format("dd")  }}. 
                span {{ date.format('DD') }}
                span {{ date.format('MMMM') }} 
                span {{ date.format('YYYY') }} 
                span {{ time }}
        .date-diff(ref="dateContainer")
            .side-date-content(ref="dateContent") 
                div(v-resize-text={ratio: 2}) {{ dateDiff }} 
        .event-img
            img.img(v-if="event.img" :src="event.img")
        //- button Mehr
</template>

<style scoped>

h2 {
    margin: 0;
}

.date-diff {
    /* transform: rotate(90deg); */
    grid-area: date-diff;
   font-weight: 900;
    font-size: clamp(2.5rem, 3.5vw, 4rem);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.side-date-content {
/* transform: rotate(90deg); */
position: relative;
margin-top: 1rem;
margin-bottom: 1rem;
  writing-mode: vertical-rl;
}


.date {
    grid-area: date;
    display: flex; 
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 100%;
    width: 100%;
    font-weight: 900;
    font-size: clamp(1.6rem, 3vw, 4rem)
}

.time {
    font-family: "Geologica";
    grid-area: time;
 
}


.title {
    font-family: "Geologica";
    grid-area: title;
    word-break: break-word;
    /* text-align: justify; */
 	hyphens: auto; 
    height: 100%;
    width: 100%;
    font-size:  clamp(2rem, 3.1vw, 4rem);
    font-stretch: 125%;
    font-weight: 900;
}

.event-preview {
    display: grid;
    flex-direction: column;
    align-items: center;
    grid-gap: 0.5rem;
       border: 0.5rem solid;
    background-color: var(--text-color);
    grid-template-columns: 2fr 1fr;
   grid-template-areas: "title date"
   "img date-diff"; 
   margin-left: 1rem;
   margin-right: 1rem;
   transform: rotate(1deg);
}

.event-preview > div {
    background-color: white;
}

.event-img {
    grid-area: img;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}

.img {
        max-height: min(900px, 90vw);


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
import { computed, onMounted, ref } from "vue";
import { eventHash } from "../utils";
const props = defineProps<{event: Event}>();

dayjs.extend(calendar)
dayjs.extend(duration)
dayjs.extend(isToday)
dayjs.extend(isTomorrow)
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
const localeList = dayjs.Ls;
dayjs.updateLocale('de', {
  calendar: {
    sameDay: '[Heute] HH:mm',
    nextDay: '[Morgen!]'
  }
})
dayjs.updateLocale('de', {
  relativeTime: {
    ...localeList['de'].relativeTime,
    future: "In %s",
    dd: "%d Tagen"
  }
})
dayjs.locale('de')

const date = computed(() => {
    const date = dayjs(props.event.date).locale('de');
    return date
})

const time = computed(() => {
    return dayjs(props.event.date).format("HH:mm");
})

const showDatediff = computed(() => {
    return true;
    return dayjs(props.event.date).diff(dayjs(), "day") < 7;
})

const dateDiff = computed(() => {
    if (dayjs(props.event.date).isTomorrow() || dayjs(props.event.date).isToday()) {
        return dayjs(props.event.date).locale('de').calendar();
    }
    return dayjs(props.event.date).locale('de').fromNow();
})

</script>