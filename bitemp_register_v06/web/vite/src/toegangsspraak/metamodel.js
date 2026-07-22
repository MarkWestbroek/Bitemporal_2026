/**
 * metamodel.js — koppeling van Toegangsspraak aan het metamodel (schema-API).
 *
 * Twee taken (ontwerpdoc §4.7 en §5.3):
 *
 * 1. **Keten-resolutie (met verkorting).** Een van-keten wordt opgezocht in de
 *    echte veldpaden van het register. Tussenstappen mogen worden overgeslagen
 *    zolang de keten eenduidig blijft: "de achternaam van een natuurlijk
 *    persoon" vindt NatuurlijkPersoon.naam.achternaam als er maar één veld
 *    `achternaam` onder NatuurlijkPersoon bestaat. Bij dubbelzinnigheid wordt
 *    de volledige keten geëist; de resolutie levert bovendien de juiste
 *    schrijfwijze van het pad (de casing van het metamodel wint).
 *
 * 2. **Typebewaking.** Vergelijkingen worden gecontroleerd tegen het veldtype
 *    uit de schema-API ("begint met" kan alleen met tekst; een datumveld
 *    vergelijk je niet met een getal; enum-velden alleen met hun toegestane
 *    waarden). Foutmeldingen zijn zelf ook klare taal.
 *
 * De module is puur (geen fetch): de aanroeper levert een veldenlijst, bv.
 * FieldRefs uit modelpicker/bouwModelTree of een met de hand gemaakte lijst in
 * tests. Vorm per veld: { veldpad, type, format, enum } (OAS-conventies).
 */
import { vindOperator } from "./operatoren.js";
import { renderVerwijzing } from "./renderer.js";
import { camelNaarWoorden, lidwoordVoor } from "./woorden.js";

// ── Normalisatie ─────────────────────────────────────────────────────────────
// Woorden en padsegmenten worden vergeleken op een genormaliseerde sleutel:
// kleine letters, zonder scheidingstekens. "natuurlijk persoon" ≙
// "NatuurlijkPersoon", "burgerlijke staat" ≙ "burgerlijkeStaat".

function sleutelVanWoorden(woorden) {
  return woorden.join("").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function sleutelVanSegment(segment) {
  return String(segment).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** OAS-type/format → Toegangsspraak-waardetype. */
export function bepaalWaardetype({ type, format, datatype } = {}) {
  if (format === "date" || format === "date-time") return "datum";
  if (String(datatype).toLowerCase().includes("geo")) return "geometrie";
  if (type === "integer" || type === "number") return "getal";
  if (type === "boolean") return "waarheid";
  if (type === "string") return "tekst";
  return null;
}

// ── Veldindex ────────────────────────────────────────────────────────────────

/**
 * Bouw een index over de veldenlijst van de schema-API.
 * @param velden Array<{ veldpad, type?, format?, datatype?, enum? }>
 */
export function maakVeldIndex(velden) {
  const perEntiteit = new Map();
  const ontvang = (segment) => {
    const key = sleutelVanSegment(segment);
    if (!perEntiteit.has(key)) {
      perEntiteit.set(key, { naam: segment, velden: [], groepen: new Map() });
    }
    return perEntiteit.get(key);
  };

  for (const veld of velden || []) {
    const segmenten = String(veld.veldpad || "").split(".").filter(Boolean);
    if (segmenten.length < 2) continue;
    const ent = ontvang(segmenten[0]);
    ent.velden.push({
      pad: segmenten.join("."),
      bladSleutel: sleutelVanSegment(segmenten[segmenten.length - 1]),
      tussenSleutels: segmenten.slice(1, -1).map(sleutelVanSegment),
      waardetype: bepaalWaardetype(veld),
      enum: Array.isArray(veld.enum) ? veld.enum : [],
    });
    // Groepen: alle pad-prefixen boven het veld (entiteit zelf + GE-rollen).
    for (let n = 1; n < segmenten.length; n++) {
      const groepPad = segmenten.slice(0, n).join(".");
      const laatste = sleutelVanSegment(segmenten[n - 1]);
      if (!ent.groepen.has(groepPad)) {
        ent.groepen.set(groepPad, { pad: groepPad, bladSleutel: laatste, tussenSleutels: segmenten.slice(1, n - 1).map(sleutelVanSegment) });
      }
    }
  }
  return { perEntiteit };
}

/** Is `deel` (in volgorde) een deelrij van `geheel`? */
function isDeelrij(deel, geheel) {
  let i = 0;
  for (const seg of geheel) {
    if (i < deel.length && deel[i] === seg) i += 1;
  }
  return i === deel.length;
}

// ── Resolutie ────────────────────────────────────────────────────────────────

/**
 * Zoek een type-gebaseerde verwijzing op in de index (met keten-verkorting).
 * @returns {{ pad, veld }|{ fout }}
 */
export function resolveerVerwijzing(verwijzing, index) {
  if (verwijzing.basis?.soort !== "type") return { pad: null, veld: null };
  const entKey = sleutelVanWoorden(verwijzing.basis.woorden);
  const ent = index.perEntiteit.get(entKey);
  const basisNaam = verwijzing.basis.woorden.join(" ");
  if (!ent) {
    return { fout: `Onbekend gegevenstype "${basisNaam}" — niet gevonden in het metamodel.` };
  }
  if (!verwijzing.keten.length) return { pad: ent.naam, veld: null };

  // keten is buiten-naar-binnen: [blad, …tussenstappen]; zoeken gebeurt
  // binnen-naar-buiten.
  const bladKey = sleutelVanWoorden(verwijzing.keten[0].woorden);
  const tussenKeys = verwijzing.keten.slice(1).reverse().map((groep) => sleutelVanWoorden(groep.woorden));

  const kandidaten = ent.velden.filter(
    (veld) => veld.bladSleutel === bladKey && isDeelrij(tussenKeys, veld.tussenSleutels)
  );
  if (kandidaten.length === 1) return { pad: kandidaten[0].pad, veld: kandidaten[0] };
  const bladNaam = verwijzing.keten[0].woorden.join(" ");
  if (kandidaten.length === 0) {
    return { fout: `Onder ${basisNaam} is geen veld "${bladNaam}" bekend (keten: "${renderVerwijzing(verwijzing)}").` };
  }
  const paden = kandidaten.map((k) => k.pad).slice(0, 4).join('", "');
  return { fout: `"${renderVerwijzing(verwijzing)}" is dubbelzinnig: het kan "${paden}" zijn. Gebruik de volledige keten.` };
}

/** Idem voor een gegevensgroep ("alle gegevens van …"): entiteit of GE-rol. */
export function resolveerGroep(verwijzing, index) {
  if (verwijzing.basis?.soort !== "type") return { pad: null };
  const entKey = sleutelVanWoorden(verwijzing.basis.woorden);
  const ent = index.perEntiteit.get(entKey);
  const basisNaam = verwijzing.basis.woorden.join(" ");
  if (!ent) {
    return { fout: `Onbekend gegevenstype "${basisNaam}" — niet gevonden in het metamodel.` };
  }
  if (!verwijzing.keten.length) return { pad: ent.naam };
  const bladKey = sleutelVanWoorden(verwijzing.keten[0].woorden);
  const tussenKeys = verwijzing.keten.slice(1).reverse().map((groep) => sleutelVanWoorden(groep.woorden));
  const kandidaten = [...ent.groepen.values()].filter(
    (groep) => groep.bladSleutel === bladKey && isDeelrij(tussenKeys, groep.tussenSleutels)
  );
  if (kandidaten.length === 1) return { pad: kandidaten[0].pad };
  const bladNaam = verwijzing.keten[0].woorden.join(" ");
  if (kandidaten.length === 0) {
    return { fout: `Onder ${basisNaam} is geen gegevensgroep "${bladNaam}" bekend.` };
  }
  const paden = kandidaten.map((k) => k.pad).slice(0, 4).join('", "');
  return { fout: `"alle gegevens van ${renderVerwijzing(verwijzing)}" is dubbelzinnig: het kan "${paden}" zijn. Gebruik de volledige keten.` };
}

// ── Autocomplete ─────────────────────────────────────────────────────────────
// De aanroeper bepaalt de doorsnede: welke veldenlijst in de index zit (heel
// canoniek model, gefilterd op domein, of straks een andere doorsnede van de
// universele projectboom), daartoe beperkt de autocomplete zich vanzelf.

function groepTekst(segment) {
  const woorden = camelNaarWoorden(segment);
  return `${lidwoordVoor(woorden[0])} ${woorden.join(" ")}`;
}

function basisTekst(segment) {
  return `een ${camelNaarWoorden(segment).join(" ")}`;
}

/**
 * Vooruit: een gedeeltelijk getypt woord → van-vormen van passende velden.
 * Suggesties hebben een `label` (met het overslabare deel tussen haakjes),
 * plus `kort` en `lang` als invoegvarianten: kort waar de keten-verkorting
 * eenduidig is, lang is altijd de volledige keten.
 */
export function suggereerVanVormen(partieel, index, maximum = 8) {
  const p = sleutelVanSegment(partieel);
  if (!p) return [];
  const suggesties = [];
  for (const ent of index.perEntiteit.values()) {
    const perBlad = new Map();
    for (const veld of ent.velden) {
      if (!veld.bladSleutel.startsWith(p)) continue;
      if (!perBlad.has(veld.bladSleutel)) perBlad.set(veld.bladSleutel, []);
      perBlad.get(veld.bladSleutel).push(veld);
    }
    for (const groep of perBlad.values()) {
      const eenduidig = groep.length === 1;
      for (const veld of groep) {
        const segmenten = veld.pad.split(".");
        const blad = groepTekst(segmenten[segmenten.length - 1]);
        const basis = basisTekst(segmenten[0]);
        const tussen = segmenten.slice(1, -1).reverse().map(groepTekst);
        const lang = [blad, ...tussen, basis].join(" van ");
        const kort = `${blad} van ${basis}`;
        if (eenduidig && tussen.length) {
          suggesties.push({ label: `${blad} van (${tussen.join(" van ")} van) ${basis}`, kort, lang, pad: veld.pad });
        } else if (eenduidig) {
          suggesties.push({ label: kort, kort, lang: kort, pad: veld.pad });
        } else {
          // Dubbelzinnig blad: alleen de volledige keten is eenduidig.
          suggesties.push({ label: lang, kort: lang, lang, pad: veld.pad });
        }
      }
    }
  }
  return suggesties.slice(0, maximum);
}

/**
 * Achterstevoren: je typt "de naam van " en krijgt alle bases (typen/ketens)
 * die zo'n veld of gegevensgroep hebben. `bladGroepen` zijn de al getypte
 * ketengroepen als woorden-arrays, buiten-naar-binnen: [["naam"]] of
 * [["datum"], ["geboorte"]]. Zelfde kort/lang/label-vorm als hierboven.
 */
export function suggereerBases(bladGroepen, index, maximum = 8) {
  if (!bladGroepen.length) return [];
  const bladKey = sleutelVanWoorden(bladGroepen[0]);
  const tussenKeys = bladGroepen.slice(1).reverse().map(sleutelVanWoorden);
  const suggesties = [];
  for (const ent of index.perEntiteit.values()) {
    const kandidaten = [...ent.velden, ...ent.groepen.values()].filter(
      (item) => item.bladSleutel === bladKey && isDeelrij(tussenKeys, item.tussenSleutels)
    );
    if (!kandidaten.length) continue;
    const basis = basisTekst(ent.naam);
    if (kandidaten.length === 1) {
      // Eenduidig binnen dit type: de korte basis volstaat (keten-verkorting).
      const segmenten = kandidaten[0].pad.split(".");
      const rest = segmenten.slice(1, -1)
        .filter((seg) => !tussenKeys.includes(sleutelVanSegment(seg)))
        .reverse()
        .map(groepTekst);
      const lang = [...rest, basis].join(" van ");
      suggesties.push(rest.length
        ? { label: `(${rest.join(" van ")} van) ${basis}`, kort: basis, lang, pad: kandidaten[0].pad }
        : { label: basis, kort: basis, lang: basis, pad: kandidaten[0].pad });
    } else {
      // Dubbelzinnig: bied per kandidaat de onderscheidende volledige rest.
      for (const item of kandidaten) {
        const segmenten = item.pad.split(".");
        const rest = segmenten.slice(1, -1)
          .filter((seg) => !tussenKeys.includes(sleutelVanSegment(seg)))
          .reverse()
          .map(groepTekst);
        const lang = [...rest, basis].join(" van ");
        suggesties.push({ label: lang, kort: lang, lang, pad: item.pad });
      }
    }
  }
  return suggesties.slice(0, maximum);
}

// ── Controle + verrijking van een beleid ─────────────────────────────────────

const WAARDETYPE_NAAM = { tekst: "tekst", getal: "een getal", datum: "een datum", waarheid: "waar/onwaar", geometrie: "een geometrie" };

/**
 * Controleer een geparst beleid tegen het metamodel en verrijk verwijzingen
 * met het geresolvede pad (`verwijzing.pad`), zodat de ODRL-uitvoer de echte
 * registerpaden gebruikt. Het beleid zelf wordt niet gewijzigd.
 *
 * @returns {{ beleid: object, fouten: Array<{bericht, regel, kolom}> }}
 */
export function resolveerBeleid(beleid, index) {
  const kopie = structuredClone(beleid);
  const fouten = [];
  const meld = (context, bericht) => fouten.push({ bericht: `${context}: ${bericht}`, regel: null, kolom: null });

  const resolveerTerm = (term, context) => {
    if (!term || term.soort !== "verwijzing") return null;
    const res = resolveerVerwijzing(term, index);
    if (res.fout) { meld(context, res.fout); return null; }
    if (res.pad) term.pad = res.pad;
    return res.veld || null;
  };

  const controleerVoorwaarde = (v, context) => {
    if (v.soort !== "voorwaarde") { v.items.forEach((item) => controleerVoorwaarde(item, context)); return; }
    const linksVeld = resolveerTerm(v.links, context);
    resolveerTerm(v.rechts, context);
    resolveerTerm(v.rechts2, context);
    (v.lijst || []).forEach((t) => resolveerTerm(t, context));
    if (!linksVeld) return;

    const linksTekst = `"${renderVerwijzing(v.links)}"`;
    const op = vindOperator(v.operator);
    const linksType = linksVeld.waardetype;

    // 1. Past de vergelijking op het veldtype?
    if (op?.typen && linksType && !op.typen.includes(linksType)) {
      let hint = "";
      if ((linksType === "datum" || linksType === "getal") && op.typen.includes("tekst")) {
        hint = ' Gebruik bijvoorbeeld "is kleiner dan" of "ligt tussen".';
      }
      meld(context, `"${op.zin}" kan alleen met ${op.typen.map((t) => WAARDETYPE_NAAM[t] || t).join(" of ")}; ${linksTekst} is ${WAARDETYPE_NAAM[linksType]}.${hint}`);
      return;
    }

    // 2. Past de rechterwaarde op het veldtype?
    const controleerLiteral = (term) => {
      if (!term || term.soort !== "literal" || !linksType) return;
      if (linksType === "waarheid" || linksType === "geometrie") return;
      if (term.type !== linksType) {
        meld(context, `${linksTekst} is ${WAARDETYPE_NAAM[linksType]}, maar wordt vergeleken met ${WAARDETYPE_NAAM[term.type]} (${term.type === "tekst" ? `"${term.waarde}"` : term.waarde}).`);
        return;
      }
      // 3. Enum-velden: alleen toegestane waarden.
      if (term.type === "tekst" && linksVeld.enum.length && !linksVeld.enum.includes(term.waarde)) {
        const toegestaan = linksVeld.enum.slice(0, 8).map((w) => `"${w}"`).join(", ");
        meld(context, `"${term.waarde}" is geen toegestane waarde voor ${linksTekst}. Toegestaan: ${toegestaan}.`);
      }
    };
    controleerLiteral(v.rechts);
    controleerLiteral(v.rechts2);
    (v.lijst || []).forEach(controleerLiteral);
  };

  const controleerWat = (wat, context) => {
    if (wat.soort === "verwijzing") {
      const res = resolveerVerwijzing(wat, index);
      if (res.fout) meld(context, res.fout);
      else if (res.pad) wat.pad = res.pad;
    } else if (wat.soort === "alle") {
      const res = resolveerGroep(wat.verwijzing, index);
      if (res.fout) meld(context, res.fout);
      else if (res.pad) wat.verwijzing.pad = res.pad;
    }
  };

  for (const begrip of kopie.begrippen) {
    if (begrip.soort !== "wat") continue;
    const context = `Begrip "${begrip.naam}"`;
    controleerWat(begrip.wat, context);
    if (begrip.waarvan) controleerVoorwaarde(begrip.waarvan, context);
  }
  for (const regel of kopie.regels) {
    const context = `Regel "${regel.naam}"`;
    controleerWat(regel.wat, context);
    if (regel.voorwaarden) controleerVoorwaarde(regel.voorwaarden, context);
  }

  return { beleid: kopie, fouten };
}
