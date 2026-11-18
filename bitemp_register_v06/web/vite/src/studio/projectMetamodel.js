// @ts-check
/**
 * projectMetamodel — de structuur van een Studio-project (het werkbestand, formaat
 * "studio-project") als gegevens (plan docs/plans/2026-11-15 M3 en projectmetamodel als modellen
 * in Omnium, stap 2). Geen M3: dit beschrijft het bestand en de werkbank, niet de modeltalen.
 *
 * Bron voor het alleen-lezen model "Omnium projectmetamodel" (puur-uml, `npm run metamodellen`).
 * De code is de implementatie (bouwProjectData in activities/modellerenActivity.jsx,
 * createDiagramStore, projectSync.js); de controletest `projectMetamodel.test.js` houdt dit gelijk:
 *   - de formaatversie is PROJECT_FORMAAT_VERSIE;
 *   - elke sleutel in echte werkbestanden (fixtures, docs/architectuur, docs/metamodel) is hier
 *     beschreven, op elk niveau;
 *   - elke beschreven sleutel komt in de code voor (geen verzonnen of vergeten sleutels);
 *   - de eis van formaat 4 (uuid's) klopt met UUID_SOORTEN en met het voorbeeldbestand.
 *
 * Zelfde vorm als het M3 (types/m3.js): klassen met eigenschappen (type, kardinaliteit), een
 * eigenschap tussen twee klassen is een associatie; `sleutel` = een map (sleutel → waarde);
 * `standaard` = de vaste waarde. Pakket **Werkruimte** is per gebruiker en staat NIET in het
 * werkbestand (v3, 07-10).
 */
import { PROJECT_FORMAAT, PROJECT_FORMAAT_VERSIE } from "./activities/projectSync.js";
import { UUID_SOORTEN } from "../diagramprofielen/canoniek-uml/uuids.js";

const e = (naam, type, kard = "0..1", extra = {}) => ({ naam, type, kard, ...extra });
const deel = (naam, type, kard = "*", extra = {}) => ({ naam, type, kard, samenstelling: true, ...extra });

export const PROJECT_PAKKETTEN = [
  { naam: "Werkbestand", uitleg: "Het project als geheel: identiteit, de boom (mappen en plaatsing), bundels, kruisverbanden en de profielversies. Eén JSONB-blob op de server, en het bestand van Exporteer project." },
  { naam: "Model", uitleg: "De inhoud per profiel (M1): elementen met compartimenten en velden, en diagrammen met hun voorkomens en lijnen." },
  { naam: "Werkruimte", uitleg: "Per gebruiker, NIET in het werkbestand (formaat 3, 07-10): open tabs, de actieve tab, open mappen, eigen bundels, pan/zoom. Lokaal en op de server per project en gebruiker." },
];

export const PROJECT_KLASSEN = [
  // ── Werkbestand ──
  {
    naam: "Werkbestand",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "Het hele bestand (bouwProjectData, modellerenActivity.jsx).",
    eigenschappen: [
      e("formaat", "string", "1", { standaard: PROJECT_FORMAAT }),
      e("versie", "number", "1", { standaard: String(PROJECT_FORMAAT_VERSIE), uitleg: "Formaatversie (projectSync.js PROJECT_FORMAAT_VERSIE). 3: zonder werkruimte; 4 (15-11): uuid's op modelelementen en velden van canoniek-uml. Een ouder bestand laadt en wordt bij de volgende snapshot het huidige formaat." }),
      e("geexporteerd", "string", "0..1", { uitleg: "Tijdstip (ISO) van de export." }),
      deel("project", "Project", "1"),
      deel("structuur", "Structuur", "1"),
      deel("kruisverbanden", "Kruisverband"),
      deel("koppelsoorten", "Koppelsoort", "*", { uitleg: "De soortenlijst van het project (07-11); ontbreekt = de standaardlijst." }),
      e("profielVersies", "string", "*", { sleutel: "profiel-id", uitleg: "Per profiel de versie (M2) waarmee het project is bewaard; de Studio vergelijkt die bij het openen (types/profielVersie.js)." }),
      deel("profielen", "ProfielInhoud", "*", { sleutel: "profiel-id" }),
    ],
  },
  {
    naam: "Project",
    pakket: "Werkbestand",
    soort: "datatype",
    uitleg: "De identiteit. Een branch draagt daarnaast `herkomst` (ouderProject, basis); die staat in het serverrecord, niet in het bestand.",
    eigenschappen: [e("id", "string", "1", { uitleg: "UUID (de server accepteert 8–64 tekens uit [A-Za-z0-9_-])." }), e("naam", "string", "1")],
  },
  {
    naam: "Structuur",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "De projectboom: mappen, waar elk element en diagram hangt, en de gedeelde bundels.",
    eigenschappen: [
      deel("mappen", "Map", "*", { sleutel: "map-id" }),
      e("plaatsing", "string", "*", { sleutel: "plaatsingssleutel", uitleg: "Sleutel `el::<profiel>::<element>` of `<profiel>::<diagram>`; waarde de map-id, of een element-sleutel als ouder (een element met uitwerking; hooguit één ouder, besluit 04-11)." }),
      e("plaatsingVolgorde", "string", "*", { uitleg: "De plaatsingssleutels in boomvolgorde (jsonb bewaart de sleutelvolgorde niet)." }),
      deel("bundels", "Bundel", "*", { sleutel: "bundel-id", uitleg: "Gedeelde bundels; de eigen bundels staan in de werkruimte." }),
    ],
  },
  {
    naam: "Map",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "Een map in de projectboom.",
    eigenschappen: [
      e("id", "string", "1", { uitleg: "`map_<ms>_<n>`." }),
      e("naam", "string", "1"),
      e("ouderId", "Map", "0..1", { uitleg: "De oudermap; leeg = wortel." }),
      e("volgorde", "number", "1"),
      e("beschrijving", "string", "0..1", { uitleg: "Markdown, voor documenten." }),
      e("kleur", "string", "0..1"),
    ],
  },
  {
    naam: "Bundel",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "Een gedeelde set diagrammen die samen open gaan.",
    eigenschappen: [e("id", "string", "1"), e("naam", "string", "1"), e("tabs", "DiagramRef", "*"), e("volgorde", "number", "0..1")],
  },
  {
    naam: "DiagramRef",
    pakket: "Werkbestand",
    soort: "datatype",
    uitleg: "Een diagram in een profiel.",
    eigenschappen: [e("profielId", "string", "1"), e("diagramId", "string", "1")],
  },
  {
    naam: "Kruisverband",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "Een koppeling tussen twee elementen, ook in verschillende talen (de koppelingen-matrix).",
    eigenschappen: [
      e("id", "string", "1", { uitleg: "`<profiel>::<element>##<profiel>::<element>` (rij ## kolom)." }),
      e("rij", "ElementRef", "1"),
      e("kolom", "ElementRef", "1", { uitleg: "Het bovenliggende uiteinde." }),
      e("soort", "Koppelsoort", "1", { uitleg: "Op naam." }),
      e("omgekeerd", "boolean", "0..1", { uitleg: "Richting kolom → rij." }),
    ],
  },
  {
    naam: "ElementRef",
    pakket: "Werkbestand",
    soort: "datatype",
    uitleg: "Een element in een profiel.",
    eigenschappen: [e("profielId", "string", "1"), e("elementId", "string", "1")],
  },
  {
    naam: "Koppelsoort",
    pakket: "Werkbestand",
    soort: "klasse",
    uitleg: "Een soort kruisverband (bv. \"traceert naar\").",
    eigenschappen: [e("soort", "string", "1"), e("stijl", "KoppelStijl", "1"), e("defaultOmgekeerd", "boolean", "0..1")],
  },

  // ── Model ──
  {
    naam: "ProfielInhoud",
    pakket: "Model",
    soort: "klasse",
    uitleg: "De inhoud van één profiel (de profielstore, createDiagramStore).",
    eigenschappen: [
      e("diagramTypeId", "string", "1", { uitleg: "Het DiagramType (M2)." }),
      deel("elements", "Element", "*", { sleutel: "element-id" }),
      deel("diagrams", "Diagram", "*", { sleutel: "diagram-id" }),
      e("actiefDiagramId", "Diagram", "0..1"),
      e("meta", "any", "0..1", { uitleg: "Metagegevens van de bron die niet bij een diagram horen; de motor geeft ze ongelezen door." }),
    ],
  },
  {
    naam: "Element",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een modelelement; een connector is een element met source en target.",
    eigenschappen: [
      e("id", "string", "1"),
      e("naam", "string", "1"),
      e("elementType", "string", "1", { uitleg: "Het ElementType (M2)." }),
      deel("compartimenten", "Compartiment", "0..9"),
      e("source", "Element", "0..1", { uitleg: "Bron (connector)." }),
      e("target", "Element", "0..1", { uitleg: "Doel (connector)." }),
      e("data", "ElementData", "0..1"),
    ],
  },
  {
    naam: "ElementData",
    pakket: "Model",
    soort: "datatype",
    uitleg: "Vrije gegevens van een element: de sleutels van zijn PropertyTypes (profiel-eigen), plus deze die de motor zelf leest.",
    eigenschappen: [
      e("uuid", "string", "0..1", { uitleg: `Formaat 4: verplicht voor de soorten in UuidSoort (canoniek-uml); de Studio vult een ontbrekende aan met een uuid v5 (canoniek-uml/uuids.js), stam het project of bij een branch herkomst.ouderProject.` }),
      e("beschrijving", "string"),
      e("verwijstNaar", "DiagramRef", "0..1", { uitleg: "De doorklik (dubbelklik opent dat diagram)." }),
      e("gedragDiagramId", "string"),
      e("randVan", "Element", "0..1", { uitleg: "De gastheer van een rand-element." }),
      e("kleur", "string"),
      e("achtergrondKleur", "string"),
      e("randStijl", "string"),
      e("zOrde", "number"),
      e("tekst", "string"),
      e("expressie", "string"),
      e("directioneel", "boolean"),
      e("domein", "string"),
      e("afgeleid", "boolean"),
    ],
  },
  {
    naam: "Compartiment",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een vak van een element, van een CompartmentType (M2).",
    eigenschappen: [e("compartmentType", "string", "1"), deel("velden", "Veld")],
  },
  {
    naam: "Veld",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een regel in een compartiment, van een FieldType (M2).",
    eigenschappen: [e("naam", "string", "1"), e("fieldType", "string", "1"), e("data", "VeldData", "0..1")],
  },
  {
    naam: "VeldData",
    pakket: "Model",
    soort: "datatype",
    uitleg: "Vrije gegevens van een veld: de sleutels van zijn PropertyTypes, plus deze die de motor leest.",
    eigenschappen: [
      e("uuid", "string", "0..1", { uitleg: "Formaat 4: verplicht voor een veld met een naam in het compartiment \"velden\" van canoniek-uml." }),
      e("typeLabel", "string"),
      e("cursief", "boolean"),
      e("afgeleid", "boolean"),
      e("beschrijving", "string"),
    ],
  },
  {
    naam: "Diagram",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een diagram: voorkomens van elementen; connectoren tekent de motor uit de elementen met source/target.",
    eigenschappen: [
      e("id", "string", "1"),
      e("naam", "string", "1"),
      e("diagramType", "string", "1"),
      deel("nodes", "DiagramNode", "*"),
      deel("edges", "DiagramEdge", "*", { uitleg: "Alleen presentatie-edges uit een import." }),
      deel("lijnen", "Lijn", "*", { sleutel: "connector-id", uitleg: "De lijnstand per connector op dit diagram." }),
      e("verborgenConnectoren", "Element", "*", { uitleg: "Connectoren die alleen op dit diagram verborgen zijn." }),
      e("gedaanteOverrides", "ConnectorGedaante", "*", { sleutel: "connector-id" }),
      e("connectorVoorkomens", "VoorkomenPaar", "*", { sleutel: "connector-id" }),
      e("verbergCompartimenten", "boolean"),
      e("shapeSetId", "string"),
      e("beschrijving", "string"),
      e("layoutStijl", "string"),
    ],
  },
  {
    naam: "DiagramNode",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een voorkomen van een element op een diagram (meer dan één mag als het profiel dat toelaat).",
    eigenschappen: [
      e("nodeId", "string", "0..1", { uitleg: "Zonder: het element-id. Extra voorkomen: `<element>__voorkomen_<ms>_<n>`." }),
      e("elementId", "Element", "1"),
      e("position", "Punt", "1", { uitleg: "Relatief aan de gastheer bij een rand-element." }),
      e("size", "Maat", "0..1"),
      e("gedaante", "Gedaante", "0..1"),
      e("ankerPosition", "Punt", "0..1", { uitleg: "Anker van een connector als doos (associatieklasse)." }),
      e("layoutLocked", "boolean"),
    ],
  },
  {
    naam: "DiagramEdge",
    pakket: "Model",
    soort: "klasse",
    uitleg: "Een presentatie-edge uit een import.",
    eigenschappen: [
      e("id", "string", "1"),
      e("source", "string", "1"),
      e("target", "string", "1"),
      e("sourceHandle", "string"),
      e("targetHandle", "string"),
      e("hidden", "boolean"),
      e("data", "any"),
    ],
  },
  {
    naam: "Lijn",
    pakket: "Model",
    soort: "datatype",
    uitleg: "De lijnstand van een connector (model/lijnvorm.js); dezelfde sleutels op element.data gelden als standaard, die op het diagram wint.",
    eigenschappen: [
      e("knikken", "Punt", "*"),
      e("vorm", "LijnVorm"),
      e("sourceHandle", "string"),
      e("targetHandle", "string"),
      e("labelOffsets", "any"),
      e("boomOuder", "string"),
    ],
  },
  { naam: "VoorkomenPaar", pakket: "Model", soort: "datatype", uitleg: "Welke twee voorkomens een connector verbindt.", eigenschappen: [e("bronNodeId", "string", "1"), e("doelNodeId", "string", "1")] },
  { naam: "Punt", pakket: "Model", soort: "datatype", uitleg: "Een punt.", eigenschappen: [e("x", "number", "1"), e("y", "number", "1")] },
  { naam: "Maat", pakket: "Model", soort: "datatype", uitleg: "Breedte en hoogte.", eigenschappen: [e("width", "number", "1"), e("height", "number", "1")] },

  // ── Werkruimte ──
  {
    naam: "Werkruimte",
    pakket: "Werkruimte",
    soort: "klasse",
    uitleg: "Per gebruiker en project (localStorage `studio-werkruimte:<project>` en de server); niet in het werkbestand.",
    eigenschappen: [
      e("tabs", "Tab", "*"),
      e("actieveTab", "string"),
      e("mapOpen", "boolean", "*", { sleutel: "map-id" }),
      e("bundels", "EigenBundel", "*"),
      e("bijgewerkt", "string"),
      e("viewports", "Viewport", "*", { sleutel: "diagram-id", uitleg: "In de profielstore (lokaal bewaard), niet in de undo." }),
    ],
  },
  { naam: "Tab", pakket: "Werkruimte", soort: "datatype", uitleg: "Een open diagram.", eigenschappen: [e("id", "string", "1"), e("profielId", "string", "1"), e("diagramId", "string", "1")] },
  { naam: "EigenBundel", pakket: "Werkruimte", soort: "datatype", uitleg: "Een eigen bundel (niet gedeeld).", eigenschappen: [e("id", "string", "1"), e("naam", "string", "1"), e("tabs", "DiagramRef", "*")] },
  { naam: "Viewport", pakket: "Werkruimte", soort: "datatype", uitleg: "Pan en zoom van een diagram.", eigenschappen: [e("x", "number", "1"), e("y", "number", "1"), e("zoom", "number", "1")] },
];

export const PROJECT_ENUMERATIES = [
  { naam: "Gedaante", pakket: "Model", waarden: ["vol", "kop", "bol"], uitleg: "De gedaante van een voorkomen: alles, alleen de kop, of het bolletje (samentrekking); een profiel kan eigen gedaanten noemen (opname)." },
  { naam: "LijnVorm", pakket: "Model", waarden: ["bezier", "hoekig", "recht", "boom"], uitleg: "Routering van een lijn." },
  { naam: "ConnectorGedaante", pakket: "Model", waarden: ["box", "lijn"], uitleg: "Een connector met velden als doos of als lijn." },
  { naam: "KoppelStijl", pakket: "Werkbestand", waarden: ["afhankelijk", "realisatie"], uitleg: "Hoe een kruisverband tekent." },
  { naam: "UuidSoort", pakket: "Model", waarden: [...UUID_SOORTEN], uitleg: "Formaat 4: de elementsoorten van canoniek-uml die een uuid dragen.", bron: "diagramprofielen/canoniek-uml/uuids.js (UUID_SOORTEN)" },
];
