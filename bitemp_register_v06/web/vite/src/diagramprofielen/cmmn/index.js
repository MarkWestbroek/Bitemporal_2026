// @ts-check
/**
 * cmmn — CMMN 1.1 (Case Management Model and Notation) op de generieke motor.
 *
 * CMMN stond niet in de notatie-verkenning van 17-07, maar past er naadloos
 * bij — en het vult een echt gat naast BPMN. Waar BPMN een proces is dat je
 * vóóraf uittekent, beschrijft CMMN een **casus**: wat er *kan* gebeuren, en
 * onder welke voorwaarden. Er zijn dan ook geen sequence flows; er zijn
 * **sentries** — bewakers op de rand van een taak, stage of milestone die
 * zeggen wanneer iets mag beginnen (entry) of moet stoppen (exit).
 *
 * En precies dáárom past het hier zo goed: die sentry ís het
 * rand-aanhechtingsprimitief (`randElement`, STUDIO-05-gedragsdiagrammen
 * §3.1). Hetzelfde mechanisme dat BPMN-boundary-events, state machine
 * entry/exit-points, activity-pins en SysML-poorten draagt, draagt hier de
 * kern van de notatie. De stage is een container (`containerVoor`) en het
 * case plan model de buitenste. Verder is dit profiel dus: zeven shapes plus
 * een descriptor.
 *
 * v0 dekt:
 *   - **case plan model** (mapvorm) en **stage** (achthoek) als containers;
 *     `discretionair` maakt de rand gestreept (discretionary / plan fragment);
 *   - **task** met soort (human · process · case · decision) en de
 *     planningsmarkeringen `!` (verplicht), `#` (herhaling), `▷` (handmatig);
 *   - **milestone** (stadion) en **event listener** (dubbele cirkel, timer of
 *     user);
 *   - **case file item** (dokje) — waar de casus zijn gegevens houdt;
 *   - **sentry** als rand-element, open (entry) of gevuld (exit);
 *   - **on-part**: de gestippelde lijn van een plan item of case file item
 *     náár een sentry — "als dít gebeurt, gaat die bewaker open".
 *
 * Bewust nog niet: de **planningstabel** (discretionary items die een
 * casusbehandelaar tijdens de uitvoering toevoegt — een tabelmarkering, geen
 * vorm), **caseFileItem-relaties** (parent/child/refer), en de
 * **expressietaal** achter sentries en rules. Dat laatste is de kandidaat om
 * te koppelen aan CEL/Toegangsspraak in plaats van er een eigen taal bij te
 * verzinnen.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerCmmnShapes } from "./shapes.jsx";
import { registreerCmmnIconen } from "./iconen.jsx";

export const CMMN_ID = "cmmn";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };

/** Waar een sentry op mag zitten, en wat een on-part kan triggeren. */
const PLAN_ITEMS = ["taak", "stage", "mijlpaal"];
const HOUDERS = ["case-plan", "stage"];

/** De planningsmarkeringen; identiek voor taak en stage. */
const MARKERINGEN = [
  { key: "verplicht", label: "verplicht  !", datatype: "boolean" },
  { key: "herhaling", label: "herhaling  #", datatype: "boolean" },
  { key: "handmatig", label: "handmatig starten  ▷", datatype: "boolean" },
  { key: "discretionair", label: "discretionair (gestreept)", datatype: "boolean" },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: "case-plan",
    label: "Case plan model",
    omschrijving: "De buitenste map: alles wat er in deze casus kan gebeuren.",
    kort: "CASE",
    icoon: "cmmn-caseplan",
    shape: "cmmn-caseplan",
    containerVoor: "bevat",
    achtergrond: true,
    minBreedte: 320,
    minHoogte: 220,
    properties: [KLEUR_VELD],
  },
  {
    id: "stage",
    label: "Stage",
    omschrijving: "Een fase in de casus; sleep taken en mijlpalen erin.",
    kort: "STAGE",
    icoon: "cmmn-stage",
    shape: "cmmn-stage",
    containerVoor: "bevat",
    achtergrond: true,
    minBreedte: 220,
    minHoogte: 130,
    properties: [...MARKERINGEN, KLEUR_VELD],
  },
  {
    id: "taak",
    label: "Task",
    omschrijving: "Werk in de casus. Kies de soort (human, process, case, decision) in de inspector.",
    kort: "TASK",
    icoon: "cmmn-taak",
    shape: "cmmn-taak",
    kleur: "#e0f2fe",
    properties: [
      {
        key: "soort",
        label: "soort",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(blanco task)" },
          { waarde: "human", label: "human task — een mens doet het" },
          { waarde: "proces", label: "process task — start een proces (bv. BPMN)" },
          { waarde: "case", label: "case task — start een deelcasus" },
          { waarde: "decision", label: "decision task — roept een beslissing aan (bv. DMN)" },
        ],
      },
      ...MARKERINGEN,
      KLEUR_VELD,
    ],
  },
  {
    id: "mijlpaal",
    label: "Milestone",
    omschrijving: "Een bereikt resultaat in de casus; heeft geen werk, alleen voorwaarden.",
    kort: "MILE",
    icoon: "cmmn-mijlpaal",
    shape: "cmmn-mijlpaal",
    kleur: "#f3e8ff",
    properties: [KLEUR_VELD],
  },
  {
    id: "event-listener",
    label: "Event listener",
    omschrijving: "Wacht op iets van buiten: een timer of een handeling van een gebruiker.",
    kort: "EVT",
    icoon: "cmmn-event",
    shape: "cmmn-event",
    resizebaar: false,
    // Een dubbele ring van 32px draagt zelf geen tekst.
    naamLabel: "buiten",
    properties: [
      {
        key: "soort",
        label: "soort",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(blanco)" },
          { waarde: "timer", label: "timer ⏱" },
          { waarde: "user", label: "user ☺" },
        ],
      },
    ],
  },
  {
    id: "case-file-item",
    label: "Case file item",
    omschrijving: "Een gegeven in het casusdossier; kan een sentry laten aanslaan.",
    kort: "FILE",
    icoon: "cmmn-casefile",
    shape: "cmmn-casefile",
    resizebaar: false,
    naamLabel: "buiten",
    properties: [],
  },
  {
    id: "sentry",
    label: "Sentry",
    omschrijving: "Sleep hem op de rand: de bewaker. Open = entry (mag beginnen), gevuld = exit (moet stoppen).",
    kort: "◇",
    icoon: "cmmn-sentry",
    shape: "cmmn-sentry",
    resizebaar: false,
    // Rand-aanhechting (§3.1): de sentry hóórt bij zijn plan item.
    randElement: { ouderTypes: PLAN_ITEMS },
    naamLabel: "buiten",
    properties: [
      {
        key: "soort",
        label: "soort",
        datatype: "keuze",
        opties: [
          { waarde: "entry", label: "entry criterion (open ruit)" },
          { waarde: "exit", label: "exit criterion (gevulde ruit)" },
        ],
      },
      { key: "ifPart", label: "voorwaarde (ifPart)", datatype: "tekst" },
    ],
  },
  {
    id: "notitie",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram.",
    kort: "NOT",
    icoon: "notitie",
    shape: "note",
    handleStijl: "onzichtbaar",
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "on-part",
    label: "On-part",
    omschrijving: "Wat de sentry laat aanslaan: 'als dit plan item/gegeven iets doet, gaat die bewaker open'.",
    kort: "⇢◇",
    icoon: "cmmn-onpart",
    shape: "edge",
    isConnector: true,
    // CMMN heeft geen sequence flow: alle afhankelijkheid loopt via sentries.
    bron: { elementTypes: [...PLAN_ITEMS, "event-listener", "case-file-item"] },
    doel: { elementTypes: ["sentry"] },
    edgePresentatie: { lijn: "dash-4-4", vorm: "hoekig", kleur: "#475569" },
    properties: [
      {
        key: "standaardEvent",
        label: "gebeurtenis",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(niet gekozen)" },
          { waarde: "complete", label: "complete — is afgerond" },
          { waarde: "terminate", label: "terminate — is afgebroken" },
          { waarde: "occur", label: "occur — heeft plaatsgevonden" },
          { waarde: "create", label: "create — is aangemaakt" },
          { waarde: "update", label: "update — is gewijzigd" },
        ],
      },
    ],
    hooks: {
      // De gebeurtenis staat als label op de lijn — zonder die keuze zegt een
      // on-part alleen "hier hangt iets van af", en dat is te vaag om te tonen.
      edgeLabels: (conn) => {
        const ev = conn.data?.standaardEvent;
        if (!ev) return {};
        return { kaal: [{ zijde: "midden", delen: [{ tekst: ev, soort: "constraint" }] }] };
      },
    },
  },
  {
    id: "associatie",
    label: "Associatie",
    omschrijving: "Losse koppeling, bijvoorbeeld naar een notitie.",
    kort: "┄",
    icoon: "cmmn-associatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: [...PLAN_ITEMS, "case-file-item", "event-listener", "notitie"] },
    doel: { elementTypes: [...PLAN_ITEMS, "case-file-item", "event-listener", "notitie"] },
    edgePresentatie: { lijn: "dash-4-3", vorm: "recht", kleur: "#94a3b8" },
  },
  {
    id: "bevat",
    label: "Bevat (stage)",
    omschrijving: "Lidmaatschap van een stage of het case plan model; verborgen zolang het lid erin ligt.",
    kort: "∋",
    icoon: "cmmn-bevat",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: HOUDERS },
    doel: {
      elementTypes: [...PLAN_ITEMS, "event-listener", "case-file-item", "stage", "notitie"],
    },
    edgePresentatie: { lijn: "dash-4-3", vorm: "hoekig", kleur: "#cbd5e1", verbergBijNesting: true },
  },
];

export const cmmnDiagramType = {
  id: CMMN_ID,
  label: "CMMN",
  style: "uml-klassiek",
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
  const NAAMLOOS = new Set(["sentry", "event-listener", "notitie"]);
  const element = {
    id: `cm_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  // Een sentry zonder soort is betekenisloos; entry is verreweg het gewoonst.
  if (et.id === "sentry") element.data.soort = "entry";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerCmmn() {
  registreerCmmnShapes();
  registreerCmmnIconen();
  if (!getDiagramType(CMMN_ID)) {
    registreerDiagramType(cmmnDiagramType);
  }
}
