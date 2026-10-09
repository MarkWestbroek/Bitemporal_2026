// @ts-check
/**
 * composite-structure — UML 2 composite structure diagram: een gestructureerde
 * klasse met parts, poorten op de rand en connectoren ertussen; collaboraties
 * en collaboration uses met rolbindingen. Opdracht Mark via EA-SYNC
 * (2026-10-09), punt 6 — "past dit in ons M3?" Ja, volledig: het SysML-ibd
 * doet hetzelfde (parts in een blok, poorten als randElement, connectoren),
 * dit profiel is de pure UML-versie ervan.
 *
 * M3-gebruik: `klasse` en `part` zijn containers (containerVoor "bevat");
 * `poort` is randElement op klasse/part/collaboratie; `collaboratie` is een
 * gestippelde ellips-container met rollen (parts); `collaboratiegebruik`
 * verwijst naar een collaboratie (gedragsverwijzing is hier niet nodig: de
 * rolbinding-lijnen doen het werk). Abstracte `structureel` als bereik.
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const COMPOSITE_STRUCTURE_ID = "composite-structure";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    id: "attribuut",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", datatype: "string" },
    ],
  },
];

/** Gastheren van poorten. */
const POORT_OUDERS = ["klasse", "part", "collaboratie"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    // Abstracte wortel: klasse, part en collaboratie(gebruik) delen
    // toelichting, kleur en een attributen-compartiment.
    id: "structureel",
    label: "Structureel element",
    isAbstract: true,
    shape: "class-box",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
    compartments: [{ id: "attributen", label: null, fieldType: "attribuut" }],
  },
  {
    id: "klasse",
    label: "Klasse (gestructureerd)",
    erft: "structureel",
    omschrijving: "De gestructureerde klasse: het frame waar parts in liggen en poorten op zitten.",
    kort: "KL",
    icoon: "klasse",
    kleur: "#fef9c3",
    containerVoor: "bevat",
    minBreedte: 220,
    minHoogte: 140,
    properties: [{ key: "abstract", label: "abstract", datatype: "boolean" }],
  },
  {
    id: "part",
    label: "Part",
    erft: "structureel",
    omschrijving: "Deel binnen een klasse: rolnaam : Type [multipliciteit]. Sleep hem in de klasse.",
    kort: "PART",
    icoon: "cs-part",
    kleur: "#eff6ff",
    containerVoor: "bevat",
    properties: [
      { key: "typeLabel", label: "type", datatype: "string" },
      { key: "multipliciteit", label: "multipliciteit", datatype: "string", placeholder: "bijv. 1, 0..*" },
      { key: "instantieVan", label: "type (verwijzing)", datatype: "element-verwijzing" },
      { key: "isReferentie", label: "referentie (geen eigendom, gestippeld)", datatype: "boolean" },
    ],
  },
  {
    id: "poort",
    label: "Poort",
    omschrijving: "Sleep hem op de rand van een klasse, part of collaboratie: aansluitpunt voor connectoren.",
    kort: "PRT",
    icoon: "cd-poort",
    shape: "sysml-poort",
    resizebaar: false,
    randElement: { ouderTypes: POORT_OUDERS },
    naamLabel: "buiten",
    properties: [
      { key: "typeLabel", label: "type (interface)", datatype: "string" },
      { key: "richting", label: "richting", datatype: "keuze", opties: [{ waarde: "", label: "(geen)" }, { waarde: "in", label: "in" }, { waarde: "uit", label: "uit" }] },
      { key: "isGedrag", label: "behavior port", datatype: "boolean" },
    ],
  },
  {
    id: "interface",
    label: "Interface",
    omschrijving: "Interface die een poort aanbiedt of vereist; in te klappen tot lollipop.",
    kort: "IF",
    stereotype: "«interface»",
    icoon: "cd-interface",
    shape: "class-box",
    kleur: "#dcfce7",
    samentrekking: { gedaante: "bol", relatieTypes: ["realisatie"], labelIngeklapt: "bolletje (lollipop)", labelUitgeklapt: "volledige interface" },
    properties: [TOELICHTING_VELD, KLEUR_VELD],
  },
  {
    id: "collaboratie",
    label: "Collaboratie",
    erft: "structureel",
    omschrijving: "Samenwerking van rollen (gestippelde ellips); sleep de rollen (parts) erin.",
    kort: "COLL",
    icoon: "cs-collaboratie",
    shape: "uc-ellips",
    randStijl: "dashed",
    kleur: "#f8fafc",
    containerVoor: "bevat",
    minBreedte: 220,
    minHoogte: 140,
  },
  {
    id: "collaboratiegebruik",
    label: "Collaboration use",
    erft: "structureel",
    omschrijving: "Toepassing van een collaboratie in deze klasse: naam : Collaboratie, met rolbindingen naar de parts.",
    kort: "CUSE",
    icoon: "cs-collaboratiegebruik",
    shape: "uc-ellips",
    randStijl: "dashed",
    kleur: "#f1f5f9",
    properties: [
      { key: "typeLabel", label: "collaboratie", datatype: "string" },
      { key: "instantieVan", label: "collaboratie (verwijzing)", datatype: "element-verwijzing" },
    ],
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "connector",
    label: "Connector",
    omschrijving: "Verbinding tussen parts of poorten (assembly: ball-and-socket als het via interfaces loopt).",
    kort: "—",
    icoon: "cd-assembly",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["part", "poort", "klasse"] },
    doel: { elementTypes: ["part", "poort", "klasse"] },
    properties: [
      { key: "bronRol", label: "rol (bron)", datatype: "string" },
      { key: "doelRol", label: "rol (doel)", datatype: "string" },
      { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
      { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
      { key: "isAssembly", label: "assembly (bol)", datatype: "boolean" },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    hooks: {
      edgePresentatie: (conn) => (conn?.data?.isAssembly ? { markerEnd: "bol" } : {}),
      edgeLabels: (conn) => {
        const d = conn?.data || {};
        const kaal = [];
        if (d.bronRol) kaal.push({ zijde: "bron", delen: [{ tekst: d.bronRol, soort: "rolnaam" }] });
        if (d.doelRol) kaal.push({ zijde: "doel", delen: [{ tekst: d.doelRol, soort: "rolnaam" }] });
        if (d.bronKardinaliteit) kaal.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
        if (d.doelKardinaliteit) kaal.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
        return { kaal };
      },
    },
  },
  {
    id: "delegatie",
    label: "Delegatie",
    omschrijving: "Poort op de klasse delegeert naar een part of poort binnenin (UML «delegate»).",
    kort: "deleg",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort"] },
    doel: { elementTypes: ["part", "poort"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«delegate»"),
  },
  {
    id: "rolbinding",
    label: "Rolbinding",
    omschrijving: "Collaboration use bindt een rol van de collaboratie aan een part (gestippeld, rolnaam als label).",
    kort: "rol",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["collaboratiegebruik"] },
    doel: { elementTypes: ["part", "poort", "klasse"] },
    properties: [{ key: "rol", label: "rol", datatype: "string" }],
    edgePresentatie: { lijn: "dash-4-3", vorm: "recht", kleur: "#64748b" },
    hooks: {
      edgeLabels: (conn) =>
        conn?.data?.rol ? { kaal: [{ zijde: "midden", delen: [{ tekst: conn.data.rol, soort: "rolnaam" }] }] } : {},
    },
  },
  {
    id: "realisatie",
    label: "Realisatie (aangeboden interface)",
    omschrijving: "Poort of klasse biedt deze interface aan.",
    kort: "⊳┄",
    icoon: "realisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort", "klasse", "part"] },
    doel: { elementTypes: ["interface"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "gebruikt",
    label: "Gebruikt (benodigde interface)",
    omschrijving: "Poort of klasse vereist deze interface (UML «use»).",
    kort: "«use»",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort", "klasse", "part"] },
    doel: { elementTypes: ["interface"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«use»"),
  },
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Overige afhankelijkheid; stereotype uit EA als label.",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["structureel", "interface", "package"] },
    doel: { elementTypes: ["structureel", "interface", "package"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  notitielijn(["structureel", "interface", "poort", "package", "boundary"]),
  bevat(["klasse", "part", "collaboratie", "package"], ["structureel", "interface", "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const compositeStructureDiagramType = {
  id: COMPOSITE_STRUCTURE_ID,
  label: "Composite structure",
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
