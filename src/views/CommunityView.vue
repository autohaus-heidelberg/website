<script setup lang="ts">
import { computed, ref } from "vue";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { events } from "../events";
import { isPastEvent } from "@/utils/eventTime";
import { communityOnly, helpRequests } from "@/utils/community";
import { ransomChars } from "@/utils/ransom";
import FanzineNav from "@/components/FanzineNav.vue";

dayjs.locale("de");

const meetings = communityOnly(events).map((item) => ({ ...item, date_d: dayjs(item.date) }));
const upcoming = computed(() =>
  meetings.filter((m) => !isPastEvent(m)).sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);
const past = computed(() =>
  meetings.filter((m) => isPastEvent(m)).sort((a, b) => (a.date_d.isAfter(b.date_d) ? -1 : 1)).slice(0, 5)
);

const eventLink = (id: string) => ({ name: "event", params: { id: encodeURI(id) } });
const issueNo = dayjs().format("MM/YY");
const censorOpen = ref(false);
</script>

<template lang="pug">
.fz
  FanzineNav(label="Community")
  header.fz-page-head
    h1.fz-page-title(aria-label="Community")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Community')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub Das Carousel läuft ausschließlich durch ehrenamtliche Arbeit. Hier siehst du, wo wir gerade Hilfe brauchen und wann wir uns treffen.

  section.fz-section
    .fz-label
      s Wir suchen
      |  Wir brauchen euch
    ul.fz-wanted(v-if="helpRequests.length")
      li.fz-cut(v-for="(h, i) in helpRequests" :key="i")
        .fz-pin
        h3 {{ h.title }}
        p {{ h.text }}
    .fz-box(v-else)
      p Werkstattpause: Gerade gibt es keine konkreten Gesuche – Hilfe ist trotzdem immer willkommen. Komm zum nächsten Treffen oder schreib uns über das Anfragenformular.

  section.fz-section
    .fz-label Treffen
    .fz-meetings(v-if="upcoming.length")
      router-link.plain-link.fz-meeting(v-for="m in upcoming" :key="m.id" :to="eventLink(m.id)")
        .when {{ m.date_d.format('dd, DD.MM.YYYY') }} · {{ m.date_d.format('HH:mm') }} Uhr
        .what(:class="{ 'fz-cancelled': m.cancelled }")
          span.fz-cancelled-tag(v-if="m.cancelled") Abgesagt
          | {{ m.title }}
    p(v-else) Werkstattpause: Aktuell ist kein Treffen geplant. Neue Termine erscheinen hier und im Kalender.

    template(v-if="past.length")
      h2.fz-h2(style="margin-top: 2.5rem; margin-bottom: 1rem") Zuletzt
      .fz-meetings
        router-link.plain-link.fz-meeting.fz-meeting-past(v-for="m in past" :key="m.id" :to="eventLink(m.id)")
          .when {{ m.date_d.format('DD.MM.YYYY') }}
          .what {{ m.title }}

  section.fz-section
    .fz-box.fz-form
      .fz-stamp.fz-form-stamp Genehmigt
      h2.fz-h2 Antrag auf Mithilfe
      dl.fz-form-fields
        dt Aktenzeichen
        dd MH-{{ issueNo }}
        dt Antragsteller:in
        dd.blank
        dt Gewünschte Tätigkeit
        dd Essen für die Bands, Ton, Bar, eigene Abende – such dir was aus
        dt Vergütung
        dd
          span.fz-censor(
            :class="{ open: censorOpen }"
            role="button"
            tabindex="0"
            title="Antippen zum Aufdecken"
            @click="censorOpen = !censorOpen"
            @keydown.enter.prevent="censorOpen = !censorOpen"
          ) Bier und Applaus
      p Komm einfach zu einem Treffen vorbei – du musst niemanden kennen. Oder melde dich vorab über das Anfragenformular.
      .btn-row
        router-link.btn(:to="{ name: 'requests' }") Anfragenformular
        router-link.btn(:to="{ name: 'calendar' }") Kalender
</template>

