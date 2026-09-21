/**
 * editorSuggesties.js — autocomplete-context voor de Toegangsspraak-editor.
 *
 * Puur (geen DOM): krijgt de tekst, de caret-positie, de parser-spans en de
 * veldindex, en bepaalt welke suggesties gelden en wat ze vervangen. Drie
 * contexten, in deze volgorde:
 *
 * 1. **Binnen een bestaande gegevens-keten** (caret in een gegevens-span):
 *    suggesties vervangen de héle keten (`bereik`), nooit er middenin — anders
 *    verknoei je de zin. Geen treffers → geen suggesties.
 * 2. **Achterstevoren**: "de naam van " (evt. + partieel) → bases die zo'n
 *    veld of gegevensgroep hebben.
 * 3. **Vooruit**: partieel woord → van-vormen, begrippen, handelingen,
 *    operator-zinnen en plichten. Een al getypt lidwoord vóór het woord wordt
 *    meevervangen ("mag de achterna" → "mag de achternaam van …", niet
 *    "mag de de achternaam …").
 *
 * Suggestie-vorm: { label, kort, lang } (uit metamodel.js) + één van:
 *   vervang : aantal tekens vóór de caret dat vervangen wordt
 *   bereik  : { van, tot } — absoluut bereik (span-vervanging)
 */
import { suggereerVanVormen, suggereerBases } from "./metamodel.js";
import { geefActies, geefOperatoren, geefPlichten } from "./operatoren.js";

// Achterstevoren: "… de naam van " (evt. + partieel woord). De keten-groepen
// zijn beperkt tot 1–2 woorden per groep (velden heten zelden langer); dat
// houdt de detectie eenvoudig en voorspelbaar.
const RE_KETEN_CONTEXT =
  /(?:^|\s)((?:de|het|een)\s+[\p{L}-]+(?:\s+[\p{L}-]+)?\s+van\s+(?:(?:de|het|een)\s+[\p{L}-]+(?:\s+[\p{L}-]+)?\s+van\s+)*)((?:de|het|een)\s+)?([\p{L}-]*)$/u;
// Vooruit: partieel woord, met eventueel een al getypt lidwoord ervoor.
const RE_WOORD_CONTEXT = /(?:\b(de|het|een)\s+)?([\p{L}-]{2,})$/u;
const ANKER_WOORDEN = new Set(["aanvrager", "aanvraag", "betrokkene", "gegevens"]);

export function bepaalSuggesties({ tekst, caret, spans = [], veldIndex = null, begrippen = [], maximum = 6 }) {
  const voorCaret = String(tekst).slice(0, caret);

  // ── 1. Binnen een gegevens-keten: vervang de hele span ──
  const span = spans.find((s) => s.soort === "gegevens" && s.verwijzing && s.van <= caret && caret <= s.tot);
  if (span) {
    if (!veldIndex) return [];
    const m = RE_WOORD_CONTEXT.exec(voorCaret);
    const blad = span.verwijzing.keten[0]?.woorden[0] || span.verwijzing.basis.woorden?.[0] || "";
    const bereik = { van: span.van, tot: span.tot };
    let treffers = m ? suggereerVanVormen(m[2].toLowerCase(), veldIndex, maximum) : [];
    if (!treffers.length && blad && (!m || m[2].toLowerCase() !== blad.toLowerCase())) {
      treffers = suggereerVanVormen(blad.toLowerCase(), veldIndex, maximum);
    }
    return treffers.map((s) => ({ ...s, bereik }));
  }

  const staart = voorCaret.split(/[.;:()\n]/).pop() || "";

  // ── 2. Achterstevoren: bases voor een getypte keten ──
  const keten = RE_KETEN_CONTEXT.exec(staart);
  if (keten && veldIndex) {
    const groepen = keten[1]
      .split(/\s+van\s+/)
      .filter(Boolean)
      .map((deel) => deel.trim().split(/\s+/).slice(1)); // lidwoord eraf
    if (groepen.length && !groepen.some((groep) => groep.some((woord) => ANKER_WOORDEN.has(woord.toLowerCase())))) {
      const partieel = ((keten[2] || "") + keten[3]).toLowerCase();
      const vervang = (keten[2] || "").length + keten[3].length;
      const treffers = suggereerBases(groepen, veldIndex, maximum)
        .filter((s) => !partieel || s.kort.toLowerCase().startsWith(partieel) || s.lang.toLowerCase().startsWith(partieel))
        .map((s) => ({ ...s, vervang }));
      if (treffers.length) return treffers.slice(0, maximum);
    }
  }

  // ── 3. Vooruit: partieel woord ──
  const woordMatch = RE_WOORD_CONTEXT.exec(staart);
  if (!woordMatch) return [];
  const woord = woordMatch[2].toLowerCase();
  // Van-vormen beginnen zelf met een lidwoord: vervang een al getypt lidwoord mee.
  const vervangMetLidwoord = woordMatch[0].length;
  const vervangWoord = woordMatch[2].length;
  const treffers = [];
  if (veldIndex) {
    for (const s of suggereerVanVormen(woord, veldIndex, maximum)) {
      treffers.push({ ...s, vervang: vervangMetLidwoord });
    }
  }
  const voegPlat = (zin) => treffers.push({ label: zin, kort: zin, lang: zin, vervang: vervangWoord });
  for (const naam of begrippen) {
    if (naam.toLowerCase().startsWith(woord)) voegPlat(naam);
  }
  for (const actie of geefActies()) {
    if (actie.woord.startsWith(woord)) voegPlat(actie.woord);
  }
  for (const op of geefOperatoren()) {
    if (op.zin.startsWith(woord)) voegPlat(op.zin);
  }
  for (const plicht of geefPlichten()) {
    if (plicht.zin.startsWith(woord)) voegPlat(plicht.zin);
  }
  const uniek = [];
  const gezien = new Set();
  for (const t of treffers) {
    if (gezien.has(t.label)) continue;
    gezien.add(t.label);
    uniek.push(t);
  }
  return uniek.slice(0, maximum);
}
