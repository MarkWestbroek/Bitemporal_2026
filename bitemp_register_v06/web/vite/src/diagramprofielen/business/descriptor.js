// @ts-check
/**
 * business — Business Modeling volgens Eriksson-Penker (EA's extensie):
 * bedrijfsproces (de pijlvorm), doel, resources (fysiek / mensen /
 * informatie), gebeurtenis, bedrijfsobject en actor, verbonden met de vier
 * EP-stereotypen «supply», «control», «input», «output» en een doel-koppeling.
 * Opdracht Mark via EA-SYNC (2026-10-09), punt 4 — "mooie icoontjes".
 *
 * EP-conventie (de shapes tekenen hem, de lijnen volgen hem niet dwingend):
 * input komt van links het proces in, output gaat rechts eruit, control
 * (doelen, regels) van boven, supply (resources) van onder.
 *
 * M3-gebruik: abstracte `resource` boven fysiek/mensen/informatie (zodat
 * «supply» één regel is: resource → proces), `pakket` als container.
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const BUSINESS_ID = "business";

/** Alles wat in EP een "ding" is (voor dependency/notitielijn). */
const DINGEN = ["proces", "doel", "resource", "gebeurtenis", "bedrijfsobject", "actor"];

/**
 * EP-lijn: gestippelde dependency met vast stereotype.
 * @param {string} id
 * @param {string} label
 * @param {string} stereotype
 * @param {string} omschrijving
 * @param {string[]} bron
 * @param {string[]} doel
 */
function epLijn(id, label, stereotype, omschrijving, bron, doel) {
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
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel(`«${stereotype}»`),
  };
}

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "proces",
    label: "Bedrijfsproces",
    omtrek: "rechthoek",
    omschrijving: "Activiteit die input in output omzet, gestuurd door doelen en gevoed door resources (EP-pijlvorm).",
    kort: "PROC",
    icoon: "ep-proces",
    shape: "ep-proces",
    kleur: "#dbeafe",
    minBreedte: 180,
    minHoogte: 64,
    // Een proces mag deelprocessen bevatten (EA: Business Process met
    // kinderen, of een Activity erin).
    containerVoor: "bevat",
    properties: [
      { key: "eigenaar", label: "eigenaar", datatype: "string" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "doel",
    label: "Doel",
    omtrek: "ellips",
    omschrijving: "Wat het proces wil bereiken; stuurt het proces (control, van boven).",
    kort: "DOEL",
    icoon: "ep-doel",
    shape: "ep-doel",
    kleur: "#fef9c3",
    properties: [
      { key: "meetbaar", label: "meetbaar als", datatype: "string", placeholder: "bijv. doorlooptijd < 5 dagen" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    // Abstracte resource: wat fysiek, mensen en informatie delen; als bereik
    // voor «supply» (van onder het proces in).
    id: "resource",
    label: "Resource",
    isAbstract: true,
    shape: "ep-resource",
    kleur: "#dcfce7",
    properties: [
      { key: "hoeveelheid", label: "hoeveelheid / capaciteit", datatype: "string" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "fysiek",
    label: "Fysieke resource",
    erft: "resource",
    omschrijving: "Machine, materiaal, gebouw — fysieke middelen die het proces gebruikt of verbruikt.",
    kort: "FYS",
    stereotype: "«physical»",
    icoon: "ep-resource-fysiek",
    kleur: "#e2e8f0",
  },
  {
    id: "mensen",
    label: "Mensen",
    erft: "resource",
    omschrijving: "Mensen/rollen als resource van het proces.",
    kort: "MENS",
    stereotype: "«people»",
    icoon: "ep-resource-mensen",
    kleur: "#fce7f3",
  },
  {
    id: "informatie",
    label: "Informatie",
    erft: "resource",
    omschrijving: "Informatie als resource: documenten, gegevens, kennis.",
    kort: "INFO",
    stereotype: "«information»",
    icoon: "ep-resource-informatie",
    kleur: "#e0f2fe",
  },
  {
    id: "gebeurtenis",
    label: "Gebeurtenis",
    omtrek: "rechthoek",
    omschrijving: "Wat een proces start of oplevert (bliksem).",
    kort: "EVT",
    icoon: "ep-event",
    shape: "ep-event",
    kleur: "#fef3c7",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
  },
  {
    id: "bedrijfsobject",
    label: "Bedrijfsobject",
    omschrijving: "Ding uit het bedrijfsdomein dat als input/output door het proces gaat (order, dossier, product).",
    kort: "OBJ",
    stereotype: "«business object»",
    icoon: "ep-object",
    shape: "class-box",
    kleur: "#f5f3ff",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
  },
  {
    id: "actor",
    label: "Actor",
    omschrijving: "Rol buiten het proces die het start, uitvoert of ontvangt.",
    kort: "ACT",
    icoon: "ep-actor",
    shape: "uc-actor",
    resizebaar: false,
    properties: [TOELICHTING_VELD],
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren (de vier EP-stereotypen + doelkoppeling) ───────────────
  epLijn("invoer", "Invoer «input»", "input", "Bedrijfsobject/gebeurtenis gaat het proces in (van links).", ["bedrijfsobject", "gebeurtenis", "informatie", "proces"], ["proces"]),
  epLijn("uitvoer", "Uitvoer «output»", "output", "Het proces levert dit op (naar rechts).", ["proces"], ["bedrijfsobject", "gebeurtenis", "informatie", "proces"]),
  epLijn("besturing", "Besturing «control»", "control", "Doel, regel of actor stuurt het proces (van boven).", ["doel", "actor", "informatie", "proces"], ["proces"]),
  epLijn("levering", "Levering «supply»", "supply", "Resource voedt het proces (van onder).", ["resource", "actor"], ["proces"]),
  {
    id: "doelkoppeling",
    label: "Doelkoppeling «achieve»",
    omschrijving: "Het proces draagt bij aan het doel; een doel kan subdoelen hebben.",
    kort: "«achieve»",
    shape: "edge",
    icoon: "ep-doel",
    isConnector: true,
    verbindingsregels: [
      { bron: { elementTypes: ["proces"] }, doel: { elementTypes: ["doel"] } },
      { bron: { elementTypes: ["doel"] }, doel: { elementTypes: ["doel"] } },
    ],
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#ca8a04", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«achieve»"),
  },
  {
    id: "stroom",
    label: "Processtroom",
    omschrijving: "Volgorde tussen (deel)processen of van gebeurtenis naar proces.",
    kort: "→",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["proces", "gebeurtenis"] },
    doel: { elementTypes: ["proces", "gebeurtenis"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-dicht" },
  },
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Overige afhankelijkheid; stereotype uit EA als label.",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [...DINGEN, "package"] },
    doel: { elementTypes: [...DINGEN, "package"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  {
    id: "associatie",
    label: "Associatie",
    omschrijving: "Structurele samenhang (bv. actor — bedrijfsobject).",
    kort: "—",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: DINGEN },
    doel: { elementTypes: DINGEN },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569" },
  },
  {
    id: "generalisatie",
    label: "Generalisatie",
    omschrijving: "Specialisatie binnen dezelfde soort.",
    kort: "▷",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    verbindingsregels: [
      { bron: { elementTypes: ["proces"] }, doel: { elementTypes: ["proces"] } },
      { bron: { elementTypes: ["resource"] }, doel: { elementTypes: ["resource"] } },
      { bron: { elementTypes: ["bedrijfsobject"] }, doel: { elementTypes: ["bedrijfsobject"] } },
      { bron: { elementTypes: ["actor"] }, doel: { elementTypes: ["actor"] } },
      { bron: { elementTypes: ["doel"] }, doel: { elementTypes: ["doel"] } },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  notitielijn([...DINGEN, "package", "boundary"]),
  bevat(["proces", "package"], [...DINGEN, "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const businessDiagramType = {
  id: BUSINESS_ID,
  label: "Business (Eriksson-Penker)",
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
