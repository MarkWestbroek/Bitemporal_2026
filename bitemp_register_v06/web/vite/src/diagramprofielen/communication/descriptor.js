// @ts-check
/**
 * communication — UML communication diagram (UML 1: collaboration diagram):
 * objecten als knopen in een graaf, links ertussen, en op elke link de
 * genummerde berichten. Opdracht Mark via EA-SYNC (2026-10-09), punt 6.
 *
 * Semantisch is dit hetzelfde interactiemodel als een sequence diagram
 * (Rational Rose morphde ze met F5). In ons M3 is een profiel één
 * rendering: het sequence-profiel legt berichten als rand-elementen op
 * levenslijnen met een verticale tijdas; hier zijn de berichten de velden
 * van een link (de connector materialiseert als anker + box met de
 * berichtenlijst — het ASOC-patroon). Dat is géén tweede gedaante van
 * hetzelfde element maar een eigen profiel; de brug is een M2→M2-
 * transformatie (regelset) in de koppelingen-matrix: levenslijn ↔ object,
 * bericht(punt→punt) ↔ berichtregel op de link, volgorde ↔ volgnummer. Zie
 * docs/PROFIELEN-EA-AANVULLING.md §6 voor de afweging.
 *
 * Berichtregel: `naam` = volgnummer ("1", "1.2"), `typeLabel` = het bericht
 * met zijn richting als pijl ("→ opvragen(id)" naar het doel van de link,
 * "← resultaat" terug). Elementtype-id's zijn een contract met de EA-lezer.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn } from "../uml2Basis.js";

export const COMMUNICATION_ID = "communication";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    id: "bericht",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "volgnummer", datatype: "string", verplicht: true, placeholder: "bijv. 1.2" },
      { key: "typeLabel", label: "bericht (→ heen, ← terug)", datatype: "string", placeholder: "→ opvragen(id)" },
      {
        key: "soort",
        label: "soort",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "synchroon" },
          { waarde: "async", label: "asynchroon" },
          { waarde: "retour", label: "retour" },
        ],
      },
      { key: "guard", label: "guard", datatype: "string", placeholder: "bijv. [gevonden]" },
    ],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "object",
    label: "Object (rol)",
    omschrijving: "Deelnemer: naam : Klasse (onderstreept); de klasse via een verwijzing of als tekst.",
    kort: "OBJ",
    icoon: "cm-object",
    shape: "ob-object",
    kleur: "#fef9c3",
    properties: [
      { key: "instantieVan", label: "instantie van", datatype: "element-verwijzing" },
      { key: "klassifierLabel", label: "klasse (tekst)", datatype: "string" },
      { key: "multi", label: "meerdere (multi-object)", datatype: "boolean" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "actor",
    label: "Actor",
    omschrijving: "Externe deelnemer die de interactie start.",
    kort: "ACT",
    icoon: "ep-actor",
    shape: "uc-actor",
    resizebaar: false,
    properties: [TOELICHTING_VELD],
  },
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    // Link mét berichten: de motor materialiseert een connector met velden als
    // anker + box (ASOC-patroon) — de box ís de berichtenlijst bij de lijn.
    id: "link",
    label: "Link (met berichten)",
    omschrijving: "Verbinding tussen twee deelnemers; voeg de genummerde berichten toe als regels.",
    kort: "—",
    icoon: "cm-bericht",
    shape: "class-box",
    kleur: "#f8fafc",
    isConnector: true,
    bron: { elementTypes: ["object", "actor"] },
    doel: { elementTypes: ["object", "actor"] },
    properties: [{ key: "naam", label: "linknaam", datatype: "string" }, KLEUR_VELD],
    compartments: [{ id: "berichten", label: null, fieldType: "bericht" }],
    edgePresentatie: { lijn: "solid", vorm: "recht", kleur: "#475569" },
  },
  notitielijn(["object", "actor", "boundary"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const communicationDiagramType = {
  id: COMMUNICATION_ID,
  label: "Communication",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};
