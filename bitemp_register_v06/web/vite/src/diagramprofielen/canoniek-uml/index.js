// @ts-check
/**
 * canoniek-uml — het eerste diagramprofiel: het canonieke datamodel
 * (Entiteit, GE, REL, enumeraties, …) als DiagramType-configuratie.
 *
 * Fase 1: read-only spiegel (adapter.js beeldt useModelStore af).
 * Fase 2: bewerken — `fieldTypes` hebben editor-regels (gegenereerde
 * inspector), er zijn kale **connector-typen** (compositie, generalisatie,
 * «use») met verbindingsregels en `edgePresentatie`, en `taakbalken`
 * beschrijft de "Maken"- en "Verbinding"-balken.
 *
 * Fase 3B: `relatie` is een echt `isConnector`-type; de adapter vouwt de
 * oude REL-node + anker + edges terug tot één connector-element, en de core
 * materialiseert het ASOC-patroon zelf (het anker is een synthetische node
 * van de canvas — geen elementtype meer).
 *
 * Kleuren komen overeen met defaultKleur() in umleditor/metamodel/types.js.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { berekenAutoLayout } from "../../umleditor/metamodel/autoLayout.js";

export const CANONIEK_UML_ID = "canoniek-uml";

/**
 * FieldTypes met hun PropertyTypes (metamodel, vierde iteratie): declaratief
 * {key, datatype, referenceTypes?}; de widget volgt uit de datatype-registry.
 * `TYPE_REFS` = de vier soorten kandidaten voor een attribuuttype.
 */
const TYPE_REFS = ["basistype", "gegevenstype", "enumeratie", "refitem"];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "attribuut",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "verplicht", datatype: "boolean" },
      { key: "afgeleid", datatype: "boolean" },
    ],
  },
  {
    id: "afgeleidVeld",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "afleidingsregel", label: "afleidingsregel (CEL)", datatype: "cel-expressie" },
    ],
  },
  {
    id: "waarde",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
  {
    id: "eigenschap",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "waarde", datatype: "string" },
    ],
  },
  {
    id: "regel",
    viewer: "tekst",
    properties: [{ key: "naam", label: "regel", datatype: "string", verplicht: true }],
  },
];

/** Gedeelde element-PropertyType: achtergrondkleur (datatype "colour"). */
const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** "sleutel: waarde"-regels voor weergave-compartimenten (lege waarden vallen weg). */
function regelVelden(paren) {
  return paren
    .filter(([, waarde]) => waarde !== undefined && waarde !== null && waarde !== "")
    .map(([sleutel, waarde]) => ({ naam: `${sleutel}: ${waarde}`, fieldType: "regel" }));
}

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "entiteit",
    label: "Entiteit",
    kort: "ENT",
    stereotype: "«entiteit»",
    shape: "class-box",
    kleur: "#bfdbfe",
    icoon: "klasse",
    // tijdlijnvoorkomen (LGM): materieel ↔ isMaterieel; formeel = uit.
    properties: [KLEUR_VELD, { key: "materieel", label: "materieel (tijdlijn)", datatype: "boolean" }],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
      { id: "overerving", label: null, fieldType: "attribuut", alleenWeergave: true },
    ],
    hooks: {
      /**
       * Overgeërfde velden (weergave-compartiment, niet in het element zelf):
       * volg de generalisatie-connectoren kind → ouder en toon de velden van
       * de supertype-keten, cursief met een ↑-kopregel per supertype.
       */
      extraCompartimenten: (element, { elements }) => {
        const velden = [];
        let huidigeId = element.id;
        const bezocht = new Set([element.id]);
        for (;;) {
          const gen = Object.values(elements || {}).find(
            (el) => el.elementType === "generalisatie" && el.source === huidigeId
          );
          const ouder = gen ? elements[gen.target] : null;
          if (!ouder || bezocht.has(ouder.id)) break;
          bezocht.add(ouder.id);
          const ouderVelden = [];
          for (const c of ouder.compartimenten || []) {
            if (c.compartmentType !== "velden" && c.compartmentType !== "afgeleid") continue;
            for (const v of c.velden || []) if (v.naam) ouderVelden.push(v);
          }
          if (ouderVelden.length) {
            velden.push({ naam: `↑ ${ouder.naam}`, fieldType: "regel", data: {} });
            for (const v of ouderVelden) {
              velden.push({
                naam: v.naam,
                fieldType: "attribuut",
                data: { ...v.data, verplicht: false, cursief: true },
              });
            }
          }
          huidigeId = ouder.id;
        }
        return velden.length ? [{ compartmentType: "overerving", velden }] : [];
      },
    },
  },
  {
    id: "gegevenselement",
    label: "Gegevenselement",
    kort: "GE",
    stereotype: "«gegevenselement»",
    shape: "class-box",
    kleur: "#bbf7d0",
    icoon: "veld",
    properties: [KLEUR_VELD, { key: "materieel", label: "materieel (tijdlijn)", datatype: "boolean" }],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
  },
  {
    // Fase 3B: REL is een écht connector-type (metamodel: Connector = Element
    // met source/target). Zonder velden → kale edge; mét velden → het
    // ASOC-patroon (anker + box + 3 edges), automatisch gematerialiseerd —
    // het oude "normaliseer relaties" is daarmee ingebouwd gedrag.
    // Staat vóór generalisatie in de lijst: ENT→ENT slepen zonder expliciete
    // keuze maakt dus een relatie (generalisatie kies je in "Verbinding").
    id: "relatie",
    label: "Relatie",
    kort: "REL",
    stereotype: "«relatie»",
    shape: "class-box",
    kleur: "#ede9fe",
    icoon: "relatie-box",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["entiteit"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b" },
    properties: [
      KLEUR_VELD,
      { key: "materieel", label: "materieel (tijdlijn)", datatype: "boolean" },
      { key: "geordend", label: "geordend {ordered}", datatype: "boolean" },
    ],
    compartments: [
      { id: "velden", label: null, fieldType: "attribuut" },
      { id: "afgeleid", label: null, fieldType: "afgeleidVeld" },
    ],
    hooks: {
      /** Labels voor de gematerialiseerde/kale gedaante (UML-conventies). */
      edgeLabels: (conn) => {
        const d = conn.data || {};
        const bron = [];
        const doel = [];
        const kaal = [];
        if (d.bronKardinaliteit) {
          bron.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
          kaal.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
        }
        if (d.naamLabelHeen) {
          bron.push({ zijde: "doel", delen: [{ tekst: `▶ ${d.naamLabelHeen}`, soort: "naam" }] });
          kaal.push({ zijde: "bron", delen: [{ tekst: `▶ ${d.naamLabelHeen}`, soort: "naam" }] });
        }
        if (d.doelKardinaliteit) {
          doel.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
          kaal.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
        }
        if (d.naamLabelTerug) {
          doel.push({ zijde: "bron", delen: [{ tekst: `◀ ${d.naamLabelTerug}`, soort: "naam" }] });
          kaal.push({ zijde: "doel", delen: [{ tekst: `◀ ${d.naamLabelTerug}`, soort: "naam" }] });
        }
        // Tijdlijnvoorkomen (LGM): «materieel» op de lijn; formeel is default.
        if (d.materieel) {
          const label = { zijde: "midden", delen: [{ tekst: "«materieel»", soort: "constraint", kleur: "#0369a1" }] };
          kaal.push(label);
          bron.push(label);
        }
        if (d.geordend) {
          const label = { zijde: "doel", delen: [{ tekst: "{ordered}", soort: "constraint" }] };
          kaal.push(label);
          doel.push(label);
        }
        return { bron, doel, kaal };
      },
    },
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    kort: "ENUM",
    stereotype: "«enumeratie»",
    shape: "class-box",
    kleur: "#fef3c7",
    icoon: "enumeratie",
    properties: [KLEUR_VELD],
    compartments: [{ id: "waarden", label: null, fieldType: "waarde" }],
  },
  {
    id: "gegevenstype",
    label: "Gegevenstype",
    kort: "TYPE",
    stereotype: "«gegevenstype»",
    shape: "class-box",
    kleur: "#dbeafe",
    icoon: "datatype",
    // Validatie/normalisatie/weergave zijn element-properties met eigen
    // PropertyTypeEditors (implementaties.jsx registreert "validatieregels"
    // en "weergaveregels" in de datatype-registry) — het PropertyType-patroon
    // uit plan §2, zoals "cel-expressie".
    properties: [
      KLEUR_VELD,
      { key: "validatie", label: "Validatie", datatype: "validatieregels" },
      { key: "normalisatie", label: "Normalisatie", datatype: "string" },
      { key: "weergave", label: "Weergave", datatype: "weergaveregels" },
    ],
    compartments: [
      { id: "eigenschappen", label: null, fieldType: "eigenschap" },
      // Alleen op de node: in de inspector zijn validatie/weergave al
      // bewerkbaar via de element-properties hierboven (dubbelop vermeden).
      { id: "validatie", label: null, fieldType: "regel", alleenWeergave: true, verbergInInspector: true },
      { id: "weergave", label: null, fieldType: "regel", alleenWeergave: true, verbergInInspector: true },
    ],
    hooks: {
      /**
       * Validatie- en weergave-compartimenten live uit element.data, zodat de
       * node meebeweegt met wat de inspector wijzigt (voorheen statisch bij
       * de adapter-heenreis gegenereerd, waardoor bewerken onzichtbaar bleef).
       */
      extraCompartimenten: (element) => {
        const d = element.data || {};
        const val = d.validatie || {};
        const wg = d.weergave || {};
        const validatie = regelVelden([
          ["pattern", val.pattern],
          ["minLength", val.minLength],
          ["maxLength", val.maxLength],
          ["minimum", val.minimum],
          ["maximum", val.maximum],
          ["multipleOf", val.multipleOf],
          ...(val.regels || []).map((r) => ["regel", r?.naam || r]),
          ["norm", d.normalisatie],
        ]);
        const weergave = regelVelden([
          ["placeholder", wg.placeholder],
          ["mask", wg.inputMask],
          ["prefix", wg.prefix],
          ["suffix", wg.suffix],
        ]);
        return [
          ...(validatie.length ? [{ compartmentType: "validatie", velden: validatie }] : []),
          ...(weergave.length ? [{ compartmentType: "weergave", velden: weergave }] : []),
        ];
      },
    },
  },
  {
    id: "referentielijstInstantie",
    label: "Referentielijst-instantie",
    kort: "REF",
    stereotype: "«instantie»",
    shape: "class-box",
    kleur: "#fde68a",
    icoon: "lijst",
    properties: [KLEUR_VELD],
    compartments: [{ id: "eigenschappen", label: null, fieldType: "eigenschap" }],
  },
  {
    // Package = het V3-domein als gewoon elementtype (geen core-concept).
    // Het bevat-lidmaatschap is een connector die je meestal niet tekent;
    // de elementen-browser ordent er de boom mee en de adapter vertaalt
    // hem heen en terug naar het domein-veld van V3.
    id: "package",
    label: "Package (domein)",
    kort: "PKG",
    stereotype: "«package»",
    shape: "package",
    kleur: "#f1f5f9",
    icoon: "package",
    // Drop-doel op canvas en in de boom: erin slepen legt de bevat-connector.
    containerVoor: "bevat",
    properties: [KLEUR_VELD],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    icoon: "notitie",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "constraint",
    label: "Constraint",
    kort: "CON",
    stereotype: "«constraint»",
    shape: "rounded",
    kleur: "#e0f2fe",
    icoon: "constraint",
    handleStijl: "onzichtbaar",
    properties: [{ key: "expressie", label: "expressie (OCL/CEL)", datatype: "cel-expressie" }, KLEUR_VELD],
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

  // ── Connector-typen (fase 2: kale edges; ASOC-materialisatie volgt in fase 3) ──
  {
    id: "compositie",
    label: "Compositie",
    kort: "◆",
    shape: "edge",
    icoon: "compositie",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["gegevenselement"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b", markerStart: "ruit" },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    kort: "▷",
    shape: "edge",
    icoon: "generalisatie",
    isConnector: true,
    bron: { elementTypes: ["entiteit"] },
    doel: { elementTypes: ["entiteit"] },
    edgePresentatie: {
      lijn: "solid",
      kleur: "#475569",
      markerEnd: "driehoek",
      labels: [
        { zijde: "midden", delen: [{ tekst: "«Generalisatie»", soort: "constraint", kleur: "#0d9488" }] },
      ],
    },
  },
  {
    id: "gebruik",
    label: "Gebruik («use»)",
    kort: "use",
    shape: "edge",
    icoon: "gebruik",
    isConnector: true,
    bron: { elementTypes: ["entiteit", "gegevenselement", "relatie"] },
    doel: { elementTypes: ["enumeratie", "gegevenstype", "referentielijstInstantie"] },
    edgePresentatie: {
      lijn: "dash-6-3",
      kleur: "#64748b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«use»", soort: "constraint", kleur: "#7c3aed" }] }],
    },
  },
  {
    // Package-lidmaatschap ("plaatsing in"): meestal alleen een model-feit
    // (boomordening, V3-domein), maar tekenbaar als subtiele stippellijn.
    id: "bevat",
    label: "Bevat (package)",
    kort: "pkg ∋",
    shape: "edge",
    icoon: "bevat",
    isConnector: true,
    bron: { elementTypes: ["package"] },
    doel: {
      elementTypes: [
        "entiteit",
        "enumeratie",
        "gegevenstype",
        "referentielijstInstantie",
        "package",
        "notitie",
        "constraint",
      ],
    },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#94a3b8" },
  },
];

/**
 * ReferenceTypes (declaratief) + ReferenceResolvers (implementatie) —
 * metamodel §4.5b. Iconen volgen de oude editor: ✦ gegevenstype,
 * ◇ enumeratie, ▣ ref.lijstitem. Elke resolver levert kandidaten met groep
 * (optgroup/minibrowser-sectie) en pad (domein/package, minibrowser-kolom).
 * @type {import("../../diagramcore/types/schema.js").ReferenceType[]}
 */
const referenceTypes = [
  { id: "basistype", label: "Basistypen" },
  { id: "gegevenstype", label: "Gegevenstypen", icoon: "✦" },
  { id: "enumeratie", label: "Enumeraties", icoon: "◇" },
  { id: "refitem", label: "Referentielijst-items", icoon: "▣" },
];

/** Hulpje: elementen van een soort → gesorteerde kandidaten. */
function elementKandidaten(elements, filter, icoon, groep, labelFn = (el) => el.naam) {
  return Object.values(elements || {})
    .filter((el) => el.naam && filter(el))
    .map((el) => ({ waarde: el.naam, label: labelFn(el), icoon, groep, pad: [el.data?.domein || ""] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  basistype: () =>
    ["string", "integer", "number", "boolean", "date", "date-time"].map((t) => ({
      waarde: t,
      label: t,
      groep: "Basistypen",
    })),
  gegevenstype: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "gegevenstype", "✦", "Gegevenstypen"),
  enumeratie: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "enumeratie", "◇", "Enumeraties"),
  refitem: ({ elements }) =>
    elementKandidaten(
      elements,
      (el) => el.elementType === "entiteit" && el.data?.stereotype === "«ref.lijst item»",
      "▣",
      "Referentielijst-items",
      (el) => `${el.naam} (ref.lijst)`
    ),
};

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const canoniekUmlDiagramType = {
  id: CANONIEK_UML_ID,
  label: "Canoniek datamodel",
  style: "uml-klassiek",
  // P02: eerst package-lidmaatschap (domein), daarna de compositie
  // (ENT ◆ GE) — de browser toont packages → entiteiten → gegevenselementen.
  hierarchie: ["bevat", "compositie"],
  hooks: {
    /**
     * Gespiegelde composities uit het oude model zijn presentatie-edges
     * (markerStart "ruit"), geen connector-elementen — lever ze als extra
     * hiërarchie-paren aan de elementen-browser.
     */
    hierarchieParen: ({ diagrams }) => {
      const paren = [];
      for (const d of Object.values(diagrams || {})) {
        for (const e of d.edges || []) {
          if (e.data?.presentatie?.markerStart === "ruit") paren.push([e.source, e.target]);
        }
      }
      return paren;
    },
  },
  elementTypes,
  fieldTypes,
  referenceTypes,
  referenceResolvers,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
    { id: "auto-layout", label: "Auto-layout", acties: "layouts" },
  ],
  /**
   * Plaatsingsstrategieën (plan §4.5): semantiek, dus profiel-werk. Hergebruikt
   * het gelaagde algoritme van de umleditor (entiteiten boven, GE's eronder,
   * ankers op middelpunten). `run` krijgt de live canvas-context en geeft
   * posities terug (Map/Record) die de core als één undo-stap toepast.
   */
  layouts: [
    {
      id: "gelaagd",
      label: "Auto-layout",
      run: ({ flowNodes, flowEdges, selectieIds }) =>
        berekenAutoLayout(
          // Synthetische ankers van de core ("__anker") spreken in het oude
          // algoritme de taal van de umleditor ("associatieAnker" + relatieNaam).
          flowNodes.map((n) =>
            n.type === "__anker"
              ? { ...n, type: "associatieAnker", data: { ...n.data, relatieNaam: n.data?.connectorId } }
              : n
          ),
          flowEdges,
          {
            selectie: selectieIds || undefined,
            respecteerLocked: true,
          }
        ),
    },
  ],
};

let _teller = 0;

/**
 * Fabriek voor een nieuw (leeg) element van het gegeven type.
 * @param {string} elementTypeId
 * @returns {import("../../diagramcore/model/schema.js").Element|null}
 */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const id = `el_${Date.now()}_${_teller}`;
  const element = {
    id,
    naam: `Nieuw${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  if (et.id === "constraint") element.data.expressie = "";
  if (et.id === "package") element.naam = "NieuwPackage";
  return element;
}

/**
 * Idempotente registratie (veilig bij HMR/dubbele import).
 *
 * LET OP: dit bestand is het Definitie-deel en blijft bewust vrij van
 * .jsx-imports (node-testbaar). De Implementatie-registraties (o.a. de
 * "cel-expressie"-PropertyTypeEditor) staan in implementaties.jsx en worden
 * door de activiteit geladen.
 */
export function registreerCanoniekUml() {
  if (!getDiagramType(CANONIEK_UML_ID)) {
    registreerDiagramType(canoniekUmlDiagramType);
  }
  return canoniekUmlDiagramType;
}
