/**
 * activities/index.js — registreert alle activiteiten in het activityRegistry.
 *
 * De volgorde hieronder bepaalt de volgorde van de iconen in de activity bar.
 * Een nieuwe functie toevoegen = hier één descriptor toevoegen (of importeren).
 *
 * Groepen (consolidatieplan 2026-07-11, fase 0):
 *   "modelleren" → UML, canoniek model, OAS, MIM, DMN, BPMN, Berichten
 *   "diensten"   → API's, Toegangverlening
 *   "data"       → Rollen, Referentielijsten
 *   "beheer"     → profiel-gereedschap + Studio-instellingen (onderaan de balk)
 *
 * Activiteiten met status "concept" of verborgenInBalk: true staan niet in de
 * activity bar, maar blijven bereikbaar via menu Ga naar.
 */
import { registreerActiviteiten } from "../activityRegistry";
import { maakPlaceholderActiviteit } from "./PlaceholderActivity";
import { IconAPI, IconRollen, IconReferentielijst } from "../icons";

import umlActivity from "./umlActivity";
import modellerenActivity from "./modellerenActivity";
import koppelingenActivity from "./koppelingenActivity";
import diagramActivity from "./diagramActivity";
import puurUmlActivity from "./puurUmlActivity";
import oasActivity from "./oasActivity";
import profielActivity from "./profielActivity";
import profielOntwerpActivity from "./profielOntwerpActivity";
import dmnActivity from "./dmnActivity";
import dmnDrdActivity from "./dmnDrdActivity";
import statemachineActivity from "./statemachineActivity";
import usecaseActivity from "./usecaseActivity";
import activityActivity from "./activityActivity";
import bpmnMotorActivity from "./bpmnMotorActivity";
import archimateActivity from "./archimateActivity";
import sequenceActivity from "./sequenceActivity";
import erdActivity from "./erdActivity";
import sysmlActivity from "./sysmlActivity";
import cmmnActivity from "./cmmnActivity";
// Data-shapes globaal registreren bij startup (side-effect), zodat ze in
// elk profiel beschikbaar zijn.
import "./vormenRegistratie.js";
import "./iconenRegistratie.js";
import studioInstellingenActivity from "./studioInstellingenActivity";
import mimActivity from "./mimActivity";
import bpmnActivity from "./bpmnActivity";
import berichtActivity from "./berichtActivity";
import formulierActivity from "./formulierActivity";
import formulierDiagramActivity from "./formulierDiagramActivity";
import toegangActivity from "./toegangActivity";
import toegangsregelsActivity from "./toegangsregelsActivity";

// ── Nog te bouwen functies: uniforme placeholder met de drie-slot-structuur ──
const apiActivity = maakPlaceholderActiviteit({
  id: "api",
  label: "API's",
  icon: <IconAPI />,
  groep: "diensten",
  sidebarLabel: "API's",
  toelichting: "Beheer van API-definities (OpenAPI 3.1) bovenop het canoniek model.",
  voorbeeldItems: [],
});

const rollenActivity = maakPlaceholderActiviteit({
  id: "rollen",
  label: "Rollen",
  icon: <IconRollen />,
  groep: "data",
  sidebarLabel: "Rollen",
  toelichting: "Inhoudelijke rollen-data die de toegangverlening en policies voeden.",
  voorbeeldItems: [],
});

const referentielijstenActivity = maakPlaceholderActiviteit({
  id: "referentielijsten",
  label: "Referentielijsten",
  icon: <IconReferentielijst />,
  groep: "data",
  sidebarLabel: "Referentielijsten",
  toelichting: "Beheer van referentielijsten en hun instantie-items.",
  voorbeeldItems: [],
});

import { registreerActiviteitAlsProfieltype } from "./activiteitAlsProfieltype.jsx";
// Side-effect: registreert de ingebouwde transformaties (import/export/transform).
import "./transformaties.js";

registreerActiviteiten([
  // modelleren
  modellerenActivity, // fase 2: één ingang — projectbrowser + diagram-tabs over alle profielen
  koppelingenActivity, // fase 4 v0: kruisverbanden tussen profieltypen (matrix)
  umlActivity,
  diagramActivity, // "Canoniek model" — canoniek-uml op de generieke motor (preview)
  puurUmlActivity, // "UML" — tweede profiel (preview)
  oasActivity, // "OAS" — derde profiel, OAS 3.0/3.1 (preview)
  mimActivity, // "MIM" — vijfde profiel, MIM 1.2 (preview)
  statemachineActivity, // "State machine" — gedragsdiagram-verkenning (preview)
  usecaseActivity, // "Use case" — actoren/use cases/systeemkader (preview)
  activityActivity, // "Activity" — acties/fork/pins/partities (preview)
  bpmnMotorActivity, // "BPMN" — eigen motor: events/gateways/boundary (preview)
  archimateActivity, // "ArchiMate" — vier lagen, elf relaties (preview)
  sequenceActivity, // "Sequence" — levenslijnen op het rand-primitief (preview)
  erdActivity, // "ERD" — kraaienpoten, kardinaliteit per uiteinde (preview)
  sysmlActivity, // "SysML" — bdd + ibd (poorten op de rand) + requirements (preview)
  cmmnActivity, // "CMMN" — casusmodel; sentries op het rand-primitief (preview)
  formulierDiagramActivity, // "Formulier (diagram)" — formulier-profiel, dogfood (F48 P1; niet in de balk)
  toegangsregelsActivity, // "Toegangsregels" — toegangsregel-profiel op de motor (via Modelleren-host)
  dmnActivity,
  dmnDrdActivity, // "DMN DRD" — vierde profiel (preview, niet in de balk)
  bpmnActivity,
  berichtActivity,
  // diensten
  apiActivity,
  toegangActivity,
  // data
  rollenActivity,
  referentielijstenActivity,
  // presentatie
  formulierActivity, // visuele FormulierDefinitie-editor (F41)
  // beheer (onderaan de balk)
  profielActivity, // "Profiel-editor" — meta-editor trede 1 (JSON, §8.9)
  profielOntwerpActivity, // "Profiel-ontwerp" — meta-editor trede 2 (tekenen, §8.9)
  studioInstellingenActivity, // globale vorm-/icoon-galerij (P07-vervolg)
]);

// ── Fase 2-sluitstuk: klassieke editors ook in de Modelleren-tab-host ──
// Andere motor (dmn-js/bpmn/FlexLayout) → als profieltype met vaste
// documenten; de eigen sidebar verschijnt in het ondervak van de browser.
// De "UML-model"-activiteit implementeert het canonieke metamodel
// (ENT/GE/REL), niet puur UML — in de projectboom heet zij dus naar wat
// ze is: de Canoniek model IDE (v1), de publiceer-/genereer-plek.
registreerActiviteitAlsProfieltype(umlActivity, {
  label: "Canoniek model IDE",
  kleur: "#475569",
  documenten: [{ id: "uml-model", naam: "Canoniek model IDE (v1)" }],
  eigenSchil: true,
});
// BPMN en DMN: meerdere documenten, elk met eigen (per document bewaarde)
// inhoud — de elementen leven in bpmn.io/dmn-js, niet in de projectboom.
registreerActiviteitAlsProfieltype(dmnActivity, {
  kleur: "#a78bfa",
  documenten: [{ id: "dmn-model", naam: "DMN-model (DRD + tabel)" }],
  documentenBeheer: true,
});
registreerActiviteitAlsProfieltype(bpmnActivity, {
  kleur: "#f472b6",
  documenten: [{ id: "bpmn-proces", naam: "BPMN-proces" }],
  documentenBeheer: true,
});
registreerActiviteitAlsProfieltype(berichtActivity, {
  kleur: "#34d399",
  documenten: [{ id: "berichtdefinities", naam: "Berichtdefinities" }],
});
