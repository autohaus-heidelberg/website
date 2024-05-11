<script setup lang="ts">
import { computed } from "vue";
import { events } from "../events";
import dayjs from "dayjs";
import EventPreview from "../components/EventPreview.vue";

const upcoming = computed(() => events
  .map(item => ({...item, date_d: dayjs(item.date) }) )
  // Only show dates that are newer than yesterday
  .filter(item => item.date_d.isAfter(dayjs().subtract(1, "day")))
  .sort((a,b) => a.date_d.isAfter(b.date_d) ? 1 : -1));

</script>

<template lang="pug">
h1 Autohaus Heidelberg
p Wir sind das Carousel im alten Autohaus.
  br 
  | Ein Ort für Musik, Kunst, Kultur und alles was Spaß macht.
  
h1 Termine
.event.mb-1(v-for="event in upcoming")
  EventPreview( :event="event")

h1 Newsletter
p Abonniere den Newsletter um updates über anstehende Konzerte und Veranstaltungen zu erhalten. Wir senden dir meistens einen Newsletter im Monat über die anstehenden Veranstaltungen und eine Erinnerung am Tag der Veranstaltung.
.newsletter-form
  div(id="mc_embed_shell")
    link(href="//cdn-images.mailchimp.com/embedcode/classic-061523.css", rel="stylesheet", type="text/css")
    div(id="mc_embed_signup")
      form#mc-embedded-subscribe-form.validate(action="https://gmail.us17.list-manage.com/subscribe/post?u=96eb1b394c29f8ffd1ab89b4a&amp;id=83bbee113a&amp;f_id=00f8c2e1f0", method="post",  name="mc-embedded-subscribe-form", target="_blank")
        div(id="mc_embed_signup_scroll")
          .mc-field-group
            label(for="mce-EMAIL") E-Mail-Adresse 
              span.asterisk *
            input#mce-EMAIL.required.email(type="email", name="EMAIL", required, value)
          #mce-responses.clear.foot
            #mce-error-response.response(style="display: none;")
            #mce-success-response.response(style="display: none;")
          div(style="position: absolute; left: -5000px;", aria-hidden="true")
            | /* real people should not fill this in and expect good things - do not remove this or risk form bot signups */
            input(type="text", name="b_96eb1b394c29f8ffd1ab89b4a_83bbee113a", tabindex="-1", value)
          button.mt-1(type="submit" value="Anmelden" name="subscribe" id="mc-embedded-subscribe" class="button el-button el-button--default") Anmelden

h1 Impressum
p Verantwortlich für den Inhalt dieser Website: 
p Leo Reich - Plöck 85 - 69117
a(href="mailto:autohaus.heidelberg@gmail.com") autohaus.heidelberg@gmail.com
</template>

<style scoped>
.newsletter-form {
  display: flex;
  justify-content: center;
}
</style>