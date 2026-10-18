<template lang="pug">
.event
    .event-img-wrapper(v-if="imageUrl")
        img.event-img(:src="imageUrl" crossorigin="anonymous")
        .cancelled-stamp(v-if="event.cancelled") ABGESAGT
    .event-header
        h2.date.accent(:class="{ 'date-cancelled': event.cancelled }") {{ date }}{{ isMultiDay ? '' : ' Uhr' }}
        p.datediff.accent(v-if="showDatediff") {{ dateDiff }}
        .cancelled-display(v-if="event.cancelled") ABGESAGT
        h1.accent.title {{ event.title }}
        .event-meta
            a.btn.ticket-btn(v-if="event.shopLink && event.fee && event.feeAk" :href="event.shopLink" target="_blank" rel="noopener")
                span.ticket-price VVK {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }} &nbsp;·&nbsp; AK {{ event.feeAk.endsWith('€') ? event.feeAk : event.feeAk + ' €' }}
                span.ticket-cta Tickets kaufen
            a.btn.ticket-btn(v-else-if="event.shopLink && event.fee" :href="event.shopLink" target="_blank" rel="noopener")
                span.ticket-price Eintritt {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }}
                span.ticket-cta Tickets kaufen
            a.btn.ticket-btn(v-else-if="event.shopLink" :href="event.shopLink" target="_blank" rel="noopener")
                span.ticket-cta Tickets kaufen
            .price-badge(v-else-if="event.fee && event.feeAk") VVK {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }} &nbsp;·&nbsp; AK {{ event.feeAk.endsWith('€') ? event.feeAk : event.feeAk + ' €' }}
            .price-badge(v-else-if="event.fee") Eintritt {{ event.fee.endsWith('€') ? event.fee : event.fee + ' €' }}
        .share-bar
            button.btn.share-btn(@click="shareNative" v-if="canShare") Teilen
            button.btn.share-btn(@click="copyLink") {{ copyLabel }}
    p.description(v-html="event.descriptionLong ? event.descriptionLong : event.descriptionShort")
    template(v-if="event.artists && event.artists.length")
        .artist(v-for="artist in event.artists")
            //- Name appears above the image on mobile, beside it on desktop
            h2.accent.artist-name-mobile {{ artist.name }}
            img.artist-img(v-if="artistImage(artist)" :src="artistImage(artist)" crossorigin="anonymous")
            .artist-text
                h2.accent.artist-name-desktop {{ artist.name }}
                p {{ artist.description }}
            a.btn.band-website-btn(v-if="artist.link" :href="artist.link" target="_blank" rel="noopener") Band-Website
            .bandcamp-container(v-if="artist.bandcamp")
                p.media-label Klingt so:
                iframe.bandcamp(:src="artist.bandcamp" title="Bandcamp player" frameborder="0" width="100%" height="175" seamless)
            template(v-if="artist.youtube")
                p.media-label Video
                .video-container
                    iframe.youtube(:src="artist.youtube" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen)
</template>


<script lang="ts" setup>
import type { Event } from "@/services/events"
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/de'
import dayjs from "dayjs"
import { computed, ref } from "vue"

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
  const start = dayjs(props.event?.date).locale('de')
  if (endDate.value) {
    return `${start.format('DD.MM.YYYY')} – ${endDate.value.format('DD.MM.YYYY')}`
  }
  return start.format("dddd - DD/MM/YYYY - HH:mm")
})

const isMultiDay = computed(() => !!props.event.endDate)

const endDate = computed(() => {
  return props.event.endDate ? dayjs(props.event.endDate).locale('de') : null
})

// Already started but not (yet) past its endDate, e.g. a running exhibition.
const isOngoing = computed(() => {
  if (!endDate.value) return false
  return dayjs().isAfter(dayjs(props.event?.date)) && dayjs().isBefore(endDate.value)
})

const showDatediff = computed(() => {
  if (isOngoing.value) return true
  return dayjs(props.event?.date).diff(dayjs(), "day") < 7
})

const dateDiff = computed(() => {
  if (isOngoing.value && endDate.value) {
    return `Läuft noch bis ${endDate.value.format('DD.MM.YYYY')}`
  }
  return dayjs(props.event?.date).locale('de').fromNow()
})

// Share
const pageUrl = computed(() => window.location.href)
const shareText = computed(() => `${props.event.title} – ${date.value}`)

const canShare = computed(() => typeof navigator.share === 'function')

function shareNative() {
  navigator.share({ title: props.event.title, text: shareText.value, url: pageUrl.value })
    .catch(() => {/* user cancelled – ignore */})
}

const copyLabel = ref('Link kopieren')
function copyLink() {
  navigator.clipboard.writeText(pageUrl.value).then(() => {
    copyLabel.value = 'Kopiert!'
    setTimeout(() => { copyLabel.value = 'Link kopieren' }, 2000)
  })
}
</script>


<style scoped>

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  margin-bottom: 1.5rem;
  width: 100%;
}
.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.bandcamp-container {
  width: 100%;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bandcamp-container iframe {
  width: 100% !important;
  max-width: 780px;
  height: 175px;
  display: block;
}

.media-label {
  font-size: clamp(0.8rem, 1.5vw, 0.95rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 1.5rem 0 0.5rem;
  color: black;
  clear: both;
}

.artist {
    width: 100%;
    clear: both;
}

.artist + .artist {
    margin-top: 3rem;
}

.artist h2 {
    margin: 0 0 1.25rem;
    align-self: center;
}

.event-header {
    overflow: hidden;
}

.event-img-wrapper {
    position: relative;
    float: right;
    margin: 0 0 1rem 1.5rem;
    max-width: min(55%, 460px);
}

@media (max-width: 500px) {
    .event-img-wrapper {
        float: none;
        max-width: 100%;
        margin: 0 0 1rem;
    }
    .event-header {
        overflow: visible;
    }
}

.event-img {
    display: block;
    margin: 0;
    max-width: 100%;
    height: auto;
}

.event::after {
    content: '';
    display: table;
    clear: both;
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
    float: left;
    margin: 0 1.5rem 1rem 0;
    max-width: min(45%, 280px);
    height: auto;
}

.artist-name-mobile {
    display: none;
}

@media (max-width: 500px) {
    .artist-img {
        float: none;
        max-width: 100%;
        margin: 0 0 1rem;
    }
    .artist .artist-name-mobile {
        display: block;
        margin: 0 0 0.75rem;
        text-align: left;
    }
    .artist-name-desktop {
        display: none;
    }
}

.artist-text {
    overflow: hidden;
}

.artist-text h2 {
    margin: 0 0 0.75rem;
    text-align: left;
}

.artist-text p {
    text-align: left;
    line-height: 1.65;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}

.description :deep(p) {
  margin: 0 0 0.9em !important;
  white-space: normal;
}

.description :deep(p:last-child) {
  margin-bottom: 0 !important;
}

/* Flex items default to min-width:auto, which uses the longest unbreakable
   run (e.g. "AAAAaaaahhhh!!!") as a hard minimum and defeats break-word,
   causing horizontal overflow. min-width:0 lets it shrink to the column. */
.description {
  min-width: 0;
  width: 100%;
  text-align: left;
  line-height: 1.65;
  white-space: normal;
}

.artist p {
  text-align: left;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  min-width: 0;
  width: 100%;
}

.share-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
  justify-content: flex-start;
}

.share-btn {
  padding: 0.5em 1.2em;
  font-size: clamp(0.85rem, 1.5vw, 1rem);
  letter-spacing: normal;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.event {
    display: block;
    max-width: 75ch;
    margin: auto;
}

.date {
    font-size: clamp(1.1rem, 5vw, 1.75rem);
    margin: 0 0 0.25rem;
    text-align: left;
}

.datediff {
    font-size: clamp(0.9rem, 2.5vw, 1.2rem);
    margin: 0 0 0.5rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-align: left;
}

.title {
    font-size: clamp(1.5rem, 7vw, 3.5rem);
    margin: 0.5rem 0 1rem;
    text-align: left;
}

.event-meta {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    margin: 0.5rem 0 1rem;
    width: 100%;
}

.price-badge {
    font-size: 1em;
    font-weight: 700;
    letter-spacing: 0.4em;
    background: black;
    color: white;
    padding: 0.7em 1em;
    display: inline-block;
}

.ticket-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 0.35em 1.1em;
    font-size: 0.85em;
    cursor: pointer;
}

.ticket-price {
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.12em;
    opacity: 0.85;
}

.ticket-cta {
    font-size: 1em;
    font-weight: 700;
    letter-spacing: 0.4em;
}

.band-website-btn {
    padding: 0.4em 1.1em;
    font-size: clamp(0.85rem, 1.5vw, 1rem);
    letter-spacing: 0.05em;
    margin-bottom: 1.25rem;
    clear: both;
}

.share-bar-bottom {
    margin-top: 2.5rem;
    padding-top: 2rem;
    border-top: 0.2rem solid black;
    width: 100%;
}

</style>
