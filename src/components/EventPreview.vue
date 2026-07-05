

<template lang="pug">
router-link(:to="{name: 'event', params: { id: encodeURI(event.id) }}")
    .event-preview.border
        .title
            span(v-resize-text)
                template(v-for="part in titleParts" :key="part.text")
                    span.title-paren(v-if="part.isParen") {{ part.text }}
                    template(v-else) {{ part.text }}
            .cancelled-label(v-if="event.cancelled") ABGESAGT
        .date()
            .date(v-resize-text="{ratio: 2}" :class="{ 'date-cancelled': event.cancelled }")
                span {{ date.format("dd")  }}.
                span {{ date.format('DD') }}
                span {{ date.format('MMM') }}
                span {{ date.format('YYYY') }}
                span {{ time }}
        .date-diff(ref="dateContainer")
            .side-date-content(ref="dateContent")
                div(v-resize-text={ratio: 2}) {{ dateDiff }}
        .event-img
            img.img(v-if="event.img" :src="event.img" crossorigin="anonymous")
            .cancelled-stamp(v-if="event.cancelled") ABGESAGT
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
    font-size: 2.5rem;
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
    font-size: 1.6rem;
}

.time {
    font-family: "Geologica";
    grid-area: time;
 
}


.title {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Geologica";
    grid-area: title;
    word-break: break-word;
    /* text-align: justify; */
  	hyphens: auto;
    height: 100%;
    width: 100%;
    font-size: 2rem;
    font-stretch: 125%;
    font-weight: 900;
    position: relative;
    padding: 0.3rem;
}

.title-paren {
    font-size: 0.65em;
    color: #888;
    font-weight: 600;
}

.cancelled-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: red;
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
    text-shadow: 0 0 8px rgba(255,255,255,0.8);
}

.date-cancelled {
    text-decoration: line-through;
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
  transition: all 0.2s;
  min-width: 300px;
  max-width: 500px;
  }

@media screen and (max-width: 768px) {
  .event-preview {
    max-width: 100%;
    min-width: unset;
  }
}

.event-preview:hover {
    transform: rotate(2deg) scale(1.02);

}

.event-preview > div {
    background-color: white;
}

.event-img {
    grid-area: img;
    overflow: hidden;
    position: relative;
    align-self: stretch;
}

.event-img::before {
    content: '';
    display: block;
    padding-top: 141.42%;
}

.cancelled-stamp {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    color: red;
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    border: 4px solid red;
    padding: 0.3rem 0.8rem;
    white-space: nowrap;
    pointer-events: none;
    background: rgba(255,255,255,0.15);
}

.img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    object-fit: cover;
}

/* Regular screens (tablets and small desktops) */
@media screen and (min-width: 768px) {
  .title {
    font-size: 2.5rem;
  }

  .date {
    font-size: 2rem;
  }

  .date-diff {
    font-size: 3rem;
  }
}

/* Large screens (large desktops and 4K) */
@media screen and (min-width: 1200px) {
  .title {
    font-size: 3rem;
  }

  .date {
    font-size: 2.4rem;
  }

  .date-diff {
    font-size: 3.5rem;
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
import { computed, onMounted, ref } from "vue";
import { eventHash } from "../utils";
const props = defineProps<{event: Event}>();

const titleParts = computed(() => {
    const parts: { text: string; isParen: boolean }[] = []
    const regex = /([^(]*)\(([^)]*)\)/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(props.event.title)) !== null) {
        if (match[1]) parts.push({ text: match[1], isParen: false })
        parts.push({ text: `(${match[2]})`, isParen: true })
        lastIndex = regex.lastIndex
    }
    if (lastIndex < props.event.title.length) {
        parts.push({ text: props.event.title.slice(lastIndex), isParen: false })
    }
    return parts
})

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