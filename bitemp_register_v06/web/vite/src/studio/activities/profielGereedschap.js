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
      if (conn.naam) kaal.push({ zijde: "midden", delen: [{ tekst: conn.naam, soort: "naam" }] });
      return { bron, doel, kaal };
    },
    /** Alleen de connector-naam in het midden. */
    naam: (conn) =>
      conn.naam
        ? { bron: [], doel: [], kaal: [{ zijde: "midden", delen: [{ tekst: conn.naam, soort: "naam" }] }] }
        : { bron: [], doel: [], kaal: [] },
  },
  edgePresentatie: {
    /** data.directioneel === true → open pijl aan de doelzijde. */
    "directioneel-pijl": (conn) => (conn.data?.directioneel ? { markerEnd: "pijl-open" } : {}),
  },
};

/**
 * Vertaal hook-id's (strings) in een descriptor-kern naar echte functies uit
 * de catalogus. Geeft een nieuwe descriptor terug; onbekende id's → Error.
 *
 * @param {Object} kern - JSON-descriptor (elementTypes[].hooks: Record<string,string>)
 * @returns {Object} descriptor met functie-hooks
 */
export function vertaalHooks(kern) {
  const elementTypes = (kern.elementTypes || []).map((et) => {
    if (!et?.hooks) return et;
    const hooks = {};
    for (const [hookNaam, hookId] of Object.entries(et.hooks)) {
      if (typeof hookId !== "string") {
        throw new Error(
          `ElementType "${et.id}": hook "${hookNaam}" moet een catalogus-id (string) zijn`
        );
      }
      const fn = HOOK_CATALOGUS[hookNaam]?.[hookId];
      if (!fn) {
        const bekend = Object.keys(HOOK_CATALOGUS[hookNaam] || {}).join(", ") || "(geen)";
        throw new Error(
          `ElementType "${et.id}": onbekende ${hookNaam}-hook "${hookId}" — beschikbaar: ${bekend}`
        );
      }
      hooks[hookNaam] = fn;
    }
    return { ...et, hooks };
  });
  return { ...kern, elementTypes };
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
      naam: `Nieuw${(et.label || et.id).replace(/[^A-Za-z0-9]/g, "")}`,
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
