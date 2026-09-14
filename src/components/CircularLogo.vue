<template lang="pug">
.circular-logo(:style="{ width: `${diameter}px`, height: `${diameter}px` }")
    h1#logo2(ref="logo2") Carousel Carousel Carousel
    h1#logo3(ref="logo3") Carousel Carousel Carousel
    h1#logo(ref="logo") Carousel Carousel Carousel
</template>
<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import CircleType from "circletype";

const logo = ref<HTMLElement | null>(null);
const logo2 = ref<HTMLElement | null>(null);
const logo3 = ref<HTMLElement | null>(null);

const props = defineProps<{
    diameter: number
}>();

const magicNumber = 7.06;
let circles: { el: HTMLElement; ct: CircleType }[] = [];

// Pull each ring back by half its own width so it is centred horizontally on
// the box (the rings share a vertical axis). Done via margin because the spin
// animation already owns `transform`.
function centerRing(el: HTMLElement) {
  el.style.marginLeft = `${-el.offsetWidth / 2}px`;
}

function applyLayout() {
  if (!logo.value || !logo2.value || !logo3.value) return;
  const fontSize = props.diameter / magicNumber;
  const fontSize2 = fontSize / 1.5;
  const fontSize3 = fontSize2 / 1.5;

  logo.value.style.fontSize = `${fontSize}px`;
  logo2.value.style.fontSize = `${fontSize2}px`;
  logo2.value.style.top = `${(15 + props.diameter - fontSize2 * magicNumber) / 2}px`;
  logo3.value.style.fontSize = `${fontSize3}px`;
  logo3.value.style.top = `${(15 + props.diameter - fontSize3 * magicNumber) / 2}px`;
}

onMounted(() => {
  if (!logo.value || !logo2.value || !logo3.value) return;
  applyLayout();
  circles = [logo.value, logo2.value, logo3.value].map((el) => ({
    el,
    ct: new CircleType(el).radius(0),
  }));
  circles.forEach(({ el }) => centerRing(el));
});

// Recompute in place on resize instead of remounting, which avoids the flash.
watch(() => props.diameter, () => {
  applyLayout();
  circles.forEach(({ el, ct }) => {
    ct.refresh();
    centerRing(el);
  });
});

</script>


<style scoped>

.circular-logo {
  position: relative;
  margin: 0 auto;
}

.circular-logo > * {
  position: absolute;
  left: 50%;
  margin: 0;
  white-space: nowrap;
  font-weight: 900;
}

#logo {
  top: 15px;
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