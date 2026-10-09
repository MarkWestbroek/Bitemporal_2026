// @ts-check
/**
 * requirements — requirementsdiagram in EA-stijl (opdracht Mark via
 * EA-SYNC, 2026-10-09, punt 3): requirement en feature, plus EA's
 * "maintenance"-typen issue en change, verbonden met realize/trace/derive/
 * verify/refine-lijnen en een aggregatie "bevat" voor de decompositie.
 *
 * M3-gebruik: de abstracte `eis` (id, status, prioriteit, tekst, toelichting,
 * kleur) boven requirement, feature, issue en change — de traceerlijnen
 * noemen `eis` als bereik. `verwijzing` is het "element van elders" (use
 * case, klasse, component) dat een eis realiseert; EA zet die op het
 * requirementsdiagram naast de eisen.
 *
 * Verschil met het SysML-profiel: daar is requirement één blok in een
 * groter geheel (bdd/ibd); hier is het de hele taal, met EA's eigen typen en
 * velden (status/difficulty/priority) en de EA-aggregatie.
 *
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const REQUIREMENTS_ID = "requirements";

const STATUS_OPTIES = [
  { waarde: "", label: "(geen)" },
  { waarde: "Proposed", label: "voorgesteld" },
  { waarde: "Approved", label: "goedgekeurd" },
  { waarde: "Mandatory", label: "verplicht" },
  { waarde: "Implemented", label: "gerealiseerd" },
  { waarde: "Validated", label: "gevalideerd" },
  { waarde: "Deferred", label: "uitgesteld" },
  { waarde: "Rejected", label: "afgewezen" },
];
const PRIORITEIT_OPTIES = [
  { waarde: "", label: "(geen)" },
  { waarde: "High", label: "hoog" },
  { waarde: "Medium", label: "midden" },
  { waarde: "Low", label: "laag" },
];
const MOEILIJKHEID_OPTIES = PRIORITEIT_OPTIES;

/** Alle eis-typen + verwijzingen: wat een traceerlijn mag verbinden. */
const TRACEERBAAR = ["eis", "verwijzing"];

/**
 * Traceerlijn met vast stereotype (gestippeld, open pijl).
 * @param {string} id
 * @param {string} label
 * @param {string} stereotype
 * @param {string} omschrijving
 * @param {{bron?: string[], doel?: string[]}} [bereik]
 */
function traceerlijn(id, label, stereotype, omschrijving, { bron = TRACEERBAAR, doel = TRACEERBAAR } = {}) {
  return {
    id,
    label,
    omschrijving,
    kort: `«${stereotype}»`,
    shape: "edge",
    icoon: "dependency",
    isConnector: true,
    bron: { elementTypes: bron },
    doel: { elementTypes: doel },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel(`«${stereotype}»`),
  };
}

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    // Abstracte wortel: wat requirement, feature, issue en change delen.
    id: "eis",
    label: "Eis",
    isAbstract: true,
    shape: "rq-eis",
    properties: [
      { key: "reqId", label: "id / alias", datatype: "string", placeholder: "bijv. REQ-012" },
      { key: "tekst", label: "tekst", datatype: "tekst" },
      { key: "status", label: "status", datatype: "keuze", opties: STATUS_OPTIES },
      { key: "prioriteit", label: "prioriteit", datatype: "keuze", opties: PRIORITEIT_OPTIES },
      { key: "moeilijkheid", label: "moeilijkheid", datatype: "keuze", opties: MOEILIJKHEID_OPTIES },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "requirement",
    label: "Requirement",
    erft: "eis",
    omschrijving: "Een eis aan het systeem; soort (functioneel, performance, …) als stereotype.",
    kort: "REQ",
    stereotype: "«requirement»",
    icoon: "rq-requirement",
    kleur: "#ede9fe",
    properties: [
      {
        key: "soort",
        label: "soort",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(algemeen)" },
          { waarde: "Functional", label: "functioneel" },
          { waarde: "Performance", label: "performance" },
          { waarde: "Usability", label: "bruikbaarheid" },
          { waarde: "Security", label: "beveiliging" },
          { waarde: "Business", label: "business" },
          { waarde: "Interface", label: "interface" },
          { waarde: "Constraint", label: "randvoorwaarde" },
        ],
      },
    ],
    hooks: {
      /** Soort → stereotype op de kop («functional» …); leeg = «requirement». */
      stereotype: (element) => (element?.data?.soort ? `«${String(element.data.soort).toLowerCase()}»` : ""),
    },
  },
  {
    id: "feature",
    label: "Feature",
    erft: "eis",
    omschrijving: "Kenmerk/functie van het product dat eisen groepeert of realiseert.",
    kort: "FEAT",
    stereotype: "«feature»",
    icoon: "rq-feature",
    kleur: "#dcfce7",
  },
  {
    id: "issue",
    label: "Issue",
    erft: "eis",
    omschrijving: "Probleem of vraagstuk rond een eis (EA maintenance-type).",
    kort: "ISS",
    stereotype: "«issue»",
    icoon: "rq-issue",
    kleur: "#fee2e2",
  },
  {
    id: "change",
    label: "Change",
    erft: "eis",
    omschrijving: "Wijzigingsverzoek op een eis of feature (EA maintenance-type).",
    kort: "CHG",
    stereotype: "«change»",
    icoon: "rq-change",
    kleur: "#ffedd5",
  },
  {
    // Element van elders (use case, klasse, component, …) dat een eis
    // realiseert: alleen de naam; het stereotype uit EA op de kop.
    id: "verwijzing",
    label: "Verwijzing",
    omschrijving: "Element uit een ander model (use case, klasse, component) dat eisen realiseert — alleen als verwijzing.",
    kort: "REF",
    icoon: "klasse",
    shape: "class-box",
    kleur: "#f8fafc",
    randStijl: "dashed",
    properties: [
      { key: "stereotype", label: "soort (stereotype)", datatype: "string", placeholder: "bijv. use case" },
      { key: "instantieVan", label: "verwijst naar", datatype: "element-verwijzing" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // Decompositie: deel-eis → geheel-eis (open ruit bij het geheel, zoals EA
    // Aggregation). Geen container: EA tekent dit als lijnen, niet genest.
    id: "aggregatie",
    label: "Bevat (aggregatie)",
    omschrijving: "Geheel-eis bevat deel-eis; de ruit staat bij het geheel.",
    kort: "◇",
    icoon: "rq-bevat",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["eis"] },
    doel: { elementTypes: ["eis"] },
    edgePresentatie: { lijn: "solid", vorm: "boom", kleur: "#475569", markerStart: "ruit-open" },
  },
  {
    id: "realisatie",
    label: "Realisatie",
    omschrijving: "Het bron-element realiseert de eis (gestippeld, driehoek).",
    kort: "⊳┄",
    icoon: "realisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: TRACEERBAAR },
    doel: { elementTypes: ["eis"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  traceerlijn("trace", "Trace", "trace", "Zwakke herleidbaarheid tussen eisen of naar een element elders."),
  traceerlijn("derive", "Derive", "derive", "De bron-eis is afgeleid van de doel-eis.", { bron: ["eis"], doel: ["eis"] }),
  traceerlijn("verify", "Verify", "verify", "Het bron-element (test, use case) verifieert de doel-eis.", { doel: ["eis"] }),
  traceerlijn("refine", "Refine", "refine", "Het bron-element verfijnt de doel-eis (bv. een use case die een eis uitwerkt)."),
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Overige afhankelijkheid; stereotype uit EA als label.",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [...TRACEERBAAR, "package"] },
    doel: { elementTypes: [...TRACEERBAAR, "package"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Specialisatie tussen eisen van dezelfde soort.",
    kort: "▷",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["eis"] },
    doel: { elementTypes: ["eis"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  notitielijn([...TRACEERBAAR, "package", "boundary"]),
  bevat(["package"], [...TRACEERBAAR, "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const requirementsDiagramType = {
  id: REQUIREMENTS_ID,
  label: "Requirements",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  hierarchie: "bevat",
  fieldTypes: [],
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};
