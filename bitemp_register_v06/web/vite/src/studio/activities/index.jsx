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
import graphqlActivity from "./graphqlActivity";
import shaclActivity from "./shaclActivity";
import profielActivity from "./profielActivity";
import profielOntwerpActivity from "./profielOntwerpActivity";
import dmnActivity from "./dmnActivity";
import dmnDrdActivity from "./dmnDrdActivity";
import statemachineActivity from "./statemachineActivity";
import usecaseActivity from "./usecaseActivity";
import activityActivity from "./activityActivity";
import bpmnMotorActivity from "./bpmnMotorActivity";
import simulatieActivity from "./simulatieActivity";
import archimateActivity from "./archimateActivity";
import sequenceActivity from "./sequenceActivity";
import erdActivity from "./erdActivity";
import sysmlActivity from "./sysmlActivity";
import cmmnActivity from "./cmmnActivity";
// EA-aanvulling (2026-10-09): de UML 2-/EA-diagramsoorten die de Sparx EA-import nog miste.
import componentDeploymentActivity from "./componentDeploymentActivity";
import objectActivity from "./objectActivity";
import simulatiemodelActivity from "./simulatiemodelActivity";
import requirementsActivity from "./requirementsActivity";
import businessActivity from "./businessActivity";
import xsdActivity from "./xsdActivity";
import wsdlActivity from "./wsdlActivity";
import compositeStructureActivity from "./compositeStructureActivity";
import communicationActivity from "./communicationActivity";
// Data-shapes globaal registreren bij startup (side-effect), zodat ze in
// elk profiel beschikbaar zijn.
import "./vormenRegistratie.js";
import "./iconenRegistratie.js";
import studioInstellingenActivity from "./studioInstellingenActivity";
import aiToegangActivity from "./aiToegangActivity";
import gebruikersActivity from "./gebruikersActivity";
import mimActivity from "./mimActivity";
import bpmnActivity from "./bpmnActivity";
import berichtActivity from "./berichtActivity";
import formulierActivity from "./formulierActivity";
import formulierDiagramActivity from "./formulierDiagramActivity";
import toegangActivity from "./toegangActivity";
import toegangsregelsActivity from "./toegangsregelsActivity";
import transformatiesActivity from "./transformatiesActivity";
import transformatieProfielActivity from "./transformatieProfielActivity";
import weergaveActivity from "./weergaveActivity";
import m3ProfielActivity from "./m3ProfielActivity";
import { profielenZicht, transformatiesZicht } from "./projectZicht.jsx";

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
import "./inrichtingsExport.js";
import "./shaclTransformatie.js"; // canoniek → SHACL (linked data fase 3)
import "./layoutOvernemenTransformatie.js"; // layout overnemen via kruisverbanden
import "./archimateTransformaties.js";
import "./oasCanoniekTransformatie.js";
import "./usecaseTransformaties.js";
import "./bpmnDmnTransformaties.js"; // BPMN 2.0 XML → BPMN, DMN XML → DRD (lezer → regelset → toepasser)

registreerActiviteiten([
  // modelleren
  modellerenActivity, // fase 2: één ingang — projectbrowser + diagram-tabs over alle profielen
  koppelingenActivity, // fase 4 v0: kruisverbanden tussen profieltypen (matrix)
  simulatieActivity, // "Simulatie" — een BPMN-proces met beslistabellen doorlopen met cm-objecten (preview)
  umlActivity,
  diagramActivity, // "Canoniek model" — canoniek-uml op de generieke motor (preview)
  puurUmlActivity, // "UML" — tweede profiel (preview)
  oasActivity, // "OAS" — derde profiel, OAS 3.0/3.1 (preview)
  graphqlActivity, // "GraphQL" — schema-profiel (M2): typesysteem, SDL in en uit (preview)
  shaclActivity, // "SHACL" — linked data (M2): shapes, Turtle in, met lint (preview)
  mimActivity, // "MIM" — vijfde profiel, MIM 1.2 (preview)
  statemachineActivity, // "State machine" — gedragsdiagram-verkenning (preview)
  usecaseActivity, // "Use case" — actoren/use cases/systeemkader (preview)
  activityActivity, // "Activity" — acties/fork/pins/partities (preview)
  bpmnMotorActivity, // "BPMN" — eigen motor: events/gateways/boundary (preview)
  archimateActivity, // "ArchiMate" — vier lagen, elf relaties (preview)
  sequenceActivity, // "Sequence" — levenslijnen op het rand-primitief (preview)
  m3ProfielActivity, // "Profiel (M3)" — een profiel (M2) als model in het M3, voor het sidecar-project (PROF-1)
  transformatieProfielActivity, // "Transformatie" — het profiel (M2) waarin je een regelset schrijft (TRANS-1)
  weergaveActivity, // "Weergave" — de vormen en iconen van de tool als model (weergaveproject)
  erdActivity, // "ERD" — kraaienpoten, kardinaliteit per uiteinde (preview)
  sysmlActivity, // "SysML" — bdd + ibd (poorten op de rand) + requirements (preview)
  cmmnActivity, // "CMMN" — casusmodel; sentries op het rand-primitief (preview)
  componentDeploymentActivity, // "Component & deployment" — UML 2 component-/deploymentdiagrammen (preview, niet in de balk)
  objectActivity, // "Object" — instantiediagram: objecten met slots, links (preview, niet in de balk)
  simulatiemodelActivity, // "Simulatiemodel" — simulatie, subjecten, scenario's, instanties, stubs (preview, niet in de balk)
  requirementsActivity, // "Requirements" — EA-stijl: requirement/feature/issue/change (preview, niet in de balk)
  businessActivity, // "Business (EP)" — Eriksson-Penker (preview, niet in de balk)
  xsdActivity, // "XML Schema" — XSD-stereotypen (preview, niet in de balk)
  wsdlActivity, // "WSDL" — WSDL-stereotypen (preview, niet in de balk)
  compositeStructureActivity, // "Composite structure" — parts/poorten/connectoren (preview, niet in de balk)
  communicationActivity, // "Communication" — objecten, links, genummerde berichten (preview, niet in de balk)
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
  profielenZicht, // "Profielen" — het profielen- en transformatieproject, boom gefilterd op de profielen (stap 9, Mark 22-11)
  transformatiesZicht, // "Transformaties" — hetzelfde project, boom gefilterd op de transformaties
  profielActivity, // "Profiel-editor" — meta-editor trede 1 (JSON, §8.9)
  profielOntwerpActivity, // "Profiel-ontwerp" — meta-editor trede 2 (tekenen, §8.9)
  transformatiesActivity, // "Regelsets proefdraaien" — regelsets (M2) lezen en proefdraaien (TRANS-1 stap 1); knop in Transformaties
  gebruikersActivity, // "Gebruikers" — accounts, rollen, wachtwoorden (domein beheer, AUTH_DEVELOPER_GUIDE §11)
  aiToegangActivity, // "AI-toegang" — toegangscodes voor de AI-proxy (docs/AI_ASSISTENT.md)
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

// ── Starten uit het project (plan Sidecar-project §7 stap 6, het lokale deel) ──
// Is er in deze browser gekozen om met profielen of weergaven uit een project te starten, dan
// komen die nu in de tool: eerst de profielen, dan de weergaven. Lukt het niet, dan blijft de
// code gelden en volgt een melding (startUitProject.js).
void (async () => {
  try {
    const [{ pasStartToe }, { zetProfielenInDeTool }, { zetWeergavenInDeTool }, { toonMelding }, centraal, { haalCentraleVersie }] = await Promise.all([
      import("../startUitProject.js"),
      import("./m3ProfielActivity.jsx"),
      import("./weergaveActivity.jsx"),
      import("../naamDialog.jsx"),
      import("../centraal.js"),
      import("./projectSync.js"),
    ]);
    // Stap 5: de vastgepinde centrale versies van deze build (centraalVersies.js; null = de code).
    // De API van deze instantie levert ze; is zij niet de centrale, dan haalt zij ze daar.
    const haal = async (soort, versie) => {
      const rec = await haalCentraleVersie(soort, versie);
      return { kop: { id: rec.projectId, naam: rec.projectNaam }, inhoud: centraal.modelUitWerkbestand(soort, rec.inhoud) };
    };
    const uit = await pasStartToe(
      {
        profielen: (inhoud) => zetProfielenInDeTool(inhoud),
        weergaven: (inhoud) => zetWeergavenInDeTool(inhoud.elements),
      },
      undefined,
      { pins: centraal.vastgepind(), haal }
    );
    if (uit.fouten.length) toonMelding({ titel: "Starten uit het project", tekst: uit.fouten.join("\n") });
  } catch (e) {
    console.warn("[studio] starten uit het project mislukt; de tool gebruikt de code", e);
  }
})();
