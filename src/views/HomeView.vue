<script setup lang="ts">
import { computed, ref } from "vue";
import { events } from "../events";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/de";
import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer, LMarker } from "@vue-leaflet/vue-leaflet";
import { isPastEvent } from "@/utils/eventTime";
import { communityOnly, concertsOnly, helpRequests } from "@/utils/community";
import { stripHtml } from "@/utils/calendar";
import { ransomChars } from "@/utils/ransom";
import { claim } from "@/utils/claims";
import { doors, mailto, support, wantedLine } from "@/utils/communityContent";
import { aboutTexts, type AboutLang } from "@/utils/about";
import { useAuthStore } from "@/stores/auth";

dayjs.extend(relativeTime);
dayjs.locale("de");

const authStore = useAuthStore();

const concerts = concertsOnly(events);

// Multi-day events (e.g. exhibitions) that already started but aren't over yet.
const ongoing = computed(() =>
  concerts
    .filter((item) => item.endDate && dayjs(item.date).isBefore(dayjs()) && dayjs(item.endDate).isAfter(dayjs()))
    .map((item) => ({ ...item, date_d: dayjs(item.endDate) }))
    .sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);

const upcoming = computed(() =>
  concerts
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    .filter((item) => !isPastEvent(item))
    // Already-started multi-day events are shown in the "Läuft aktuell" box instead
    .filter((item) => !ongoing.value.some((o) => o.id === item.id))
    .sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);

// Titelstory = nächster Termin, Nebenstories = die nächsten (max. 2) mit Bild, Rest im Inhaltsverzeichnis
const feature = computed(() => upcoming.value[0]);
const picks = computed(() => upcoming.value.slice(1).filter((e) => e.img).slice(0, 2));
const toc = computed(() =>
  upcoming.value.slice(1).filter((e) => !picks.value.some((p) => p.id === e.id))
);

const nextMeeting = computed(() =>
  communityOnly(events)
    .map((item) => ({ ...item, date_d: dayjs(item.date) }))
    .filter((item) => !isPastEvent(item) && !item.cancelled)
    .sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))[0]
);

const teaser = (html?: string) => (html ? stripHtml(html) : "");
const eventLink = (id: string) => ({ name: "event", params: { id: encodeURI(id) } });

const issueNo = dayjs().format("MM/YY");
const issueMonth = dayjs().format("MMMM");
const titleLines = ["Carousel", "im alten Autohaus"];

const censorOpen = ref(false);

const wanted = computed(() => wantedLine(helpRequests.map((h) => h.title)));

const lang = ref<AboutLang>("de");
const about = computed(() => aboutTexts[lang.value]);

const zoom = ref(17);
</script>

<template lang="pug">
.fz
  router-link.fz-admin.plain-link(v-if="authStore.accessToken" :to="{ name: 'admin-dashboard' }" title="Admin – hier geht's hinter die Kulissen" aria-label="Admin") (A)
  //- ===== Cover =====
  header.fz-masthead
    .fz-strip
      span Nr. {{ issueNo }} · {{ issueMonth }}
      span Kopiert &amp; geklebt im Alten Autohaus · Heidelberg
      span Gebraucht, aber gut in Schuss
    .fz-cover
      h1.fz-title(aria-label="Carousel im alten Autohaus")
        span.fz-line(v-for="(line, li) in titleLines" :key="li" aria-hidden="true")
          span.fz-ch(v-for="(c, i) in ransomChars(line, li)" :key="i" :class="c.cls") {{ c.ch }}
      .fz-cover-side
        p.fz-claim
          template(v-for="(part, i) in claim" :key="i")
            span.fz-censor(
              v-if="'censor' in part"
              :class="{ open: censorOpen }"
              role="button"
              tabindex="0"
              title="Antippen zum Aufdecken"
              @click="censorOpen = !censorOpen"
              @keydown.enter.prevent="censorOpen = !censorOpen"
            ) {{ part.censor }}
            template(v-else) {{ part.text }}
        .fz-cover-cta
          router-link.btn(:to="{ name: 'calendar' }") Kalender
          router-link.btn(:to="{ name: 'community' }") Mach mit!

  //- ===== Programm =====
  section.fz-section#programm
    .fz-label Das Programm

    .fz-empty(v-if="!feature && ongoing.length === 0") Werkstattpause: Aktuell ist kein Termin geplant. Pannenhilfe: Newsletter abonnieren oder bald wieder reinschauen.

    router-link.plain-link.fz-feature(
      v-if="feature"
      :to="eventLink(feature.id)"
      :class="{ 'no-img': !feature.img }"
    )
      .fz-photo(v-if="feature.img")
        .fz-tape.tl
        .fz-tape.tr
        img(:src="feature.img" :alt="feature.title" crossorigin="anonymous")
      div
        .fz-feature-date {{ feature.date_d.format('dddd, DD. MMMM') }} · {{ feature.date_d.format('HH:mm') }} Uhr
        h2.fz-feature-title(:class="{ 'fz-cancelled': feature.cancelled }")
          span.fz-cancelled-tag(v-if="feature.cancelled") Abgesagt
          | {{ feature.title }}
        p.fz-teaser(v-if="teaser(feature.descriptionShort)") {{ teaser(feature.descriptionShort) }}
        p.fz-feature-diff Abfahrt {{ feature.date_d.fromNow() }}
        span.btn Zum Artikel

    .fz-picks(v-if="picks.length")
      router-link.plain-link.fz-pick(v-for="ev in picks" :key="ev.id" :to="eventLink(ev.id)")
        .fz-photo
          .fz-tape.tc
          img(:src="ev.img" :alt="ev.title" crossorigin="anonymous")
        .fz-pick-date {{ ev.date_d.format('dd, DD.MM.') }} · {{ ev.date_d.format('HH:mm') }} Uhr
        h3.fz-pick-title(:class="{ 'fz-cancelled': ev.cancelled }") {{ ev.title }}

    .fz-box.fz-ongoing(v-if="ongoing.length")
      .fz-stamp Läuft aktuell
      router-link(v-for="ev in ongoing" :key="ev.id" :to="eventLink(ev.id)") {{ ev.title }} (bis {{ ev.date_d.format('DD.MM.') }})

    template(v-if="toc.length")
      h2.fz-h2(style="margin-top: 3rem") Außerdem im Programm
      ul.fz-toc(style="margin-top: 1rem")
        li(v-for="ev in toc" :key="ev.id")
          router-link.plain-link(:to="eventLink(ev.id)")
            span.toc-date {{ ev.date_d.format('dd DD.MM.') }}
            span.toc-title(:class="{ 'fz-cancelled': ev.cancelled }") {{ ev.title }}
            span.toc-lead
            span.toc-time {{ ev.date_d.format('HH:mm') }}

    nav.fz-more(aria-label="Weiterblättern")
      .fz-more-label Weiterblättern
      router-link.btn(:to="{ name: 'calendar' }") Alle Termine im Kalender
      router-link.btn(:to="{ name: 'pastEvents' }") Vergangene Events
      router-link.btn(:to="{ name: 'flyerGallery' }") Flyer-Galerie

  //- ===== Community-Teaser =====
  aside.fz-cut.fz-community#community
    .fz-stamp Community
    .fz-community-grid
      div
        h2.fz-h2(style="margin-top: 0.75rem") Mach mit! Der Laden lebt vom Ehrenamt.
        p Wir sind ein Verein ohne Chef:innen und ohne Geld im Rücken. Hier wird alles von Leuten wie dir gemacht. Drei Wege, mitzumachen:
        ol.fz-door-links
          li(v-for="d in doors" :key="d.id")
            router-link(:to="{ name: 'community', hash: '#mitmachen' }") {{ d.title }}
      .fz-ad
        .fz-ad-head Kleinanzeigen · Gesuche
        p
          b SUCHE:
          |  {{ wanted }}.
        p
          b BIETE:
          |  Bier, Applaus, nette Leute. VB.
        p.fz-ad-foot Zuschriften unter Chiffre HD-CA oder
          |  
          a(:href="mailto('Mithilfe im Verein')") per Mail
          | .
    .fz-community-next
      .lbl Nächstes Vereinstreffen
      template(v-if="nextMeeting")
        router-link(:to="eventLink(nextMeeting.id)") {{ nextMeeting.date_d.format('dddd, DD.MM. · HH:mm') }} Uhr – {{ nextMeeting.title }}
        p.fz-community-note Der öffentliche Teil ist offen für alle, die im Carousel etwas auf die Beine stellen wollen.
      p(v-else) Werkstattpause: Aktuell ist kein Vereinstreffen angekündigt. Neue Termine erscheinen hier und im Kalender.
    .btn-row
      router-link.btn(:to="{ name: 'community' }") Zur Community-Seite
      a.btn(:href="mailto(support.subject)") Uns unterstützen

  //- ===== Rubriken =====
  .fz-rubriken
    .fz-box.r-narrow#newsletter
      h2.fz-h2 Newsletter
      p Abonniere den Newsletter, um Updates über anstehende Konzerte und Veranstaltungen zu erhalten.
      button.rm-open-popup Newsletter abonnieren

    .fz-box.r-wide.directions#lage
      h2.fz-h2 Lage
      p Das Carousel im alten Autohaus befindet sich in der
        |  
        a(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Hebelstraße 7
        | , am einfachsten mit dem Fahrrad oder der Bahn erreichbar. Nächste Haltestelle:
        |  
        a(href="https://maps.app.goo.gl/7k4UvxVHtGvHK1NfA") Rudolf-Diesel-Straße
        | .
      p.fz-service
        b Serviceleistung:
        |  Fahrrad oder Bahn – wir sind ein Autohaus, kein Parkhaus.
      .fz-map
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
      a.btn(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Auf Google Maps öffnen

    #about.fz-cut.r-half
      .fz-lang(role="group" aria-label="Sprache")
        button.btn.fz-toggle(:class="{ on: lang === 'de' }" :aria-pressed="lang === 'de'" @click="lang = 'de'") DE
        button.btn.fz-toggle(:class="{ on: lang === 'en' }" :aria-pressed="lang === 'en'" @click="lang = 'en'") EN
      h2.fz-h2 {{ about.title }}
      p(v-for="(para, i) in about.paragraphs" :key="i" :lang="lang") {{ para }}

    #anfragen.fz-box.r-half
      h2.fz-h2 Anfragen
      p Für Anfragen verwendet bitte unser Anfragenformular. Anfragen per E-Mail werden wir wahrscheinlich nicht sehen.
      router-link.btn(:to="{ name: 'requests' }") Anfragenformular

    #impressum.fz-cut.r-full.fz-colophon
      h2.fz-h2 Impressum
      p Verantwortlich für den Inhalt dieser Website:
      p Carousel e.V. – Hebelstraße 7 – 69115 Heidelberg
      p
        a(href="mailto:carouselev@gmail.com") carouselev@gmail.com
      p
        router-link(:to="{ name: 'about' }") Mehr
</template>
