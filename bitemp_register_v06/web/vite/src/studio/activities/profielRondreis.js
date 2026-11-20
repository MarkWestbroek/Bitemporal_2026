// @ts-check
/**
 * profielRondreis — meet wat een profiel (M2) verliest op de weg descriptor → ontwerp-model →
 * descriptor (`ontwerpUitProfiel` en `bouwProfielUitOntwerp`).
 *
 * Aanleiding (Mark 19-11, PROF-1): de tool moet zijn profielen uit het sidecar-project gaan
 * laden, niet uit .js-bestanden. Dat kan pas als deze rondreis **exact** is voor elk ingebouwd
 * profiel, met code (hooks, editors, resolvers) vergeleken op aanwezigheid: die blijft code en
 * wordt op id aangewezen. Deze meting is de werklijst daarvoor; `render-svc/profielRondreis.*`
 * legt de stand vast en laat de test falen als hij verandert zonder dat de stand is bijgewerkt.
 *
 * Eerlijk vergelijken (20-11): het teruggebouwde profiel gaat door dezelfde stappen als een
 * zelf getekend profiel bij het activeren — hook-id's worden code (`vertaalHooks`), de erfenis
 * wordt uitgevlakt, het superprofiel en de standaard-layouts worden aangevuld — en de volgorde
 * van sleutels in een object telt niet (die betekent niets).
 *
 * Een verschil is `"<Metaklasse>.<sleutel> — weg | erbij | anders"`, of `"<Metaklasse> — type
 * weg"` als een heel type niet terugkomt. Sleutels met een `_` vooraan zijn afgeleid (uitgevlakte
 * erfenis) en tellen niet mee; typen uit het superprofiel ook niet, die erft elk profiel.
 *
 * Puur en store-loos.
 */
import { ontwerpUitProfiel, bouwProfielUitOntwerp } from "./profielOntwerp.js";
import { vertaalHooks } from "./profielGereedschap.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { vulSuperprofielAan } from "../../diagramcore/types/superprofiel.js";
import { vulLayoutsAan } from "../../diagramcore/types/typeRegistry.js";
import { STANDAARD_PROFIELVERSIE } from "../../diagramcore/types/profielVersie.js";

const CODE = "«code»";

/** Vergelijkbare vorm: code wordt een merkteken, afgeleide (`_`) sleutels vervallen, sleutels op volgorde. */
function vergelijkbaar(waarde) {
  if (typeof waarde === "function") return CODE;
  if (Array.isArray(waarde)) return waarde.map(vergelijkbaar);
  if (waarde && typeof waarde === "object") {
    return Object.fromEntries(
      Object.entries(waarde)
        .filter(([sleutel]) => !sleutel.startsWith("_"))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sleutel, w]) => [sleutel, vergelijkbaar(w)])
    );
  }
  return waarde;
}

const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Wat de registratie met een zelf getekend profiel doet (profielRegistratie.jsx, typeRegistry.js). */
function zoalsGeregistreerd(kern) {
  const dt = kopieVoorNormalisatie(vertaalHooks(kern));
  normaliseerErfenis(dt);
  vulSuperprofielAan(dt);
  vulLayoutsAan(dt);
  if (!dt.versie) dt.versie = STANDAARD_PROFIELVERSIE;
  return dt;
}

/**
 * De verschillen van één profiel na de rondreis.
 * @param {any} descriptor - een geregistreerde descriptor (DiagramType)
 * @returns {string[]} leeg = de rondreis is exact
 */
export function rondreisVerschillen(descriptor) {
  let kern;
  try {
    const ontwerp = ontwerpUitProfiel(descriptor);
    const diagram = Object.values(ontwerp.diagrams)[0] || {};
    kern = bouwProfielUitOntwerp(
      { elements: ontwerp.elements, shapeSets: diagram.shapeSets, typeWeergave: diagram.typeWeergave, m3Profiel: diagram.m3Profiel },
      { id: descriptor.id, label: descriptor.label }
    );
  } catch (fout) {
    return [`DiagramType — niet te bouwen (${String(fout?.message || fout).slice(0, 80)})`];
  }
  return verschillenMetKern(descriptor, kern);
}

/**
 * De verschillen tussen een geregistreerd profiel en een kern die eruit is teruggebouwd (uit een
 * ontwerp, of uit het sidecar-project).
 * @param {any} descriptor
 * @param {any} kern
 * @returns {string[]}
 */
export function verschillenMetKern(descriptor, kern) {
  const uit = [];
  const voor = vergelijkbaar(descriptor);
  let na;
  try {
    na = vergelijkbaar(zoalsGeregistreerd(kern));
  } catch (fout) {
    return [`DiagramType — niet te registreren (${String(fout?.message || fout).slice(0, 80)})`];
  }
  const sleutels = (klasse, a, b) => {
    for (const sleutel of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      if (!(sleutel in (b || {}))) uit.push(`${klasse}.${sleutel} — weg`);
      else if (!(sleutel in (a || {}))) uit.push(`${klasse}.${sleutel} — erbij`);
      else if (!gelijk(a[sleutel], b[sleutel])) uit.push(`${klasse}.${sleutel} — anders`);
    }
  };
  const { elementTypes: etVoor = [], fieldTypes: ftVoor = [], ...restVoor } = voor;
  const { elementTypes: etNa = [], fieldTypes: ftNa = [], ...restNa } = na;
  sleutels("DiagramType", restVoor, restNa);
  const superprofiel = new Set((descriptor.elementTypes || []).filter((et) => et._superprofiel).map((et) => et.id));
  for (const et of etVoor) {
    if (superprofiel.has(et.id)) continue;
    const klasse = et.isConnector ? "ConnectorType" : "ElementType";
    const terug = etNa.find((x) => x.id === et.id);
    if (!terug) uit.push(`${klasse} — type weg`);
    else sleutels(klasse, et, terug);
  }
  for (const ft of ftVoor) {
    const terug = ftNa.find((x) => x.id === ft.id);
    if (!terug) uit.push("FieldType — type weg");
    else sleutels("FieldType", ft, terug);
  }
  return uit;
}

/**
 * De stand over een reeks profielen: per verschil het aantal keren, op alfabet.
 * @param {any[]} descriptors
 * @returns {Record<string, number>}
 */
export function rondreisStand(descriptors) {
  /** @type {Record<string, number>} */
  const tel = {};
  for (const d of descriptors || []) for (const v of rondreisVerschillen(d)) tel[v] = (tel[v] || 0) + 1;
  return Object.fromEntries(Object.entries(tel).sort(([a], [b]) => a.localeCompare(b)));
}
