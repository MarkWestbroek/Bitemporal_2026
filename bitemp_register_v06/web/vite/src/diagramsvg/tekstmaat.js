/**
 * tekstmaat — deterministische schatting van tekstbreedtes, zonder browser.
 *
 * De SVG gebruikt generieke fonts (`ui-sans-serif, system-ui, sans-serif`), dus
 * welk font de lezer werkelijk ziet weten we niet. We rekenen daarom met de
 * Helvetica-AFM-breedtes (duizendsten van een em) plus een veiligheidsmarge:
 * Segoe UI / SF / Roboto zijn per teken hooguit een paar procent breder.
 * Belangrijk is vooral dat de uitkomst op elke machine hetzelfde is, zodat een
 * render byte-gelijk blijft.
 */

// Helvetica, tekens 32 (spatie) t/m 126 (~).
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // spatie … /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, // 0-9
  278, 278, 584, 584, 584, 556, 1015, // : ; < = > ? @
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, // A-M
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, // N-Z
  278, 278, 278, 469, 556, 333, // [ \ ] ^ _ `
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, // a-m
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, // n-z
  334, 260, 334, 584, // { | } ~
];

const OVERIG = 620; // accenten, «», pijlen, …
const MARGE = 1.06;
const VET = 1.08;

/** Geschatte breedte in px van `tekst` op `grootte` px. */
export function tekstBreedte(tekst, grootte, { vet = false, mono = false } = {}) {
  const s = String(tekst ?? "");
  if (mono) return s.length * 0.6 * grootte;
  let som = 0;
  for (const teken of s) {
    const c = teken.codePointAt(0);
    som += c >= 32 && c <= 126 ? HELVETICA[c - 32] : OVERIG;
  }
  return (som / 1000) * grootte * MARGE * (vet ? VET : 1);
}

/**
 * Breek `tekst` af op woorden zodat elke regel binnen `maxBreedte` past. Een
 * woord dat op zich al te lang is, krijgt een eigen regel (wordt niet geknipt).
 */
export function breekAf(tekst, grootte, maxBreedte, opts) {
  const regels = [];
  for (const alinea of String(tekst ?? "").split(/\r?\n/)) {
    let regel = "";
    for (const woord of alinea.split(/\s+/).filter(Boolean)) {
      const kandidaat = regel ? `${regel} ${woord}` : woord;
      if (!regel || tekstBreedte(kandidaat, grootte, opts) <= maxBreedte) regel = kandidaat;
      else {
        regels.push(regel);
        regel = woord;
      }
    }
    regels.push(regel);
  }
  return regels;
}
