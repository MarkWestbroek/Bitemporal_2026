// @ts-check
/**
 * toegangsregel — Toegangsspraak-regels als diagramprofiel (stap 1 van het
 * plan "2026-07-24 Toegangsregel-profiel (ontwerp)").
 *
 * Het diagram is de derde projectie van dezelfde AST (naast klare taal en
 * ODRL): beleid = diagram, regel = kaart erin. De kleuren zijn dezelfde als
 * de zinsontleding in de teksteditor — één visuele taal, twee weergaven.
 *
 * Cross-profiel: een Gegevensselectie of Begrip verwijst naar een element in
 * een ánder profiel als paar (verwijzingsprofiel, verwijzingselement) — het
 * canoniek model is alleen de default, niet hardgecodeerd.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";

export const TOEGANGSREGEL_ID = "toegangsregel";

/** Ontleding-palet (zie studio/activities/toegangActivity.css) — één bron. */
export const KLEUREN = {
  subject: "#d3f2d4",
  gegevens: "#fdf0a8",
  waarde: "#c9e5ff",
  operator: "#ecdcf7",
  actie: "#ffe1c7",
  plicht: "#d2f0ea",
  begrip: "#e2e8f0",
  toestemming: "#16a34a",
  verbod: "#dc2626",
  structuur: "#475569",
};

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Cross-profiel verwijzing: profiel + element, canoniek model als default. */
const VERWIJZING_VELDEN = [
  { key: "verwijzingsprofiel", label: "verwijst naar: profiel", datatype: "string" },
  { key: "verwijzingselement", label: "verwijst naar: element", datatype: "string" },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    // Top-level element: de policy (het toegangsbeleid als geheel). Draagt de
    // naam, geldigheid, grondslag en doel; cross-links (wet → ArchiMate
    // Constraint, doel → Goal) hangen aan dít niveau — en desgewenst ook aan
    // een individuele regel. Werknaam "policy": "beleid" heeft geen meervoud.
    id: "policy",
    label: "Policy",
    kort: "POL",
    shape: "tr-kaft",
    icoon: "tr-policy",
    kleur: "#e0e7ff",
    properties: [
      { key: "geldigVanaf", label: "geldig vanaf", datatype: "string" },
      { key: "geldigTot", label: "geldig tot", datatype: "string" },
      { key: "grondslag", label: "grondslag (wet)", datatype: "string" },
      { key: "doel", label: "doelbinding", datatype: "string" },
      KLEUR_VELD,
    ],
  },
  {
    // Ordening in de projectboom: regels zijn herbruikbaar (aggregatie, geen
    // compositie), dus een map/package helpt om policies en regels te ordenen.
    id: "map",
    label: "Map",
    kort: "MAP",
    shape: "package",
    icoon: "tr-map",
    kleur: "#f1f5f9",
    properties: [KLEUR_VELD],
  },
  {
    id: "toegangsregel",
    label: "Toegangsregel",
    kort: "REG",
    shape: "tr-regelkaart",
    icoon: "tr-regel",
    kleur: "#f8fafc",
    properties: [
      { key: "modaliteit", label: "modaliteit (mag / mag niet)", datatype: "string", verplicht: true },
      KLEUR_VELD,
    ],
  },
  {
    id: "subject",
    label: "Subject",
    kort: "WIE",
    shape: "tr-badge",
    icoon: "tr-subject",
    kleur: KLEUREN.subject,
    properties: [
      { key: "rol", label: "rol", datatype: "string" },
      { key: "kenmerken", label: "kenmerken", datatype: "string" },
      KLEUR_VELD,
    ],
  },
  {
    id: "handeling",
    label: "Handeling",
    kort: "DOE",
    shape: "tr-pijlblok",
    icoon: "tr-handeling",
    kleur: KLEUREN.actie,
    properties: [{ key: "nlgov", label: "NLGov-actie", datatype: "string" }, KLEUR_VELD],
  },
  {
    id: "gegevensselectie",
    label: "Gegevensselectie",
    kort: "GEG",
    shape: "tr-cilinder",
    icoon: "tr-gegevens",
    kleur: KLEUREN.gegevens,
    properties: [...VERWIJZING_VELDEN, KLEUR_VELD],
  },
  {
    id: "voorwaardepoort",
    label: "Voorwaardepoort",
    kort: "◇",
    shape: "tr-poort",
    icoon: "tr-poort",
    // Vaste ruit (48px): resizen is zinloos en de box moet de vorm blijven.
    resizebaar: false,
    kleur: KLEUREN.operator,
    properties: [
      { key: "soort", label: "soort (alle / ten minste één / precies één)", datatype: "string", verplicht: true },
      KLEUR_VELD,
    ],
  },
  {
    id: "voorwaarde",
    label: "Voorwaarde",
    kort: "ALS",
    shape: "tr-vergelijking",
    icoon: "tr-voorwaarde",
    kleur: KLEUREN.operator,
    properties: [
      { key: "links", label: "linksterm", datatype: "string" },
      { key: "vergelijking", label: "vergelijking", datatype: "string" },
      { key: "rechts", label: "rechtsterm", datatype: "string" },
      KLEUR_VELD,
    ],
  },
  {
    id: "plicht",
    label: "Plicht",
    kort: "⚑",
    shape: "tr-vaandel",
    icoon: "tr-plicht",
    kleur: KLEUREN.plicht,
    properties: [{ key: "nlgov", label: "NLGov-plicht", datatype: "string" }, KLEUR_VELD],
  },
  {
    id: "begrip",
    label: "Begrip",
    kort: "DEF",
    shape: "tr-tag",
    icoon: "tr-begrip",
    kleur: KLEUREN.begrip,
    properties: [
      { key: "soort", label: "soort (wie / wat)", datatype: "string" },
      { key: "definitie", label: "definitie", datatype: "string" },
      ...VERWIJZING_VELDEN,
      KLEUR_VELD,
    ],
  },

  // ── Connectoren: structuur ─────────────────────────────────────────────────
  {
    // Aggregatie (open ruit), bewust géén compositie: een regel kan door
    // meerdere policies worden omvat en is dus herbruikbaar.
    id: "omvat",
    label: "omvat",
    kort: "◇",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["policy"] },
    doel: { elementTypes: ["toegangsregel"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur, markerStart: "ruit-open" },
  },
  {
    // Map-ordening voor de projectboom (hierarchie-connector).
    id: "bevat",
    label: "bevat",
    kort: "◆",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["map"] },
    doel: { elementTypes: ["map", "policy", "toegangsregel", "begrip"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur, markerStart: "ruit" },
  },

  // ── Connectoren: de zinsdelen van de kernzin ───────────────────────────────
  {
    id: "wie",
    label: "wie",
    kort: "▶",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["subject"] },
    edgePresentatie: {
      lijn: "solid",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      dikte: 2,
      markerEnd: "pijl-dicht",
    },
  },
  {
    id: "doet",
    label: "doet",
    kort: "▶",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel", "subject"] },
    doel: { elementTypes: ["handeling"] },
    edgePresentatie: {
      lijn: "solid",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      dikte: 2,
      markerEnd: "pijl-dicht",
    },
  },
  {
    id: "op",
    label: "op",
    kort: "▶",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel", "handeling"] },
    doel: { elementTypes: ["gegevensselectie"] },
    edgePresentatie: {
      lijn: "solid",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      dikte: 2,
      markerEnd: "pijl-dicht",
    },
  },
  {
    id: "als",
    label: "als",
    kort: "⇢",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["voorwaardepoort", "voorwaarde"] },
    edgePresentatie: {
      lijn: "dash-6-3",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      markerEnd: "pijl-open",
    },
  },
  {
    id: "tak",
    label: "tak",
    kort: "·",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["voorwaardepoort"] },
    doel: { elementTypes: ["voorwaardepoort", "voorwaarde"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur, dikte: 1.2 },
  },
  {
    id: "waarbij",
    label: "waarbij",
    kort: "⚑",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["plicht"] },
    edgePresentatie: {
      lijn: "dash-6-3",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      markerEnd: "bol",
    },
  },
  {
    id: "verwijst-naar",
    label: "verwijst naar",
    kort: "▦",
    shape: "edge",
    isConnector: true,
    // Binnen het diagram: selectie → begrip; cross-profiel verwijzingen
    // (canoniek model, ArchiMate) lopen via de verwijzings-properties.
    bron: { elementTypes: ["gegevensselectie", "subject", "begrip"] },
    doel: { elementTypes: ["begrip"] },
    edgePresentatie: {
      lijn: "dash-4-4",
      vorm: "hoekig",
      kleur: KLEUREN.structuur,
      markerEnd: "pijl-open",
    },
  },
];

export const toegangsregelDiagramType = {
  id: TOEGANGSREGEL_ID,
  label: "Toegangsregel",
  style: "uml-klassiek",
  elementTypes,
  hierarchie: ["bevat"],
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

/** Idempotente registratie (veilig bij HMR/dubbele import).
 *  De vormentaal (shapes.jsx + iconen.jsx, Implementatie-domein) wordt
 *  door de activiteiten geregistreerd — dit bestand blijft jsx-vrij
 *  zodat de node-tests het kunnen importeren. */
export function registreerToegangsregelProfiel() {
  if (!getDiagramType(TOEGANGSREGEL_ID)) {
    registreerDiagramType(toegangsregelDiagramType);
  }
}

let _teller = 0;

/** Nieuw (niet-connector-)element van het gegeven type (voor de canvas-taakbalk). */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et || et.isConnector) return null;
  _teller += 1;
  return {
    id: `trg_nieuw_${Date.now()}_${_teller}`,
    naam: et.label,
    elementType: et.id,
    compartimenten: [],
    data:
      et.id === "toegangsregel"
        ? { modaliteit: "mag" }
        : et.id === "voorwaardepoort"
          ? { soort: "alle" }
          : {},
  };
}
