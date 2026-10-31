// @ts-check
/**
 * v3DeltaImport — een V3-model (bestand of API) als delta in de canoniek-uml-store van
 * het project, in plaats van "Importeer V3 JSON" dat de hele sandbox vervangt (Mark, 31-10).
 *
 * Zelfde vorm als de EA-merge op GUID (diagramprofielen/ea/vergelijkImport.js):
 *   lezen (importeerV3) → vergelijken (vergelijkMetStore) → review (aan/uit per regel)
 *   → toepassen (pasPlanToe, bestaande ids blijven: diagrammen, plaatsingen in mappen,
 *   kruisverbanden en verwijzingen blijven staan).
 *
 * Identiteit: eerst `data.uuid` (V3 `uuid`, identiteit binnen de tool — besluit Mark 31-10);
 * zonder uuid het id dat importeerV3 deterministisch uit de namen afleidt (Entiteit,
 * Entiteit_GE, enum_X, dt_X). Een hernoeming zonder uuid wordt dus "verdwenen + nieuw".
 *
 * Vergelijken gebeurt in V3-ruimte: de bestaande store gaat eerst door dezelfde rondgang
 * (exporteerV3 → importeerV3), zodat een in de Studio bewerkt element niet als gewijzigd
 * telt alleen omdat zijn heenreis-kopie (`data.bron`) oud is.
 *
 * Diagrammen: alleen die de V3 zelf meebrengt (`model.diagrammen`); het afgeleide Overzicht
 * alleen bij een lege store. "Verdwenen" geldt voor de modelsoorten van V3 in de domeinen
 * van de import, nooit voor diagrammen, notities of wat alleen in de Studio bestaat — en
 * staat standaard uit.
 *
 * Pure functies; de store komt als `state` binnen.
 */
import { importeerV3, exporteerV3 } from "./serialisatie.js";
import { vergelijkMetStore } from "../ea/vergelijkImport.js";
/** Het afgeleide Overzicht-diagram (zoals serialisatie.js). */
const DEFAULT_DIAGRAM_ID = "overzicht";

/** Elementsoorten die V3 beschrijft: alleen die kunnen "verdwenen" zijn. */
const V3_SOORTEN = new Set([
  "entiteit",
  "gegevenselement",
  "relatie",
  "enumeratie",
  "gegevenstype",
  "referentielijstInstantie",
  "compositie",
  "generalisatie",
  "package",
  "bevat",
]);

/** Verbindingen die hun uiteinden volgen: niet apart in de review. */
const VOLGT_UITEINDEN = new Set(["bevat", "compositie", "generalisatie"]);

/** Data-sleutels op core-elementen die uit V3 komen (de rest is Studio-eigen en blijft staan). */
const V3_DATA_BASIS = ["bron", "beschrijving", "kleur", "abstract", "materieel", "domein", "tijdprecisie", "stereotype", "uuid"];

/**
 * Dubbele naampaden in een V3-model: artefacten (DMN-kolommen, traceregels) verwijzen op
 * naampad, dat moet binnen het model uniek zijn (besluit Mark 31-10).
 * @param {any} v3
 * @returns {string[]} meldingen
 */
export function dubbeleNaampaden(v3) {
  const m = v3?.model || v3 || {};
  const uit = [];
  const tel = (soort, namen) => {
    const gezien = new Set();
    for (const n of namen) {
      if (!n) continue;
      if (gezien.has(n)) uit.push(`${soort} "${n}" komt meer dan eens voor`);
      gezien.add(n);
    }
  };
  tel("entiteit", (m.entiteiten || []).map((e) => e.typenaam));
  tel("enumeratie", (m.enums || []).map((e) => e.goType));
  tel("gegevenstype", (m.datatypes || []).map((d) => d.naam));
  // Relaties zijn in de Studio één element per naam, ook over entiteiten heen.
  tel("relatie", (m.entiteiten || []).flatMap((e) => (e.relaties || []).map((r) => r.naam)));
  for (const e of m.entiteiten || []) {
    tel(`gegevenselement in ${e.typenaam}`, (e.gegevenselementen || []).map((g) => g.naam));
    for (const x of [...(e.gegevenselementen || []), ...(e.relaties || [])]) {
      tel(`veld in ${e.typenaam}.${x.naam}`, (x.velden || []).map((v) => v.naam));
    }
  }
  return uit;
}

/**
 * @param {any} v3 - V3-bestand ({model_naam, model}) of het model zelf
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} state - de canoniek-uml-store
 */
export function planV3Import(v3, state) {
  const model = importeerV3(v3);
  const v3Model = v3?.model || v3 || {};
  const bestaandeEl = state?.elements || {};
  const bestaandeDi = state?.diagrams || {};

  // Diagrammen: wat de V3 zelf meebrengt; het afgeleide Overzicht alleen bij een lege store.
  const eigen = new Set((v3Model.diagrammen || []).map((d) => d?.id).filter(Boolean));
  const leeg = !Object.keys(bestaandeEl).length;
  model.diagrams = Object.fromEntries(
    Object.entries(model.diagrams || {}).filter(([id]) => eigen.has(id) || (id === DEFAULT_DIAGRAM_ID && leeg))
  );

  // Bestaande stand door dezelfde rondgang (alleen de elementen; diagrammen zoals ze zijn).
  const genormaliseerd = leeg ? { elements: {} } : importeerV3(exporteerV3(state).v3);
  const vergelijkState = { elements: genormaliseerd.elements, diagrams: bestaandeDi };

  const domeinen = new Set(Object.values(model.elements).map((e) => e.data?.domein || ""));
  const uuid = (el) => el?.data?.uuid || null;
  const plan = vergelijkMetStore(model, vergelijkState, {
    sleutelVan: uuid,
    diagramSleutelVan: (d) => d?.id || null,
    // Zonder uuid aan één van beide kanten: hetzelfde (uit de namen afgeleide) id = hetzelfde element.
    opIdTerugval: (el, b) => !uuid(el) || !uuid(b),
    verdwenenKandidaat: (el) => V3_SOORTEN.has(el.elementType) && domeinen.has(el.data?.domein || ""),
    verdwenenDiagram: null,
    opUiteinden: VOLGT_UITEINDEN,
  });

  // Een id dat de rondgang niet meeneemt (bv. een relatie zonder herleidbare bron) maar
  // wel in de store staat: geen "nieuw" (dat botst), maar "gewijzigd" op dat id.
  plan.elementen.nieuw = plan.elementen.nieuw.filter((r) => {
    if (!bestaandeEl[r.id]) return true;
    plan.idMap.set(r.id, r.id);
    plan.elementen.gewijzigd.push({ ...r, bestaandId: r.id, verschillen: ["(niet vergelijkbaar)"] });
    return false;
  });
  // "Verdwenen" naar de echte store: alleen wat daar echt staat.
  plan.elementen.verdwenen = plan.elementen.verdwenen.filter((r) => bestaandeEl[r.bestaandId]);

  const dataSleutels = new Set(V3_DATA_BASIS);
  for (const el of Object.values(model.elements)) for (const k of Object.keys(el.data || {})) dataSleutels.add(k);

  return {
    model,
    plan,
    meldingen: dubbeleNaampaden(v3),
    /** Studio-eigen data (uitwerking, verwijstNaar, …) blijft bij een bijgewerkt element staan. */
    behoudData: (k) => !dataSleutels.has(k),
  };
}

/**
 * Review-boom voor vraagReview: domein → regels. Verbindingen die hun uiteinden volgen
 * (bevat, compositie, generalisatie) staan er niet apart in; `standaardAan` zet ze aan.
 * @param {ReturnType<typeof planV3Import>["plan"]} plan
 * @param {{elements: Record<string, any>}} model
 * @param {{elements?: Record<string, any>}} state
 * @param {string} [titel]
 */
export function bouwV3ReviewBoom(plan, model, state, titel = "Canoniek model") {
  const ongewijzigd = plan.elementen.ongewijzigd.length + plan.diagrammen.ongewijzigd.length;
  const wortel = { label: `${titel}${ongewijzigd ? ` — ${ongewijzigd} ongewijzigd` : ""}`, kinderen: [] };
  const perDomein = new Map();
  const tak = (domein) => {
    const k = domein || "";
    if (!perDomein.has(k)) {
      const knoop = { label: k ? `domein ${k}` : "(geen domein)", kinderen: [] };
      perDomein.set(k, knoop);
    }
    return perDomein.get(k);
  };
  const label = (r) => `${r.elementType} ${r.naam || "(naamloos)"}`;
  const domeinVan = (els, id) => els?.[id]?.data?.domein || "";
  for (const r of plan.diagrammen.nieuw) wortel.kinderen.push({ sleutel: `di:${r.id}`, label: `diagram ${r.naam}`, status: "nieuw" });
  for (const r of plan.diagrammen.gewijzigd)
    wortel.kinderen.push({ sleutel: `di:${r.id}`, label: `diagram ${r.naam}`, status: "gewijzigd", detail: r.verschillen.join(", ") });
  for (const r of plan.elementen.nieuw)
    if (!VOLGT_UITEINDEN.has(r.elementType)) tak(domeinVan(model.elements, r.id)).kinderen.push({ sleutel: `el:${r.id}`, label: label(r), status: "nieuw" });
  for (const r of plan.elementen.gewijzigd)
    if (!VOLGT_UITEINDEN.has(r.elementType))
      tak(domeinVan(model.elements, r.id)).kinderen.push({ sleutel: `el:${r.id}`, label: label(r), status: "gewijzigd", detail: r.verschillen.join(", ") });
  for (const r of plan.elementen.verdwenen)
    if (!VOLGT_UITEINDEN.has(r.elementType))
      tak(domeinVan(state?.elements, r.bestaandId)).kinderen.push({
        sleutel: `weg:${r.bestaandId}`,
        label: label(r),
        status: "verdwenen",
        detail: "niet in de import; aanvinken = hier ook weg",
        aan: false,
      });
  wortel.kinderen.push(...[...perDomein.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, k]) => k));
  return [wortel];
}

/**
 * De gekozen sleutels plus de verbindingen die hun uiteinden volgen: aan als er een
 * uiteinde mee gaat (nieuw of bijgewerkt). Een verdwenen element neemt zijn compositie mee
 * (de store ruimt verbindingen naar een weggehaald element zelf op).
 * @param {ReturnType<typeof planV3Import>["plan"]} plan
 * @param {{elements: Record<string, any>}} model
 * @param {Iterable<string>} gekozen
 */
export function metVolgendeVerbindingen(plan, model, gekozen) {
  const aan = new Set(gekozen);
  for (const r of [...plan.elementen.nieuw, ...plan.elementen.gewijzigd]) {
    if (!VOLGT_UITEINDEN.has(r.elementType)) continue;
    const el = model.elements[r.id];
    const bestaat = (id) => !plan.elementen.nieuw.some((n) => n.id === id) || aan.has(`el:${id}`);
    if (el && bestaat(el.source) && bestaat(el.target)) aan.add(`el:${r.id}`);
  }
  return aan;
}
