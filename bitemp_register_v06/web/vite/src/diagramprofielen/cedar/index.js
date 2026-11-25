// @ts-check
/**
 * cedar — Cedar (AWS, cedarpolicy.com) als diagramprofiel (M2). Aanleiding: Open FTV beheert
 * toegangsbeleid in Cedar (PABC-policies); we willen Cedar en ODRL in beide richtingen kunnen
 * vertalen, met Toegangsspraak als spil (plan fase 2/3; TRANSFORMATIES.md §8).
 *
 * Twee soorten inhoud, zoals Cedar ze zelf scheidt:
 *
 *   - schema: entiteittype («entity», attributen als regels, `in` = memberOfTypes),
 *     actie («action», appliesTo als pijlen naar principal- en resourcetypen, `in` = memberOf),
 *     commontype («type»). Zonder schema (PABC heeft er geen) leidt de adapter het af uit de
 *     policies, gemarkeerd als `afgeleid`.
 *   - policy («permit»/«forbid»): de Cedar-tekst is het bewerkvlak (`tekst`), de JSON-vorm van
 *     Cedar (EST) wordt eruit gelezen (`cedar`) en is wat transformaties gebruiken. De regels in de
 *     kaart (annotaties, scope, condities) en de scope-pijlen naar het schema zijn afgeleid
 *     (`leidAf`, in hooks.migreerModel), zoals bij SHACL.
 *
 * Lezer en schrijver zijn eigen JS (lezer.js, schrijver.js), geen cedar-wasm: die weigert de
 * PABC-vorm `name::"…"` als actie, cedar-go (de PDP van Open FTV) niet. De adapter meldt het.
 *
 * Geen nieuwe shapes: class-box en edge.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { leesPolicies } from "./lezer.js";
import { expressieTekst, entiteitTekst } from "./schrijver.js";

export const CEDAR_ID = "cedar";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const BESCHRIJVING = { key: "beschrijving", label: "beschrijving", datatype: "tekst" };
const AFGELEID = { key: "afgeleid", label: "afgeleid uit de policies (geen schema)", datatype: "boolean" };
const KLEUR_EFFECT = { permit: "#dcfce7", forbid: "#fee2e2" };

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "attribuut",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "attribuut", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type (String, Long, Bool, Set<String>, een entiteittype, …)", datatype: "string" },
      { key: "optioneel", label: "optioneel (required: false)", datatype: "boolean" },
      // Toegangsspraak (fase 2): de naam van het kenmerk in de zin; leeg = afgeleid ("…Rollen" → "rol").
      { key: "kenmerk", label: "kenmerk in Toegangsspraak (leeg: afgeleid, …rollen → rol)", datatype: "string" },
    ],
  },
  { id: "cedarregel", viewer: "tekst", properties: [{ key: "naam", datatype: "string" }] },
];

/** De regels in een policy-kaart: annotaties, de scope en de condities, uit de EST. */
export function policyRegels(element) {
  const est = element?.data?.cedar;
  if (element?.data?.fout) return [{ compartmentType: "scope", velden: [{ naam: `⚠ ${element.data.fout}`, fieldType: "cedarregel" }] }];
  if (!est) return [];
  const rij = (naam) => ({ naam, fieldType: "cedarregel" });
  const scope = (naam, s) => {
    if (!s || s.op === "All") return naam;
    if (s.op === "in" && s.entities) return `${naam} in [${s.entities.map(entiteitTekst).join(", ")}]`;
    const doel = (x) => (x.slot ? x.slot : entiteitTekst(x.entity));
    if (s.op === "is") return `${naam} is ${s.entity_type}${s.in ? ` in ${doel(s.in)}` : ""}`;
    return `${naam} ${s.op} ${doel(s)}`;
  };
  const uit = [];
  const ann = Object.entries(est.annotations || {});
  if (ann.length) uit.push({ compartmentType: "annotaties", velden: ann.map(([k, v]) => rij(v === null ? `@${k}` : `@${k}("${v}")`)) });
  uit.push({ compartmentType: "scope", velden: [scope("principal", est.principal), scope("action", est.action), scope("resource", est.resource)].map(rij) });
  if ((est.conditions || []).length) {
    uit.push({ compartmentType: "condities", velden: est.conditions.map((c) => rij(`${c.kind} { ${expressieTekst(c.body)} }`)) });
  }
  return uit;
}

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "policy",
    label: "Policy",
    omschrijving: "Een Cedar-policy (permit of forbid). Bewerk de Cedar-tekst; scope, condities en de pijlen naar het schema volgen eruit.",
    kort: "POL",
    stereotype: "«policy»",
    shape: "class-box",
    kleur: "#f1f5f9",
    icoon: "tr-policy",
    minBreedte: 380,
    properties: [
      { key: "tekst", label: "Cedar", datatype: "tekst" },
      { key: "titel", label: "titel", datatype: "string" },
      BESCHRIJVING,
      { key: "status", label: "status (Open FTV)", datatype: "string" },
      KLEUR_VELD,
    ],
    compartments: [
      { id: "annotaties", label: null, fieldType: "cedarregel", alleenWeergave: true, verbergInInspector: true },
      { id: "scope", label: null, fieldType: "cedarregel", alleenWeergave: true, verbergInInspector: true },
      { id: "condities", label: null, fieldType: "cedarregel", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      extraCompartimenten: policyRegels,
      stereotype: (el) => `«${el?.data?.cedar?.effect || el?.data?.effect || "policy"}»`,
    },
  },
  {
    id: "entiteittype",
    label: "Entiteittype",
    omschrijving: "Een entiteittype uit het Cedar-schema; de attributen zijn de regels, `in` (memberOfTypes) een pijl.",
    kort: "ENT",
    stereotype: "«entity»",
    shape: "class-box",
    kleur: "#dbeafe",
    icoon: "klasse",
    properties: [{ key: "tags", label: "tags (type)", datatype: "string" }, AFGELEID, BESCHRIJVING, KLEUR_VELD],
    compartments: [{ id: "attributen", label: null, fieldType: "attribuut" }],
  },
  {
    id: "actie",
    label: "Actie",
    omschrijving: "Een actie uit het Cedar-schema (naam = het id); appliesTo als pijlen, `in` (memberOf) naar een actiegroep.",
    kort: "ACT",
    stereotype: "«action»",
    shape: "class-box",
    kleur: "#ffedd5",
    icoon: "handeling",
    properties: [
      { key: "actietype", label: "type (Action, NS::Action; PABC: name)", datatype: "string" },
      // Toegangsspraak (fase 2): de actielijst van het profiel is de woordenschat; één woord per actie.
      { key: "handeling", label: "handeling in Toegangsspraak (één woord; leeg: laatste deel van de naam)", datatype: "string" },
      { key: "context", label: "context (Cedar-schema JSON, record)", datatype: "tekst" },
      AFGELEID,
      BESCHRIJVING,
      KLEUR_VELD,
    ],
  },
  {
    id: "commontype",
    label: "Common type",
    omschrijving: "Een benoemd type uit het schema (commonTypes).",
    kort: "TYPE",
    stereotype: "«type»",
    shape: "class-box",
    kleur: "#f5f3ff",
    icoon: "datatype",
    properties: [{ key: "definitie", label: "definitie (Cedar-schema JSON)", datatype: "tekst" }, BESCHRIJVING, KLEUR_VELD],
  },
  {
    id: "boundary",
    label: "Kader",
    kort: "KADER",
    shape: "boundary",
    icoon: "kader",
    achtergrond: true,
    handleStijl: "onzichtbaar",
    properties: [
      { key: "kleur", label: "rand", datatype: "colour" },
      { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
    ],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "lid",
    label: "in (memberOf)",
    kort: "in",
    shape: "edge",
    icoon: "generalisatie",
    isConnector: true,
    bron: { elementTypes: ["entiteittype", "actie"] },
    doel: { elementTypes: ["entiteittype", "actie"] },
    edgePresentatie: { lijn: "solid", kleur: "#475569", markerEnd: "driehoek", labels: [{ zijde: "midden", delen: [{ tekst: "in", soort: "constraint" }] }] },
  },
  {
    id: "geldtVoor",
    label: "appliesTo",
    kort: "→",
    shape: "edge",
    icoon: "verwijzing",
    isConnector: true,
    bron: { elementTypes: ["actie"] },
    doel: { elementTypes: ["entiteittype"] },
    edgePresentatie: { lijn: "dash-6-3", kleur: "#c2410c", markerEnd: "pijl-open" },
    properties: [
      {
        key: "rol",
        label: "rol",
        datatype: "keuze",
        opties: [
          { waarde: "principal", label: "principal" },
          { waarde: "resource", label: "resource" },
        ],
      },
    ],
    hooks: { edgeLabels: (conn) => ({ bron: [], doel: [], kaal: [{ zijde: "midden", delen: [{ tekst: conn.data?.rol || "", soort: "rolnaam" }] }] }) },
  },
  {
    // Afgeleid uit de scope van een policy (leidAf): niet zelf tekenen.
    id: "scope",
    label: "scope (afgeleid)",
    kort: "scope",
    shape: "edge",
    icoon: "verwijzing",
    isConnector: true,
    bron: { elementTypes: ["policy"] },
    doel: { elementTypes: ["entiteittype", "actie"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b", markerEnd: "pijl-open" },
    properties: [{ key: "rol", label: "rol", datatype: "string" }],
    hooks: { edgeLabels: (conn) => ({ bron: [], doel: [], kaal: [{ zijde: "midden", delen: [{ tekst: conn.data?.rol || "", soort: "rolnaam" }] }] }) },
  },
];

const isConnector = (el) => Boolean(el?.source && el?.target);

/** Het entiteittype- en actie-element waar een scope naar wijst (op naam; acties op type + id). */
function scopeDoelen(est) {
  const uit = [];
  const typeVan = (s) => (s?.op === "is" ? [s.entity_type, s.in?.entity?.type] : s?.entity ? [s.entity.type] : []).filter(Boolean);
  for (const t of typeVan(est.principal)) uit.push({ rol: "principal", soort: "entiteittype", naam: t });
  for (const t of typeVan(est.resource)) uit.push({ rol: "resource", soort: "entiteittype", naam: t });
  const acties = est.action?.entities || (est.action?.entity ? [est.action.entity] : []);
  for (const a of acties) uit.push({ rol: "action", soort: "actie", naam: a.id, actietype: a.type });
  return uit;
}

/**
 * Na elke wijziging: de Cedar-tekst van een gewijzigde policy opnieuw lezen (EST of fout) en
 * de scope-pijlen opnieuw afleiden. Idempotent; geeft null als er niets verandert.
 * @param {Record<string, any>|undefined} elements
 */
export function leidAf(elements) {
  if (!elements) return null;
  let anders = false;
  /** @type {Record<string, any>} */
  const uit = {};
  for (const [id, el] of Object.entries(elements)) {
    if (el.elementType === "scope") continue;
    if (el.elementType !== "policy" || el.data?.tekst === el.data?.cedarVan) {
      uit[id] = el;
      continue;
    }
    const data = { ...el.data, cedarVan: el.data?.tekst };
    try {
      const pols = leesPolicies(String(el.data?.tekst || ""));
      if (pols.length !== 1) throw new Error(pols.length ? `${pols.length} policies in één element; één per element` : "geen policy in de tekst");
      data.cedar = pols[0].est;
      data.effect = pols[0].est.effect;
      data.fout = "";
    } catch (e) {
      data.fout = e?.message || String(e);
    }
    uit[id] = { ...el, data };
    anders = true;
  }
  // Scope-pijlen: policy → entiteittype (principal/resource) en → actie.
  const perNaam = new Map();
  for (const el of Object.values(uit)) {
    if (el.elementType === "entiteittype") perNaam.set(`entiteittype::${el.naam}`, el.id);
    if (el.elementType === "actie") perNaam.set(`actie::${el.data?.actietype || "Action"}::${el.naam}`, el.id);
  }
  for (const el of Object.values(uit)) {
    if (el.elementType !== "policy" || !el.data?.cedar || el.data?.fout) continue;
    for (const d of scopeDoelen(el.data.cedar)) {
      const doel = perNaam.get(d.soort === "actie" ? `actie::${d.actietype}::${d.naam}` : `entiteittype::${d.naam}`);
      if (!doel) continue;
      const sid = `scope__${el.id}__${d.rol}__${doel}`;
      if (uit[sid]) continue;
      uit[sid] = { id: sid, naam: "", elementType: "scope", source: el.id, target: doel, compartimenten: [], data: { rol: d.rol } };
    }
  }
  const oud = Object.keys(elements).filter((id) => elements[id].elementType === "scope").sort().join("|");
  const nieuw = Object.keys(uit).filter((id) => uit[id].elementType === "scope").sort().join("|");
  return anders || oud !== nieuw ? uit : null;
}

/** Rijen-layout: schema (entiteittypen, acties) boven, policies eronder. */
export function cedarPosities({ ids, elements }) {
  const groep = (soorten) => ids.filter((id) => soorten.includes(elements?.[id]?.elementType));
  const posities = {};
  let y = 60;
  for (const [soorten, breedte, perRij] of [
    [["entiteittype", "commontype"], 340, 5],
    [["actie"], 340, 5],
    [["policy"], 440, 4],
  ]) {
    const lijst = groep(soorten);
    for (let i = 0; i < lijst.length; i += perRij) {
      const rij = lijst.slice(i, i + perRij);
      rij.forEach((id, k) => (posities[id] = { x: 80 + k * breedte, y }));
      const regels = Math.max(0, ...rij.map((id) => policyRegels(elements[id]).reduce((n, c) => n + c.velden.length, 0) + (elements[id]?.compartimenten || []).reduce((n, c) => n + (c.velden || []).length, 0)));
      y += Math.max(130, 80 + regels * 22) + 60;
    }
  }
  for (const id of ids) posities[id] ??= { x: 80, y: (y += 160) };
  return posities;
}

export const cedarDiagramType = {
  id: CEDAR_ID,
  label: "Cedar",
  // 1.1.0: handeling (actie) en kenmerk (attribuut) voor de vertaling met Toegangsspraak.
  versie: "1.1.0",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  layouts: [
    {
      id: "cedar-lagen",
      label: "Auto-layout",
      run: ({ flowNodes, elements }) => cedarPosities({ ids: flowNodes.filter((n) => !n.hidden && !isConnector(elements?.[n.id])).map((n) => n.id), elements }),
    },
  ],
  hooks: {
    migreerModel: (state) => {
      const elements = leidAf(state?.elements);
      return elements ? { elements, diagrams: state.diagrams, meta: state.meta } : null;
    },
  },
};

export { KLEUR_EFFECT };

let _teller = 0;
const START = {
  policy: '@id("nieuw")\npermit (\n    principal,\n    action,\n    resource\n);',
};

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = { id: `cedar_${Date.now()}_${_teller}`, naam: et.id === "policy" ? "nieuw" : et.id === "actie" ? "bekijken" : et.label, elementType: et.id, compartimenten: [], data: {} };
  if (et.id === "policy") element.data = { tekst: START.policy };
  if (et.id === "actie") element.data = { actietype: "Action" };
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCedar() {
  if (!getDiagramType(CEDAR_ID)) registreerDiagramType(cedarDiagramType);
}
