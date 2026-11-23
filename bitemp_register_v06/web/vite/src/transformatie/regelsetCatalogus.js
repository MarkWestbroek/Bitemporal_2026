// @ts-check
/**
 * regelsetCatalogus — de **laadroute** van regelsets (docs/TRANSFORMATIES.md §9.1, TRANS-1 stap 1).
 *
 * Een regelset is M2: een afbeelding tussen twee talen, of tussen een taal en een extern formaat.
 * Tot nu toe stonden ze alleen als `.js`-bestand in de code en kende alleen hun eigen
 * transformatie ze. Deze catalogus is de ene plek waar de Studio ze vindt, met per regelset de
 * **vindplaats** ("ingebouwd"; later "bestand" en "register") en eventueel een **proef**: hoe je
 * een proefbron voor deze regelset leest en hoe je het plan als tekst schrijft.
 *
 * Twee vormen van regelset bestaan naast elkaar:
 *   - **regels**: een geordende lijst `als … maak …`-regels voor de generieke toepasser
 *     (`regels.js`); die zijn te valideren en proef te draaien;
 *   - **instellingen**: tabellen die een schrijver leest (BPMN voor GZAC, dossierbundel,
 *     zaaktype). Die toont de catalogus zoals ze zijn; ze hebben geen toepasser.
 *
 * Puur en store-loos; de Studio-kant staat in `studio/activities/transformatiesActivity.jsx`.
 */
import { pasRegelsToe, valideerRegelset } from "./regels.js";
import { valideerSchema } from "../vormen/schemaValidatie.js";
import { onbekendePlaceholders } from "../vormen/schemaPaneel.js";

/**
 * @typedef {Object} Proef
 * @property {"tekst"|"map"} soort          - geplakte tekst, of een map uit het project
 * @property {(tekst: string, opties?: any) => any[]} [lees] - tekst → brongrafen (soort "tekst")
 * @property {string} [profielId]            - het profiel waarvan de map inhoud moet hebben (soort "map")
 * @property {(plan: any, graaf: any) => string} [schrijf]   - plan → tekst, als het doel een formaat is
 * @property {string} [voorbeeld]            - een kleine proefbron om mee te beginnen
 * @property {string} [uitleg]
 */

/**
 * @typedef {Object} Vermelding
 * @property {any} regelset
 * @property {"regels"|"instellingen"} vorm
 * @property {string} vindplaats
 * @property {"in"|"tussen"|"uit"} richting - in: iets van buiten → model; tussen: model → model; uit: model → buiten (een formaat om te delen of een artefact voor een component)
 * @property {string|null} bestand           - waar hij in de code staat (voor de ingebouwde)
 * @property {Proef|null} proef
 * @property {any|null} schema               - bij instellingen: het schema van de schrijver waarvoor dit een stand is
 * @property {string|null} schrijver         - bij instellingen: de naam van die schrijver (de motor)
 */

/** @type {Map<string, Vermelding>} */
const _vermeldingen = new Map();

/** Heeft deze regelset regels voor de generieke toepasser? */
export const heeftRegels = (regelset) => Array.isArray(regelset?.regels);

/**
 * Meld een regelset aan. Dezelfde id opnieuw aanmelden vervangt de vorige (de laatste wint);
 * dat is hoe een bestand of het register later een ingebouwde regelset overschrijft.
 *
 * @param {any} regelset
 * @param {{vindplaats?: string, bestand?: string|null, proef?: Proef|null, richting?: string}} [opties]
 */
export function registreerRegelset(regelset, { vindplaats = "ingebouwd", bestand = null, proef = null, richting: opgegeven = "uit", schema = null, schrijver = null } = {}) {
  if (!regelset?.id) throw new Error("Regelset zonder id kan niet in de catalogus.");
  const richting = normaliseerRichting(opgegeven);
  if (!richting) throw new Error(`Regelset ${regelset.id}: onbekende richting "${opgegeven}".`);
  _vermeldingen.set(regelset.id, { regelset, vorm: heeftRegels(regelset) ? "regels" : "instellingen", vindplaats, bestand, proef, richting, schema, schrijver });
}

/** De kop van elke regelset; de rest is bij instellingen de stand van de schrijver. */
export const KOP_SLEUTELS = ["id", "versie", "titel", "bron", "doel", "regels"];

/** De stand van een instellingen-regelset: alles behalve de kop. */
export function standVan(regelset) {
  return Object.fromEntries(Object.entries(regelset || {}).filter(([sleutel]) => !KOP_SLEUTELS.includes(sleutel)));
}

/**
 * De richtingen, in de volgorde van de lijst (Mark 23-11). Het model (een of meer M1's) staat in
 * het midden: **in** komt van buiten het model in (een formaat, een bestand, wat dan ook),
 * **tussen** gaat van model naar model (M1 → M1, dus tussen profielen), **uit** gaat eruit naar
 * buiten: een formaat dat je deelt (vroeger "export") of een artefact voor een component die het
 * uitvoert (vroeger "inrichting"). Een transformatie die stappen combineert (eerst t1, dan t2)
 * bestaat nog niet: BACKLOG TRANS-2 (T-sets).
 */
export const RICHTINGEN = [
  { id: "in", label: "In", uitleg: "van buiten → model" },
  { id: "tussen", label: "Tussen", uitleg: "model → model" },
  { id: "uit", label: "Uit", uitleg: "model → buiten (formaat of artefact)" },
];

/** De oude namen (tot 23-11) op de nieuwe. */
const OUDE_RICHTINGEN = { import: "in", export: "uit", inrichting: "uit" };

/** Een richting op zijn huidige naam (`in`, `tussen`, `uit`), ook uit de oude namen; anders null. */
export function normaliseerRichting(richting) {
  const r = OUDE_RICHTINGEN[richting] || richting;
  return RICHTINGEN.some((x) => x.id === r) ? r : null;
}

/** De vermeldingen per richting, lege richtingen weggelaten. */
export function regelsetsPerRichting() {
  const alle = alleRegelsets();
  return RICHTINGEN.map((richting) => ({ ...richting, vermeldingen: alle.filter((v) => v.richting === richting.id) })).filter((g) => g.vermeldingen.length);
}

/** Alle vermeldingen, op titel. */
export function alleRegelsets() {
  return [..._vermeldingen.values()].sort((a, b) => String(a.regelset.titel || a.regelset.id).localeCompare(String(b.regelset.titel || b.regelset.id), "nl"));
}

/** @returns {Vermelding|null} */
export function getRegelsetVermelding(id) {
  return _vermeldingen.get(id) || null;
}

/** Alleen voor tests. */
export function wisRegelsets() {
  _vermeldingen.clear();
}

const isObject = (w) => !!w && typeof w === "object" && !Array.isArray(w);

/** Een toets in woorden: `actor of usecase`, `past op /…/`, `leeg`, `niet notitie`. */
export function toetsTekst(toets) {
  if (Array.isArray(toets)) return toets.map(toetsTekst).join(" of ");
  if (toets === true) return "ja";
  if (toets === false) return "nee";
  if (isObject(toets)) {
    if ("niet" in toets) return `niet ${toetsTekst(toets.niet)}`;
    if ("leeg" in toets) return toets.leeg ? "leeg" : "niet leeg";
    if ("patroon" in toets) return `past op /${toets.patroon}/`;
    return JSON.stringify(toets);
  }
  return String(toets);
}

/** De voorwaarden van een regel als regels tekst (`vorm: cirkel`, `bron.type: actor`). */
export function alsTekst(als, voor = "") {
  return Object.entries(als || {}).flatMap(([eigenschap, toets]) =>
    (eigenschap === "bron" || eigenschap === "doel") && isObject(toets)
      ? alsTekst(toets, `${voor}${eigenschap}.`)
      : [`${voor}${eigenschap}: ${toetsTekst(toets)}`]
  );
}

const dataTekst = (data) => {
  const paren = Object.entries(data || {});
  return paren.length ? ` (${paren.map(([sleutel, waarde]) => `${sleutel} = ${typeof waarde === "string" ? waarde : JSON.stringify(waarde)}`).join(", ")})` : "";
};

/** Wat een regel doet, in één zin. */
export function actieTekst(regel) {
  if (regel?.negeer) return "negeer";
  if (regel?.zet) {
    return `zet op ${regel.zet.op}${dataTekst(regel.zet.data)}${regel.zet.vervalt ? `; ${regel.zet.vervalt} vervalt` : ""}`;
  }
  if (regel?.maak) {
    const naam = regel.maak.naam != null ? `, naam ${regel.maak.naam === "" ? "leeg" : regel.maak.naam}` : "";
    return `maak ${regel.maak.type}${regel.maak.omgekeerd ? " (omgekeerd)" : ""}${naam}${dataTekst(regel.maak.data)}`;
  }
  return "—";
}

/** De regels als rijen voor een tabel: volgorde, naam, bij, voorwaarden, actie. */
export function regelRijen(regelset) {
  return (regelset?.regels || []).map((regel, index) => ({
    nr: index + 1,
    naam: regel.naam || "",
    bij: regel.bij || "",
    als: alsTekst(regel.als),
    actie: actieTekst(regel),
    meld: !!regel.meld,
  }));
}

/**
 * Controle van een vermelding: de validator voor regels; een instellingen-regelset wordt tegen
 * het schema van zijn schrijver gehouden, als dat er is (ook op onbekende placeholders).
 */
export function controleer(regelset, schema = null) {
  if (heeftRegels(regelset)) return valideerRegelset(regelset);
  if (!schema) return [];
  const stand = standVan(regelset);
  return [
    ...valideerSchema(stand, schema),
    ...onbekendePlaceholders(schema, stand).map((p) => `${p.pad}: onbekende placeholder {${p.naam}}`),
  ];
}

const omschrijf = (soort, item) => {
  if (!item) return "";
  if (soort === "verbinding") return `${item.bron} → ${item.doel}${item.label ? ` (${item.label})` : ""}`;
  return String(item.tekst || item.naam || item.id || "").split("\n")[0];
};

/**
 * Draai een regelset proef op één of meer brongrafen en leg het spoor **per regel** neer: welke
 * bron-items elke regel pakte, welke regels niets raakten, en welke items bij geen enkele regel
 * landden. Er wordt niets in een model geschreven.
 *
 * @param {any} regelset
 * @param {any[]} grafen
 * @returns {{plannen: any[], perRegel: {nr: number, naam: string, items: any[]}[], zonderRegel: any[], diagnostics: any[], telling: Record<string, number>}}
 */
export function proefdraai(regelset, grafen) {
  if (!heeftRegels(regelset)) throw new Error("Deze regelset heeft geen regels voor de toepasser; proefdraaien kan niet.");
  const perNaam = new Map();
  const perRegel = regelset.regels.map((regel, index) => {
    const rij = { nr: index + 1, naam: regel.naam, items: [] };
    // Twee regels met dezelfde naam zijn in het spoor niet te onderscheiden: de eerste krijgt de treffers.
    if (!perNaam.has(regel.naam)) perNaam.set(regel.naam, rij);
    return rij;
  });
  const zonderRegel = [];
  const diagnostics = [];
  const telling = { bronItems: 0, gemaakt: 0, gezet: 0, opgegaan: 0, genegeerd: 0, overgeslagen: 0, "geen-regel": 0 };
  const plannen = [];

  for (const graaf of grafen || []) {
    const plan = pasRegelsToe(graaf, regelset);
    plannen.push(plan);
    diagnostics.push(...plan.diagnostics);
    const item = new Map();
    for (const knoop of graaf.knopen || []) item.set(`knoop|${knoop.id}`, knoop);
    for (const groep of graaf.groepen || []) item.set(`groep|${groep.id}`, groep);
    for (const verbinding of graaf.verbindingen || []) item.set(`verbinding|${verbinding.id}`, verbinding);
    for (const spoor of plan.trace) {
      const rij = { ...spoor, omschrijving: omschrijf(spoor.soort, item.get(`${spoor.soort}|${spoor.bronId}`)) };
      telling.bronItems += 1;
      telling[spoor.actie] = (telling[spoor.actie] || 0) + 1;
      // Een item dat in een ander opging hoort bij de regel die het eerst maakte.
      const doel = spoor.regel ? perNaam.get(spoor.regel) : null;
      if (doel) doel.items.push(rij);
      else zonderRegel.push(rij);
    }
  }
  return { plannen, perRegel, zonderRegel, diagnostics, telling };
}
