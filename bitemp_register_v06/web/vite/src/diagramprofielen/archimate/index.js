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

export const ARCHIMATE_ID = "archimate";

// Laag-kleuren (conventie, per element overschrijfbaar via data.kleur).
const BUSINESS = "#fff4b8";
const APPLICATION = "#cfe6ff";
const TECHNOLOGY = "#d3f5cf";
const MOTIVATION = "#e8d9f5";

const KLEUR_VELD = { key: "kleur", datatype: "colour" };
const ROND = 10; // gedragselementen (proces/functie/service/event)

/**
 * Compacte element-declaratie: [id, label, laagkleur, icoon, rond?, omschrijving].
 * @type {[string, string, string, string, boolean, string][]}
 */
const ELEMENTEN = [
  // ── business ──
  ["business-actor", "Business actor", BUSINESS, "am-actor", false, "Organisatie-entiteit die gedrag kan uitvoeren (persoon, afdeling, organisatie)."],
  ["business-rol", "Business rol", BUSINESS, "am-rol", false, "Verantwoordelijkheid die aan een actor toegewezen wordt."],
  ["business-proces", "Business proces", BUSINESS, "am-proces", true, "Reeks gedragingen die een product of dienst oplevert."],
  ["business-functie", "Business functie", BUSINESS, "am-functie", true, "Gedrag gebundeld op benodigde kennis/kunde (afdelings-agnostisch)."],
  ["business-service", "Business service", BUSINESS, "am-service", true, "Expliciet aangeboden dienst met waarde voor de omgeving."],
  ["business-event", "Business event", BUSINESS, "am-event", true, "Gebeurtenis die business-gedrag start of beïnvloedt."],
  ["business-object", "Business object", BUSINESS, "am-object", false, "Concept dat in de business gebruikt wordt (passieve structuur)."],
  // ── application ──
  ["app-component", "Applicatiecomponent", APPLICATION, "am-component", false, "Modulair, zelfstandig inzetbaar stuk applicatie-functionaliteit."],
  ["app-service", "Applicatieservice", APPLICATION, "am-service", true, "Expliciet aangeboden applicatiedienst."],
  ["app-functie", "Applicatiefunctie", APPLICATION, "am-functie", true, "Intern gedrag van een applicatiecomponent."],
  ["data-object", "Data-object", APPLICATION, "am-object", false, "Gegevens geschikt voor geautomatiseerde verwerking."],
  // ── technology ──
  ["node", "Node", TECHNOLOGY, "am-node", false, "Reken-/opslagresource waarop artifacts draaien."],
  ["device", "Device", TECHNOLOGY, "am-device", false, "Fysiek IT-middel (server, telefoon, sensor)."],
  ["systeemsoftware", "Systeemsoftware", TECHNOLOGY, "am-software", false, "Software-omgeving voor het draaien van componenten (OS, DBMS)."],
  ["tech-service", "Technologyservice", TECHNOLOGY, "am-service", true, "Expliciet aangeboden infrastructuurdienst."],
  ["artifact", "Artifact", TECHNOLOGY, "am-artifact", false, "Fysiek stuk data/software (bestand, deployable)."],
  // ── motivation ──
  ["stakeholder", "Stakeholder", MOTIVATION, "am-stakeholder", false, "Belanghebbende met interesse in de architectuur-uitkomst."],
  ["driver", "Driver", MOTIVATION, "am-driver", false, "Interne of externe drijfveer voor verandering."],
  ["goal", "Goal", MOTIVATION, "am-goal", false, "Beoogd resultaat (doel) van een stakeholder."],
  ["principle", "Principle", MOTIVATION, "am-principle", false, "Algemene ontwerpuitspraak die richting geeft."],
  ["requirement", "Requirement", MOTIVATION, "am-requirement", false, "Concrete eis aan het systeem of de architectuur."],
  // ArchiMate 3: Constraint is een specialisatie van Requirement — een
  // opgelegde beperking, bv. wet- en regelgeving (grondslag van toegangsbeleid).
  ["constraint", "Constraint", MOTIVATION, "am-requirement", false, "Opgelegde beperking op realisatie (bv. wet- en regelgeving)."],
];

const ALLE_IDS = [...ELEMENTEN.map(([id]) => id), "junction"];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  ...ELEMENTEN.map(([id, label, kleur, icoon, rond, omschrijving]) => ({
    id,
    label,
    omschrijving,
    kort: label.replace(/^(Business|Applicatie|Technology|Data-|Systeem)\s?/i, "").slice(0, 9) || label.slice(0, 9),
    icoon,
    shape: "archimate-box",
    kleur,
    ...(rond ? { hoekRadius: ROND } : {}),
    properties: [KLEUR_VELD],
  })),
  {
    id: "junction",
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
