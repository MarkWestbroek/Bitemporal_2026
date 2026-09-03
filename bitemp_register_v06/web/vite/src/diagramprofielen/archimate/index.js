// @ts-check
/**
 * archimate — ArchiMate 3.2 op de generieke diagram-motor (v0, sessie
 * 2026-07-17; plan: "2026-07-17 ArchiMate en verdere notaties" §3 fase 1).
 *
 * ArchiMate is notationeel uniform — (vrijwel) elk element is een rechthoek
 * in de laag-kleur met een type-icoon rechtsboven; gedrag heeft afgeronde
 * hoeken, structuur rechte. Eén `archimate-box`-shape + iconen dekt dus de
 * hele elemententaal. v0-subset (~22 typen) over Business (geel),
 * Application (blauw), Technology (groen) en Motivation (paars), plus de
 * junction (en/of). De **tweede officiële notatie** — het symbool zélf als
 * vorm (poppetje, 3D-doos, …) — zit als shape-set "Iconen als vorm" naast de
 * boxen: `vormSet.js` (mapping) + `vormShapes.jsx` (vormen), te kiezen via
 * menu Beeld → Shape-set.
 *
 * Alle **elf relaties** zijn er, op bestaande lijn-/markermiddelen:
 * compositie/aggregatie (ruit aan de bron), toewijzing (bol→pijl),
 * realisatie (stippel + open driehoek), bediening (open pijl), toegang
 * (stippel; `toegang` lezen/schrijven → label), beïnvloeding (stippel;
 * `invloed` bv. "+"/"−" → label), trigger (dichte pijl), stroom (streepjes +
 * dichte pijl; naam = label), specialisatie (dichte→open driehoek) en
 * associatie (kaal). **v0 is bewust permissief**: de regels beperken alleen
 * junction-gebruik niet; de échte geldigheidsmatrix (spec-bijlage B) komt in
 * v1 als datatabel → gegenereerde verbindingsregels. Nesting (containers)
 * en viewpoints: eveneens v1/v2 — zie het plan.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { registreerArchimateIconen } from "./iconen.jsx";
import { registreerArchimateShapes } from "./shapes.jsx";
import { registreerArchimateVormShapes } from "./vormShapes.jsx";
import { VORMEN_SET } from "./vormSet.js";
import { ELEMENTEN, LAAG_GROEP, MOTIVATION } from "./elementen.js";

export const ARCHIMATE_ID = "archimate";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const ROND = 10; // gedragselementen (proces/functie/service/event/…)

const ALLE_IDS = [...ELEMENTEN.map(([id]) => id), "junction"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  ...ELEMENTEN.map(([id, label, kleur, icoon, rond, omschrijving, kort]) => ({
    id,
    label,
    omschrijving,
    kort:
      kort ||
      label.replace(/^(Business|Applicatie-?|Technology-?|Data-|Systeem)\s?/i, "").slice(0, 12) ||
      label.slice(0, 12),
    icoon,
    shape: "archimate-box",
    kleur,
    // Laag als taakbalkgroep: de Maken-balk krijgt een scheidingsteken op
    // elke laaggrens (business | application | technology | motivation).
    taakbalkGroep: LAAG_GROEP[kleur],
    // ArchiMate tekent motivation-elementen met afgeschuinde hoeken — dat is
    // hun eigen vormgrammatica, net als ronde hoeken voor gedrag.
    ...(kleur === MOTIVATION ? { hoekStijl: "afgeschuind" } : {}),
    ...(rond ? { hoekRadius: ROND } : {}),
    properties: [KLEUR_VELD],
  })),
  {
    id: "junction",
    taakbalkGroep: "overig",
    label: "Junction",
    omschrijving: "Splitst/verbindt relaties van hetzelfde type (en = dicht, of = open).",
    kort: "Junctie",
    icoon: "am-junction",
    shape: "archimate-junction",
    resizebaar: false,
    properties: [{ key: "soort", label: "soort", datatype: "keuze", opties: [
      { waarde: "", label: "en (dicht)" },
      { waarde: "of", label: "of (open)" },
    ] }],
  },
  {
    id: "notitie",
    taakbalkGroep: "overig",
    label: "Notitie",
    omschrijving: "Vrije notitie op het diagram; koppel hem met een toelichting-lijn aan een element.",
    kort: "NOT",
    shape: "note",
    // Geen handleStijl "onzichtbaar" zoals in de andere profielen: de
    // toelichting-connector vertrekt vanaf de notitie, en onzichtbare handles
    // hebben pointer-events: none — dan is die lijn niet te slepen.
    properties: [{ key: "tekst", datatype: "tekst" }, KLEUR_VELD],
  },
  {
    id: "kader",
    taakbalkGroep: "overig",
    label: "Kader",
    omschrijving: "Puur visuele groepering in een view; geen ArchiMate-modelsemantiek.",
    kort: "KADER",
    icoon: "kader",
    shape: "boundary",
    achtergrond: true,
    handleStijl: "onzichtbaar",
    properties: [
      { key: "kleur", label: "rand", datatype: "colour" },
      { key: "achtergrondKleur", label: "achtergrond", datatype: "colour" },
    ],
  },

  // ── De elf relaties ────────────────────────────────────────────────────
  // v0 permissief: elke relatie mag tussen alle elementen (+ junction als
  // tussenstation); de geldigheidsmatrix wordt v1 (datatabel → regels).
  ...[
    ["compositie", "Compositie", "Geheel-deel: het deel bestaat niet zonder het geheel (ruit aan het geheel).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerStart: "ruit" }],
    ["aggregatie", "Aggregatie", "Groepeert delen die ook zelfstandig bestaan (open ruit aan het geheel).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerStart: "ruit-open" }],
    ["toewijzing", "Toewijzing", "Actieve structuur voert gedrag uit (bol aan de uitvoerder).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerStart: "bol", markerEnd: "pijl-dicht" }],
    ["realisatie", "Realisatie", "Het een realiseert het ander (bv. proces realiseert service).",
      { lijn: "dash-4-4", vorm: "recht", kleur: "#475569", markerEnd: "driehoek" }],
    ["bediening", "Bediening (serving)", "Levert zijn functionaliteit aan de ander.",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-open" }],
    ["toegang", "Toegang (access)", "Gedrag benadert een passief element (eigenschap: lezen/schrijven).",
      { lijn: "dash-4-4", vorm: "recht", kleur: "#64748b", markerEnd: "pijl-open" }],
    ["beinvloeding", "Beïnvloeding", "Motivatie-element beïnvloedt een ander (+/− als eigenschap).",
      { lijn: "dash-4-4", vorm: "recht", kleur: "#64748b", markerEnd: "pijl-open" }],
    ["trigger", "Trigger", "Tijdelijke of causale opvolging tussen gedrag.",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "pijl-dicht" }],
    ["stroom", "Stroom (flow)", "Overdracht (informatie, geld, goederen) tussen gedrag; naam = wat er stroomt.",
      { lijn: "dash-6-3", vorm: "recht", kleur: "#475569", markerEnd: "pijl-dicht" }],
    ["specialisatie", "Specialisatie", "Is-een-soort-van (open driehoek naar het algemene element).",
      { lijn: "solid", vorm: "recht", kleur: "#475569", markerEnd: "driehoek" }],
    ["associatie", "Associatie", "Ongespecificeerde relatie.",
      { lijn: "solid", vorm: "recht", kleur: "#475569" }],
  ].map(([id, label, omschrijving, edgePresentatie]) => ({
    id,
    label,
    omschrijving,
    kort: label.split(" ")[0],
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ALLE_IDS },
    doel: { elementTypes: ALLE_IDS },
    edgePresentatie,
    ...(id === "toegang"
      ? {
          properties: [{ key: "toegang", label: "toegang", datatype: "keuze", opties: [
            { waarde: "", label: "(ongespecificeerd)" },
            { waarde: "r", label: "lezen" },
            { waarde: "w", label: "schrijven" },
            { waarde: "rw", label: "lezen + schrijven" },
          ] }],
          hooks: {
            edgeLabels: (conn) => {
              const t = conn.data?.toegang;
              if (!t) return {};
              return { kaal: [{ zijde: "midden", delen: [{ tekst: `(${t})`, soort: "constraint" }] }] };
            },
          },
        }
      : {}),
    ...(id === "beinvloeding"
      ? {
          properties: [{ key: "invloed", label: "invloed (bv. + of −)", datatype: "string" }],
          hooks: {
            edgeLabels: (conn) => {
              const i = conn.data?.invloed;
              if (!i) return {};
              return { kaal: [{ zijde: "midden", delen: [{ tekst: i, soort: "constraint" }] }] };
            },
          },
        }
      : {}),
  })),
  {
    id: "toelichting",
    taakbalkGroep: "view",
    label: "Toelichting",
    omschrijving: "View-only stippellijn van een notitie naar een element; geen ArchiMate-relatie.",
    kort: "Toel.",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["notitie"] },
    doel: { elementTypes: [...ALLE_IDS, "kader"] },
    edgePresentatie: { lijn: "dash-4-4", vorm: "recht", kleur: "#64748b" },
  },
];

export const archimateDiagramType = {
  id: ARCHIMATE_ID,
  label: "ArchiMate",
  style: "uml-klassiek",
  // Connectoren hechten aan de omtrek i.p.v. aan vier handles: dozen
  // dragen vaak veel lijnen, en die moeten kunnen uitwaaieren.
  randAanhechting: "zwevend",
  meerdereVoorkomens: true,
  typeWeergave: "geen", // het hoek-icoon zit al in de shape
  // Tweede officiële notatie (P07): het symbool *als* vorm i.p.v. de box met
  // hoek-icoon — menu Beeld → Shape-set. Mapping en motivatie: `vormSet.js`.
  shapeSets: [VORMEN_SET],
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
  const NAAMLOOS = new Set(["junction", "notitie"]);
  const element = {
    id: `am_${Date.now()}_${_teller}`,
    naam: NAAMLOOS.has(et.id) ? "" : et.label,
    elementType: et.id,
    compartimenten: [],
    data: {},
  };
  if (et.id === "notitie") element.data.tekst = "";
  return element;
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerArchimate() {
  registreerArchimateIconen();
  registreerArchimateShapes();
  registreerArchimateVormShapes();
  if (!getDiagramType(ARCHIMATE_ID)) {
    registreerDiagramType(archimateDiagramType);
  }
}
