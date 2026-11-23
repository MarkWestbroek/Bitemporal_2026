// @ts-check
/**
 * profielGroepen — de ordening van de profielen in het profielen- en transformatieproject (Mark
 * 23-11: nu een profiel een container is, kun je er mappen omheen zetten).
 *
 * Een eerste indeling, door Mark nog te overdenken. Een map is hier ordening in de boom (geen M1),
 * zoals elke map in een project; een profiel hoort in hooguit één map. Een profiel dat hier niet
 * staat (een eigen profiel), komt in *Overig*.
 *
 * Niet door Mark genoemd en door Claude ingedeeld (23-11, te bevestigen): Canoniek datamodel bij
 * Gegevensmodellering; SysML en Requirements als eigen groep.
 *
 * Statisch/dynamisch binnen UML is nu een map; als eigenschap van het profiel (zoals `aard` op een
 * elementtype) bestaat het nog niet (BACKLOG PROF-1).
 *
 * Puur.
 */

/**
 * @typedef {{id: string, naam: string, profielen?: string[], groepen?: ProfielGroep[]}} ProfielGroep
 */

/** @type {ProfielGroep[]} */
export const PROFIEL_GROEPEN = [
  {
    id: "uml",
    naam: "UML",
    groepen: [
      { id: "uml-statisch", naam: "Statisch", profielen: ["puur-uml", "object", "component-deployment", "composite-structure"] },
      { id: "uml-dynamisch", naam: "Dynamisch", profielen: ["usecase", "activity", "sequence", "communication", "statemachine"] },
    ],
  },
  { id: "gegevens", naam: "Gegevensmodellering", profielen: ["canoniek-uml", "mim12", "erd"] },
  { id: "archimate", naam: "ArchiMate", profielen: ["archimate"] },
  { id: "schemas", naam: "Schema's", profielen: ["graphql-schema", "oas31", "wsdl", "xsd"] },
  { id: "business", naam: "Business", profielen: ["bpmn-motor", "cmmn", "dmn-drd", "business"] },
  { id: "ui", naam: "UI", profielen: ["formulier"] },
  { id: "ld", naam: "Linked data", profielen: ["shacl", "graaf-demo"] },
  { id: "sysml", naam: "SysML", profielen: ["sysml", "requirements"] },
  { id: "plumbing", naam: "Plumbing", profielen: ["toegangsregel", "transformatie", "simulatie", "weergave"] },
];

export const OVERIG = { id: "overig", naam: "Overig" };

/**
 * Activiteiten zonder eigen profiel in het project (de klassieke editors, de M3-taal) en hun groep,
 * alleen voor het overzicht in Modelleren.
 */
// De klassieke editors (bpmn.io, dmn-js) heten act-bpmn en act-dmn; "SP" (sterplaneet) is het voorbeeld
// uit het Profiel-ontwerp en blijft in Overig.
const ALIASSEN = { "act-bpmn": "business", "act-dmn": "business", "profiel-ontwerp": "plumbing" };

/** Alle profiel-id's van een groep, ook die in de subgroepen. */
const allesIn = (g) => [...(g.profielen || []), ...(g.groepen || []).flatMap(allesIn)];

/**
 * Het overzicht "begin met een nieuw diagram" in Modelleren volgt de mappen (Mark 23-11), op het
 * bovenste niveau: UML Statisch en Dynamisch samen als UML. Lege groepen vallen weg, Overig achteraan.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} idVan - het profiel-id (descriptor-id) van een item
 * @returns {{id: string, naam: string, items: T[]}[]}
 */
export function overzichtPerGroep(items, idVan) {
  const groepVan = new Map();
  for (const g of PROFIEL_GROEPEN) for (const p of allesIn(g)) if (!groepVan.has(p)) groepVan.set(p, g.id);
  for (const [p, g] of Object.entries(ALIASSEN)) if (!groepVan.has(p)) groepVan.set(p, g);
  const uit = [...PROFIEL_GROEPEN, OVERIG].map((g) => ({ id: g.id, naam: g.naam, items: /** @type {T[]} */ ([]) }));
  for (const item of items) {
    const g = groepVan.get(idVan(item)) || OVERIG.id;
    uit.find((x) => x.id === g)?.items.push(item);
  }
  return uit.filter((g) => g.items.length);
}

/**
 * De mappen voor deze profielen en per profiel de map waarin het hoort. Lege groepen vallen weg.
 * @param {string[]} profielIds
 * @param {{ouderId: string, mapId?: (groepId: string) => string}} opties
 * @returns {{mappen: {id: string, naam: string, ouderId: string, volgorde: number}[], mapVan: Record<string, string>}}
 */
export function groepeerProfielen(profielIds, { ouderId, mapId = (g) => `map_groep_${g}` }) {
  const aanwezig = new Set(profielIds);
  const mappen = [];
  /** @type {Record<string, string>} */
  const mapVan = {};
  /** @returns {boolean} of de groep iets bevat */
  const leg = (groep, ouder, volgorde) => {
    const id = mapId(groep.id);
    const eigen = (groep.profielen || []).filter((p) => aanwezig.has(p) && !mapVan[p]);
    for (const p of eigen) mapVan[p] = id;
    let n = 0;
    let gevuld = eigen.length > 0;
    for (const g of groep.groepen || []) if (leg(g, id, ++n)) gevuld = true;
    if (gevuld) mappen.push({ id, naam: groep.naam, ouderId: ouder, volgorde });
    return gevuld;
  };
  PROFIEL_GROEPEN.forEach((g, i) => leg(g, ouderId, i + 1));
  const rest = profielIds.filter((p) => !mapVan[p]);
  if (rest.length) {
    const id = mapId(OVERIG.id);
    mappen.push({ id, naam: OVERIG.naam, ouderId, volgorde: PROFIEL_GROEPEN.length + 1 });
    for (const p of rest) mapVan[p] = id;
  }
  return { mappen, mapVan };
}
