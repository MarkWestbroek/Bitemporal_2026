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
    id: "toegangsregel",
    label: "Toegangsregel",
    kort: "REG",
    shape: "rect",
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
    shape: "rect",
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
    shape: "rect",
    kleur: KLEUREN.actie,
    properties: [{ key: "nlgov", label: "NLGov-actie", datatype: "string" }, KLEUR_VELD],
  },
  {
    id: "gegevensselectie",
    label: "Gegevensselectie",
    kort: "GEG",
    shape: "rect",
    kleur: KLEUREN.gegevens,
    properties: [...VERWIJZING_VELDEN, KLEUR_VELD],
  },
  {
    id: "voorwaardepoort",
    label: "Voorwaardepoort",
    kort: "◇",
    shape: "rect",
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
    shape: "rect",
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
    shape: "note",
    kleur: KLEUREN.plicht,
    properties: [{ key: "nlgov", label: "NLGov-plicht", datatype: "string" }, KLEUR_VELD],
  },
  {
    id: "begrip",
    label: "Begrip",
    kort: "DEF",
    shape: "rect",
    kleur: KLEUREN.begrip,
    properties: [
      { key: "soort", label: "soort (wie / wat)", datatype: "string" },
      { key: "definitie", label: "definitie", datatype: "string" },
      ...VERWIJZING_VELDEN,
      KLEUR_VELD,
    ],
  },

  // ── Connectoren: de zinsdelen van de kernzin ───────────────────────────────
  {
    id: "wie",
    label: "wie",
    kort: "wie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["subject"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur },
  },
  {
    id: "doet",
    label: "doet",
    kort: "doet",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel", "subject"] },
    doel: { elementTypes: ["handeling"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur, markerEnd: "pijl" },
  },
  {
    id: "op",
    label: "op",
    kort: "op",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel", "handeling"] },
    doel: { elementTypes: ["gegevensselectie"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur, markerEnd: "pijl" },
  },
  {
    id: "als",
    label: "als",
    kort: "als",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["voorwaardepoort", "voorwaarde"] },
    edgePresentatie: { lijn: "dashed", vorm: "hoekig", kleur: KLEUREN.structuur },
  },
  {
    id: "tak",
    label: "tak",
    kort: "·",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["voorwaardepoort"] },
    doel: { elementTypes: ["voorwaardepoort", "voorwaarde"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: KLEUREN.structuur },
  },
  {
    id: "waarbij",
    label: "waarbij",
    kort: "⚑",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["toegangsregel"] },
    doel: { elementTypes: ["plicht"] },
    edgePresentatie: { lijn: "dashed", vorm: "hoekig", kleur: KLEUREN.structuur },
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
    edgePresentatie: { lijn: "dotted", vorm: "hoekig", kleur: KLEUREN.structuur, markerEnd: "pijl" },
  },
];

export const toegangsregelDiagramType = {
  id: TOEGANGSREGEL_ID,
  label: "Toegangsregel",
  style: "uml-klassiek",
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerToegangsregelProfiel() {
  if (!getDiagramType(TOEGANGSREGEL_ID)) {
    registreerDiagramType(toegangsregelDiagramType);
  }
}
