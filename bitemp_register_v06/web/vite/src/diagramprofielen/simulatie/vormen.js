// @ts-check
/**
 * simulatie/vormen — de elementen van het simulatiemodel als ShapeType: één doos
 * (bibliotheek-`rechthoek`) met eigen inhoud per type (`hooks.inhoudsregels` in descriptor.js),
 * getekend door de motor. Pure `.js`.
 */
import { toonVoorwaarde } from "../../simulatie/voorwaarde.js";
import { registreerShapeType } from "../../diagramcore/types/shapeType.js";
import "../../diagramcore/tekenaar/bibliotheek.js";

/** @type {import("../../diagramcore/types/schema.js").ShapeType[]} */
export const SIMULATIE_SHAPETYPES = [{ id: "sm-doos", renderer: "rechthoek", parameters: { inhoud: "volledig", naamGrootte: 13 }, minMaat: { w: 180, h: 56 } }];

for (const st of SIMULATIE_SHAPETYPES) registreerShapeType(st);

const GEDEMPT = "#475569";
const label = (ref, context) => (ref && typeof context?.verwijzingLabel === "function" ? context.verwijzingLabel(ref) : null);
const regel = (tekst, extra = {}) => ({ delen: [{ tekst, soort: "mono", kleur: GEDEMPT, ...extra }] });

/** Json leesbaar inkorten: de sleutels van een object, of de waarde zelf. */
export function jsonKort(tekst, max = 4, toon = null) {
  const t = String(tekst ?? "").trim();
  if (!t) return [];
  try {
    const w = JSON.parse(t);
    if (w && typeof w === "object" && !Array.isArray(w)) {
      const paren = Object.entries(w);
      const kort = (v) => (v !== null && typeof v === "object" ? (Array.isArray(v) ? `[${v.length}]` : "{…}") : JSON.stringify(v));
      const uit = paren.slice(0, max).map(([k, v]) => (toon ? `${k} ${toon(v)}` : `${k} = ${kort(v)}`));
      if (paren.length > max) uit.push(`… nog ${paren.length - max}`);
      return uit;
    }
    return [JSON.stringify(w)];
  } catch {
    return ["(geen geldige json)"];
  }
}

/** Subject: het diagram waar het naar wijst staat als doorklik op het element; hier geen extra regels. */
export function subjectInhoud() {
  return [];
}

/** Scenario: waar het start en hoe de gaten gevuld worden. */
export function scenarioInhoud(element, context = {}) {
  const d = element?.data || {};
  const uit = [];
  const start = label(d.startBij, context) || d.startProces;
  if (start) uit.push({ divider: true, ...regel(`start bij ${start}`) });
  if (d.vulwijze) uit.push({ divider: !uit.length, delen: [{ tekst: `vulwijze: ${d.vulwijze === "fixture" ? "uit het scenario" : d.vulwijze === "hand" ? "met de hand" : d.vulwijze}`, soort: "badge" }] });
  return uit;
}

/** Instantie: "instantie van" het type, en de eerste velden van de json. */
export function instantieInhoud(element, context = {}) {
  const d = element?.data || {};
  const uit = [];
  const type = label(d.instantieVan, context) || d.typeLabel;
  if (type) uit.push({ divider: true, ...regel(`: ${type}`, { veld: "typeLabel" }) });
  jsonKort(d.json).forEach((t, i) => uit.push({ divider: i === 0, ...regel(t) }));
  return uit;
}

/** Stub: bij welke taak, het hoeveelste bezoek, en de waarde. */
export function stubInhoud(element, context = {}) {
  const d = element?.data || {};
  const uit = [];
  const bij = label(d.bij, context) || d.plek;
  if (bij) uit.push({ divider: true, ...regel(`bij ${bij}${d.bezoek && String(d.bezoek) !== "1" ? ` (bezoek ${d.bezoek})` : ""}`) });
  if (d.wijze) uit.push({ delen: [{ tekst: d.wijze === "hand" ? "met de hand" : d.wijze, soort: "badge" }] });
  else jsonKort(d.json).forEach((t, i) => uit.push({ divider: i === 0, ...regel(t) }));
  return uit;
}

/** Verwachting: waar de run stopt, de waarden en de reden. */
export function verwachtingInhoud(element, context = {}) {
  const d = element?.data || {};
  const uit = [];
  const bij = label(d.bij, context) || d.plek;
  if (bij) uit.push({ divider: true, ...regel(`${d.soort === "gat" ? "gat" : "einde"}: ${bij}`) });
  if (d.via) uit.push({ divider: !uit.length, ...regel(`via ${d.via}`) });
  jsonKort(d.waarden, 4, toonVoorwaarde).forEach((t, i) => uit.push({ divider: i === 0, ...regel(t) }));
  if (d.reden) uit.push({ divider: true, delen: [{ tekst: String(d.reden), soort: "tekst", kleur: "#334155", veld: "reden" }] });
  return uit;
}
