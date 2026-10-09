// @ts-check
/**
 * object — UML objectdiagram (instantiediagram): instance specifications met
 * classifier en slots, verbonden met links (associatie-instanties).
 * Opdracht Mark via EA-SYNC (2026-10-09), punt 2.
 *
 * Een object is in UML een InstanceSpecification: naam, de classifier
 * ("jan : Persoon", onderstreept) en slots (attribuut = waarde). De
 * classifier is een **cross-profiel verwijzing** (datatype
 * "element-verwijzing", het instantie-van-concept uit het sequence-profiel):
 * `data.instantieVan = {profielId, elementId}` naar een klasse in puur-uml,
 * MIM of canoniek-uml. De EA-lezer kent de klasse alleen bij naam en zet die
 * in `data.klassifierLabel`; de shape toont de verwijzing als die er is en
 * valt anders terug op het label.
 *
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen. Zie
 * `eaMapping.js`.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeUitData } from "../uml2Basis.js";

export const OBJECT_ID = "object";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    // Slot: "attribuut = waarde" — de naam-type-viewer toont naam links en
    // `typeLabel` rechts; de shape zet daar een "=" tussen (zie shapes.jsx).
    id: "slot",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "attribuut", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "waarde", datatype: "string" },
    ],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "object",
    label: "Object",
    omschrijving: "Instantie van een klasse: naam : Klasse (onderstreept) met slots attribuut = waarde.",
    kort: "OBJ",
    icoon: "ob-object",
    shape: "ob-object",
    kleur: "#fef9c3",
    properties: [
      { key: "instantieVan", label: "instantie van", datatype: "element-verwijzing" },
      { key: "klassifierLabel", label: "klasse (tekst)", datatype: "string", placeholder: "als er geen verwijzing is" },
      { key: "toestand", label: "toestand", datatype: "string", placeholder: "bijv. [actief]" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
    compartments: [{ id: "slots", label: null, fieldType: "slot" }],
  },
  {
    // Meerdere objecten tegelijk (UML 1 "multiobject"; EA tekent ze als
    // object met stereotype). Erft alles van object; alleen de gedaante
    // (dubbele rand) verschilt.
    id: "multiobject",
    label: "Multi-object",
    erft: "object",
    omschrijving: "Verzameling instanties van dezelfde klasse (dubbele rand).",
    kort: "OBJ+",
    kleur: "#fef3c7",
    randDikte: 3,
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // Link = instantie van een associatie; rolnamen aan de uiteinden.
    id: "link",
    label: "Link",
    omschrijving: "Instantie van een associatie tussen twee objecten (rolnamen aan de uiteinden).",
    kort: "—",
    icoon: "ob-link",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["object"] },
    doel: { elementTypes: ["object"] },
    properties: [
      { key: "bronRol", label: "rol (bron)", datatype: "string" },
      { key: "doelRol", label: "rol (doel)", datatype: "string" },
      { key: "directioneel", label: "gericht (→ doel)", datatype: "boolean" },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    hooks: {
      edgePresentatie: (conn) => (conn?.data?.directioneel ? { markerEnd: "pijl-open" } : {}),
      edgeLabels: (conn) => {
        const d = conn?.data || {};
        const kaal = [];
        if (d.bronRol) kaal.push({ zijde: "bron", delen: [{ tekst: d.bronRol, soort: "rolnaam" }] });
        if (d.doelRol) kaal.push({ zijde: "doel", delen: [{ tekst: d.doelRol, soort: "rolnaam" }] });
        return { kaal };
      },
    },
  },
  {
    // Compositie-instantie: het geheel bezit het deel (EA tekent ze ook op
    // objectdiagrammen).
    id: "compositie",
    label: "Compositie (instantie)",
    omschrijving: "Het bron-object bezit het doel-object.",
    kort: "◆",
    icoon: "compositie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["object"] },
    doel: { elementTypes: ["object"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit" },
  },
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Afhankelijkheid tussen objecten; stereotype uit EA als label («instantiate», «create», …).",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["object", "package"] },
    doel: { elementTypes: ["object", "package"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  {
    // Klassen op een objectdiagram (EA tekent ze naast hun instanties) dragen
    // hun generalisaties mee; tussen objecten zelf is het "instantie van een
    // subtype". Beide als generalisatie-pijl.
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Specialisatie tussen klassen op het objectdiagram (of tussen object en zijn klasse).",
    kort: "▷",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["object"] },
    doel: { elementTypes: ["object"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  notitielijn(["object", "package", "boundary"]),
  bevat(["package"], ["object", "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const objectDiagramType = {
  id: OBJECT_ID,
  label: "Object",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  hierarchie: "bevat",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};
