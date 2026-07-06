// @ts-check
/**
 * mim12 — MIM 1.2 (Metamodel voor Informatie Modellering, Geonovum) als
 * diagramprofiel: het vijfde profiel op de generieke motor. MIM heeft de
 * "pas toe of leg uit"-status voor overheden; dit profiel dekt de kern
 * (zie docs/STUDIO-05-mim-verkenning.md voor de volledige mapping en wat
 * naar fase 2+ gaat: keuze-varianten 2–5, validator, import).
 *
 * Vormgeving: MIM 1.2 normeert alleen semantiek, geen weergave — en op
 * verzoek tonen we geen stereotypen (kleur/vorm draagt het type, zoals in
 * DMN); eigen MIM-ShapeTypes zijn aan de vormgeving.
 *
 * Structuurkeuzes:
 *   - Objecttype/Gegevensgroeptype: class-box met attribuutsoorten; de
 *     MIM-metagegevens zijn PropertyTypes (op het type én per veld).
 *   - Gegevensgroep = ◆-connector objecttype → gegevensgroeptype (nest in
 *     de boom, zoals canoniek ENT ◆ GE).
 *   - Relatiesoort = connector; rollen/kardinaliteiten per zijde als data;
 *     velden erop maken er een relatieklasse van (ASOC-materialisatie).
 *   - Packages (informatiemodel/domein/extern/view) = één package-type met
 *     een soort-property; bevat-connector = boom + drop-doel.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const MIM12_ID = "mim12";

/** Kandidaat-types voor attribuutsoorten en data-elementen. */
const TYPE_REFS = ["mim-primitief", "mim-datatype", "mim-waardelijst"];

/** MIM-basismetagegevens die (vrijwel) elke metaclass draagt. */
const MIM_BASIS = [
  { key: "alias", label: "alias", datatype: "string" },
  { key: "begrip", label: "begrip (URI)", datatype: "string" },
  { key: "definitie", label: "definitie", datatype: "tekst" },
  { key: "toelichting", label: "toelichting", datatype: "tekst" },
  { key: "herkomst", label: "herkomst", datatype: "string" },
  { key: "datumOpname", label: "datum opname", datatype: "string" },
];

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Metagegevens van een attribuutsoort (MIM 1.2 §attribuutsoort). */
const ATTRIBUUTSOORT_VELDEN = [
  { key: "naam", datatype: "string", verplicht: true },
  { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
  { key: "kardinaliteit", label: "kardinaliteit", datatype: "string" },
  { key: "definitie", label: "definitie", datatype: "tekst" },
  { key: "authentiek", label: "authentiek", datatype: "string" },
  { key: "indicatieMaterieleHistorie", label: "materiële historie", datatype: "boolean" },
  { key: "indicatieFormeleHistorie", label: "formele historie", datatype: "boolean" },
  { key: "mogelijkGeenWaarde", label: "mogelijk geen waarde", datatype: "boolean" },
  { key: "identificerend", label: "identificerend", datatype: "boolean" },
  { key: "indicatieAfleidbaar", label: "afleidbaar", datatype: "boolean" },
];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
const fieldTypes = [
  { id: "attribuutsoort", viewer: "naam-type", properties: ATTRIBUUTSOORT_VELDEN },
  {
    id: "dataElement",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", referenceTypes: TYPE_REFS },
      { key: "kardinaliteit", label: "kardinaliteit", datatype: "string" },
    ],
  },
  {
    id: "waarde",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "waarde", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "code", datatype: "string" },
    ],
  },
  {
    id: "referentieElement",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", datatype: "string" },
    ],
  },
];

const OBJECTACHTIG = ["objecttype", "gegevensgroeptype"];
const DATATYPEN = ["primitiefDatatype", "gestructureerdDatatype", "enumeratie", "codelijst", "referentielijst"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "objecttype",
    label: "Objecttype",
    kort: "OT",
    shape: "class-box",
    kleur: "#bfdbfe",
    icoon: "klasse",
    properties: [
      KLEUR_VELD,
      ...MIM_BASIS,
      { key: "herkomstDefinitie", label: "herkomst definitie", datatype: "string" },
      { key: "uniekeAanduiding", label: "unieke aanduiding", datatype: "string" },
      { key: "populatie", label: "populatie", datatype: "tekst" },
      { key: "kwaliteit", label: "kwaliteit", datatype: "tekst" },
      { key: "indicatieAbstract", label: "indicatie abstract object", datatype: "boolean" },
    ],
    compartments: [{ id: "attribuutsoorten", label: null, fieldType: "attribuutsoort" }],
  },
  {
    id: "gegevensgroeptype",
    label: "Gegevensgroeptype",
    kort: "GGT",
    shape: "class-box",
    kleur: "#bbf7d0",
    icoon: "veld",
    properties: [KLEUR_VELD, ...MIM_BASIS],
    compartments: [{ id: "attribuutsoorten", label: null, fieldType: "attribuutsoort" }],
  },
  {
    id: "enumeratie",
    label: "Enumeratie",
    kort: "ENUM",
    shape: "class-box",
    kleur: "#fef3c7",
    icoon: "enumeratie",
    properties: [KLEUR_VELD, ...MIM_BASIS],
    compartments: [{ id: "waarden", label: null, fieldType: "waarde" }],
  },
  {
    // Waarden extern beheerd; de lijst zelf leeft op een URI.
    id: "codelijst",
    label: "Codelijst",
    kort: "CODE",
    shape: "class-box",
    kleur: "#fde68a",
    icoon: "lijst",
    properties: [
      KLEUR_VELD,
      ...MIM_BASIS,
      { key: "waardenverzameling", label: "waardenverzameling (URI)", datatype: "string" },
    ],
  },
  {
    id: "referentielijst",
    label: "Referentielijst",
    kort: "REF",
    shape: "class-box",
    kleur: "#fed7aa",
    icoon: "lijst",
    properties: [
      KLEUR_VELD,
      ...MIM_BASIS,
      { key: "locatie", label: "locatie (URI)", datatype: "string" },
    ],
    compartments: [{ id: "elementen", label: null, fieldType: "referentieElement" }],
  },
  {
    id: "primitiefDatatype",
    label: "Primitief datatype",
    kort: "PDT",
    shape: "class-box",
    kleur: "#dbeafe",
    icoon: "datatype",
    properties: [
      KLEUR_VELD,
      ...MIM_BASIS,
      { key: "patroon", label: "patroon", datatype: "string" },
      { key: "formeelPatroon", label: "formeel patroon (regex)", datatype: "string" },
      { key: "lengte", label: "lengte", datatype: "string" },
    ],
  },
  {
    id: "gestructureerdDatatype",
    label: "Gestructureerd datatype",
    kort: "GDT",
    shape: "class-box",
    kleur: "#e0e7ff",
    icoon: "datatype",
    properties: [KLEUR_VELD, ...MIM_BASIS],
    compartments: [{ id: "dataElementen", label: null, fieldType: "dataElement" }],
  },
  {
    // Keuze-variant 1 (tussen datatypen); alternatieven via de
    // alternatief-connector. Varianten 2–5: fase 2 (zie verkenning §4).
    id: "keuze",
    label: "Keuze",
    kort: "KEUZE",
    shape: "rounded",
    kleur: "#f5d0fe",
    icoon: "keuze-een",
    properties: [KLEUR_VELD, ...MIM_BASIS],
  },
  {
    id: "constraint",
    label: "Constraint",
    kort: "CON",
    shape: "rounded",
    kleur: "#e0f2fe",
    icoon: "constraint",
    handleStijl: "onzichtbaar",
    properties: [
      KLEUR_VELD,
      { key: "specificatie", label: "specificatie (tekst/OCL)", datatype: "tekst" },
    ],
  },
  {
    // Informatiemodel, domein, extern en view zijn allemaal packages; de
    // soort bepaalt de MIM-rol. Bevat-lidmaatschap = boom + drop-doel.
    id: "package",
    label: "Package",
    kort: "PKG",
    shape: "package",
    kleur: "#f1f5f9",
    icoon: "package",
    containerVoor: "bevat",
    standaardDichtInBoom: true,
    properties: [
      KLEUR_VELD,
      { key: "soort", label: "soort (informatiemodel/domein/extern/view)", datatype: "string" },
      { key: "definitie", label: "definitie", datatype: "tekst" },
      { key: "mimVersie", label: "MIM-versie (informatiemodel)", datatype: "string" },
      { key: "relatiemodelleringstype", label: "relatiemodelleringstype (soort/rol leidend)", datatype: "string" },
    ],
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
    // Relatiesoort; mét velden wordt het een relatieklasse (ASOC-patroon).
    id: "relatiesoort",
    label: "Relatiesoort",
    kort: "REL",
    shape: "class-box",
    kleur: "#ede9fe",
    icoon: "relatie-box",
    isConnector: true,
    bron: { elementTypes: ["objecttype"] },
    doel: { elementTypes: ["objecttype"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b" },
    properties: [
      KLEUR_VELD,
      ...MIM_BASIS,
      { key: "bronRolNaam", label: "relatierol bron (naam)", datatype: "string" },
      { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
      { key: "doelRolNaam", label: "relatierol doel (naam)", datatype: "string" },
      { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
      { key: "unidirectioneel", label: "unidirectioneel (→ doel)", datatype: "boolean" },
      { key: "indicatieMaterieleHistorie", label: "materiële historie", datatype: "boolean" },
      { key: "indicatieFormeleHistorie", label: "formele historie", datatype: "boolean" },
      { key: "authentiek", label: "authentiek", datatype: "string" },
    ],
    compartments: [{ id: "attribuutsoorten", label: null, fieldType: "attribuutsoort" }],
    hooks: {
      /** Richting (unidirectioneel): open pijl aan de doelzijde. */
      edgePresentatie: (conn) => (conn.data?.unidirectioneel ? { markerEnd: "pijl-open" } : {}),
      /** Rolnamen en kardinaliteiten aan de uiteinden (MIM-conventie). */
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
        if (d.bronRolNaam) {
          bron.push({ zijde: "bron", delen: [{ tekst: d.bronRolNaam, soort: "rolnaam" }] });
          kaal.push({ zijde: "bron", delen: [{ tekst: d.bronRolNaam, soort: "rolnaam" }] });
        }
        if (d.doelRolNaam) {
          doel.push({ zijde: "doel", delen: [{ tekst: d.doelRolNaam, soort: "rolnaam" }] });
          kaal.push({ zijde: "doel", delen: [{ tekst: d.doelRolNaam, soort: "rolnaam" }] });
        }
        return { bron, doel, kaal };
      },
    },
  },
  {
    // Gegevensgroep: het lidmaatschap objecttype ◆ gegevensgroeptype.
    id: "gegevensgroep",
    label: "Gegevensgroep (◆)",
    kort: "◆",
    shape: "edge",
    icoon: "compositie",
    isConnector: true,
    bron: { elementTypes: OBJECTACHTIG },
    doel: { elementTypes: ["gegevensgroeptype"] },
    edgePresentatie: { lijn: "solid", kleur: "#64748b", markerStart: "ruit" },
    properties: [
      { key: "naam", label: "naam gegevensgroep", datatype: "string" },
      { key: "kardinaliteit", label: "kardinaliteit", datatype: "string" },
    ],
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    kort: "▷",
    shape: "edge",
    icoon: "generalisatie",
    isConnector: true,
    verbindingsregels: [
      { bron: ["objecttype"], doel: ["objecttype"] },
      { bron: DATATYPEN, doel: DATATYPEN },
    ],
    edgePresentatie: {
      lijn: "solid",
      kleur: "#475569",
      markerEnd: "driehoek",
      labels: [{ zijde: "midden", delen: [{ tekst: "«generalisatie»", soort: "constraint", kleur: "#0d9488" }] }],
    },
  },
  {
    // Verwijzing naar een objecttype in een Extern-package.
    id: "externeKoppeling",
    label: "Externe koppeling",
    kort: "ext",
    shape: "edge",
    icoon: "gebruik",
    isConnector: true,
    bron: { elementTypes: ["objecttype"] },
    doel: { elementTypes: ["objecttype"] },
    edgePresentatie: {
      lijn: "dash-6-3",
      kleur: "#64748b",
      markerEnd: "pijl-open",
      labels: [{ zijde: "midden", delen: [{ tekst: "«externe koppeling»", soort: "constraint", kleur: "#7c3aed" }] }],
    },
  },
  {
    // Keuze-variant 1: een keuze wijst naar zijn alternatieve datatypen.
    id: "alternatief",
    label: "Alternatief (keuze)",
    kort: "alt",
    shape: "edge",
    icoon: "keuze-elk",
    isConnector: true,
    bron: { elementTypes: ["keuze"] },
    doel: { elementTypes: DATATYPEN },
    edgePresentatie: { lijn: "dash-4-4", kleur: "#d946ef", markerEnd: "pijl-open" },
  },
  {
    // Package-lidmaatschap ("plaatsing in"), zelfde patroon als puur-uml.
    id: "bevat",
    label: "Bevat (package)",
    kort: "pkg ∋",
    shape: "edge",
    icoon: "bevat",
    isConnector: true,
    bron: { elementTypes: ["package"] },
    doel: {
      elementTypes: [...OBJECTACHTIG, ...DATATYPEN, "keuze", "constraint", "package", "notitie"],
    },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#94a3b8" },
  },
];

function elementKandidaten(elements, soorten, icoon, groep) {
  return Object.values(elements || {})
    .filter((el) => el.naam && soorten.includes(el.elementType))
    .map((el) => ({ waarde: el.naam, label: el.naam, icoon, groep, pad: [] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @type {Record<string, import("../../diagramcore/types/schema.js").ReferenceResolver>} */
const referenceResolvers = {
  "mim-primitief": () =>
    [
      "CharacterString",
      "Integer",
      "Real",
      "Boolean",
      "Date",
      "DateTime",
      "Year",
      "Month",
      "Day",
      "URI",
    ].map((t) => ({ waarde: t, label: t, groep: "MIM-primitieven", pad: [] })),
  "mim-datatype": ({ elements }) =>
    elementKandidaten(elements, ["primitiefDatatype", "gestructureerdDatatype", "keuze"], "✦", "Datatypen"),
  "mim-waardelijst": ({ elements }) =>
    elementKandidaten(elements, ["enumeratie", "codelijst", "referentielijst"], "◇", "Waardelijsten"),
};

/** @type {import("../../diagramcore/types/schema.js").ReferenceType[]} */
const referenceTypes = [
  { id: "mim-primitief", label: "MIM-primitief" },
  { id: "mim-datatype", label: "Datatype" },
  { id: "mim-waardelijst", label: "Waardelijst (enumeratie/codelijst/referentielijst)" },
];

export const mim12DiagramType = {
  id: MIM12_ID,
  label: "MIM 1.2",
  style: "uml-klassiek",
  // Boom: packages (informatiemodel → domein → …) en daarbinnen de
  // gegevensgroep-composities.
  hierarchie: ["bevat", "gegevensgroep"],
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
    id: `mim_${Date.now()}_${_teller}`,
    naam: `Nieuw${et.label.replace(/[^A-Za-z]/g, "")}`,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") {
    element.naam = "";
    element.data.tekst = "";
  }
  if (et.id === "package") {
    element.naam = "NieuwDomein";
    element.data.soort = "domein";
  }
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerMim12() {
  if (!getDiagramType(MIM12_ID)) {
    registreerDiagramType(mim12DiagramType);
  }
}
