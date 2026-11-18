// @ts-check
/**
 * metamodelWerkbestand — maakt van een metamodel als gegevens (het M3 uit types/m3.js, straks het
 * projectmetamodel) een Studio-werkbestand in puur-uml (plan docs/plans/2026-11-15 M3 en
 * projectmetamodel als modellen in Omnium, stap 3; besluiten Mark 15-11).
 *
 * Puur: geen fs, geen stores. Het script `scripts/genereer-metamodellen.mjs` leest en schrijft de
 * bestanden en geeft de maat-functie mee (de tekenaar meet de dozen); de test `metamodellen.test.js`
 * controleert dat het bestand in de repo actueel is.
 *
 * Afbeelding naar puur-uml:
 *   - pakket → package (met `bevat` naar zijn leden) en één diagram, in de boom onder dat package;
 *   - metaklasse → klasse of datatype; enumeratie → enumeratie met literals;
 *   - eigenschap met een primitief, een enumeratie of een datatype als type → attribuut
 *     (`naam : Type [kard]`); een map (`sleutel`) toont als `sleutel → Type`;
 *   - eigenschap tussen twee klassen → **associatie** (Mark 15-11: een attribuut met een klasse als
 *     type is in UML een associatie), met de eigenschap als rolnaam aan het doel; `samenstelling` →
 *     compositie;
 *   - operatie (code) → operatie `naam(params)` met het resultaat als retourtype;
 *   - uitleg → `data.beschrijving` (de M3-beschrijving van elementen en velden).
 * Op het diagram van een pakket staan zijn eigen leden volledig, en de klassen uit een ander pakket
 * waarmee ze een associatie hebben als kop (gedaante "kop"), zodat de lijn zichtbaar blijft.
 *
 * **Layout van Mark blijft staan** (besluit 15-11 b): met `vorige` (het bestaande werkbestand)
 * houdt elk voorkomen dat er al was zijn positie en breedte; alleen nieuwe voorkomens krijgen een
 * plek, onder wat er al staat. Ids zijn vast (afgeleid van de namen), zodat dat kan en een diff iets
 * zegt.
 */

export const PROFIEL_ID = "puurUml05";
export const DIAGRAM_TYPE_ID = "puur-uml";

import { indelingVan } from "./indeling.js";

/** @typedef {import("./indeling.js").Metamodel} Metamodel */

const RUIMTE_X = 48;
const RUIMTE_Y = 40;
const MAX_RIJBREEDTE = 1500;
const MARGE = 40;
const KOP_HOOGTE = 48;
const LAAG_RUIMTE = 110; // ruimte tussen lagen voor de rolnamen

/** Vaste, leesbare id uit een naam. */
const idVan = (...delen) => delen.map((d) => String(d).replace(/[^A-Za-z0-9]+/g, "_")).join("__");
export const elementId = (naam) => idVan("m", naam);
const pakketId = (naam) => idVan("pkg", naam);
const diagramId = (naam) => idVan("dg", naam);

const kardTekst = (kard) => (kard === "1" ? "" : kard);

/**
 * Het werkbestand.
 * @param {Metamodel} model
 * @param {Object} [opties]
 * @param {(element: Object, gedaante?: string) => {w: number, h: number}} [opties.maatVan] - de maat
 *   van een doos (de tekenaar); zonder: een ruwe schatting
 * @param {Object|null} [opties.vorige] - het bestaande werkbestand: posities en breedtes blijven
 * @param {string} [opties.profielVersie] - versie van puur-uml (profielVersies)
 * @returns {Object}
 */
export function metamodelWerkbestand(model, { maatVan = schatMaat, vorige = null, profielVersie = "1.0.0" } = {}) {
  const klassen = new Map(model.klassen.map((k) => [k.naam, k]));
  const enums = new Map(model.enumeraties.map((e) => [e.naam, e]));
  /** @type {Record<string, any>} */
  const elements = {};
  const leden = new Map(model.pakketten.map((p) => [p.naam, []]));

  // Pakketten.
  for (const p of model.pakketten) {
    elements[pakketId(p.naam)] = { id: pakketId(p.naam), naam: p.naam, elementType: "package", compartimenten: [], data: p.uitleg ? { beschrijving: p.uitleg } : {} };
  }

  // Klassen en datatypes; de associaties apart.
  const associaties = [];
  for (const k of model.klassen) {
    const attributen = [];
    const operaties = [];
    for (const e of k.eigenschappen) {
      const beschrijving = [e.optioneel ? "(optioneel)" : "", e.uitleg || ""].filter(Boolean).join(" ");
      const indeling = indelingVan(model, k, e);
      if (indeling === "operatie") {
        operaties.push({
          naam: `${e.naam}(${e.params || ""})`,
          fieldType: "operatie",
          data: { typeLabel: e.type + (kardTekst(e.kard) ? ` [${e.kard}]` : ""), ...(beschrijving ? { beschrijving } : {}) },
        });
      } else if (indeling === "associatie" || indeling === "samenstelling") {
        associaties.push({ van: k.naam, eigenschap: e, beschrijving, indeling });
      } else {
        attributen.push({
          naam: e.naam,
          fieldType: "attribuut",
          data: {
            typeLabel: e.sleutel ? `${e.sleutel} → ${e.type}` : e.type,
            ...(kardTekst(e.kard) ? { kardinaliteit: e.kard } : {}),
            ...(e.standaard !== undefined ? { standaardwaarde: e.standaard } : {}),
            ...(beschrijving ? { beschrijving } : {}),
          },
        });
      }
    }
    const compartimenten = [{ compartmentType: "attributen", velden: attributen }];
    if (k.soort === "klasse") compartimenten.push({ compartmentType: "operaties", velden: operaties });
    elements[elementId(k.naam)] = {
      id: elementId(k.naam),
      naam: k.naam,
      elementType: k.soort === "datatype" ? "datatype" : "klasse",
      compartimenten,
      data: k.uitleg ? { beschrijving: k.uitleg } : {},
    };
    leden.get(k.pakket)?.push(k.naam);
  }
  for (const en of model.enumeraties) {
    elements[elementId(en.naam)] = {
      id: elementId(en.naam),
      naam: en.naam,
      elementType: "enumeratie",
      compartimenten: [
        {
          compartmentType: "literals",
          velden: en.waarden.map((w) => ({ naam: w, fieldType: "literal", data: en.uitlegPerWaarde?.[w] ? { beschrijving: en.uitlegPerWaarde[w] } : {} })),
        },
      ],
      data: en.uitleg ? { beschrijving: en.uitleg } : {},
    };
    leden.get(en.pakket)?.push(en.naam);
  }
  for (const { van, eigenschap: e, beschrijving, indeling } of associaties) {
    const id = idVan("as", van, e.naam);
    elements[id] = {
      id,
      naam: "",
      elementType: indeling === "samenstelling" ? "compositie" : "associatie",
      source: elementId(van),
      target: elementId(e.type),
      compartimenten: [],
      data: {
        doelRolNaam: e.sleutel ? `${e.naam} [${e.sleutel}]` : e.naam,
        doelKardinaliteit: e.kard,
        doelNavigeerbaar: "ja",
        ...(beschrijving ? { beschrijving } : {}),
      },
    };
  }
  // Lidmaatschap van de pakketten.
  for (const [pakket, namen] of leden) {
    for (const naam of namen) {
      const id = idVan("bv", pakket, naam);
      elements[id] = { id, naam: "", elementType: "bevat", source: pakketId(pakket), target: elementId(naam), compartimenten: [], data: {} };
    }
  }

  const lijnen = associaties.map((a) => /** @type {[string, string, string]} */ ([idVan("as", a.van, a.eigenschap.naam), a.van, a.eigenschap.type]));
  const vorigeElementen = vorige?.profielen?.[PROFIEL_ID]?.elements || {};
  // Diagrammen: per pakket de eigen leden, en de vreemde associatie-uiteinden als kop.
  const vorigeDiagrammen = vorige?.profielen?.[PROFIEL_ID]?.diagrams || {};
  const pakketVan = new Map([...model.klassen, ...model.enumeraties].map((x) => [x.naam, x.pakket]));
  /** @type {Record<string, any>} */
  const diagrams = {};
  for (const p of model.pakketten) {
    const eigen = leden.get(p.naam) || [];
    const vreemd = [];
    for (const a of associaties) {
      const doel = a.eigenschap.type;
      if (eigen.includes(a.van) && pakketVan.get(doel) !== p.naam && !vreemd.includes(doel)) vreemd.push(doel);
      if (eigen.includes(doel) && pakketVan.get(a.van) !== p.naam && !vreemd.includes(a.van)) vreemd.push(a.van);
    }
    const id = diagramId(p.naam);
    const oud = vorigeDiagrammen[id];
    diagrams[id] = {
      ...(oud ? Object.fromEntries(Object.entries(oud).filter(([k]) => !["nodes", "edges", "verborgenConnectoren"].includes(k))) : {}),
      id,
      naam: p.naam,
      diagramType: DIAGRAM_TYPE_ID,
      nodes: legUit(
        [
          ...ordenLeden(eigen, klassen, enums).map((naam) => ({ naam, gedaante: undefined })),
          ...vreemd.map((naam) => ({ naam, gedaante: "kop" })),
        ],
        // Alleen de lijnen die hier zichtbaar zijn, bepalen de lagen.
        associaties.map((a) => /** @type {[string, string]} */ ([a.van, a.eigenschap.type])).filter(([a, b]) => eigen.includes(a) || eigen.includes(b)),
        elements,
        maatVan,
        oud?.nodes || [],
      ),
      edges: (oud?.edges || []).filter((e) => !e?.elementId || elements[e.elementId]),
      verborgenConnectoren: verborgen(lijnen, eigen, oud, vorigeElementen),
    };
  }

  // Structuur: één hoofdmap; de pakketten erin, hun leden en diagram eronder.
  const mapId = idVan("map", model.naam);
  const plaatsing = {};
  const plaatsingVolgorde = [];
  const plaats = (sleutel, ouder) => {
    plaatsing[sleutel] = ouder;
    plaatsingVolgorde.push(sleutel);
  };
  for (const p of model.pakketten) {
    const pkgSleutel = `el::${PROFIEL_ID}::${pakketId(p.naam)}`;
    plaats(pkgSleutel, mapId);
    plaats(`${PROFIEL_ID}::${diagramId(p.naam)}`, pkgSleutel);
    for (const naam of ordenLeden(leden.get(p.naam) || [], klassen, enums)) plaats(`el::${PROFIEL_ID}::${elementId(naam)}`, mapId);
  }

  return {
    formaat: "studio-project",
    versie: 4,
    project: { id: model.id, naam: model.naam },
    structuur: {
      mappen: { [mapId]: { id: mapId, naam: model.naam, ouderId: null, volgorde: 1 } },
      plaatsing,
      plaatsingVolgorde,
    },
    kruisverbanden: [],
    profielVersies: { [PROFIEL_ID]: profielVersie },
    profielen: {
      [PROFIEL_ID]: {
        diagramTypeId: DIAGRAM_TYPE_ID,
        elements,
        diagrams,
        actiefDiagramId: diagramId(model.pakketten[0].naam),
        meta: model.uitleg ? { beschrijving: model.uitleg } : {},
      },
    },
  };
}

/**
 * Lijnen tussen twee vreemde koppen horen op het diagram van hun eigen pakket: hier verborgen
 * (ook de zelf-associaties van een vreemde klasse). Wat Mark op een bestaand diagram verborg of
 * weer toonde, blijft staan; alleen nieuwe associaties volgen deze regel.
 */
function verborgen(lijnen, eigen, oud, vorigeElementen) {
  return lijnen
    .filter(([id, van, naar]) => {
      if (!oud || !vorigeElementen[id]) return !eigen.includes(van) && !eigen.includes(naar);
      return (oud.verborgenConnectoren || []).includes(id);
    })
    .map(([id]) => id);
}

/** Klassen eerst, dan datatypes, dan enumeraties; binnen een soort de volgorde van het model. */
function ordenLeden(namen, klassen, enums) {
  const rang = (n) => (klassen.get(n)?.soort === "klasse" ? 0 : klassen.has(n) ? 1 : enums.has(n) ? 2 : 3);
  return [...namen].sort((a, b) => rang(a) - rang(b));
}

/**
 * Posities. Een diagram zonder vorige layout krijgt een gelaagde layout: de klassen met associaties
 * in lagen langs de richting van de associaties (de eigenaar boven zijn delen), in elke laag
 * geordend naar het gemiddelde van de ouders; daaronder de rest (datatypes, enumeraties, losse
 * klassen) in rijen. Heeft het diagram al een layout (van Mark), dan houdt elk bestaand voorkomen
 * zijn plek en breedte en komen alleen nieuwe voorkomens in rijen onder wat er staat.
 * @param {{naam: string, gedaante?: string}[]} voorkomens
 * @param {Array<[string, string]>} paren - associaties van → naar (namen)
 */
function legUit(voorkomens, paren, elements, maatVan, oudeNodes) {
  const oud = new Map(oudeNodes.map((n) => [n.elementId, n]));
  const maat = new Map();
  for (const { naam, gedaante } of voorkomens) {
    const el = elements[elementId(naam)];
    const vorig = oud.get(el.id);
    const w = vorig?.size?.width;
    maat.set(naam, w && gedaante !== "kop" ? { w, h: maatVan(el, gedaante, w).h } : maatVan(el, gedaante));
  }
  const node = (naam, position) => {
    const g = voorkomens.find((v) => v.naam === naam)?.gedaante;
    const m = maat.get(naam);
    return { elementId: elementId(naam), position, size: { width: m.w, height: m.h }, ...(g ? { gedaante: g } : {}) };
  };
  const nodes = [];
  const nieuw = [];
  let onderkant = MARGE;
  for (const { naam } of voorkomens) {
    const vorig = oud.get(elementId(naam));
    if (vorig?.position) {
      nodes.push(node(naam, vorig.position));
      onderkant = Math.max(onderkant, vorig.position.y + maat.get(naam).h + RUIMTE_Y);
    } else nieuw.push(naam);
  }
  const posities = nodes.length ? rijen(nieuw, maat, MARGE, onderkant) : gelaagd(nieuw, paren, maat);
  for (const naam of nieuw) nodes.push(node(naam, posities.get(naam)));
  // Vaste volgorde: die van de voorkomens (een diff toont alleen echte verschuivingen).
  const volgorde = new Map(voorkomens.map((v, i) => [elementId(v.naam), i]));
  return nodes.sort((a, b) => volgorde.get(a.elementId) - volgorde.get(b.elementId));
}

/** In rijen van links naar rechts vanaf (x0, y0); geeft naam → positie. */
function rijen(namen, maat, x0, y0, maxBreedte = MAX_RIJBREEDTE) {
  const uit = new Map();
  let x = x0;
  let y = y0;
  let rijHoogte = 0;
  for (const naam of namen) {
    const m = maat.get(naam);
    if (x > x0 && x + m.w > x0 + maxBreedte) {
      x = x0;
      y += rijHoogte + RUIMTE_Y;
      rijHoogte = 0;
    }
    uit.set(naam, { x, y });
    x += m.w + RUIMTE_X;
    rijHoogte = Math.max(rijHoogte, m.h);
  }
  return uit;
}

/** Gelaagd: zie legUit. Deterministisch (alleen de volgorde van de invoer telt bij gelijkspel). */
function gelaagd(namen, paren, maat) {
  const op = new Set(namen);
  const randen = paren.filter(([a, b]) => a !== b && op.has(a) && op.has(b));
  const inGraaf = namen.filter((n) => randen.some(([a, b]) => a === n || b === n));
  const los = namen.filter((n) => !inGraaf.includes(n));
  // Laag = langste pad vanaf een bron; terugwijzende randen (cycli) tellen niet.
  const uit = new Map(inGraaf.map((n) => [n, []]));
  for (const [a, b] of randen) if (!uit.get(a).includes(b)) uit.get(a).push(b);
  const bezig = new Set();
  const klaar = new Set();
  const voorwaarts = [];
  const bezoek = (n) => {
    bezig.add(n);
    for (const m of uit.get(n)) {
      if (bezig.has(m)) continue; // cyclus: deze rand telt niet
      voorwaarts.push([n, m]);
      if (!klaar.has(m)) bezoek(m);
    }
    bezig.delete(n);
    klaar.add(n);
  };
  const heeftIn = new Set(randen.map(([, b]) => b));
  for (const n of [...inGraaf.filter((x) => !heeftIn.has(x)), ...inGraaf]) if (!klaar.has(n)) bezoek(n);
  const laag = new Map(inGraaf.map((n) => [n, 0]));
  for (let ronde = 0; ronde < inGraaf.length; ronde++) {
    let veranderd = false;
    for (const [a, b] of voorwaarts) if (laag.get(b) < laag.get(a) + 1) { laag.set(b, laag.get(a) + 1); veranderd = true; }
    if (!veranderd) break;
  }
  const lagen = [];
  for (const n of inGraaf) (lagen[laag.get(n)] ||= []).push(n);
  // Volgorde per laag: gemiddelde plek van de ouders (twee rondes).
  for (let ronde = 0; ronde < 2; ronde++) {
    const plek = new Map(lagen.flatMap((l) => l.map((n, i) => [n, i / Math.max(1, l.length - 1)])));
    for (let i = 1; i < lagen.length; i++) {
      const gem = (n) => {
        const ouders = voorwaarts.filter(([, b]) => b === n).map(([a]) => plek.get(a)).filter((x) => x !== undefined);
        return ouders.length ? ouders.reduce((s, x) => s + x, 0) / ouders.length : 0.5;
      };
      lagen[i] = lagen[i].map((n, j) => [n, gem(n), j]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([n]) => n);
    }
  }
  const breedte = (l) => l.reduce((s, n) => s + maat.get(n).w, 0) + RUIMTE_X * (l.length - 1);
  const breedst = Math.max(0, ...lagen.map(breedte));
  const posities = new Map();
  let y = MARGE;
  for (const l of lagen) {
    let x = MARGE + Math.round((breedst - breedte(l)) / 2);
    for (const n of l) {
      posities.set(n, { x, y });
      x += maat.get(n).w + RUIMTE_X;
    }
    y += Math.max(...l.map((n) => maat.get(n).h)) + LAAG_RUIMTE;
  }
  for (const [n, p] of rijen(los, maat, MARGE, y, Math.max(MAX_RIJBREEDTE, breedst))) posities.set(n, p);
  return posities;
}

/** Ruwe schatting zonder tekenaar (tests, of als de maat-functie ontbreekt). */
export function schatMaat(element, gedaante) {
  if (gedaante === "kop") return { w: Math.max(140, element.naam.length * 8 + 32), h: KOP_HOOGTE };
  const regels = (element.compartimenten || []).flatMap((c) => c.velden || []);
  const breedste = Math.max(element.naam.length * 8, ...regels.map((v) => (v.naam.length + (v.data?.typeLabel || "").length + 8) * 6.5));
  return { w: Math.ceil(Math.max(180, breedste + 24)), h: 52 + regels.length * 18 };
}
