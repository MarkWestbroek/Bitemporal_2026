// @ts-check
/**
 * sequence — een UML sequence-profiel op de generieke diagram-motor (v0,
 * sessie 2026-07-17). Dit was het "grootste gat" uit de gedragsverkenning
 * (as-/volgorde-semantiek + activations); v0 lost het pragmatisch op met
 * het rand-primitief (§3.1) als sequence-mechaniek:
 *
 *   - **levenslijn**: een bewust smalle, hoge node (de gestippelde lijn;
 *     de naam-kop hangt er via overflow boven). Rand-elementen klemmen
 *     daardoor óp de lijn en bewegen mee met de levenslijn;
 *   - **punt** (occurrence) en **activatie** (execution-balk, in hoogte
 *     resizebaar) zijn rand-elementen op de levenslijn — berichten
 *     verbinden punt↔punt (of activatie);
 *   - **berichten**: synchroon (dichte pijl), asynchroon (open pijl) en
 *     retour (gestippeld); de naam is het label. Een zelf-bericht wordt
 *     het hoekige "oortje" (bestaande lus-presentatie);
 *   - **fragment**: alt/opt/loop/par-kader (soort als keuze-property).
 *
 * Bewuste v0-versimpelingen (het resterende as-primitief, v1):
 * de verticale positie ís de volgorde en blijft handwerk — er is nog geen
 * auto-ordening, geen "berichten horizontaal"-constraint en geen
 * herordenen-met-doorschuiven. Gates, found/lost messages en
 * state-invariants blijven buiten scope.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerGedragTypeIconen } from "../gedragTypeIconen.jsx";
import { registreerSequenceShapes } from "./shapes.jsx";

export const SEQUENCE_ID = "sequence";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Wat berichten kan zenden/ontvangen: punten en activaties op de lijn. */
const AANHECHT = ["punt", "activatie"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "levenslijn",
    label: "Levenslijn",
    omschrijving: "Deelnemer aan de interactie; sleep punten/activaties op de lijn.",
    kort: "Lijn",
    icoon: "seq-levenslijn",
    shape: "seq-levenslijn",
    // Hoogte rekbaar (lijn langer maken); de breedte blijft praktisch 14px.
    minBreedte: 14,
    minHoogte: 200,
    properties: [KLEUR_VELD],
  },
  {
    id: "punt",
    label: "Punt (occurrence)",
    omschrijving: "Aanhechtpunt op de levenslijn — sleep hem op de lijn; berichten lopen van punt naar punt.",
    kort: "Punt",
    icoon: "seq-punt",
    shape: "seq-punt",
    resizebaar: false,
    // Rand-element (§3.1): klemt op de (smalle) levenslijn-node = op de lijn.
    randElement: { ouderTypes: ["levenslijn"] },
    properties: [],
  },
  {
    id: "activatie",
    label: "Activatie",
    omschrijving: "Execution-balk op de levenslijn (sleep op de lijn; hoogte = duur).",
    kort: "Activ",
    icoon: "seq-activatie",
    shape: "seq-activatie",
    minBreedte: 14,
    minHoogte: 44,
    randElement: { ouderTypes: ["levenslijn"] },
    properties: [],
  },
  {
    id: "fragment",
    label: "Fragment",
    omschrijving: "Gecombineerd fragment (alt/opt/loop/par) — kader over een stuk interactie.",
    kort: "Frag",
    icoon: "seq-fragment",
    shape: "seq-fragment",
    achtergrond: true,
    properties: [
      { key: "soort", label: "soort", datatype: "keuze", opties: [
        { waarde: "alt", label: "alt (alternatieven)" },
        { waarde: "opt", label: "opt (optioneel)" },
        { waarde: "loop", label: "loop (herhaling)" },
        { waarde: "par", label: "par (parallel)" },
      ] },
      { key: "naam", label: "conditie/toelichting", datatype: "string" },
    ],
  },
  {
    id: "notitie",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "NOT",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Berichten ──────────────────────────────────────────────────────────
  ...[
    ["synchroon", "Synchroon bericht", "Aanroep die op antwoord wacht (dichte pijlpunt).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-dicht" }],
    ["asynchroon", "Asynchroon bericht", "Bericht zonder te wachten (open pijlpunt).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open" }],
    ["retour", "Retourbericht", "Antwoord terug naar de aanroeper (gestippeld).",
      { lijn: "dash-4-4", vorm: "recht", kleur: "#64748b", markerEnd: "pijl-open" }],
  ].map(([id, label, omschrijving, edgePresentatie]) => ({
    id,
    label,
    omschrijving,
    kort: label.split(" ")[0],
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: AANHECHT },
    doel: { elementTypes: AANHECHT },
    edgePresentatie,
  })),
];

export const sequenceDiagramType = {
  id: SEQUENCE_ID,
  label: "Sequence",
  style: "uml-klassiek",
  typeWeergave: "geen",
  fieldTypes: [],
  elementTypes,
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
  const NAAMLOOS = new Set(["punt", "activatie", "fragment", "notitie"]);
  const element = {
    id: `sq_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "fragment") element.data.soort = "alt";
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerSequence() {
  registreerGedragTypeIconen();
  registreerSequenceShapes();
  if (!getDiagramType(SEQUENCE_ID)) {
    registreerDiagramType(sequenceDiagramType);
  }
}
