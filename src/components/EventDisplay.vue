<template lang="pug">
.event.fz-event(:class="{ 'no-img': !imageUrl }")
    .event-poster(v-if="imageUrl")
        .event-img-wrapper.fz-photo
            .fz-tape.tl
            .fz-tape.tr
            img.event-img(:src="imageUrl" crossorigin="anonymous")
            .cancelled-stamp(v-if="event.cancelled") ABGESAGT
    .event-header
        router-link.community-stamp.plain-link(v-if="isCommunityEvent" :to="{ name: 'community' }") Community-Treffen · Alle Infos &amp; Mithilfe
        h2.date.fz-event-date(:class="{ 'date-cancelled': event.cancelled }") {{ date }}{{ isMultiDay ? '' : ' Uhr' }}
        p.datediff(v-if="showDatediff") {{ dateDiff }}
        .cancelled-display(v-if="event.cancelled") ABGESAGT
        h1.title {{ event.title }}
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
    .artists(v-if="event.artists && event.artists.length")
        .artist(v-for="artist in event.artists" :class="{ 'has-img': artistImage(artist) }")
            .artist-photo.fz-photo(v-if="artistImage(artist)")
                .fz-tape.tc
                img.artist-img(:src="artistImage(artist)" crossorigin="anonymous")
            .artist-text
                h2.artist-name {{ artist.name }}
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

// Public events.json uses `type`, the admin API `event_type`
const isCommunityEvent = computed(() => {
  const evt = props.event as any
  return (evt.type || evt.event_type) === 'community'
})

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
  const start = dayjs(props.event?.date).locale('de')
  return start.isAfter(dayjs()) ? `Abfahrt ${start.fromNow()}` : `Das war ${start.fromNow()}`
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
/* Layout: Poster links, Text rechts (wie die Titelstory der Startseite); Künstler:innen darunter.
   Der Fanzine-Look (Kopierer-Foto, Klebeband) kommt aus fanzine.css, sobald ein .fz-Elternelement existiert. */
.event {
    display: grid;
    gap: 2rem 3rem;
    align-items: start;
    text-align: left;
    margin: 2.25rem 0 0;
}

@media (min-width: 900px) {
    .event { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
    .event.no-img { grid-template-columns: minmax(0, 1fr); }
    .event .event-poster { align-self: stretch; }
    .event .event-img-wrapper { position: sticky; top: 1.5rem; }
    .event .artists { grid-column: 1 / -1; }
}

.event-img-wrapper {
    margin: 0.5rem 0.5rem 0;
    transform: rotate(-1.4deg);
}

.event-img {
    display: block;
    margin: 0;
    width: 100%;
    height: auto;
}

.event-header { min-width: 0; }

.fz-event-date {
    display: inline-block;
    margin: 0 0 0.6rem;
    padding: 0.2em 0.7em;
    background: #000;
    color: #fff;
    font-size: clamp(0.95rem, 2.2vw, 1.15rem);
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transform: rotate(-1deg);
}

.date-cancelled { text-decoration: line-through; }

.datediff {
    margin: 0 0 0.5rem;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.title {
    margin: 0.4rem 0 1rem;
    font-size: clamp(1.6rem, 3.4vw, 2.4rem);
    font-weight: 900;
    line-height: 1.02;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    hyphens: auto;
}

.community-stamp {
    display: block;
    width: fit-content;
    text-align: left;
    margin: 0 0 0.75rem;
    padding: 0.2rem 0.7rem;
    border: 0.2rem dashed black;
    font-size: clamp(0.8rem, 1.6vw, 0.95rem);
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-1.5deg);
}

.cancelled-display {
    color: red;
    font-size: clamp(2rem, 8vw, 4rem);
    font-weight: 900;
    letter-spacing: 0.1em;
    font-family: "Geologica";
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

.event-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0 1rem;
}

.price-badge {
    display: inline-block;
    padding: 0.7em 1em;
    background: black;
    color: white;
    font-weight: 700;
    letter-spacing: 0.3em;
}

.ticket-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 0.45em 1.1em;
    font-size: 0.85em;
    cursor: pointer;
}

.ticket-price {
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.12em;
}

.ticket-cta {
    font-weight: 700;
    letter-spacing: 0.3em;
}

.share-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0 1.5rem;
}

.share-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.45em 0.9em;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    cursor: pointer;
}

/* Beschreibung kommt als HTML aus dem Editor; min-width:0 verhindert Überlauf durch lange Wörter */
.description {
    min-width: 0;
    max-width: 70ch;
    text-align: left;
    line-height: 1.65;
    white-space: normal;
    overflow-wrap: break-word;
}

.description :deep(p) {
    margin: 0 0 0.9em !important;
    white-space: normal;
}

.description :deep(p:last-child) { margin-bottom: 0 !important; }

/* ---------- Künstler:innen ---------- */
.artists {
    display: grid;
    gap: 3rem;
    padding-top: 2rem;
    border-top: 0.25rem solid #000;
}

.artist {
    display: grid;
    gap: 1.25rem 2.5rem;
    align-items: start;
}

@media (min-width: 700px) {
    .artist.has-img { grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); }
}

.artist-photo {
    margin: 0.5rem;
    transform: rotate(1.2deg);
}

.artist:nth-child(even) .artist-photo { transform: rotate(-1.2deg); }

.artist-img {
    display: block;
    margin: 0;
    width: 100%;
    height: auto;
}

.artist-text { min-width: 0; }

.artist-name {
    margin: 0 0 0.75rem;
    font-size: clamp(1.4rem, 3.2vw, 1.7rem);
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    overflow-wrap: anywhere;
}

.artist-text p {
    max-width: 70ch;
    text-align: left;
    line-height: 1.65;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}

.band-website-btn {
    margin: 1rem 0 0.5rem;
    padding: 0.45em 0.9em;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
}

.media-label {
    margin: 1.5rem 0 0.5rem;
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.bandcamp-container { width: 100%; max-width: 780px; margin-bottom: 1rem; }
.bandcamp-container iframe { width: 100% !important; display: block; height: 175px; }

.video-container {
    position: relative;
    width: 100%;
    max-width: 780px;
    padding-bottom: min(56.25%, 438px);
    height: 0;
    margin-bottom: 1rem;
}

.video-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>
