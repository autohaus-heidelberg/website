<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FanzineBurst from '@/components/FanzineBurst.vue'
import { useRoute, useRouter } from 'vue-router'
import { events, type Event } from '../events'
import { COMMUNITY_LABEL, isCommunity } from '@/utils/community'
import { categoriesIn, categoryLabel } from '@/utils/eventCategory'
import FanzineNav from '@/components/FanzineNav.vue'
import { ransomChars } from '@/utils/ransom'
import {
  buildAgendaDays,
  buildCalendarDays,
  dateKey,
  groupEventsByDay,
  hasCancelledPrefix,
  layoutWeekSegments,
  shiftCursor,
  type CalendarDay,
  type CalendarEntry,
} from '@/utils/calendar'

type Mode = 'month' | 'list'

const route = useRoute()
const router = useRouter()

const MOBILE_QUERY = '(max-width: 700px)'
const isMobile = () => window.matchMedia(MOBILE_QUERY).matches

function parseMonth(value: unknown): Date | null {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})$/.exec(value)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null
}

// Auf dem Handy ist das Monatsraster zu eng, dort startet die Liste.
const mode = ref<Mode>(
  route.query.view === 'month' ? 'month' : route.query.view === 'list' || isMobile() ? 'list' : 'month',
)
const cursor = ref<Date>(parseMonth(route.query.month) ?? new Date())

const monthKey = computed(() => dateKey(cursor.value).slice(0, 7))

watch([mode, monthKey], () => {
  router.replace({ query: { view: mode.value, month: monthKey.value } })
})

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

// events.json enthält nur veröffentlichte ("live") Events.
const categories = categoriesIn(events.filter(e => !isCommunity(e)))
const activeCategory = ref('')
const visibleEvents = computed(() =>
  activeCategory.value ? events.filter(e => e.category === activeCategory.value) : events,
)
const eventsByDay = computed(() => groupEventsByDay(visibleEvents.value))
const days = computed(() => buildCalendarDays(cursor.value, 'month', eventsByDay.value))
const todayKey = dateKey(new Date())

const weeks = computed(() => {
  const rows = []
  for (let i = 0; i < days.value.length; i += 7) {
    const rowDays = days.value.slice(i, i + 7)
    rows.push({ key: rowDays[0].key, week: rowDays[0].week, days: rowDays, ...layoutWeekSegments(rowDays) })
  }
  return rows
})

const listDays = computed(() => buildAgendaDays(days.value.filter(d => d.inCurrentMonth)))

const title = computed(() => cursor.value.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))

function prev() {
  cursor.value = shiftCursor(cursor.value, 'month', -1)
}
function next() {
  cursor.value = shiftCursor(cursor.value, 'month', 1)
}
function today() {
  cursor.value = new Date()
}

function eventLink(e: Event) {
  return { name: 'event', params: { id: encodeURI(e.id) } }
}

function time(e: Event): string {
  return new Date(e.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function shortDate(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function dateRange(e: Event): string {
  return `${shortDate(e.date)} – ${shortDate(e.endDate!)}`
}

// Abgesagte Events bekommen „ABGESAGT“ statt der Uhrzeit, außer der Titel sagt es schon selbst.
function showCancelled(e: Event): boolean {
  return !!e.cancelled && !hasCancelledPrefix(e.title)
}

function tooltip(e: Event, when: string): string {
  return `${showCancelled(e) ? 'ABGESAGT: ' : ''}${when} · ${e.title}`
}

function listLabel(entry: CalendarEntry<Event>): string {
  if (showCancelled(entry.event)) return 'ABGESAGT'
  if (!entry.multiDay) return `${time(entry.event)} Uhr`
  return entry.isStart ? dateRange(entry.event) : `bis ${shortDate(entry.event.endDate!)}`
}

function singleEntries(day: CalendarDay<Event>) {
  return day.entries.filter(e => !e.multiDay)
}

function isPastDay(day: CalendarDay<Event>): boolean {
  return day.key < todayKey
}

// Laufende mehrtägige Events stehen evtl. an einem vergangenen Listentag, sind aber nicht vorbei.
function isPastListDay(day: CalendarDay<Event>): boolean {
  return day.entries.every(entry => dateKey(new Date(entry.event.endDate || entry.event.date)) < todayKey)
}

// Im engen Monatsraster (Handy) sind Titel ausgeblendet — Tippen springt in die Liste.
function onDayClick(day: CalendarDay<Event>) {
  if (!isMobile() || !day.entries.length) return
  if (!day.inCurrentMonth) cursor.value = new Date(day.date.getFullYear(), day.date.getMonth(), 1)
  mode.value = 'list'
  setTimeout(() => document.getElementById(`tag-${day.key}`)?.scrollIntoView({ block: 'start' }))
}

// webcal:// öffnet direkt den Abo-Dialog der Kalender-App (Apple, Outlook, Google auf Android).
const feedPath = '/calendar.ics'
const subscribeUrl = `webcal://${window.location.host}${feedPath}`
// Google Kalender (Web) reagiert nicht auf webcal://, hat aber einen eigenen Abo-Link.
const googleSubscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscribeUrl)}`

const subscribeLinks = [
  { label: 'Apple / Outlook', href: subscribeUrl },
  { label: 'Google Kalender', href: googleSubscribeUrl, external: true },
  { label: '.ics-Datei', href: feedPath, download: 'carousel-termine.ics' },
]
</script>

<template lang="pug">
.fz.fz-wide
 FanzineNav(label="Kalender")
 .calendar-page
  header.fz-page-head.cal-head
    div
      h1.fz-page-title(aria-label="Kalender")
        span.fz-line(aria-hidden="true")
          span.fz-ch(v-for="(c, i) in ransomChars('Kalender')" :key="i" :class="c.cls") {{ c.ch }}
      .cal-help
        p.fz-page-sub So liest du den Kalender:
        ul.cal-legend
          li
            span.sw.sw-concert
            | Veranstaltung
          li
            span.sw.sw-meeting
            | Vereinstreffen
          li
            span.sw.sw-multi
            | mehrtägig
          li
            span.sw.sw-cancel
            | abgesagt
          li
            span.sw.sw-past
            | vorbei
          li
            span.sw.sw-today
            | heute
    .fz-cut.cal-take.cal-take-top
      FanzineBurst.cal-star Abo!
      .fz-stamp Zum Mitnehmen
      p Abonnieren, und kein Termin rauscht mehr an dir vorbei.
      .btn-row
        a.btn(v-for="l in subscribeLinks" :key="l.label" :href="l.href" :target="l.external ? '_blank' : undefined" :rel="l.external ? 'noopener' : undefined" :download="l.download") {{ l.label }}

  .toolbar
    .nav
      button.nav-btn(@click="prev" aria-label="Vorheriger Monat") ‹
      button.nav-btn(@click="today") Heute
      button.nav-btn(@click="next" aria-label="Nächster Monat") ›
    h2.title.fz-label(aria-live="polite") {{ title }}
    .modes(role="group" aria-label="Ansicht")
      button(:class="{ active: mode === 'month' }" :aria-pressed="mode === 'month'" @click="mode = 'month'") Monat
      button(:class="{ active: mode === 'list' }" :aria-pressed="mode === 'list'" @click="mode = 'list'") Liste

  .filters(v-if="categories.length > 1" role="group" aria-label="Art filtern")
    button(:class="{ active: !activeCategory }" :aria-pressed="!activeCategory" @click="activeCategory = ''") Alles
    button(v-for="c in categories" :key="c.value" :class="{ active: activeCategory === c.value }" :aria-pressed="activeCategory === c.value" @click="activeCategory = c.value") {{ c.label }}

  //- Monatsraster
  .grid(v-if="mode === 'month'" role="grid" :aria-label="`Kalender ${title}`" :style="{ '--weeks': weeks.length }")
    .corner KW
    .weekday(v-for="w in weekdayLabels" :key="w" role="columnheader") {{ w }}
    template(v-for="(row, rowIndex) in weeks" :key="row.key")
      .weeknum(role="rowheader" :style="{ gridRow: rowIndex + 2 }" :aria-label="`Kalenderwoche ${row.week}`") {{ row.week }}
      .day(
        v-for="(day, colIndex) in row.days"
        :key="day.key"
        role="gridcell"
        :style="{ gridRow: rowIndex + 2, gridColumn: colIndex + 2, '--lanes': row.laneCount }"
        :class="{ 'other-month': !day.inCurrentMonth, today: day.key === todayKey, past: isPastDay(day), 'has-events': day.entries.length > 0 }"
        @click="onDayClick(day)"
      )
        span.day-num {{ day.date.getDate() }}
        .lanes(v-if="row.laneCount" aria-hidden="true")
        router-link.ev.plain-link(
          v-for="entry in singleEntries(day)"
          :key="entry.event.id"
          :to="eventLink(entry.event)"
          :class="{ cancelled: entry.event.cancelled, community: isCommunity(entry.event) }"
          :title="tooltip(entry.event, `${time(entry.event)} Uhr`)"
        )
          span.ev-time {{ showCancelled(entry.event) ? 'ABGESAGT' : time(entry.event) }}
            span.community-tag(v-if="isCommunity(entry.event)")  · {{ COMMUNITY_LABEL }}
            span.community-tag(v-else-if="categoryLabel(entry.event)")  · {{ categoryLabel(entry.event) }}
          span.ev-title {{ entry.event.title }}
      //- Mehrtägige Events als durchgehende Balken
      .bars(v-if="row.laneCount" :style="{ gridRow: rowIndex + 2 }")
        router-link.bar.plain-link(
          v-for="seg in row.segments"
          :key="seg.event.id"
          :to="eventLink(seg.event)"
          :title="tooltip(seg.event, dateRange(seg.event))"
          :class="{ 'cont-before': seg.continuesBefore, 'cont-after': seg.continuesAfter, cancelled: seg.event.cancelled, community: isCommunity(seg.event) }"
          :style="{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 1 }"
        )
          span.bar-title {{ seg.continuesBefore ? '◂ ' : '' }}
            span.cancel-label(v-if="showCancelled(seg.event)") ABGESAGT
            | {{ seg.event.title }}
          span.bar-range(v-if="seg.span > 1") {{ dateRange(seg.event) }}
          span.bar-arrow(v-if="seg.continuesAfter") ▸

  //- Liste
  .list(v-else)
    p.empty(v-if="!listDays.length") Im {{ title }} steht noch nichts. Kommt noch.
    .list-day(
      v-for="day in listDays"
      :key="day.key"
      :id="`tag-${day.key}`"
      :class="{ today: day.key === todayKey, past: isPastListDay(day) }"
    )
      .list-date
        span.list-dow {{ day.date.toLocaleDateString('de-DE', { weekday: 'short' }) }}
        span.list-dom {{ day.date.getDate() }}
        span.list-mon {{ day.date.toLocaleDateString('de-DE', { month: 'short' }) }}
      .list-entries
        router-link.list-entry.plain-link(
          v-for="entry in day.entries"
          :key="entry.event.id"
          :to="eventLink(entry.event)"
          :class="{ multiday: entry.multiDay, cancelled: entry.event.cancelled, community: isCommunity(entry.event), concert: !entry.multiDay && !entry.event.cancelled && !isCommunity(entry.event) }"
        )
          span.list-time {{ listLabel(entry) }}
            span.community-tag(v-if="isCommunity(entry.event)")  · {{ COMMUNITY_LABEL }}
            span.community-tag(v-else-if="categoryLabel(entry.event)")  · {{ categoryLabel(entry.event) }}
          span.list-title {{ entry.event.title }}

  //- Mobil: Abo am Seitenende, damit oben der Kalender steht (am Desktop sitzt der Kasten im Kopf)
  .fz-cut.cal-take.cal-take-bottom
    .fz-stamp Zum Mitnehmen
    p Abonnieren, und kein Termin rauscht mehr an dir vorbei.
    .btn-row
      a.btn(v-for="l in subscribeLinks" :key="l.label" :href="l.href" :target="l.external ? '_blank' : undefined" :rel="l.external ? 'noopener' : undefined" :download="l.download") {{ l.label }}
</template>

<style scoped>
.calendar-page {
  margin: 0;
  padding: 0;
}

/* Kopf: Titel und Legende links, Abo-Kasten rechts (auf schmalen Bildschirmen darunter) */
.cal-head {
  display: grid;
  gap: 1.5rem 3rem;
  align-items: center;
}

@media (min-width: 1000px) {
  .cal-head { grid-template-columns: minmax(0, 1fr) minmax(18rem, 30rem); }
}

.cal-help .fz-page-sub { font-size: 1rem; }

/* Legende: kleine Muster in der Optik der echten Einträge */
.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
}

.cal-legend li { margin: 0; }

.sw {
  display: inline-block;
  width: 1.6rem;
  height: 0.9rem;
  margin-right: 0.45rem;
  vertical-align: -0.1rem;
  border: 0.12rem solid #000;
  background: #fff;
}

.sw-concert { border-left: 0.4rem solid var(--multi); }
.sw-meeting { background: var(--mark); }
.sw-multi { border-color: var(--multi); background: var(--hatch), var(--soft); }
.sw-past {
  background: linear-gradient(to bottom right, transparent calc(50% - 0.05rem), #000 calc(50% - 0.05rem), #000 calc(50% + 0.05rem), transparent calc(50% + 0.05rem)), #fff;
}
.sw-today {
  width: 0.9rem;
  margin-right: 0.6rem;
  background: #000;
  transform: rotate(-7deg);
}

/* Kompakter Abo-Kasten: kleinere Schrift und Buttons als im Fließtext */
.cal-take {
  padding: 1rem 1.25rem;
  --btn-shadow: 0.2rem;
  --btn-border: 0.15rem;
}

.cal-take .fz-stamp {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

/* Kopf-Kasten nur ab Desktop, mobil steht der Kasten am Seitenende */
.cal-take-top { display: none; }
.cal-take-bottom { margin-top: 2.5rem; }

@media (min-width: 1000px) {
  .cal-take-top { display: block; }
  .cal-take-bottom { display: none; }
}

/* Reine Deko: Stern sitzt an der oberen rechten Ecke des Kastens, nur ab Desktop */
.cal-star { display: none; }

@media (min-width: 1000px) {
  .cal-star {
    display: grid;
    position: absolute;
    top: -3rem;
    right: -0.5rem;
    z-index: 3;
    width: 11em;
    font-size: 0.8rem;
    transform: rotate(7deg);
  }

  .cal-star :deep(.fz-burst-text) { font-size: 1.25em; }
}

.cal-take p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.cal-take .btn-row {
  margin-top: 0.75rem;
  gap: 0.6rem;
}

.cal-take .btn {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  padding: 0.4em 0.8em;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 2rem 0 1.5rem;
}

.nav,
.modes,
.filters {
  display: flex;
  gap: 0.8rem;
}

.filters {
  flex-wrap: wrap;
  margin: -0.5rem 0 1.5rem;
  --btn-shadow: 0.2rem;
  --btn-border: 0.15rem;
}

.filters button {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  padding: 0.45em 0.9em;
}

/* Kompakter als die globalen Buttons (die erben die große Fließtextgröße),
   damit die Steuerung nicht das dichte Kalenderraster erschlägt. */
.toolbar {
  --btn-shadow: 0.2rem;
  --btn-border: 0.15rem;
}

.toolbar button {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  padding: 0.45em 0.9em;
}

.nav-btn {
  min-width: 2.4rem;
}

/* Monatstitel als schwarzes Etikett (.fz-label aus fanzine.css) */
.title.fz-label {
  margin: 0;
}

button.active {
  background-color: var(--text-color);
  color: var(--background-color);
}

/* ── Monatsraster ── */
.grid {
  --bar-h: 1.5rem;
  --bar-gap: 0.25rem;
  --cell-pad: 0.4rem;
  --num-h: 1.8rem;
  display: grid;
  grid-template-columns: 2.4rem repeat(7, minmax(0, 1fr));
  /* Alle Wochen so hoch wie die höchste */
  grid-template-rows: auto repeat(var(--weeks), 1fr);
  border-top: 0.3rem solid black;
  border-left: 0.3rem solid black;
}

.corner,
.weekday {
  background: black;
  color: white;
  text-align: center;
  font-weight: 900;
  font-size: 0.9rem;
  padding: 0.4rem;
  border-right: 0.3rem solid black;
  border-bottom: 0.3rem solid black;
}

.corner {
  font-size: 0.7rem;
}

.weeknum {
  grid-column: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 900;
  border-right: 0.3rem solid black;
  border-bottom: 0.3rem solid black;
}

.day {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 7.5rem;
  min-width: 0;
  padding: var(--cell-pad);
  border-right: 0.3rem solid black;
  border-bottom: 0.3rem solid black;
  background: white;
  text-align: left;
}

.day-num {
  align-self: flex-start;
  height: var(--num-h);
  min-width: var(--num-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 0.95rem;
  flex-shrink: 0;
}

/* Heute: nur die Zahl, schief aufgestempelt. Kein Gelb, das gehört den Vereinstreffen. */
.day.today .day-num {
  background: black;
  color: white;
  outline: 0.12rem solid black;
  outline-offset: 0.15rem;
  transform: rotate(-7deg);
}

/* Vergangene Tage: wie auf dem Papierkalender durchgestrichen (Diagonale hinter dem Inhalt) */
.day.past::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to bottom right, transparent calc(50% - 0.05rem), black calc(50% - 0.05rem), black calc(50% + 0.05rem), transparent calc(50% + 0.05rem));
}

.day.past > * {
  position: relative;
  z-index: 1;
}

.day.other-month .day-num {
  opacity: 0.35;
}

/* Platzhalter für die darübergelegten Balken */
.lanes {
  flex-shrink: 0;
  height: calc(var(--lanes) * var(--bar-h) + (var(--lanes) - 1) * var(--bar-gap));
}

.ev {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0.4rem;
  /* Veranstaltungen: grüne Kante, weiße Fläche (wie in der Liste und der Legende); die Kante liegt im ::before, damit sie handgezogen wackelt */
  border-left: 0.35rem solid transparent;
  background: white;
  font-size: 0.8rem;
  line-height: 1.25;
  color: black;
}

.ev:not(.community):not(.cancelled)::before {
  content: "";
  position: absolute;
  inset: 0 0 0 -0.35rem;
  border-left: 0.35rem solid var(--multi);
  filter: url(#fz-frame);
  pointer-events: none;
}

/* Community-Treffen: gelb markiert, zusätzlich gestrichelt (auch ohne Farbe erkennbar).
   Die Striche sind Verläufe statt border-style: dashed, weil Safari/iOS dort Kanten weglässt. */
.ev.community,
.bar.community,
.sw-meeting {
  --dash: 0.12rem;
  --dash-left: var(--dash);
  border: var(--dash) solid transparent;
  background:
    repeating-linear-gradient(90deg, #000 0 0.4rem, transparent 0.4rem 0.7rem) top / 100% var(--dash) no-repeat,
    repeating-linear-gradient(90deg, #000 0 0.4rem, transparent 0.4rem 0.7rem) bottom / 100% var(--dash) no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.4rem, transparent 0.4rem 0.7rem) left / var(--dash-left) 100% no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.4rem, transparent 0.4rem 0.7rem) right / var(--dash) 100% no-repeat,
    var(--mark);
  background-origin: border-box;
}

.ev.community {
  --dash-left: 0.3rem;
  border-left-width: 0.3rem;
}

.list-entry.community {
  background: var(--mark);
}

.bar.community {
  color: black;
}

.ev.community:hover,
.list-entry.community:hover,
.bar.community:hover {
  background: black;
  color: white;
}

.community-tag {
  font-weight: 600;
}

.ev:hover {
  background: black;
  color: white;
}

.ev-time {
  font-weight: 900;
}

.ev-title {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
  font-weight: 800;
}

/* Abgesagt: durchgestrichen und gepunktet (Verlauf statt border-style: dotted, siehe Treffen) */
.ev.cancelled,
.bar.cancelled,
.sw-cancel {
  --dash: 0.12rem;
  --dash-left: var(--dash);
  border: var(--dash) solid transparent;
  background:
    repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) * 2)) top / 100% var(--dash) no-repeat,
    repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) * 2)) bottom / 100% var(--dash) no-repeat,
    repeating-linear-gradient(0deg, #000 0 var(--dash-left), transparent var(--dash-left) calc(var(--dash-left) * 2)) left / var(--dash-left) 100% no-repeat,
    repeating-linear-gradient(0deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) * 2)) right / var(--dash) 100% no-repeat,
    white;
  background-origin: border-box;
}

.ev.cancelled {
  --dash-left: 0.35rem;
  border-left-width: 0.35rem;
}

.ev.cancelled:hover {
  background: black;
}

.ev.cancelled .ev-title {
  text-decoration: line-through;
}

.ev.cancelled .ev-time {
  letter-spacing: 0.05em;
  color: var(--alert);
}

.ev.cancelled:hover .ev-time {
  color: white;
}

.bars {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: var(--bar-h);
  row-gap: var(--bar-gap);
  align-self: start;
  /* Zellen-Padding + Tageszahl + Flex-Gap der Zelle */
  padding-top: calc(var(--cell-pad) + var(--num-h) + 0.3rem);
  pointer-events: none;
  /* Über den (jetzt positionierten) Tageszellen */
  position: relative;
  z-index: 2;
}

/* Mehrtägige Events wie im internen Kalender: ein durchgehender Balken pro Woche */
.bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  /* 0.3rem rechts = Zellrand, damit der Balken nicht über die Gitterlinie läuft */
  margin: 0 calc(var(--cell-pad) + 0.3rem) 0 var(--cell-pad);
  padding: 0 0.5rem;
  /* Schraffur; Titel und Zeitraum liegen auf weißen Etiketten. Treffen gelb (.community) */
  background: var(--hatch), var(--soft);
  color: black;
  border: 0.12rem solid var(--multi);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}

.bar-title,
.bar-range {
  background: white;
  padding: 0 0.3rem;
}

.bar:hover {
  background: black;
}

.bar:hover .bar-title,
.bar:hover .bar-range {
  background: black;
  color: white;
}

/* Fortsetzung aus der Vorwoche / in die nächste Woche: Balken läuft bis an den Rand */
.bar.cont-before {
  margin-left: 0;
  border-left-width: 0;
  padding-left: 0.3rem;
}

.bar.cont-after {
  margin-right: 0.3rem;
}

.bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.bar.cancelled {
  color: black;
}

.bar.cancelled:hover {
  background: black;
  color: white;
}

.bar.cancelled .bar-title {
  text-decoration: line-through;
}

/* inline-block, damit das Label nicht mit durchgestrichen wird */
.cancel-label {
  display: inline-block;
  margin-right: 0.4em;
  font-weight: 900;
  letter-spacing: 0.05em;
  color: var(--alert);
}

.bar.cancelled:hover .cancel-label {
  color: white;
}

.bar-range {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 600;
}

.bar-arrow {
  flex-shrink: 0;
  margin-left: auto;
}

/* ── Liste ── */
.list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty {
  text-align: center;
}

.list-day {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  scroll-margin-top: 6rem;
}

/* Vergangene Tage in der Liste: Datumskasten durchgestrichen statt blass */
.list-day.past .list-date {
  position: relative;
  background: white;
}

.list-day.past .list-date::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to bottom right, transparent calc(50% - 0.04rem), black calc(50% - 0.04rem), black calc(50% + 0.04rem), transparent calc(50% + 0.04rem));
}

.list-date {
  flex-shrink: 0;
  width: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0;
  border: 0.3rem solid black;
  line-height: 1.1;
}

.list-day.today .list-date {
  background: black;
  color: white;
  transform: rotate(-4deg);
}

.list-dow,
.list-mon {
  font-size: 0.75rem;
  text-transform: uppercase;
}

.list-dom {
  font-size: 1.6rem;
  font-weight: 900;
}

.list-entries {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-entry {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 0.5rem 0.8rem;
  border: 0.3rem solid black;
  color: black;
}

/* Veranstaltung: weiß mit grüner Kante (die Fläche bleibt für Mehrtägiges), sonst wird die Liste zu grün */
.list-entry.concert {
  padding-left: 1.2rem;
}

/* Kante liegt im Rahmen-Element und wackelt mit ihm */
.list-entry.concert::before {
  background: linear-gradient(var(--multi), var(--multi)) left / 0.45rem 100% no-repeat;
}

.list-entry:hover {
  background: black;
  color: white;
}

/* Vergangene Einträge: wie die Tage durchgestrichen, ohne Grün und blasser */
.list-day.past .list-entry {
  position: relative;
  background: white;
  box-shadow: none;
  opacity: 0.6;
}

.list-day.past .list-entry.concert::before {
  background: none;
}

.list-day.past .list-entry.concert {
  padding-left: 0.8rem;
}

.list-day.past .list-entry::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to bottom right, transparent calc(50% - 0.04rem), black calc(50% - 0.04rem), black calc(50% + 0.04rem), transparent calc(50% + 0.04rem));
}

.list-day.past .list-entry:hover {
  background: black;
  opacity: 1;
}

.list-day.past .list-entry:hover::after {
  display: none;
}
/* Mehrtägig: schraffierter Streifen links */
.list-entry.multiday {
  background: var(--hatch) left / 1rem 100% no-repeat, var(--soft);
  padding-left: 1.6rem;
}

.list-entry.multiday.community {
  background: var(--hatch) left / 1rem 100% no-repeat, var(--mark);
}

.list-entry.multiday:hover,
.list-entry.multiday.community:hover {
  background: black;
}

.list-entry.cancelled,
.list-entry.cancelled.multiday {
  background: white;
}

.list-entry.cancelled:hover {
  background: black;
  color: white;
}

.list-entry.cancelled .list-title {
  text-decoration: line-through;
}

.list-time {
  font-size: 0.85rem;
  font-weight: 900;
}

.list-title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 2rem;
}

.footer-hint {
  flex-basis: 100%;
  text-align: center;
  font-size: 0.85rem;
  margin: 0;
}

/* ── Handy: Monatsraster nur als Übersicht, Tippen springt in die Liste ── */
@media (max-width: 700px) {
  .toolbar {
    justify-content: center;
  }

  .title {
    order: -1;
    margin: 0 auto;
  }

  .grid {
    --bar-h: 0.45rem;
    --bar-gap: 0.15rem;
    --cell-pad: 0.2rem;
    --num-h: 1.4rem;
    border-width: 0.2rem;
  }

  .corner,
  .weekday,
  .day {
    border-width: 0 0.2rem 0.2rem 0;
  }

  .weekday {
    font-size: 0.7rem;
    padding: 0.2rem;
  }

  .day {
    min-height: 3.6rem;
    gap: 0.15rem;
  }

  .day.has-events {
    cursor: pointer;
  }

  .day-num {
    font-size: 0.8rem;
  }

  .ev {
    pointer-events: none;
    height: 0.45rem;
    padding: 0;
    border-left: none;
    background: var(--multi);
  }

  .ev::before {
    display: none;
  }
  .ev.community {
    --dash: 0.1rem;
    --dash-left: 0.1rem;
    border: 0.1rem solid transparent;
  }

  .ev.cancelled {
    --dash: 0.1rem;
    --dash-left: 0.1rem;
    border: 0.1rem solid transparent;
  }

  .grid {
    grid-template-columns: 1.4rem repeat(7, minmax(0, 1fr));
  }

  .corner {
    font-size: 0.5rem;
    padding: 0.2rem 0;
  }

  .weeknum {
    font-size: 0.6rem;
    border-width: 0 0.2rem 0.2rem 0;
  }

  .ev-time,
  .ev-title,
  .bar-title,
  .bar-range,
  .bar-arrow {
    display: none;
  }

  .bar {
    pointer-events: none;
    padding: 0;
    margin-right: calc(var(--cell-pad) + 0.2rem);
    border-left: none;
    background: var(--hatch), var(--soft);
  }

  .bar.community {
    background: var(--mark);
  }

  .bar.cancelled {
    background: white;
  }

  .bar.cont-after {
    margin-right: 0.2rem;
  }
}

/* ── Handgezogene Linien (Filter in FanzineFilters.vue): Gitterlinien und Rahmen sind leere Pseudo-Elemente,
   die echten Ränder bleiben transparent und halten das Layout ── */
.grid {
  position: relative;
  border-top-color: transparent;
  border-left-color: transparent;
}

.grid::before {
  content: "";
  position: absolute;
  top: -0.3rem;
  left: -0.3rem;
  right: 0;
  bottom: 0;
  background:
    linear-gradient(#000, #000) top / 100% 0.3rem no-repeat,
    linear-gradient(#000, #000) left / 0.3rem 100% no-repeat;
  filter: url(#fz-grid-a);
  pointer-events: none;
}

.weeknum,
.day {
  position: relative;
  border-color: transparent;
}

/* Rechte und untere Linie der Zelle; ragt 0.3rem in die Nachbarn, damit an den Kreuzungen keine Lücken entstehen */
.weeknum::before,
.day::before {
  content: "";
  position: absolute;
  inset: -0.3rem -0.3rem -0.3rem -0.3rem;
  background:
    linear-gradient(#000, #000) right / 0.3rem 100% no-repeat,
    linear-gradient(#000, #000) bottom / 100% 0.3rem no-repeat;
  filter: url(#fz-grid-a);
  pointer-events: none;
}

/* Drei Filter-Varianten, damit sich das Wackeln nicht in jeder Zelle wiederholt */
.day:nth-child(3n + 2)::before { filter: url(#fz-grid-b); }
.day:nth-child(3n)::before { filter: url(#fz-grid-c); }

.corner,
.weekday {
  filter: url(#fz-ink-soft);
}

.list-date,
.list-entry {
  position: relative;
  border-color: transparent;
}

.list-date::before,
.list-entry::before {
  content: "";
  position: absolute;
  inset: -0.3rem;
  border: 0.3rem solid #000;
  filter: url(#fz-frame);
  pointer-events: none;
}

.list-entry.community::before {
  border: 0;
  background:
    repeating-linear-gradient(90deg, #000 0 0.8rem, transparent 0.8rem 1.3rem) top / 100% 0.3rem no-repeat,
    repeating-linear-gradient(90deg, #000 0 0.8rem, transparent 0.8rem 1.3rem) bottom / 100% 0.3rem no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.8rem, transparent 0.8rem 1.3rem) left / 0.3rem 100% no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.8rem, transparent 0.8rem 1.3rem) right / 0.3rem 100% no-repeat;
}

.list-entry.cancelled::before {
  border: 0;
  background:
    repeating-linear-gradient(90deg, #000 0 0.3rem, transparent 0.3rem 0.6rem) top / 100% 0.3rem no-repeat,
    repeating-linear-gradient(90deg, #000 0 0.3rem, transparent 0.3rem 0.6rem) bottom / 100% 0.3rem no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.3rem, transparent 0.3rem 0.6rem) left / 0.3rem 100% no-repeat,
    repeating-linear-gradient(0deg, #000 0 0.3rem, transparent 0.3rem 0.6rem) right / 0.3rem 100% no-repeat;
}
</style>
