<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { events } from "../events";
import dayjs from "dayjs";
import EventPreview from "../components/EventPreview.vue";
import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer, LMarker } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import CircularLogo from "../components/CircularLogo.vue"


const upcoming = computed(() =>
  events
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    // Only show dates that are newer than yesterday
    .filter((item) => item.date_d.isAfter(dayjs().subtract(1, "day")))
    .sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);

const upComingHighlights = computed(() => {
  // NOTE: we restrict the large events to 3 or the first one without image. Other events are show in the smaller overview
return upcoming.value.reduce((acc, event) => {
  if (acc.length < 3 && event.img) {
    acc.push(event);
  }
  return acc;
}, []);
})

const upComingSmall = computed(() => 
  upcoming.value.filter(item => !upComingHighlights.value.some(up => up.id === item.id))
);

const zoom = ref(17);


const logoContainer = ref(null);

onMounted(() => {
  // NOTE: if there is no timeout, the font will appear larger, I don't know why
  // 50 works on what I could test, slower rendering might still make weird circles
  setTimeout(setLogoHeight, 50)
  window.addEventListener("resize", setLogoHeight);
});

onUnmounted(() => {
  window.removeEventListener("resize", setLogoHeight);
})

const logoHeight = ref(100);

function setLogoHeight() {
  const diameter = Math.min(window.screen.width - 100, 600);
  logoHeight.value = diameter;
  logoContainer.value.style.height = `${diameter}px`;

}

</script>

<template lang="pug">
//- h1 Autohaus Heidelberg
.l-center
  .logo-container(ref="logoContainer")
    //- .video
    //-   video(autoplay loop muted :height="logoHeight")
    //-     source(src="/header_video.mp4")
    CircularLogo(:diameter="logoHeight" :key="logoHeight")
    //- img.img-animate(:src="imgSrc1", :style="styleImg1") 
    //- img.img-animate(:src="imgSrc2", :style="styleImg2") 
    //- img.img-outline(src="/img/logo_outline.svg")
p Wir sind das Carousel im alten Autohaus.
  br 
  | Ein gemeinnütziger Verein zur Förderung von Livemusik und allem was dazu gehört. 
  br
  //- a(href="#about") Mehr erfahren

.page-content
  .dates
    h1 Termine
    .empty(v-if="upcoming.length === 0")
      p Aktuell gibt es keine anstehenden Events.
    .event.mb-1(v-else, v-for="event in upComingHighlights", :key="event.id")
      EventPreview(:event="event")

    template(v-if="upComingSmall.length > 0")
      h1 Noch mehr
      .events-small-container()
        .events-small(v-for="ev in upComingSmall" :key="ev.id")
          .date {{ dayjs(ev.date).format('dddd, DD. MMMM YYYY') }}
          router-link(:to="{name: 'event', params: { id: encodeURI(ev.id) }}")
            label {{ev.title}}

  .content
    .newsletter
      h1 Newsletter
      p Abonniere den Newsletter um updates über anstehende Konzerte und Veranstaltungen zu erhalten. 
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
        br
        br
        a(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Hebelstraße 7
        br
        br
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
      router-link(:to="{ name: 'pastEvents' }") 
        button Vergangenge Events

    #about
      h1 Über uns
      p Wir sind ein gemeinnütziger Verein, getragen von ehrenamtlicher Arbeit. 
      p Unser Ziel ist die Förderung von Livemusik in Heidelberg.  

    //- #anfragen
    //-   h1 Anfragen
    //-   p Für anfragen verwendet bitte unser Anfragenformular. Anfragen per E-Mail werden wir wahrscheinlich nicht sehen. 
    //-   router-link(:to="{ name: 'requests' }")
    //-     button Anfragenformular 

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
  width: 100%;
  height: 3em
}



.events-small {

  display: grid;
  grid-template-columns: 1fr 2fr;

    font-weight: 900;
    font-size: clamp(1.6rem, 3vw, 4rem);

    align-items: center;
    grid-gap: 0.5rem;
    border: 0.5rem solid;
  margin-top: -0.5rem;
    background-color: var(--text-color);


  transform: rotate(1deg);

}

.events-small > * {
  padding: 1rem;
  background-color: var(--background-color);
  height: 100%;
  width: 100%;
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
  max-width: min(95vw, 2048px);
}



.logo-container {
  height: 500px;
  width: 0;
  color: var(--link-color)
}



.video {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  filter: brightness(70%);
}

.video > video {
    max-width: 100vw;

}

.l-center {
  display: flex;
  justify-content: center;
}


@media screen and (min-width: 800px) {
  .page-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-width: 2048;
    grid-gap: 1rem;
    column-gap: 3rem;
    grid-template-areas:
      "dates content"
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