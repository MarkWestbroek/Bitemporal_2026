// @ts-check
/**
 * leesTypedefs — leest de JSDoc-typedefs van `schema.js` als gegevens (M3 als model, plan
 * docs/plans/2026-11-15 M3 en projectmetamodel als modellen in Omnium §5).
 *
 * Pure functie op de brontekst (geen fs): de controletest (`m3.test.js`) en de generator
 * (`scripts/genereer-metamodellen.mjs`) lezen het bestand zelf en geven de tekst mee. Zo blijft
 * de uitleg op één plek, in `schema.js`; `m3.js` legt alleen de structuur vast (pakket, type,
 * kardinaliteit), en de test dwingt dat beide dezelfde eigenschappen noemen.
 *
 * Wat hij leest, per `@typedef {…} Naam`:
 *   - `uitleg`: de proza van het commentaarblok vóór de eerste typedef (alleen voor die eerste);
 *   - per `@property {type} naam` of `[naam]`: het type als tekst, of hij optioneel is, en de
 *     beschrijving (ook vervolgregels, tot de volgende `@`-tag);
 *   - `letterlijk`: bij een type als `"a"|"b"` de lijst letterlijke waarden (de enumeratie).
 */

/**
 * @typedef {{naam: string, type: string, optioneel: boolean, uitleg: string, letterlijk: string[]|null}} TypedefEigenschap
 * @typedef {{naam: string, type: string, uitleg: string, eigenschappen: TypedefEigenschap[]}} Typedef
 */

/** Tekst tussen een `{` op positie `i` en de bijbehorende `}`; geeft [inhoud, positie na `}`]. */
function tussenAccolades(tekst, i) {
  let diepte = 0;
  for (let j = i; j < tekst.length; j++) {
    if (tekst[j] === "{") diepte++;
    else if (tekst[j] === "}" && --diepte === 0) return [tekst.slice(i + 1, j), j + 1];
  }
  throw new Error(`leesTypedefs: geen sluitende accolade na positie ${i}`);
}

/** `"a"|"b"|"c"` → ["a","b","c"]; anders null (ook bij een mengsel met andere typen). */
export function letterlijkeWaarden(type) {
  const delen = type.split("|").map((d) => d.trim());
  if (!delen.length || !delen.every((d) => /^"[^"]*"$/.test(d))) return null;
  return delen.map((d) => d.slice(1, -1));
}

const schoon = (s) => s.replace(/\s+/g, " ").trim();

/**
 * @param {string} bron - de tekst van schema.js
 * @returns {Typedef[]} in bronvolgorde
 */
export function leesTypedefs(bron) {
  /** @type {Typedef[]} */
  const uit = [];
  for (const blok of bron.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
    // De regels zonder de " * "-kantlijn, als één tekst (tags kunnen over regels lopen).
    const tekst = blok[1]
      .split("\n")
      .map((r) => r.replace(/^\s*\* ?/, ""))
      .join("\n");
    const eerste = tekst.indexOf("@typedef");
    if (eerste < 0) continue;
    const proza = schoon(tekst.slice(0, eerste));
    let pos = 0;
    /** @type {Typedef|null} */
    let huidig = null;
    let eersteTypedef = true;
    // Loop over de tags in volgorde.
    const tagRe = /@(typedef|property)\s*/g;
    tagRe.lastIndex = 0;
    for (;;) {
      tagRe.lastIndex = pos;
      const m = tagRe.exec(tekst);
      if (!m) break;
      let i = m.index + m[0].length;
      if (tekst[i] !== "{") throw new Error(`leesTypedefs: @${m[1]} zonder {type} bij "${tekst.slice(m.index, m.index + 60)}"`);
      const [type, na] = tussenAccolades(tekst, i);
      i = na;
      // Naam: tot witruimte; bij een property mogelijk [naam] of [naam=standaard].
      const rest = tekst.slice(i);
      const nm = /^\s*(\[[^\]]+\]|[\w$.]+)/.exec(rest);
      if (!nm) throw new Error(`leesTypedefs: @${m[1]} zonder naam na {${type}}`);
      i += nm[0].length;
      // Beschrijving: tot de volgende @-tag aan het begin van een regel of het eind.
      const volgende = /\n\s*@\w/.exec(tekst.slice(i));
      const eind = volgende ? i + volgende.index : tekst.length;
      const beschrijving = schoon(tekst.slice(i, eind).replace(/^\s*-\s*/, ""));
      pos = eind;
      if (m[1] === "typedef") {
        huidig = { naam: nm[1], type: schoon(type), uitleg: eersteTypedef ? proza : "", eigenschappen: [] };
        eersteTypedef = false;
        uit.push(huidig);
      } else {
        if (!huidig) throw new Error("leesTypedefs: @property vóór een @typedef");
        const optioneel = nm[1].startsWith("[");
        const naam = optioneel ? nm[1].slice(1, -1).split("=")[0] : nm[1];
        huidig.eigenschappen.push({ naam, type: schoon(type), optioneel, uitleg: beschrijving, letterlijk: letterlijkeWaarden(schoon(type)) });
      }
    }
  }
  return uit;
}
