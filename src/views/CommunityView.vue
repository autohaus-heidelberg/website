<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { events } from "../events";
import { isPastEvent } from "@/utils/eventTime";
import { communityOnly, helpRequests } from "@/utils/community";
import { ransomChars } from "@/utils/ransom";
import FanzineNav from "@/components/FanzineNav.vue";
import { doors, eveningSteps, mailto, support } from "@/utils/communityContent";

dayjs.locale("de");

const meetings = communityOnly(events).map((item) => ({ ...item, date_d: dayjs(item.date) }));
const upcoming = computed(() =>
  meetings.filter((m) => !isPastEvent(m)).sort((a, b) => (a.date_d.isAfter(b.date_d) ? 1 : -1))
);
const past = computed(() =>
  meetings.filter((m) => isPastEvent(m)).sort((a, b) => (a.date_d.isAfter(b.date_d) ? -1 : 1)).slice(0, 5)
);

const eventLink = (id: string) => ({ name: "event", params: { id: encodeURI(id) } });
</script>

<template lang="pug">
.fz
  FanzineNav(label="Community")
  header.fz-page-head
    h1.fz-page-title(aria-label="Community")
      span.fz-line(aria-hidden="true")
        span.fz-ch(v-for="(c, i) in ransomChars('Community')" :key="i" :class="c.cls") {{ c.ch }}
    p.fz-page-sub Hinter jedem Konzert stehen Leute, die dafür keinen Cent sehen und trotzdem wiederkommen. Hier steht, wie du dazustößt, wo es gerade brennt und wann wir uns treffen.

  section.fz-section#mitmachen
    .fz-label So machst du mit
    .fz-doors
      .fz-door.fz-box(v-for="(d, i) in doors" :key="d.id")
        .fz-door-no {{ i + 1 }}
        h2.fz-h2 {{ d.title }}
        p {{ d.text }}
        router-link.btn(v-if="'route' in d.action" :to="{ name: d.action.route, hash: d.action.hash }") {{ d.cta }}
        a.btn(v-else :href="mailto(d.action.mail)") {{ d.cta }}

  section.fz-section
    .fz-label So läuft ein Abend
    ol.fz-run
      li(v-for="s in eveningSteps" :key="s.when")
        span.run-when {{ s.when }}
        span.run-what {{ s.what }}

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
      p Gerade ist jeder Posten besetzt. Kommt selten vor, hält nie lange. Schreib uns trotzdem.

  section.fz-section#treffen
    .fz-label Vereinstreffen
    p.fz-meetings-intro Erst klären wir unter uns, was ansteht. Dann geht die Tür auf: Der öffentliche Teil gehört allen, die im Carousel was anzetteln wollen. Idee mitbringen, kurz vorstellen, Mitstreiter*innen finden.
    .fz-meetings(v-if="upcoming.length")
      router-link.plain-link.fz-meeting(v-for="m in upcoming" :key="m.id" :to="eventLink(m.id)")
        .when {{ m.date_d.format('dd, DD.MM.YYYY') }} · {{ m.date_d.format('HH:mm') }} Uhr
        .what(:class="{ 'fz-cancelled': m.cancelled }")
          span.fz-cancelled-tag(v-if="m.cancelled") Abgesagt
          | {{ m.title }}
    p(v-else) Noch kein Termin angesetzt. Sobald einer steht, hängt er hier und im Kalender. Wer nicht warten will: schreib uns.

    .btn-row
      router-link.btn(:to="{ name: 'calendar' }") Alle Termine im Kalender

    template(v-if="past.length")
      h2.fz-h2(style="margin-top: 2.5rem; margin-bottom: 1rem") Zuletzt
      .fz-meetings
        router-link.plain-link.fz-meeting.fz-meeting-past(v-for="m in past" :key="m.id" :to="eventLink(m.id)")
          .when {{ m.date_d.format('DD.MM.YYYY') }}
          .what {{ m.title }}

  section.fz-section
    .fz-box.fz-support
      h2.fz-h2 {{ support.title }}
      p {{ support.text }}
      a.btn(:href="mailto(support.subject)") {{ support.cta }}
</template>

