// @ts-check
/**
 * simulatie — het M2 van een simulatie (Mark 16-11, ontwerp Simulatie §12): wat er gesimuleerd
 * wordt en met welke scenario's. Een model in deze taal (M1) staat in het project, gaat mee in
 * de sync en is te tekenen; de activiteit Simulatie leest er haar scenario's uit en bewaart ze
 * erin (`simulatie/scenarioModel.js`).
 *
 *   Simulatie ──heeft──▶ Simulatiesubject ─ ─▶ een dynamisch modelonderdeel in het project
 *       │                                     (nu een BPMN-diagram; later activity, sequence,
 *       │                                     een use case-realisatie)
 *       └────heeft──▶ Scenario ──start met──▶ Instantie (de startgegevens)
 *                        ├──heeft──▶ Stub (het antwoord bij een gat) ──waarde──▶ Instantie
 *                        └──heeft──▶ Verwachting (waar de run moet uitkomen: het scenario als test)
 *
 * Een **Instantie** is de serialisatie (nu json) van een instantie van een type uit het model:
 * M0-gegevens, beschreven in een M1-model. Het elementtype heeft de M3-aard `instantie`; het
 * type waar het naar wijst heeft de aard `gegevens` (cm-entiteit, UML-klasse, MIM-objecttype,
 * ERD-entiteit). Het object uit het object-profiel heeft dezelfde aard.
 *
 * Bewust nog niet: formele en materiële tijd in de serialisatie (het formaat kan later naar dat
 * van de replay-bestanden groeien), en een subject dat iets anders is dan een diagram.
 */
import { KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, pakket, stereotypeLabel } from "../uml2Basis.js";
import { scenarioInhoud, instantieInhoud, stubInhoud, verwachtingInhoud, subjectInhoud } from "./vormen.js";

export const SIMULATIE_ID = "simulatie";

/** Hoe een gat gevuld wordt (de vulwijze; `simulatie/gaten.js`). */
export const VULWIJZEN = [
  { waarde: "hand", label: "met de hand" },
  { waarde: "willekeurig", label: "willekeurig" },
  { waarde: "fixture", label: "uit het scenario (stubs)" },
];
const VULWIJZE_OF_STANDAARD = [{ waarde: "", label: "(de standaard van het scenario)" }, ...VULWIJZEN];

/** De soorten gaten waarvoor een scenario een eigen vulwijze kan kiezen. */
export const GATSOORTEN = [
  { key: "taak", label: "taak (formulier)" },
  { key: "dienst", label: "dienst (externe actie)" },
  { key: "expressie", label: "expressie (onleesbare conditie of tabel)" },
  { key: "partner", label: "partner (bericht van buiten)" },
];

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    // Startvariabele: "naam = waarde" (de waarde als json: "tekst", 12, true, null, [..]).
    id: "variabele",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "variabele", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "waarde (json)", datatype: "string" },
    ],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "simulatie",
    label: "Simulatie",
    omschrijving: "Wat er samen gesimuleerd wordt: een of meer subjecten (processen) met een of meer scenario's.",
    kort: "SIM",
    stereotype: "«simulatie»",
    icoon: "klasse",
    shape: "sm-doos",
    kleur: "#e0e7ff",
    properties: [KLEUR_VELD],
  },
  {
    id: "subject",
    label: "Simulatiesubject",
    omschrijving: "Een dynamisch modelonderdeel dat de simulatie naspeelt: nu een BPMN-diagram (een proces); later een activity- of sequencediagram of een use case-realisatie.",
    kort: "SUBJ",
    stereotype: "«subject»",
    icoon: "klasse",
    shape: "sm-doos",
    kleur: "#dbeafe",
    properties: [{ key: "verwijstNaar", label: "het diagram", datatype: "diagram-verwijzing" }, KLEUR_VELD],
    hooks: { inhoudsregels: subjectInhoud },
  },
  {
    id: "scenario",
    label: "Scenario",
    omschrijving: "Eén doorloop: waar hij start, met welke gegevens, hoe de gaten gevuld worden en wat de verwachte uitkomst is.",
    kort: "SCN",
    stereotype: "«scenario»",
    icoon: "klasse",
    shape: "sm-doos",
    kleur: "#dcfce7",
    properties: [
      { key: "startBij", label: "start bij", datatype: "element-verwijzing", aard: "begin" },
      { key: "startProces", label: "start bij (proces-id)", datatype: "string", placeholder: "als er geen verwijzing is" },
      { key: "vulwijze", label: "vulwijze", datatype: "keuze", opties: VULWIJZEN },
      ...GATSOORTEN.map((s) => ({ key: `vulwijze_${s.key}`, label: `vulwijze ${s.label}`, datatype: "keuze", opties: VULWIJZE_OF_STANDAARD })),
      { key: "toevalsgetal", label: "toevalsgetal", datatype: "string", placeholder: "1 — maakt willekeurig herhaalbaar" },
      KLEUR_VELD,
    ],
    compartments: [{ id: "variabelen", label: "startvariabelen", fieldType: "variabele" }],
    hooks: { inhoudsregels: scenarioInhoud },
  },
  {
    // De M3-aard `instantie`: draagt de gegevens van één instantie (M0) van een type (M1).
    id: "instantie",
    label: "Instantie",
    aard: "instantie",
    omschrijving: "De gegevens van één instantie van een type uit het model, als json: de startgegevens van een scenario of de waarde van een stub.",
    kort: "INST",
    icoon: "ob-object",
    shape: "sm-doos",
    kleur: "#fef9c3",
    properties: [
      { key: "instantieVan", label: "instantie van", datatype: "element-verwijzing", aard: "gegevens" },
      { key: "typeLabel", label: "type (tekst)", datatype: "string", placeholder: "als er geen verwijzing is" },
      { key: "sleutel", label: "sleutel (id)", datatype: "string", placeholder: "bijv. aanvraag-1" },
      { key: "json", label: "gegevens (json)", datatype: "tekst" },
      KLEUR_VELD,
    ],
    hooks: { inhoudsregels: instantieInhoud },
  },
  {
    id: "stub",
    label: "Stub",
    omschrijving: "Het antwoord bij een gat: wat een taak, dienst of partner teruggeeft. Het volgnummer zegt bij welk bezoek van de taak het geldt.",
    kort: "STUB",
    stereotype: "«stub»",
    icoon: "klasse",
    shape: "sm-doos",
    kleur: "#ffedd5",
    properties: [
      { key: "bij", label: "bij (taak of gateway)", datatype: "element-verwijzing" },
      { key: "plek", label: "bij (tekst)", datatype: "string", placeholder: "bpmn-id of naam, als er geen verwijzing is" },
      { key: "bezoek", label: "volgnummer (bezoek)", datatype: "string", placeholder: "1" },
      { key: "wijze", label: "vulwijze", datatype: "keuze", opties: [{ waarde: "", label: "deze waarde" }, { waarde: "hand", label: "met de hand (geen waarde)" }, { waarde: "willekeurig", label: "willekeurig (geen waarde)" }] },
      { key: "json", label: "waarde (json)", datatype: "tekst" },
      KLEUR_VELD,
    ],
    hooks: { inhoudsregels: stubInhoud },
  },
  {
    id: "verwachting",
    label: "Verwachting",
    omschrijving: "Waar de run hoort uit te komen: een einde of een gat, met de waarden die dan moeten gelden. Maakt van het scenario een test.",
    kort: "VERW",
    stereotype: "«verwachting»",
    icoon: "klasse",
    shape: "sm-doos",
    kleur: "#fee2e2",
    properties: [
      { key: "soort", label: "de run stopt bij", datatype: "keuze", opties: [{ waarde: "einde", label: "een einde" }, { waarde: "gat", label: "een gat" }] },
      { key: "bij", label: "bij (element)", datatype: "element-verwijzing" },
      { key: "plek", label: "bij (naam)", datatype: "string", placeholder: "de naam van het einde of het gat" },
      { key: "via", label: "komt langs (naam van een stap)", datatype: "string" },
      { key: "waarden", label: "verwachte waarden (json)", datatype: "tekst" },
      { key: "reden", label: "reden (uitleg)", datatype: "tekst" },
      KLEUR_VELD,
    ],
    hooks: { inhoudsregels: verwachtingInhoud },
  },
  pakket(),
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "heeft",
    label: "Heeft",
    aard: "associatie",
    omschrijving: "De simulatie heeft subjecten en scenario's; een scenario heeft stubs en een verwachting.",
    kort: "◆",
    icoon: "compositie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["simulatie", "scenario"] },
    doel: { elementTypes: ["subject", "scenario", "stub", "verwachting"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerStart: "ruit" },
  },
  {
    id: "start-met",
    label: "Start met",
    aard: "afhankelijkheid",
    omschrijving: "Het scenario start met deze instantie als startobject.",
    kort: "«start»",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["scenario"] },
    doel: { elementTypes: ["instantie"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«start met»"),
  },
  {
    id: "waarde",
    label: "Waarde",
    aard: "afhankelijkheid",
    omschrijving: "De stub geeft deze instantie terug (in plaats van de json op de stub zelf).",
    kort: "«waarde»",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["stub"] },
    doel: { elementTypes: ["instantie"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«waarde»"),
  },
  notitielijn(["simulatie", "subject", "scenario", "instantie", "stub", "verwachting", "package", "boundary"]),
  bevat(["package"], ["simulatie", "subject", "scenario", "instantie", "stub", "verwachting", "package", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const simulatieDiagramType = {
  id: SIMULATIE_ID,
  label: "Simulatiemodel",
  versie: "1.0.0",
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
