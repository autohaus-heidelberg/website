<template lang="pug">
//- Gemeinsame SVG-Filter für den „Handgemacht"-Look (Trennlinien, Stempel-Buttons); einmal in App.vue eingebunden
svg.fz-filters(width="0" height="0" aria-hidden="true" focusable="false")
  defs
    //- Handgezogene Linie: langsames Wackeln entlang der Linie plus fleckige Kanten. Region in Benutzer-Einheiten,
    //- weil die Linien nur ca. 4px hoch sind und der Standardbereich das Wackeln abschneiden würde.
    filter#fz-hand(filterUnits="userSpaceOnUse" x="-20" y="-30" width="4000" height="70" color-interpolation-filters="sRGB")
      feTurbulence(type="fractalNoise" baseFrequency="0.012 0.12" numOctaves="2" seed="5" result="wobble")
      feDisplacementMap(in="SourceGraphic" in2="wobble" scale="7" xChannelSelector="R" yChannelSelector="G" result="shifted")
      feTurbulence(type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="2" result="grain")
      feColorMatrix(in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.6" result="mask")
      feComposite(in="shifted" in2="mask" operator="in")
    //- Gummistempel: leicht verzogener Rand und ungleichmäßig deckende Farbe
    filter#fz-ink(x="-10%" y="-20%" width="120%" height="140%" color-interpolation-filters="sRGB")
      feTurbulence(type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="wobble")
      feDisplacementMap(in="SourceGraphic" in2="wobble" scale="3" result="shifted")
      feTurbulence(type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="8" result="grain")
      feColorMatrix(in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.55" result="mask")
      feComposite(in="shifted" in2="mask" operator="in")
</template>
