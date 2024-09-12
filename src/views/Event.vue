<template lang="pug">
.event
    h2 {{ date }} Uhr
    h1(v-if="showDatediff") {{ dateDiff }}
    h1 {{ event.title }}
    img.event-img(v-if="event.img" :src="event.img")
    p(v-html="event.descriptionLong ? event.descriptionLong : event.descriptionShort")
    h3(v-if="event.fee") Eintritt: {{ event.fee }}
    .artist(v-for="artist in event.artists")
        h2 {{ artist.name }}
        a(v-if="artist.link" :href="artist.link") Im Netz
        p {{ artist.description }}
        .video-container(v-if="artist.youtube")
            iframe.youtube(:src="artist.youtube" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen)
        .bandcamp-container(v-if="artist.bandcamp")
            iframe.bandcamp(:src="artist.bandcamp" title="Bandcamp player" frameborder="0" width="350px" height="786px" seamless)
        //- .soundcloud-container(v-if="artist.soundcloud")
        //-     iframe(width="100%", height="166", scrolling="no", frameborder="no", allow="autoplay", :src="artist.soundcloud")

</template>

<script lang="ts" setup>
import { type Event, events } from "../events";
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/de';
import dayjs from "dayjs";
import { computed } from "vue";
import { eventHash } from "../utils";

const props = defineProps<{id: string}>();

const event = computed(() => {
    return events.find(item => item.id === decodeURI(props.id));
})



dayjs.extend(duration)
dayjs.extend(relativeTime);
dayjs.locale('de')

const date = computed(() => {
    const date = dayjs(event.value?.date).locale('de');
    return date.format("dddd - DD/MM/YYYY - HH")
  
    }
    )

const showDatediff = computed(() => {
    return dayjs(event.value?.date).diff(dayjs(), "day") < 7;
})

const dateDiff = computed(() => {
    return dayjs(event.value?.date).locale('de').fromNow();
})

</script>


<style scoped> 

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
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

.event-img {
    max-width: min(500px, 90vw);
    max-height: min(500px, 90vw);
   }


.event {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 75ch;
    margin: auto;
}

</style>