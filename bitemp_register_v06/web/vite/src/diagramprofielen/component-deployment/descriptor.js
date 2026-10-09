// @ts-check
/**
 * component-deployment — UML 2 component- én deploymentdiagrammen in één
 * profiel (opdracht Mark via EA-SYNC, 2026-10-09, punt 1). Eén profiel omdat
 * de elementen elkaar overlappen: een artifact staat op allebei, een
 * component mag op een deployment-diagram, een node op een componentdiagram.
 * In UML 1 heetten dit samen de "implementation diagrams".
 *
 * M3-gebruik:
 *   - **erft/isAbstract**: de abstracte `klassifier` (toelichting, kleur,
 *     eigenschappen-compartiment) boven component, interface, artifact en
 *     node; `device` en `executieomgeving` erven van node, `deploymentspec`
 *     van artifact. Verbindingsregels noemen `klassifier` en `node` als
 *     bereik en krijgen de concrete afstammelingen vanzelf;
 *   - **randElement**: de poort woont op de rand van een component of node;
 *   - **containerVoor**: component (parts, poorten), node/device/
 *     executieomgeving (wat erop gedeployd is), package;
 *   - **samentrekking**: een interface-voorkomen klapt in tot lollipop; de
 *     realisatie-lijn wordt het steeltje. Een *required* interface is in UML
 *     de socket (halve maan) — dat marker-primitief heeft de motor niet;
 *     declaratief is het de «use»-dependency naar het interface-bolletje
 *     (toegestane UML-notatie). Assembly tekent bol-aan-lijn;
 *   - **randAanhechting: zwevend**: dozen met veel lijnen.
 *
 * Elementtype-id's zijn een contract met de EA-lezer (EA-GUID → id): nooit
 * wijzigen. Zie `eaMapping.js` voor de EA-tabel.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const COMPONENT_DEPLOYMENT_ID = "component-deployment";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    id: "eigenschap",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", datatype: "string" },
    ],
  },
  {
    id: "operatie",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "signatuur", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "retourtype", datatype: "string" },
    ],
  },
];

/** Wat op/in een node gedeployd kan worden. */
const DEPLOYBAAR = ["artifact", "deploymentspec", "component"];
/** Containers met lidmaatschap. */
const CONTAINERS = ["component", "node", "package"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    // Abstracte wortel (EMOF Class.isAbstract): wat component, interface,
    // artifact en node delen. Niet instantieerbaar; als bereik = al die typen.
    id: "klassifier",
    label: "Klassifier",
    isAbstract: true,
    shape: "class-box",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
    compartments: [{ id: "eigenschappen", label: null, fieldType: "eigenschap" }],
  },
  {
    id: "component",
    label: "Component",
    erft: "klassifier",
    omschrijving: "Modulair, vervangbaar deel met duidelijke interfaces; sleep poorten op de rand en delen erin.",
    kort: "CMP",
    stereotype: "«component»",
    icoon: "cd-component",
    kleur: "#dbeafe",
    containerVoor: "bevat",
    properties: [{ key: "abstract", label: "abstract", datatype: "boolean" }],
  },
  {
    id: "interface",
    label: "Interface",
    erft: "klassifier",
    omschrijving: "Aangeboden/benodigde interface; per voorkomen in te klappen tot lollipop.",
    kort: "IF",
    stereotype: "«interface»",
    icoon: "cd-interface",
    kleur: "#dcfce7",
    samentrekking: {
      gedaante: "bol",
      relatieTypes: ["realisatie"],
      labelIngeklapt: "bolletje (lollipop)",
      labelUitgeklapt: "volledige interface",
    },
    compartments: [{ id: "operaties", label: null, fieldType: "operatie" }],
  },
  {
    id: "poort",
    label: "Poort",
    omschrijving: "Sleep hem op de rand van een component of node: het aansluitpunt voor connectoren.",
    kort: "PRT",
    icoon: "cd-poort",
    shape: "sysml-poort",
    resizebaar: false,
    randElement: { ouderTypes: ["component", "node"] },
    naamLabel: "buiten",
    properties: [
      { key: "typeLabel", label: "type (interface)", datatype: "string" },
      {
        key: "richting",
        label: "richting",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(geen richting)" },
          { waarde: "in", label: "in" },
          { waarde: "uit", label: "uit" },
        ],
      },
    ],
  },
  {
    id: "artifact",
    label: "Artifact",
    erft: "klassifier",
    omschrijving: "Fysiek stuk informatie (jar, dll, script, document) dat gedeployd wordt.",
    kort: "ART",
    stereotype: "«artifact»",
    icoon: "cd-artifact",
    kleur: "#fef3c7",
    properties: [{ key: "bestandsnaam", label: "bestandsnaam", datatype: "string" }],
  },
  {
    id: "deploymentspec",
    label: "Deployment specification",
    erft: "artifact",
    omschrijving: "Artifact met de deploy-parameters (UML «deployment spec»).",
    kort: "DSPEC",
    stereotype: "«deployment spec»",
    kleur: "#fde68a",
    properties: [
      { key: "executionLocation", label: "execution location", datatype: "string" },
      { key: "deploymentLocation", label: "deployment location", datatype: "string" },
    ],
  },
  {
    id: "node",
    label: "Node",
    erft: "klassifier",
    omschrijving: "Rekenmiddel (machine, server): sleep artifacts en componenten erin om ze te deployen.",
    kort: "NODE",
    stereotype: "«node»",
    icoon: "cd-node",
    shape: "cd-node",
    kleur: "#e2e8f0",
    containerVoor: "bevat",
    minBreedte: 160,
    minHoogte: 90,
  },
  {
    id: "device",
    label: "Device",
    erft: "node",
    omschrijving: "Fysiek apparaat met rekencapaciteit (UML «device»).",
    kort: "DEV",
    stereotype: "«device»",
    icoon: "cd-device",
    kleur: "#e0f2fe",
  },
  {
    id: "executieomgeving",
    label: "Execution environment",
    erft: "node",
    omschrijving: "Software-omgeving waarin iets draait: OS, app-server, container (UML «executionEnvironment»).",
    kort: "EXE",
    stereotype: "«executionEnvironment»",
    icoon: "cd-executieomgeving",
    kleur: "#ecfccb",
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // Aangeboden interface: component realiseert interface (lollipop als de
    // interface ingeklapt is).
    id: "realisatie",
    label: "Realisatie (aangeboden interface)",
    omschrijving: "De component biedt deze interface aan.",
    kort: "⊳┄",
    shape: "edge",
    icoon: "realisatie",
    isConnector: true,
    bron: { elementTypes: ["component", "poort", "artifact"] },
    doel: { elementTypes: ["interface", "component"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    // Benodigde interface: «use»-dependency naar de interface.
    id: "gebruikt",
    label: "Gebruikt (benodigde interface)",
    omschrijving: "De component heeft deze interface nodig (UML «use»; de socket-notatie).",
    kort: "«use»",
    shape: "edge",
    icoon: "dependency",
    isConnector: true,
    bron: { elementTypes: ["component", "poort", "artifact"] },
    doel: { elementTypes: ["interface", "component"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«use»"),
  },
  {
    // Assembly connector: benodigde aan aangeboden interface tussen twee
    // componenten (ball-and-socket). De motor kent de halve maan niet; de
    // bol aan de doelzijde is de aanbieder.
    id: "assembly",
    label: "Assembly",
    omschrijving: "Koppelt een benodigde interface van de bron aan een aangeboden interface van het doel.",
    kort: "⊂●",
    shape: "edge",
    icoon: "cd-assembly",
    isConnector: true,
    bron: { elementTypes: ["component", "poort"] },
    doel: { elementTypes: ["component", "poort"] },
    properties: [{ key: "interfaceLabel", label: "interface", datatype: "string" }],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "bol" },
    hooks: {
      edgeLabels: (conn) =>
        conn?.data?.interfaceLabel
          ? { kaal: [{ zijde: "midden", delen: [{ tekst: conn.data.interfaceLabel, soort: "naam" }] }] }
          : {},
    },
  },
  {
    // Delegatie: poort → het deel binnenin dat het werk doet.
    id: "delegatie",
    label: "Delegatie",
    omschrijving: "Poort delegeert naar een deel binnen de component (UML «delegate»).",
    kort: "deleg",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["poort", "component"] },
    doel: { elementTypes: ["component", "poort", "interface"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«delegate»"),
  },
  {
    id: "deployment",
    label: "Deployment",
    omschrijving: "Artifact of component wordt gedeployd op een node (UML «deploy»).",
    kort: "«deploy»",
    shape: "edge",
    icoon: "cd-deploy",
    isConnector: true,
    bron: { elementTypes: DEPLOYBAAR },
    doel: { elementTypes: ["node"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«deploy»"),
  },
  {
    id: "manifest",
    label: "Manifestatie",
    omschrijving: "Artifact is de fysieke vorm van een component/klassifier (UML «manifest»).",
    kort: "«manifest»",
    shape: "edge",
    icoon: "cd-manifest",
    isConnector: true,
    bron: { elementTypes: ["artifact"] },
    doel: { elementTypes: ["component", "interface", "node"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«manifest»"),
  },
  {
    id: "communicatiepad",
    label: "Communicatiepad",
    omschrijving: "Associatie tussen nodes: ze kunnen met elkaar communiceren (netwerk, bus).",
    kort: "—",
    shape: "edge",
    icoon: "cd-communicatiepad",
    isConnector: true,
    bron: { elementTypes: ["node"] },
    doel: { elementTypes: ["node"] },
    properties: [
      { key: "protocol", label: "protocol", datatype: "string", placeholder: "bijv. https, TCP/IP" },
      { key: "bronKardinaliteit", label: "kardinaliteit (bron)", datatype: "string" },
      { key: "doelKardinaliteit", label: "kardinaliteit (doel)", datatype: "string" },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
    hooks: {
      edgeLabels: (conn) => {
        const d = conn?.data || {};
        const kaal = [];
        if (d.protocol) kaal.push({ zijde: "midden", delen: [{ tekst: `«${d.protocol}»`, soort: "constraint" }] });
        if (d.bronKardinaliteit) kaal.push({ zijde: "bron", delen: [{ tekst: d.bronKardinaliteit, soort: "kardinaliteit" }] });
        if (d.doelKardinaliteit) kaal.push({ zijde: "doel", delen: [{ tekst: d.doelKardinaliteit, soort: "kardinaliteit" }] });
        return { kaal };
      },
    },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Specialisatie binnen dezelfde soort (component→component, node→node, …).",
    kort: "▷",
    shape: "edge",
    icoon: "generalisatie",
    isConnector: true,
    verbindingsregels: [
      { bron: { elementTypes: ["component"] }, doel: { elementTypes: ["component"] } },
      { bron: { elementTypes: ["interface"] }, doel: { elementTypes: ["interface"] } },
      { bron: { elementTypes: ["artifact"] }, doel: { elementTypes: ["artifact"] } },
      { bron: { elementTypes: ["node"] }, doel: { elementTypes: ["node"] } },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    // Algemene dependency; het stereotype uit EA («import», «trace», …) komt
    // als label op de lijn.
    id: "dependency",
    label: "Dependency",
    omschrijving: "Afhankelijkheid tussen klassifiers; een stereotype uit EA staat op de lijn.",
    kort: "dep",
    shape: "edge",
    icoon: "dependency",
    isConnector: true,
    bron: { elementTypes: ["klassifier", "package"] },
    doel: { elementTypes: ["klassifier", "package"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string", placeholder: "bijv. import" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  notitielijn(["klassifier", "poort", "package", "boundary"]),
  bevat(CONTAINERS, ["klassifier", "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const componentDeploymentDiagramType = {
  id: COMPONENT_DEPLOYMENT_ID,
  label: "Component & deployment",
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
