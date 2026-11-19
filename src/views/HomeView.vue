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
import FanzineBurst from "@/components/FanzineBurst.vue";
import { PLAKETTE_TAPS, nextInspection } from "@/utils/plakette";
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
// Bei genau einer Nebenstory bekommt sie denselben Aufbau wie die Titelstory (statt halb leerer Kachelreihe)
const stories = computed(() =>
  (!feature.value ? [] : picks.value.length === 1 ? [feature.value, picks.value[0]] : [feature.value]).map((s) => ({
    ...s,
    cd: countdown(s.date_d),
  }))
);
const sidePicks = computed(() => (picks.value.length === 1 ? [] : picks.value));
const toc = computed(() =>
  upcoming.value.slice(1).filter((e) => !picks.value.some((p) => p.id === e.id))
);

// Zeit bis zum Event in Kalendertagen, als Edding-Notiz am Datum des nächsten Events
const countdown = (d: dayjs.Dayjs) => {
  const days = d.startOf("day").diff(dayjs().startOf("day"), "day");
  if (days <= 0) return "heute!";
  if (days === 1) return "morgen!";
  return `in ${days} Tagen!`;
};

// Handgezogene Ellipse (leicht überlappend), wird per preserveAspectRatio="none" auf die Datumsbreite gestreckt
const MARK_RING = (() => {
  const w = 300;
  const h = 60;
  let d = "";
  for (let t = 0.15, i = 0; t < Math.PI * 2 * 1.1; t += 0.09, i++) {
    const k = 1 - 0.035 * (t / (Math.PI * 2)) + 0.012 * Math.sin(t * 3.1);
    const x = w / 2 + (w / 2 - 4) * Math.cos(t + Math.PI * 0.9) * k;
    const y = h / 2 + (h / 2 - 3) * Math.sin(t + Math.PI * 0.9) * k;
    d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return d;
})();

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

// Easter Egg: mehrfach auf den Spruch in der Kopfleiste tippen → Prüfstempel auf dem Cover
const plaketteTaps = ref(0);
const stamped = computed(() => plaketteTaps.value >= PLAKETTE_TAPS);
const nextHu = nextInspection();

const wantedFallback = wantedLine([]);

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
      span.fz-egg(@click="plaketteTaps++") Gebraucht, aber gut in Schuss
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
              @keydown.space.prevent="censorOpen = !censorOpen"
            ) {{ part.censor }}
            template(v-else) {{ part.text }}
        .fz-cover-cta
          router-link.btn(:to="{ name: 'calendar' }") Kalender
          router-link.btn(:to="{ name: 'community' }") Mach mit!
      button.fz-plakette(v-if="stamped" type="button" title="Antippen zum Entfernen" @click="plaketteTaps = 0")
        span.pl-ring
          span.pl-top Hauptuntersuchung
          span.pl-main Bestanden
          span.pl-sub Ohne Mängel*
          span.pl-date Nächste HU {{ nextHu }}
        span.pl-foot *Wir können für nichts garantieren.

  //- ===== Programm =====
  section.fz-section#programm
    .fz-label Das Programm

    .fz-empty(v-if="!feature && ongoing.length === 0") Gerade steht nichts auf der Hebebühne. Kein Grund zur Panik: Newsletter abonnieren, dann erfahrt ihr als Erste, wann es wieder kracht.

    router-link.plain-link.fz-feature(
      v-for="(story, i) in stories"
      :key="story.id"
      :to="eventLink(story.id)"
      :class="{ 'no-img': !story.img, 'is-second': i > 0 }"
    )
      .fz-photo(v-if="story.img")
        .fz-tape.tl
        .fz-tape.tr
        img(:src="story.img" :alt="story.title" crossorigin="anonymous")
      div
        .fz-feature-date(:class="{ 'has-note': i === 0 && !story.cancelled }")
          | {{ story.date_d.format('dddd, DD. MMMM') }} · {{ story.date_d.format('HH:mm') }} Uhr
          template(v-if="i === 0 && !story.cancelled")
            svg.fz-mark-ring(viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true" focusable="false")
              path(:d="MARK_RING")
            svg.fz-mark-arrow(viewBox="0 0 60 50" aria-hidden="true" focusable="false")
              path(d="M50,4 C40,10 28,18 20,38 M20,38 L16,26 M20,38 L31,32")
            span.fz-mark-note {{ story.cd }}
        h2.fz-feature-title(:class="{ 'fz-cancelled': story.cancelled }")
          span.fz-cancelled-tag(v-if="story.cancelled") Abgesagt
          | {{ story.title }}
        p.fz-teaser(v-if="teaser(story.descriptionShort)") {{ teaser(story.descriptionShort) }}
        span.btn Weiterlesen

    .fz-picks(v-if="sidePicks.length")
      router-link.plain-link.fz-pick(v-for="ev in sidePicks" :key="ev.id" :to="eventLink(ev.id)")
        .fz-photo
          .fz-tape.tc
          img(:src="ev.img" :alt="ev.title" crossorigin="anonymous")
        .fz-pick-date {{ ev.date_d.format('dd, DD.MM.') }} · {{ ev.date_d.format('HH:mm') }} Uhr
        h3.fz-pick-title(:class="{ 'fz-cancelled': ev.cancelled }") {{ ev.title }}

    .fz-box.fz-ongoing.fz-dots(v-if="ongoing.length")
      .fz-stamp Läuft aktuell
      router-link(v-for="ev in ongoing" :key="ev.id" :to="eventLink(ev.id)") {{ ev.title }} (bis {{ ev.date_d.format('DD.MM.') }})

    template(v-if="toc.length")
      .fz-sub
        .fz-label Doch damit nicht genug
        ul.fz-toc
          li(v-for="ev in toc" :key="ev.id")
            router-link.plain-link(:to="eventLink(ev.id)")
              span.toc-date {{ ev.date_d.format('dd DD.MM.') }}
              span.toc-title(:class="{ 'fz-cancelled': ev.cancelled }") {{ ev.title }}
              span.toc-lead
              span.toc-time {{ ev.date_d.format('HH:mm') }}

    nav.fz-more(aria-label="Weiterblättern")
      .fz-more-label Weiterblättern
      router-link.btn(:to="{ name: 'flyerGallery' }") Flyer-Galerie
      router-link.btn(:to="{ name: 'pastEvents' }") Vergangene Events
      router-link.btn(:to="{ name: 'calendar' }") Termine abonnieren

  //- ===== Community-Teaser =====
  aside.fz-cut.fz-community#community
    FanzineBurst.on-box Du fehlst!
    .fz-stamp Community
    .fz-community-grid
      div
        h2.fz-h2(style="margin-top: 0.75rem") Der Laden läuft nicht von allein.
        p Keine Chefetage, kein Sponsor, kein doppelter Boden. Jeder Abend hier wird von Leuten wie dir gemacht: an der Tür, hinter der Bar, am Mischpult. Drei Wege rein:
        ol.fz-door-links
          li(v-for="d in doors" :key="d.id")
            router-link(:to="{ name: 'community', hash: '#mitmachen' }") {{ d.title }}
        .btn-row
          router-link.btn(:to="{ name: 'community' }") Zur Community-Seite
          a.btn(:href="mailto(support.subject)") Uns unterstützen
      .fz-ad
        .fz-ad-head Kleinanzeigen · Gesuche
        .fz-ad-body
          .fz-ad-row
            b.fz-ad-key SUCHE
            ul.fz-ad-list(v-if="helpRequests.length")
              li(v-for="h in helpRequests" :key="h.title")
                span.fz-hl {{ h.title }}
            span(v-else)
              span.fz-hl {{ wantedFallback }}
          .fz-ad-row
            b.fz-ad-key BIETE
            span Bier, Applaus, nette Leute. VB.
        p.fz-ad-foot Zuschriften unter Chiffre HD-CA oder
          |  
          a(:href="mailto('Mithilfe im Verein')") per Mail
          | .
      .fz-community-next
        .lbl Nächstes Vereinstreffen
        template(v-if="nextMeeting")
          router-link(:to="eventLink(nextMeeting.id)") {{ nextMeeting.date_d.format('dddd, DD.MM. · HH:mm') }} Uhr – {{ nextMeeting.title }}
          p.fz-community-note Öffentlicher Teil, offene Tür: für alle, die im Carousel selbst was anzetteln wollen.
        p(v-else) Noch kein Termin angesetzt. Sobald einer steht, hängt er hier und im Kalender.

  //- ===== Gut zu wissen =====
  section.fz-section.fz-page.fz-info
    .fz-label Gut zu wissen

    .fz-box.directions#lage
      h2.fz-h2 Lage
      p Das Carousel im alten Autohaus befindet sich in der
        |  
        a(href="https://maps.app.goo.gl/Dp9BHeBE5aU8KwQH6") Hebelstraße 7
        | , am einfachsten mit dem Fahrrad oder der Bahn erreichbar. Nächste Haltestelle:
        |  
        a(href="https://maps.app.goo.gl/7k4UvxVHtGvHK1NfA") Rudolf-Diesel-Straße
        | .
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

    .fz-box#newsletter
      h2.fz-h2 Newsletter
      p Abonniere den Newsletter, um Updates über anstehende Konzerte und Veranstaltungen zu erhalten.
      button.rm-open-popup Newsletter abonnieren

    .fz-box#anfragen
      h2.fz-h2 Anfragen
      p Booking-, Veranstaltungs- und Raumanfragen bitte nur über unser Anfragenformular. Per E-Mail gehen sie bei uns leicht unter.
      router-link.btn(:to="{ name: 'requests' }") Anfragenformular

  //- ===== Kleingedrucktes =====
  section.fz-section.fz-page.fz-print
    .fz-label Kleingedrucktes

    #about
      .fz-about-head
        h2.fz-h2 {{ about.title }}
        .fz-lang(role="group" aria-label="Sprache")
          button.btn.fz-toggle(:class="{ on: lang === 'de' }" :aria-pressed="lang === 'de'" @click="lang = 'de'") DE
          button.btn.fz-toggle(:class="{ on: lang === 'en' }" :aria-pressed="lang === 'en'" @click="lang = 'en'") EN
      p(v-for="(para, i) in about.paragraphs" :key="i" :lang="lang") {{ para }}

    #impressum
      h2.fz-h2 Impressum
      p Verantwortlich für den Inhalt dieser Website:
      p Carousel e.V. – Hebelstraße 7 – 69115 Heidelberg
      p
        a(href="mailto:carouselev@gmail.com") carouselev@gmail.com
      p
        router-link(:to="{ name: 'about' }") Mehr
</template>
