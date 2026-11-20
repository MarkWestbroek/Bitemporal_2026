// @ts-check
/**
 * profielGereedschap — het pure deel van de meta-editor (plan §8.9, trede 1):
 * een profiel-descriptor als JSON bewerken en live registreren.
 *
 * De descriptor-JSON is de serialiseerbare Definitie-kern (plan §2); functies
 * horen daar niet in. Hooks verwijzen daarom **op id** naar de vaste
 * HOOK_CATALOGUS hier (Implementatie-domein) — dezelfde constructie die het
 * configuratie-register (fase 7) straks nodig heeft:
 *
 *   "hooks": { "edgeLabels": "kardinaliteiten",
 *              "edgePresentatie": "directioneel-pijl" }
 *
 * `vertaalHooks` zet die id's om naar functies; `maakGeneriekeMaakElement`
 * geeft elk profiel een standaard element-fabriek.
 */
import { startNaam } from "../../diagramcore/types/startNaam.js";
import { codeVan, codeIdVan } from "../../diagramcore/types/codeRegister.js";

/** Catalogus van benoembare hooks (uitbreidbaar; ids zijn het contract). */
export const HOOK_CATALOGUS = {
  edgeLabels: {
    /** UML-stijl: bron-/doelkardinaliteit + naam in het midden (kaal). */
    kardinaliteiten: (conn) => {
      const d = conn.data || {};
      const bron = [];
      const doel = [];
      const kaal = [];
      if (d.bronKardinaliteit) {
        bron.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
        kaal.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
      }
      if (d.doelKardinaliteit) {
        doel.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
        kaal.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
      }
      // Let op: geen naam-label toevoegen — de core zet de connector-naam
      // al automatisch als midden-label (anders verschijnt hij dubbel).
      return { bron, doel, kaal };
    },
  },
  edgePresentatie: {
    /** data.directioneel === true → open pijl aan de doelzijde. */
    "directioneel-pijl": (conn) => (conn.data?.directioneel ? { markerEnd: "pijl-open" } : {}),
  },
};

/**
 * De id van een hook-functie: eerst de catalogus van die soort (`kardinaliteiten`), anders de
 * code-id uit het register (`erd:relatie.hooks.edgePresentatie`). Een onbekende functie: undefined.
 * @param {string} soort
 * @param {any} fn
 */
export function hookIdVan(soort, fn) {
  if (typeof fn === "string") return fn;
  const inCatalogus = Object.entries(HOOK_CATALOGUS[soort] || {}).find(([, f]) => f === fn)?.[0];
  return inCatalogus ?? codeIdVan(fn);
}

/** De code bij een hook-verwijzing; een onbekende id is een fout, nooit een stille gok. */
function hookCode(soort, ref, wie) {
  if (typeof ref === "function") return ref;
  if (typeof ref !== "string") throw new Error(`${wie}: hook "${soort}" moet een catalogus-id (string) zijn`);
  const fn = HOOK_CATALOGUS[soort]?.[ref] ?? codeVan(ref);
  if (!fn) {
    const bekend = Object.keys(HOOK_CATALOGUS[soort] || {}).join(", ") || "(geen)";
    throw new Error(`${wie}: onbekende ${soort}-hook "${ref}" — beschikbaar: ${bekend}, of een code-id van een geregistreerd profiel`);
  }
  return fn;
}

/** De code bij een code-id (resolver, layout); een onbekende id is een fout. */
function code(ref, wie) {
  if (typeof ref !== "string") return ref;
  const c = codeVan(ref);
  if (!c) throw new Error(`${wie}: onbekende code-id "${ref}" (geen geregistreerd profiel heeft hem)`);
  return c;
}

/**
 * Vertaal de verwijzingen naar code in een descriptor-kern naar de code zelf. Geeft een nieuwe
 * descriptor terug; onbekende id's → Error.
 *
 * - hooks (op een elementtype en op het profiel): een id uit HOOK_CATALOGUS, of een code-id
 *   (`diagramcore/types/codeRegister.js`, code op id: PROF-1);
 * - referenceResolvers en eigen layouts: een code-id.
 * Een functie of object dat er al staat, blijft staan.
 *
 * @param {Object} kern - JSON-descriptor (elementTypes[].hooks: Record<string,string>)
 * @returns {Object} descriptor met functie-hooks
 */
export function vertaalHooks(kern) {
  const elementTypes = (kern.elementTypes || []).map((et) => {
    if (!et?.hooks) return et;
    const hooks = {};
    for (const [soort, ref] of Object.entries(et.hooks)) hooks[soort] = hookCode(soort, ref, `ElementType "${et.id}"`);
    return { ...et, hooks };
  });
  const uit = { ...kern, elementTypes };
  if (kern.hooks) {
    uit.hooks = {};
    for (const [soort, ref] of Object.entries(kern.hooks)) uit.hooks[soort] = hookCode(soort, ref, `DiagramType "${kern.id}"`);
  }
  if (kern.referenceResolvers) {
    uit.referenceResolvers = Object.fromEntries(Object.entries(kern.referenceResolvers).map(([type, ref]) => [type, code(ref, `DiagramType "${kern.id}", resolver ${type}`)]));
  }
  if (Array.isArray(kern.layouts)) uit.layouts = kern.layouts.map((ref) => code(ref, `DiagramType "${kern.id}", layout`));
  return uit;
}

/**
 * Standaard element-fabriek voor een (dynamisch) profiel: nieuw element per
 * niet-connector-type, met "Nieuw<Label>" als naam.
 *
 * @param {Object} descriptor
 * @returns {(elementTypeId: string) => Object|null}
 */
export function maakGeneriekeMaakElement(descriptor) {
  let teller = 0;
  return (elementTypeId) => {
    const et = (descriptor.elementTypes || []).find((t) => t.id === elementTypeId);
    if (!et || et.isConnector) return null;
    teller += 1;
    const element = {
      id: `${descriptor.id}_${Date.now()}_${teller}`,
      naam: startNaam(et, { tekens: /[^A-Za-z0-9]/g }),
      elementType: et.id,
      compartimenten: [],
      data: {},
    };
    if (et.shape === "note") {
      element.naam = "";
      element.data.tekst = "";
    }
    return element;
  };
}

/** Sjabloon: minimaal geldig profiel om vanaf te werken. */
export const LEEG_SJABLOON = {
  id: "mijn-profiel",
  label: "Mijn profiel",
  style: "uml-klassiek",
  fieldTypes: [
    {
      id: "veld",
      viewer: "naam-type",
      properties: [
        { key: "naam", datatype: "string", verplicht: true },
        { key: "typeLabel", label: "type", datatype: "string" },
      ],
    },
  ],
  elementTypes: [
    {
      id: "ding",
      label: "Ding",
      kort: "D",
      shape: "class-box",
      kleur: "#e2e8f0",
      properties: [{ key: "kleur", datatype: "colour" }],
      compartments: [{ id: "velden", fieldType: "veld" }],
    },
    {
      id: "lijn",
      label: "Lijn",
      kort: "—",
      shape: "edge",
      isConnector: true,
      bron: { elementTypes: ["ding"] },
      doel: { elementTypes: ["ding"] },
      edgePresentatie: { lijn: "solid", kleur: "#64748b" },
    },
  ],
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

/** Sjabloon: graaf-demo met de bol-shape (POC §8.10) — knopen als bollen. */
export const GRAAF_DEMO = {
  id: "graaf-demo",
  label: "Graaf (demo)",
  style: "uml-klassiek",
  fieldTypes: [
    {
      id: "eigenschap",
      viewer: "naam-type",
      properties: [
        { key: "naam", datatype: "string", verplicht: true },
        { key: "typeLabel", label: "waarde", datatype: "string" },
      ],
    },
  ],
  elementTypes: [
    {
      id: "knoop",
      label: "Knoop",
      kort: "◉",
      shape: "bol",
      kleur: "#a5b4fc",
      properties: [{ key: "kleur", datatype: "colour" }],
      compartments: [{ id: "eigenschappen", fieldType: "eigenschap" }],
    },
    {
      id: "kant",
      label: "Kant",
      kort: "—",
      shape: "edge",
      isConnector: true,
      bron: { elementTypes: ["knoop"] },
      doel: { elementTypes: ["knoop"] },
      edgePresentatie: { lijn: "solid", kleur: "#6366f1" },
      properties: [
        { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
        { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
        { key: "directioneel", label: "gericht (→ doel)", datatype: "boolean" },
      ],
      hooks: { edgeLabels: "kardinaliteiten", edgePresentatie: "directioneel-pijl" },
    },
  ],
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};
