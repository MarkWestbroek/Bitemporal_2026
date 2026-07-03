// @ts-check
/**
 * puur-uml — het tweede diagramprofiel (fase 5, lakmoesproef): klassieke
 * UML-klassediagrammen op de generieke diagram-motor.
 *
 * Doel van dit profiel is niet volledigheid, maar bewijzen dat de abstractie
 * klopt: klasse/interface/enumeratie met attributen en operaties, associatie
 * (mét attributen → associatieklasse, gratis via de ASOC-materialisatie van
 * de core), aggregatie/compositie, generalisatie, realisatie en dependency —
 * zonder één regel core- of shell-wijziging, alleen deze descriptor plus een
 * tweede aanroep van maakDiagramActiviteit.
 *
 * Bewust nog niet (restpunten fase 5): zichtbaarheid (+/-/#) als apart
 * property, auto-layout-strategie, eigen StyleType-tokens (§8.5b).
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const PUUR_UML_ID = "puur-uml";

/**
 * Kandidaat-types voor attribuut-/operatietypes: primitieven, «dataType»s en
 * enumeraties. Klassen/interfaces zijn bewust géén type-soort — een
 * verwijzing naar een klasse modelleer je met een associatie, niet met een
 * attribuuttype.
 */
const TYPE_REFS = ["primitief", "datatype", "enumeratie"];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  {
    id: "attribuut",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
    ],
  },
  {
    id: "operatie",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "signatuur", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "retourtype", referenceTypes: TYPE_REFS },
    ],
  },
  {
    id: "literal",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
];

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const KLASSIFIERS = ["klasse", "interface", "enumeratie"];
// Generalisatie/dependency mogen ook tussen/naar «dataType»s (associatie
// niet: een datatype heeft geen identiteit — daar is het attribuuttype voor).
const MET_DATATYPE = [...KLASSIFIERS, "datatype"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "klasse",
    label: "Klasse",
    kort: "KL",
    shape: "class-box",
    kleur: "#fef9c3",
    properties: [KLEUR_VELD, { key: "abstract", label: "abstract", datatype: "boolean" }],
    compartments: [
      { id: "attributen", label: null, fieldType: "attribuut" },
      { id: "operaties", label: null, fieldType: "operatie" },
    ],
  },
  {
    id: "interface",
    label: "Interface",
    kort: "IF",
    stereotype: "«interface»",
    shape: "class-box",
    kleur: "#dcfce7",
    properties: [KLEUR_VELD],
    compartments: [{ id: "operaties", label: null, fieldType: "operatie" }],
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    kort: "EN",
    stereotype: "«enumeration»",
    shape: "class-box",
    kleur: "#fef3c7",
    properties: [KLEUR_VELD],
    compartments: [{ id: "literals", label: null, fieldType: "literal" }],
  },
  {
    // UML «dataType»: waardetype zonder identiteit; mag zelf attributen
    // hebben (gestructureerd datatype, bv. Geldbedrag met bedrag + valuta).
    id: "datatype",
    label: "Datatype",
    kort: "DT",
    stereotype: "«dataType»",
    shape: "class-box",
    kleur: "#dbeafe",
    properties: [KLEUR_VELD],
    compartments: [{ id: "attributen", label: null, fieldType: "attribuut" }],
  },
  {
    id: "notitie",
    label: "Notitie",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "boundary",
    label: "Kader",
    kort: "KADER",
    shape: "boundary",
    achtergrond: true,
    handleStijl: "onzichtbaar",
    properties: [
      { key: "kleur", label: "rand", datatype: "colour" },
      { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
    ],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // Associatie met attributen wordt vanzelf een associatieklasse: de core
    // materialiseert een connector mét velden als anker + box + drie edges.
    id: "associatie",
    label: "Associatie",
    kort: "AS",
    stereotype: "«associatie»",
    shape: "class-box",
    kleur: "#e0e7ff",
    isConnector: true,
    bron: { elementTypes: KLASSIFIERS },
    doel: { elementTypes: KLASSIFIERS },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    properties: [
      KLEUR_VELD,
      { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
      { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
      { key: "directioneel", label: "gericht (→ doel)", datatype: "boolean" },
    ],
    compartments: [{ id: "attributen", label: null, fieldType: "attribuut" }],
    hooks: {
      /** Richting (navigeerbaarheid): open pijl aan de doelzijde. */
      edgePresentatie: (conn) =>
        conn.data?.directioneel ? { markerEnd: "pijl-open" } : {},
      /** UML-kardinaliteiten en rolnamen aan de uiteinden. */
      edgeLabels: (conn) => {
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
        if (conn.naam) {
          kaal.push({ zijde: "midden", delen: [{ tekst: conn.naam, soort: "naam" }] });
        }
        return { bron, doel, kaal };
      },
    },
  },
  {
    id: "aggregatie",
    label: "Aggregatie",
    kort: "◇",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["klasse"] },
    doel: { elementTypes: ["klasse"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit-open" },
  },
  {
    id: "compositie",
    label: "Compositie",
    kort: "◆",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["klasse"] },
    doel: { elementTypes: ["klasse"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit" },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    kort: "▷",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: MET_DATATYPE },
    doel: { elementTypes: MET_DATATYPE },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "realisatie",
    label: "Realisatie",
    kort: "⊳┄",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["klasse"] },
    doel: { elementTypes: ["interface"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "dependency",
    label: "Dependency",
    kort: "use",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: MET_DATATYPE },
    doel: { elementTypes: MET_DATATYPE },
    edgePresentatie: {
      lijn: "dash-6-3",
      vorm: "hoekig",
      kleur: "#64748b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«use»", soort: "constraint", kleur: "#7c3aed" }] }],
    },
  },
];

/** Zelfde kandidaat-vorm als canoniek-uml (waarde/label/icoon/groep/pad). */
function elementKandidaten(elements, filter, icoon, groep) {
  return Object.values(elements || {})
    .filter((el) => el.naam && filter(el))
    .map((el) => ({ waarde: el.naam, label: el.naam, icoon, groep, pad: [] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  primitief: () =>
    ["String", "Integer", "Real", "Boolean", "Date"].map((t) => ({
      waarde: t,
      label: t,
      groep: "Primitieven",
      pad: [],
    })),
  datatype: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "datatype", "✦", "Datatypes"),
  enumeratie: ({ elements }) =>
    elementKandidaten(elements, (el) => el.elementType === "enumeratie", "◇", "Enumeraties"),
};

/** @type {import("../../diagramcore/types/schema.js").ReferenceType[]} */
const referenceTypes = [
  { id: "primitief", label: "Primitief type" },
  { id: "datatype", label: "Datatype («dataType»)" },
  { id: "enumeratie", label: "Enumeratie" },
];

export const puurUmlDiagramType = {
  id: PUUR_UML_ID,
  label: "Puur UML (klassediagram)",
  // Zelfde StyleType als canoniek-uml: klassieke UML-pastels. Een eigen
  // tokenset is een §8.5b-punt (thema's per StyleType), geen fase 5-blokker.
  style: "uml-klassiek",
  fieldTypes,
  elementTypes,
  referenceTypes,
  referenceResolvers,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  const element = {
    id: `pu_${Date.now()}_${_teller}`,
    naam: `Nieuwe${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerPuurUml() {
  if (!getDiagramType(PUUR_UML_ID)) {
    registreerDiagramType(puurUmlDiagramType);
  }
}
