/**
 * operatoren.js — het operator-, actie- en plichtenregister van Toegangsspraak.
 *
 * De grammatica kent alleen het "slot" vergelijking/actie/plicht; de invulling
 * komt uit deze registers. Domeinprofielen (geo, zorg, …) registreren extra
 * termen zonder de grammatica te wijzigen — het ODRL-Profile-mechanisme,
 * doorgetrokken naar de taal. Zie docs/plans/"2026-07-22 Klare-taal
 * Toegangsbeleid — Toegangsspraak (ontwerp).md" §5.
 */

// ── Vergelijkingen (operatoren) ──────────────────────────────────────────────
// zin        : de klare-taalvorm (canonieke schrijfwijze)
// canoniek   : naam in het canonieke model
// odrl       : ODRL-operator (kern) of geprefixte profielterm
// unair      : geen rechterterm ("… is bekend")
// lijst      : rechterterm is een opsomming tussen haakjes ("is een van (…)")
// tussen     : twee rechtertermen ("ligt tussen … en …")
const KERN_OPERATOREN = [
  { zin: "is een van", canoniek: "isAnyOf", odrl: "odrl:isAnyOf", lijst: true },
  { zin: "is onderdeel van", canoniek: "isPartOf", odrl: "odrl:isPartOf" },
  { zin: "is groter dan", canoniek: "gt", odrl: "odrl:gt" },
  { zin: "is kleiner dan", canoniek: "lt", odrl: "odrl:lt" },
  { zin: "is ten minste", canoniek: "gteq", odrl: "odrl:gteq" },
  { zin: "is ten hoogste", canoniek: "lteq", odrl: "odrl:lteq" },
  { zin: "is niet", canoniek: "neq", odrl: "odrl:neq" },
  { zin: "is bekend", canoniek: "isBekend", odrl: "nlgov:isBekend", unair: true },
  { zin: "is onbekend", canoniek: "isOnbekend", odrl: "nlgov:isOnbekend", unair: true },
  { zin: "is", canoniek: "eq", odrl: "odrl:eq" },
  { zin: "begint met", canoniek: "begintMet", odrl: "nlgov:begintMet" },
  { zin: "eindigt op", canoniek: "eindigtOp", odrl: "nlgov:eindigtOp" },
  { zin: "bevat", canoniek: "bevat", odrl: "nlgov:bevat" },
  { zin: "ligt tussen", canoniek: "tussen", odrl: "nlgov:tussen", tussen: true },
];

// Geo-domeinprofiel — als voorbeeld van uitbreidbaarheid meegeleverd, maar
// niet standaard actief: een activiteit/omgeving registreert het expliciet.
export const GEO_OPERATOREN = [
  { zin: "valt geheel binnen", canoniek: "geoBinnen", odrl: "geo:within" },
  { zin: "valt deels binnen", canoniek: "geoOverlapt", odrl: "geo:intersects" },
  { zin: "overlapt", canoniek: "geoOverlapt", odrl: "geo:intersects" },
  { zin: "raakt", canoniek: "geoRaakt", odrl: "geo:touches" },
];

let operatoren = [...KERN_OPERATOREN];

/** Registreer extra operatoren (domeinprofiel). Idempotent op `zin`. */
export function registreerOperatoren(extra) {
  for (const op of extra) {
    if (!operatoren.some((o) => o.zin === op.zin)) operatoren.push(op);
  }
}

/** Alleen voor tests: terug naar de kernset. */
export function resetOperatoren() {
  operatoren = [...KERN_OPERATOREN];
}

/**
 * Alle operatoren, gesorteerd op woordlengte (langste eerst) zodat de parser
 * "is kleiner dan" vindt vóór "is" (longest match).
 */
export function geefOperatoren() {
  return [...operatoren].sort(
    (a, b) => b.zin.split(" ").length - a.zin.split(" ").length
  );
}

export function vindOperator(canoniek) {
  return operatoren.find((o) => o.canoniek === canoniek) || null;
}

// ── Acties (handelingen) ─────────────────────────────────────────────────────
// De infinitief in de kernzin; nlgov = de Action-term in het NLGov-profiel.
const KERN_ACTIES = [
  { woord: "bekijken", nlgov: "nlgov:view" },
  { woord: "opvoeren", nlgov: "nlgov:create" },
  { woord: "veranderen", nlgov: "nlgov:update" },
  { woord: "corrigeren", nlgov: "nlgov:corrigeer" },
  { woord: "afvoeren", nlgov: "nlgov:delete" },
  { woord: "registreren", nlgov: "nlgov:registreer" },
  { woord: "exporteren", nlgov: "nlgov:export" },
];

let acties = [...KERN_ACTIES];

export function registreerActies(extra) {
  for (const a of extra) {
    if (!acties.some((b) => b.woord === a.woord)) acties.push(a);
  }
}

export function geefActies() {
  return acties;
}

export function vindActie(woord) {
  return acties.find((a) => a.woord === woord) || null;
}

// ── Plichten ─────────────────────────────────────────────────────────────────
// Plichtzinnen zijn sjabloonzinnen: de hele zin is de term. Onbekende zinnen
// zijn een parsefout — zo blijft "waarbij:" net zo eenduidig als de rest.
const KERN_PLICHTEN = [
  { zin: "elke raadpleging wordt vastgelegd in het logboek", nlgov: "nlgov:log" },
  { zin: "de gegevens worden gepseudonimiseerd geleverd", nlgov: "nlgov:pseudonimiseer" },
  { zin: "de reden van de wijziging wordt vastgelegd bij de registratie", nlgov: "nlgov:motiveer" },
];

let plichten = [...KERN_PLICHTEN];

export function registreerPlichten(extra) {
  for (const p of extra) {
    if (!plichten.some((q) => q.zin === p.zin)) plichten.push(p);
  }
}

export function geefPlichten() {
  return plichten;
}

export function vindPlicht(zin) {
  const genormaliseerd = zin.trim().replace(/\s+/g, " ");
  return plichten.find((p) => p.zin === genormaliseerd) || null;
}
