<template lang="pug">
.anfragen
h1 Anfrage stellen

h3 Infos zur Location 
.info-table
    label Kapazität
    span 200 Besucher
    label Bestuhlung
    span Nicht vorhanden
    label Stage 
    div
        ul 
            li  Breite: 5m?
            li  Tiefe: 3m?
            li  Höhe: 
            li  Deckenhöhe: 
    label Anlage
    ul 
        li 32 Kanäle
        li 4 Monitore
        li 2 Subwoofer 4 Tops

h1 Anfrage
form.request-form

    label.mr-1 Art der Anfrage
    select(v-model="type")
        option Band/Booking
        option Varanstaltung
        option Vermietung Carousel

    template(v-if="type==='Band/Booking'") 

        label.mr-1 Genre
        select(v-model="genre")
            option(v-for="g in genres") {{ g }}
        label Zeitraum
        .flex.flex-col
            .flex.flex-row
                input(type="checkbox" name="Irgendwann" checked v-model="noTimeLimit")
                span Irgendwann 
            .flex.flex-row(v-if="!noTimeLimit")
                label.mr-1 von 
                input.mr-1(type="date" v-model="from")
                label.mr-1 bis
                input(type="date" v-model="to")

    template(v-else)
        label.mr-1 Datum
        input.mr-1(type="date" v-model="date")



    label.mr-1 Text
    textarea(type="area" rows="10" cols="50")
    .placehodler
    button(@click='sendRequest') Absenden
</template>

<script lang="ts" setup>
import { ref } from "vue";

const genre = ref("Punk");

const noTimeLimit = ref(false);

const from = ref(null)
const to = ref(null)
const date = ref(null)

const genres = [
  "Punk",
  "Rock",
  "Metal",
  "Pop",
  "Jazz",
  "Blues",
  "Funk",
  "Reggae",
  "Hip Hop / Rap",
]


const type = ref("Band/Booking")

function sendRequest() {
    
}


</script>

<style scoped>
select {
    font-size: 1em;
}



.info-table {
    max-width: 1000px;
    margin: auto;
    display: grid;
    grid-template-columns: 2fr 3fr;
    grid-gap: 1rem;    
    text-align: start;
}

.info-table > label {
    justify-self: end;
}

.request-form > label {
    justify-self: end;
}

.request-form {
    max-width: 1000px;
    margin: auto;
    display: grid;
    grid-template-columns: 2fr 3fr;
    grid-gap: 1rem;    
    text-align: start;

}

</style>