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
 *     retour (gestippeld); de naam is het label. Een zelf-bericht loopt
 *     tussen twee punten op dezelfde lijn (zenden, 15px lager ontvangen):
 *     rechts eruit, hoekig, rechts erin — het haakje van EA, en de
 *     "rugzak"-activatie volgt uit de afleiding (activaties.js);
 *   - **fragment**: alt/opt/loop/par-kader (soort als keuze-property).
 *
 * 2026-10-14 (fase 0 van het plan "Sequence — volgorde in het model, layout
 * erbovenop"): een levenslijn heeft een **kop** (object, actor, boundary,
 * control, entity); een bericht een **guard** en een **retourwaarde**
 * (`[guard] naam(…): retour`, labels.js). 15-10: je tekent een bericht van
 * levenslijn naar levenslijn (kies het berichttype in de balk en sleep op de
 * gewenste hoogte); de punten ontstaan vanzelf (zelfbericht.js) en de
 * activaties worden afgeleid (activaties.js) — punt en activatie staan niet
 * meer in het palet.
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
import { KOPPEN, berichtLabels } from "./labels.js";
import { verschuifBericht } from "./verschuif.js";
import { puntenVoorBericht, ruimPuntenOp } from "./zelfbericht.js";

export { KOPPEN, berichtLabels };

export const SEQUENCE_ID = "sequence";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/**
 * Wat berichten kan zenden/ontvangen: de levenslijn zelf (de gewone manier:
 * je trekt van lijn naar lijn op de hoogte van de muis en het profiel maakt
 * de punten, zie zelfbericht.js), en bestaande punten en activaties.
 */
const AANHECHT = ["levenslijn", "punt", "activatie"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "levenslijn",
    label: "Levenslijn",
    omschrijving: "Deelnemer aan de interactie — een object. Typeer hem via 'instantie van' of door een element uit de boom op de lijn te droppen.",
    kort: "Lijn",
    icoon: "seq-levenslijn",
    shape: "seq-levenslijn",
    // Hoogte rekbaar (lijn langer maken); de breedte blijft praktisch 14px.
    minBreedte: 14,
    minHoogte: 200,
    // Een levenslijn beweegt alleen opzij (zoals in EA): anders gaan alle
    // berichten (rand-elementen, relatief aan de lijn) scheef (Mark, 14-10).
    layoutDimensie: "x",
    properties: [
      // Instantie-van (ontwerp "Sequence hermetisch" §1): het type van dit
      // object, uit welk profiel dan ook. De kop rendert dan naam:Type.
      { key: "instantieVan", label: "instantie van", datatype: "element-verwijzing" },
      // Kop (2026-10-14, Mark): de rol van de deelnemer. Boundary/control/
      // entity zijn de robustness-stereotypes van Jacobson (Objectory, UML 1.x
      // standaardprofiel; EA "Robustness"). Leeg = de weergave van het type
      // (instantie van, bv. ArchiMate), zonder type de rechthoek.
      { key: "kop", label: "kop", datatype: "keuze", opties: KOPPEN },
      KLEUR_VELD,
    ],
    hooks: {
      /** Element uit de boom op de lijn gedropt → typeer de levenslijn. */
      ontvangtDrop: (element, ref, { updateElement }) => {
        if (!ref?.profielId || !ref?.elementId) return;
        updateElement(element.id, { data: { instantieVan: { profielId: ref.profielId, elementId: ref.elementId } } });
      },
    },
  },
  {
    id: "punt",
    label: "Punt (occurrence)",
    omschrijving: "Aanhechtpunt op de levenslijn — sleep hem op de lijn; berichten lopen van punt naar punt.",
    kort: "Punt",
    icoon: "seq-punt",
    shape: "seq-punt",
    resizebaar: false,
    // Ontstaat met een bericht (zelfbericht.js), niet uit het palet (15-10).
    inPalet: false,
    // Rand-element (§3.1): klemt op de (smalle) levenslijn-node = op de lijn.
    randElement: { ouderTypes: ["levenslijn"], klem: "as" },
    properties: [],
  },
  {
    id: "activatie",
    label: "Activatie",
    omschrijving: "Execution-balk op de levenslijn (sleep op de lijn; hoogte = duur). Uit berichten tussen punten leidt het diagram de balken zelf af.",
    kort: "Activ",
    icoon: "seq-activatie",
    shape: "seq-activatie",
    minBreedte: 14,
    minHoogte: 44,
    // Activaties volgen uit de berichten (activaties.js); handmatig alleen
    // nog in oude diagrammen (15-10).
    inPalet: false,
    randElement: { ouderTypes: ["levenslijn"], klem: "as" },
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
    // Klein mogen (EA: 120×70) en handles zichtbaar: zo trek je er een
    // notitie-lijn uit zonder eerst de verbind-modus te kiezen (Mark, 14-10).
    minBreedte: 100,
    minHoogte: 44,
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  {
    // Notitie-lijn (EA NoteLink): stippel van een notitie naar wat hij toelicht.
    id: "notitielijn",
    label: "Notitie-lijn",
    kort: "not",
    shape: "edge",
    icoon: "notitie",
    isConnector: true,
    bron: { elementTypes: ["notitie"] },
    doel: { elementTypes: ["levenslijn", "fragment", "punt", "activatie"] },
    edgePresentatie: { lijn: "dash-4-4", vorm: "recht", kleur: "#94a3b8" },
  },

  // ── Berichten ──────────────────────────────────────────────────────────
  ...[
    ["synchroon", "Synchroon bericht", "Aanroep die op antwoord wacht (dichte pijlpunt).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-dicht", labelsBoven: true }],
    ["asynchroon", "Asynchroon bericht", "Bericht zonder te wachten (open pijlpunt).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open", labelsBoven: true }],
    ["retour", "Retourbericht", "Antwoord terug naar de aanroeper (gestippeld).",
      { lijn: "dash-4-4", vorm: "recht", kleur: "#64748b", markerEnd: "pijl-open", labelsBoven: true }],
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
    // Delete haalt een bericht uit het model (met zijn punten, zie
    // naVerwijderen): verborgen op zijn eigen interactiediagram is zinloos.
    verwijderen: "model",
    // Hermetisch (ontwerp §2): het bericht is een operatie van het type van
    // de doel-levenslijn (keten doel-punt → levenslijn → instantieVan),
    // met vrije argumenten. Zonder getypeerde levenslijn: vrije naam.
    properties: [
      { key: "operatie", label: "operatie", datatype: "operatie-keuze" },
      { key: "argumenten", label: "argumenten", datatype: "string" },
      // Retourwaarde (UML: retourparameter van de signatuur). De terugkeer
      // zelf is het eind van de activatie; een retourpijl is optioneel.
      { key: "retourtype", label: "retourwaarde", datatype: "string" },
      // Guard (EA: conditie op het bericht), getekend als [guard] vóór de naam.
      { key: "guard", label: "guard", datatype: "string" },
    ],
    hooks: {
      /** Label: [guard] operatie(argumenten): retourwaarde. */
      edgeLabels: berichtLabels,
      /** Zelf-bericht (beide punten op één lijn): het haakje naar rechts. */
      edgePresentatie: (conn, ctx) => {
        const a = ctx?.elements?.[conn.source], b = ctx?.elements?.[conn.target];
        const lijn = a?.data?.randVan;
        if (!lijn || lijn !== b?.data?.randVan || conn.source === conn.target) return {};
        return { vorm: "hoekig", sourceHandle: "source-right", targetHandle: "target-right" };
      },
      /** Lijn verticaal slepen: punten mee, horizontaal, eronder wegduwen (verschuif.js). */
      verschuifConnector: verschuifBericht,
      /** Getekend van/naar een levenslijn (of naar zichzelf): de punten ontstaan (zelfbericht.js). */
      naVerbinden: (conn, ctx) => puntenVoorBericht(conn, { ...ctx, maakPunt: () => maakElement("punt") }),
      /** Verwijderd: de punten die alleen van dit bericht waren gaan mee. */
      naVerwijderen: ruimPuntenOp,
    },
  })),
];

export const sequenceDiagramType = {
  id: SEQUENCE_ID,
  label: "Sequence",
  // Beschrijving: wat de EA-import vóór 2026-10-12 als "notes" bewaarde → M3 data.beschrijving.
  oudeBeschrijvingSleutels: ["notes"],
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
