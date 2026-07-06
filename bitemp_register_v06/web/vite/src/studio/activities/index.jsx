/**
 * activities/index.js — registreert alle activiteiten in het activityRegistry.
 *
 * De volgorde hieronder bepaalt de volgorde van de iconen in de activity bar.
 * Een nieuwe functie toevoegen = hier één descriptor toevoegen (of importeren).
 *
 * Groepen:
 *   "modelleren" → UML, DMN, BPMN, Berichten
 *   "diensten"   → API's, Toegangverlening
 *   "data"       → Rollen, Referentielijsten
 */
import { registreerActiviteiten } from "../activityRegistry";
import { maakPlaceholderActiviteit } from "./PlaceholderActivity";
import { IconAPI, IconToegang, IconRollen, IconReferentielijst } from "../icons";

import umlActivity from "./umlActivity";
import diagramActivity from "./diagramActivity";
import puurUmlActivity from "./puurUmlActivity";
import oasActivity from "./oasActivity";
import profielActivity from "./profielActivity";
import profielOntwerpActivity from "./profielOntwerpActivity";
import dmnActivity from "./dmnActivity";
import dmnDrdActivity from "./dmnDrdActivity";
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
  umlActivity,
  diagramActivity, // Studio 0.5 preview (canoniek-uml op de generieke motor)
  puurUmlActivity, // Studio 0.5: tweede profiel (fase 5-lakmoesproef)
  oasActivity, // Studio 0.5: derde profiel (OAS 3.1, fase 5-vuurproef)
  mimActivity, // Studio 0.5: vijfde profiel (MIM 1.2, pas-toe-of-leg-uit)
  profielActivity, // Studio 0.5: meta-editor trede 1 (JSON, §8.9)
  profielOntwerpActivity, // Studio 0.5: meta-editor trede 2 (tekenen, §8.9)
  dmnActivity,
  dmnDrdActivity, // Studio 0.5: vierde profiel (DMN DRD)
  bpmnActivity,
  berichtActivity,
  // diensten
  apiActivity,
  toegangActivity,
  // data
  rollenActivity,
  referentielijstenActivity,
]);
