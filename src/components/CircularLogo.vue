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

onMounted(async () => {
  if (!logo.value || !logo2.value || !logo3.value) return;
  applyLayout();
  // CircleType measures glyph widths to place the letters; with the fallback
  // font (before Geologica loads) those widths are wrong and the ring comes out
  // distorted. Wait for the real font before building the arcs.
  try {
    await document.fonts.load(`900 ${props.diameter / magicNumber}px Geologica`);
  } catch {
    await document.fonts.ready;
  }
  if (!logo.value || !logo2.value || !logo3.value) return;
  circles = [logo.value, logo2.value, logo3.value].map((el) => ({
    el,
    ct: new CircleType(el).radius(0),
  }));
});

// Recompute in place on resize instead of remounting, which avoids the flash.
watch(() => props.diameter, () => {
  applyLayout();
  circles.forEach(({ ct }) => {
    ct.refresh();
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