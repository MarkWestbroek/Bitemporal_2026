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
import { IconAPI, IconToegang, IconRollen, IconReferentielijst } from "../icons";

import umlActivity from "./umlActivity";
import modellerenActivity from "./modellerenActivity";
import diagramActivity from "./diagramActivity";
import puurUmlActivity from "./puurUmlActivity";
import oasActivity from "./oasActivity";
import profielActivity from "./profielActivity";
import profielOntwerpActivity from "./profielOntwerpActivity";
import dmnActivity from "./dmnActivity";
import dmnDrdActivity from "./dmnDrdActivity";
// Data-shapes globaal registreren bij startup (side-effect), zodat ze in
// elk profiel beschikbaar zijn.
import "./vormenRegistratie.js";
import "./iconenRegistratie.js";
import studioInstellingenActivity from "./studioInstellingenActivity";
import mimActivity from "./mimActivity";
import bpmnActivity from "./bpmnActivity";
import berichtActivity from "./berichtActivity";

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

const toegangActivity = maakPlaceholderActiviteit({
  id: "toegang",
  label: "Toegangverlening",
  icon: <IconToegang />,
  groep: "diensten",
  sidebarLabel: "Policies (FTV)",
  toelichting: "PBAC/FTV-policies (PIP/PAP/PDP/PEP, XACML 3.0) voor toegangverlening.",
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

registreerActiviteiten([
  // modelleren
  modellerenActivity, // fase 2: één ingang — projectbrowser + diagram-tabs over alle profielen
  umlActivity,
  diagramActivity, // "Canoniek model" — canoniek-uml op de generieke motor (preview)
  puurUmlActivity, // "UML" — tweede profiel (preview)
  oasActivity, // "OAS" — derde profiel, OAS 3.0/3.1 (preview)
  mimActivity, // "MIM" — vijfde profiel, MIM 1.2 (preview)
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
  // beheer (onderaan de balk)
  profielActivity, // "Profiel-editor" — meta-editor trede 1 (JSON, §8.9)
  profielOntwerpActivity, // "Profiel-ontwerp" — meta-editor trede 2 (tekenen, §8.9)
  studioInstellingenActivity, // globale vorm-/icoon-galerij (P07-vervolg)
]);
