<template lang="pug">
.event
    h2.date.accent(:class="{ 'date-cancelled': event.cancelled }") {{ date }} Uhr
    h1.accent(v-if="showDatediff") {{ dateDiff }}
    .cancelled-display(v-if="event.cancelled") ABGESAGT
    h1.accent {{ event.title }}
    .event-img-wrapper(v-if="imageUrl")
        img.event-img(:src="imageUrl" crossorigin="anonymous")
        .cancelled-stamp(v-if="event.cancelled") ABGESAGT
    p.description(v-html="event.descriptionLong ? event.descriptionLong : event.descriptionShort")
    h3(v-if="event.fee && event.feeAk") Eintritt: VVK: {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }} / AK: {{ event.feeAk.endsWith('€') ? event.feeAk : event.feeAk + ' €' }}
    h3(v-else-if="event.fee") Eintritt: {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }}
    .get-ticket(v-if="event.shopLink")
        a(:href="event.shopLink")
            button() Tickets kaufen
    .artist(v-for="artist in event.artists")
        h2.accent {{ artist.name }}
        img.artist-img(v-if="artistImage(artist)" :src="artistImage(artist)" crossorigin="anonymous")
        a(v-if="artist.link" :href="artist.link") Band website
        p {{ artist.description }}
        .video-container(v-if="artist.youtube")
            iframe.youtube(:src="artist.youtube" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen)
        .bandcamp-container(v-if="artist.bandcamp")
            iframe.bandcamp(:src="artist.bandcamp" title="Bandcamp player" frameborder="0" width="350px" height="470px" seamless)
</template>


<script lang="ts" setup>
import type { Event } from "@/services/events"
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/de'
import dayjs from "dayjs"
import { computed } from "vue"

const props = defineProps<{ event: Event }>()

dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.locale('de')

// Handle both image_url (new API) and img (old static) properties
const imageUrl = computed(() => {
  const evt = props.event as any
  return evt.image_url || evt.img
})

// Handle both image_url and image properties for artists
const artistImage = (artist: any) => {
  return artist.image_url || artist.image
}

const date = computed(() => {
  const date = dayjs(props.event?.date).locale('de')
  return date.format("dddd - DD/MM/YYYY - HH:mm")
})

const showDatediff = computed(() => {
  return dayjs(props.event?.date).diff(dayjs(), "day") < 7
})

const dateDiff = computed(() => {
  return dayjs(props.event?.date).locale('de').fromNow()
})
</script>


<style scoped>

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  margin-bottom: 2rem;
}
.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.artist {
    width: 100%;
}

.event-img-wrapper {
    position: relative;
    display: inline-block;
}

.event-img {
    display: block;
    max-width: min(500px, 90vw);
    max-height: min(500px, 90vw);
    width: auto;
    height: auto;
}

.date-cancelled {
    text-decoration: line-through;
}

.cancelled-display {
    color: red;
    font-size: clamp(2rem, 8vw, 4rem);
    font-weight: 900;
    letter-spacing: 0.1em;
    font-family: "Geologica";
    text-align: center;
}

.cancelled-stamp {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    color: red;
    font-size: clamp(2rem, 6vw, 3.5rem);
    font-weight: 900;
    letter-spacing: 0.15em;
    border: 5px solid red;
    padding: 0.5rem 1.5rem;
    white-space: nowrap;
    pointer-events: none;
    background: rgba(255,255,255,0.15);
}

.artist-img {
    margin: auto;
    max-width: min(500px, 90vw);
    max-height: min(500px, 90vw);
    margin-bottom: 2rem;
}

.description :deep(p) {
  margin: 0 !important;
}

.event {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 75ch;
    margin: auto;
}

</style>
