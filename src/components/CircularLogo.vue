<template lang="pug">
.circular-logo
    h1#logo2(ref="logo2") Carousel Carousel Carousel
    h1#logo3(ref="logo3") Carousel Carousel Carousel
    h1#logo(ref="logo") Carousel Carousel Carousel
</template>
<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import CircleType from "circletype";

const logo = ref(null);
const logo2 = ref(null);
const logo3 = ref(null);

const props = defineProps<{
    diameter: number
}>();


onMounted(() => {
    createCircleLogo();
})

function createCircleLogo() {

  const magicNumber = 7.06;

  const fontSize = props.diameter / magicNumber;
  const fontSize2 = fontSize / 1.5;
  const fontSize3 = fontSize2 / 1.5;

  logo.value.style.fontSize = `${fontSize}px`;

  logo2.value.style.fontSize = `${fontSize2}px`;
  logo2.value.style.top = `${(props.diameter - fontSize2 * magicNumber) / 2}px`;

  logo3.value.style.fontSize = `${fontSize3}px`;
  logo3.value.style.top = `${(props.diameter - fontSize3 * magicNumber) / 2}px`;
  // logo3.value.style.top = `${diameter/2.4}px`;


  new CircleType(logo.value).radius(0);
  new CircleType(logo2.value).radius(0);
  new CircleType(logo3.value).radius(0);
}

</script>


<style scoped>

.circular-logo > * {
  position: absolute;

}

#logo {
  top: 0;
  animation: rotation 15s infinite linear;
}
#logo2 {
  animation: rotation2 15s infinite linear;
}
#logo3 {
  animation: rotation 15s infinite linear;
}

@keyframes rotation {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-359deg);
  }
}

@keyframes rotation2 {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(359deg);
  }
}

</style>