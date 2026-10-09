<template lang="pug">
.circular-logo(:style="{ width: `${diameter}px`, height: `${diameter}px` }")
    h1#logo2(ref="logo2" style="opacity:0") Carousel Carousel Carousel
    h1#logo3(ref="logo3" style="opacity:0") Carousel Carousel Carousel
    h1#logo(ref="logo" style="opacity:0") Carousel Carousel Carousel
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

  // Center ring2 and ring3 around the vertical midpoint of ring1.
  // Ring1 starts at top:15px (CSS), its midpoint is at 15 + (fontSize*magicNumber)/2.
  // To center a smaller ring around that midpoint: top = midpoint - (fontSizeN*magicNumber)/2
  const ring1Top = 15;
  const ring1Mid = ring1Top + (fontSize * magicNumber) / 2;

  logo2.value.style.fontSize = `${fontSize2}px`;
  logo2.value.style.top = `${ring1Mid - (fontSize2 * magicNumber) / 2}px`;

  logo3.value.style.fontSize = `${fontSize3}px`;
  logo3.value.style.top = `${ring1Mid - (fontSize3 * magicNumber) / 2}px`;
}

async function initCircles() {
  if (!logo.value || !logo2.value || !logo3.value) return;
  // Destroy any previous CircleType instances before re-init
  circles.forEach(({ ct }) => (ct as unknown as { destroy?: () => void }).destroy?.());
  circles = [];
  applyLayout();
  circles = [logo.value, logo2.value, logo3.value].map((el) => ({
    el,
    ct: new CircleType(el).radius(0),
  }));
  // Reveal after CircleType has built the rings with the correct font+size.
  [logo.value, logo2.value, logo3.value].forEach((el) => {
    el.style.opacity = '1';
  });
}

onMounted(async () => {
  if (!logo.value || !logo2.value || !logo3.value) return;

  // Wait for BOTH: (1) font ready, (2) diameter has a real value (not the
  // 100px placeholder that HomeView starts with before ResizeObserver fires).
  // We need both simultaneously — font loaded with wrong diameter is just as
  // bad as correct diameter with fallback font.
  await Promise.all([
    // Font signal
    Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]),
    // Diameter signal: resolve immediately if already real, else wait up to
    // 500ms for ResizeObserver to fire with the actual container size.
    new Promise<void>((resolve) => {
      if (props.diameter > 100) { resolve(); return; }
      const timer = setTimeout(resolve, 500);
      const stop = watch(() => props.diameter, (v) => { if (v > 100) { clearTimeout(timer); stop(); resolve(); } });
    }),
  ]);

  await initCircles();
});

// Recompute in place on resize instead of remounting, which avoids the flash.
watch(() => props.diameter, async () => {
  if (circles.length === 0) {
    // CircleType not yet initialised (font was still loading) — do a full init
    await initCircles();
  } else {
    applyLayout();
    circles.forEach(({ ct }) => {
      ct.refresh();
    });
  }
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
  transition: opacity 0.15s ease;
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