<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { events } from "../events";
import dayjs from "dayjs";
import EventPreview from "../components/EventPreview.vue";
import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer, LMarker } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const upcoming = computed(() =>
  events
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    // Only show dates that are newer than yesterday
    .filter((item) => item.date_d.isAfter(dayjs().subtract(1, "day")))
    .sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);

const zoom = ref(17);

const img1Current = ref(0);
const img2Current = ref(1);
const visibleImage = ref(0);
const noOfImages = 6;

const imgSrc1 = computed(() => {
  return `/img/logo_animation/${img1Current.value + 1}.jpg`;
});
const imgSrc2 = computed(() => {
  return `/img/logo_animation/${img2Current.value + 1}.jpg`;
});

const styleImg1 = computed(() => ({
  opacity: visibleImage.value === 1 ? 1 : 0,
}));

const styleImg2 = computed(() => 
  ({
    opacity: visibleImage.value === 1 ? 0 : 1
  })
);

let intervalId: number | null = null;

onMounted(() => {
  intervalId = setInterval(() => {
    if (visibleImage.value === 1) {
      img2Current.value = (img2Current.value + 2) % noOfImages;
      visibleImage.value = 2;
    } else {
      img1Current.value = (img1Current.value + 2) % noOfImages;
      visibleImage.value = 1;
    }
  }, 2000);
});

onUnmounted(() => {
  if(intervalId !== null) {
    clearInterval(intervalId);
  }
});
</script>

<template lang="pug">
//- h1 Autohaus Heidelberg
.header-img
  .container
    img.img-animate(:src="imgSrc1", :style="styleImg1") 
    img.img-animate(:src="imgSrc2", :style="styleImg2") 
    img.img-outline(src="/img/logo_outline.svg")
p Wir sind das Carousel im alten Autohaus.
  br 
  | Ein Ort für Musik, Kunst, Kultur für alle.
  br
  a(href="#about") Mehr erfahren

.page-content
  .dates
    h1 Termine
    .empty(v-if="upcoming.length === 0")
      p Aktuell gibt es keine anstehenden Events.
    .event.mb-1(v-else, v-for="event in upcoming", :key="event.id")
      EventPreview(:event="event")

  .newsletter
    h1 Newsletter
    p Abonniere den Newsletter um updates über anstehende Konzerte und Veranstaltungen zu erhalten. Wir senden dir meistens einen Newsletter im Monat über die anstehenden Veranstaltungen und eine Erinnerung am Tag der Veranstaltung.
    .newsletter-form
      #mc_embed_shell
        //- link(href="//cdn-images.mailchimp.com/embedcode/classic-061523.css", rel="stylesheet", type="text/css")
        #mc_embed_signup
          form#mc-embedded-subscribe-form.validate(
            action="https://gmail.us17.list-manage.com/subscribe/post?u=96eb1b394c29f8ffd1ab89b4a&amp;id=83bbee113a&amp;f_id=00f8c2e1f0",
            method="post",
            name="mc-embedded-subscribe-form",
            target="_blank"
          )
            #mc_embed_signup_scroll
              .mc-field-group
                label(for="mce-EMAIL") E-Mail-Adresse
                  |
                  span.asterisk *
                input#mce-EMAIL.required.email(
                  type="email",
                  name="EMAIL",
                  required,
                  value
                )
              #mce-responses.clear.foot
                #mce-error-response.response(style="display: none")
                #mce-success-response.response(style="display: none")
              div(
                style="position: absolute; left: -5000px",
                aria-hidden="true"
              )
                | /* real people should not fill this in and expect good things - do not remove this or risk form bot signups */
                input(
                  type="text",
                  name="b_96eb1b394c29f8ffd1ab89b4a_83bbee113a",
                  tabindex="-1",
                  value
                )
              button#mc-embedded-subscribe.mt-1.button.el-button.el-button--default(
                type="submit",
                value="Anmelden",
                name="subscribe"
              ) Anmelden

  .directions
    h1 Lage
    p Das Carousel im alten Autohaus befindet sich in der 
      |
      a(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Hebelstraße 7
      |
      | am einfachsten mit dem Fahrrad oder mit der Bahn erreichbar, die nächste Haltestelle ist die 
      a(href="https://maps.app.goo.gl/7k4UvxVHtGvHK1NfA") Rudolf-Diesel-Straße
    a.mb-1(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Auf Google Maps öffnen
    .map
      l-map(
        ref="map",
        v-model:zoom="zoom",
        :center="[49.396956872123646, 8.680584425099438]"
      )
        l-tile-layer(
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          layer-type="base",
          name="OpenStreetMap"
        )
        l-marker(:latLng="[49.39666, 8.680584425099438]")

  .past-events
    h1 Vergangene Events
    p Ihr wollt wissen wie die Band gestern oder letzte Woche hieß?
    router-link(:to="{ name: 'pastEvents' }") Hier findet ihr die vergangengen Events

  #about()
    h1 Über uns
    p Unser Ziel ist es niederschwellige Angebote zu schaffen für die lokale Kunst- und Kulturszene.
    p Zum einen bieten wir Kunstschaffenden günstige Proberäume und einen Veranstaltungsort
    p Zum anderen bieten wir Kunstinteressierten günstige Konzerte und Events

  #impressum
    h1 Impressum
    p Verantwortlich für den Inhalt dieser Website:
    p Carousel e.V. - Hebelstraße 7 - 69115 Heidelberg
    a(href="mailto:carouselev@gmail.com") carouselev@gmail.com
    br
    br
    router-link(:to="{ name: 'about' }") Mehr

</template>

<style scoped>

#mce-EMAIL {
  width: 280px;
}

.newsletter-form {
  display: flex;
  justify-content: center;
}

.img-animate {
  position: absolute;
  margin: 0;
  object-fit: cover;
  aspect-ratio: 3.57/1;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  transition: 2s;
  filter: brightness(200%);
  mask-image: url("/img/logo.svg");
  mask-mode: luminance;
  mask-repeat: no-repeat;
  mask-size: contain;
}

.img-outline {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  object-fit: cover;
  aspect-ratio: 3.57/1;
  margin: 0;

}

.header-img {
  display: flex;
  justify-content: center;
  width: 100%;
}

.header-img > .container {
  position: relative;
  margin: 0;
  max-width: 1024px;
  width: 100%;
  aspect-ratio: 3.57/1;
  margin-bottom: 2rem;
  overflow: hidden;
}

.map {
  margin-top: 1rem;
  height: max(300px, 20vh);
  width: 100%;
}

.page-content {
  margin: auto;
  max-width: 75ch;
}

@media screen and (min-width: 150ch) {
  .page-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-width: 200ch;
    grid-gap: 1rem;
    column-gap: 3rem;
    grid-template-areas:
      "dates newsletter"
      "dates past-events"
      "dates directions"
      "dates about"
      "dates impressum";
  }

  .dates {
    grid-area: dates;
  }

  .newsletter {
    grid-area: newsletter;
  }

  .past-events {
    grid-area: past-events;
  }

  .directions {
    grid-area: directions;
  }

  #about {
    grid-area: about;
  }

  #impressum {
    grid-area: impressum;
  }
}
</style>