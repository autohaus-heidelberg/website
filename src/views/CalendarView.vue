<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { events, type Event } from '../events'
import {
  buildAgendaDays,
  buildCalendarDays,
  dateKey,
  groupEventsByDay,
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
const eventsByDay = groupEventsByDay(events)
const days = computed(() => buildCalendarDays(cursor.value, 'month', eventsByDay))
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

function listLabel(entry: CalendarEntry<Event>): string {
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
</script>

<template lang="pug">
.calendar-page
  h1 Kalender

  .toolbar
    .nav
      button.nav-btn(@click="prev" aria-label="Vorheriger Monat") ‹
      button.nav-btn(@click="today") Heute
      button.nav-btn(@click="next" aria-label="Nächster Monat") ›
    h2.title(aria-live="polite") {{ title }}
    .modes(role="group" aria-label="Ansicht")
      button(:class="{ active: mode === 'month' }" :aria-pressed="mode === 'month'" @click="mode = 'month'") Monat
      button(:class="{ active: mode === 'list' }" :aria-pressed="mode === 'list'" @click="mode = 'list'") Liste

  //- Monatsraster
  .grid(v-if="mode === 'month'" role="grid" :aria-label="`Kalender ${title}`")
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
          :title="`${time(entry.event)} Uhr · ${entry.event.title}`"
        )
          span.ev-time {{ time(entry.event) }}
          span.ev-title {{ entry.event.title }}
      //- Mehrtägige Events als durchgehende Balken
      .bars(v-if="row.laneCount" :style="{ gridRow: rowIndex + 2 }")
        router-link.bar.plain-link(
          v-for="seg in row.segments"
          :key="seg.event.id"
          :to="eventLink(seg.event)"
          :title="`${dateRange(seg.event)} · ${seg.event.title}`"
          :class="{ 'cont-before': seg.continuesBefore, 'cont-after': seg.continuesAfter }"
          :style="{ gridColumn: `${seg.startCol + 1} / span ${seg.span}`, gridRow: seg.lane + 1 }"
        )
          span.bar-title {{ seg.continuesBefore ? '◂ ' : '' }}{{ seg.event.title }}
          span.bar-range(v-if="seg.span > 1") {{ dateRange(seg.event) }}
          span.bar-arrow(v-if="seg.continuesAfter") ▸

  //- Liste
  .list(v-else)
    p.empty(v-if="!listDays.length") Keine Termine im {{ title }}.
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
          :class="{ multiday: entry.multiDay }"
        )
          span.list-time {{ listLabel(entry) }}
          span.list-title {{ entry.event.title }}

  .footer
    a.btn(:href="subscribeUrl") Kalender abonnieren
    a.btn(:href="googleSubscribeUrl" target="_blank" rel="noopener") In Google Kalender
    a.btn(:href="feedPath" download="carousel-termine.ics") Als .ics herunterladen
    p.footer-hint Mit dem Abo erscheinen neue Termine automatisch in deinem Kalender.
</template>

<style scoped>
.calendar-page {
  --multiday-bg: #fdf3d0;
  --multiday-bg-hover: #f7e7a8;
  --multiday-accent: #ffcc00;
  max-width: var(--wide-page-width);
  margin: auto;
  padding: 1rem;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.nav,
.modes {
  display: flex;
  gap: 0.8rem;
}

/* Kompakter als die globalen Buttons (die erben die große Fließtextgröße),
   damit die Steuerung nicht das dichte Kalenderraster erschlägt. */
.toolbar,
.footer {
  --btn-shadow: 0.2rem;
  --btn-border: 0.15rem;
}

.toolbar button,
.footer .btn {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  padding: 0.45em 0.9em;
}

.nav-btn {
  min-width: 2.4rem;
}

.title {
  margin: 0;
  text-transform: capitalize;
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

.day.today .day-num {
  background: black;
  color: white;
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
  display: flex;
  flex-direction: column;
  padding: 0.2rem 0.35rem;
  border-left: 0.3rem solid black;
  font-size: 0.75rem;
  line-height: 1.25;
  color: black;
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
}

.day.past .ev {
  opacity: 0.55;
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
  /* Bewusste Farbausnahme (siehe DESIGN.md): wie im internen Kalender */
  background: var(--multiday-bg);
  color: black;
  border-left: 0.35rem solid var(--multiday-accent);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}

.bar:hover {
  background: var(--multiday-bg-hover);
}

/* Fortsetzung aus der Vorwoche / in die nächste Woche: Balken läuft bis an den Rand */
.bar.cont-before {
  margin-left: 0;
  border-left-width: 0;
  padding-left: 0.6rem;
}

.bar.cont-after {
  margin-right: 0.3rem;
}

.bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.bar-range {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.6;
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

.list-day.past {
  opacity: 0.55;
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

.list-entry:hover {
  background: black;
  color: white;
}

/* Bewusste Farbausnahme (siehe DESIGN.md): wie im internen Kalender */
.list-entry.multiday {
  background: var(--multiday-bg);
  color: black;
  border-left: 0.6rem solid var(--multiday-accent);
}

.list-entry.multiday:hover {
  background: var(--multiday-bg-hover);
  color: black;
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
    width: 100%;
    text-align: center;
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
    background: black;
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

  /* Als dünner Streifen ist das helle Gelb zu blass */
  .bar {
    pointer-events: none;
    padding: 0;
    margin-right: calc(var(--cell-pad) + 0.2rem);
    border-left: none;
    background: var(--multiday-accent);
  }

  .bar.cont-after {
    margin-right: 0.2rem;
  }
}
</style>
