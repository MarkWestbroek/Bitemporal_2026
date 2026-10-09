// @ts-check
/**
 * eaMapping — Sparx EA (DMN MDG 1.1+) → dmn-drd-profiel. In EA zijn de
 * DRD-elementen gewone objecten met DMN-stereotypen (Object_Type varieert per
 * EA-versie: "Object"/"Class"/"Activity", het stereotype is leidend); de
 * requirements zijn connectoren met stereotype InformationRequirement/
 * KnowledgeRequirement/AuthorityRequirement. Puur data; id's zijn een
 * contract (EA-GUID → id).
 *
 * Richting (GGM, EA-SYNC 10-10): EA tekent een eis als Dependency/Abstraction
 * van de **beslissing** (client) naar wat ze nodig heeft (supplier) —
 * Activity«Decision» → Class«InputData». In een DRD loopt de pijl andersom;
 * de lezer **draait Dependency/Abstraction-eisen om** (bron en doel wisselen,
 * pad mee). InformationFlow blijft 1-op-1. Object_Type in het GGM:
 * Activity«Decision»/«BusinessKnowledgeModel», Class«InputData»/
 * «KnowledgeSource» — vandaar de wildcard.
 */

export const EA_DIAGRAM_TYPES = ["DMN", "Analysis", "Logical", "Custom"];
export const EA_MDG = "DMN";

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "*", stereotype: "decision", elementType: "decision", opmerking: "Object_Type ongeacht; tagged value question → vraag; Note → toelichting" },
  { objectType: "*", stereotype: "inputdata", elementType: "inputData" },
  { objectType: "*", stereotype: "businessknowledgemodel", elementType: "bkm" },
  { objectType: "*", stereotype: "knowledgesource", elementType: "knowledgeSource" },
  { objectType: "*", stereotype: "textannotation", elementType: "notitie" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "*", stereotype: "informationrequirement", elementType: "infoReq", opmerking: "Dependency/Abstraction: omdraaien (EA: beslissing → vereiste; DRD: vereiste → beslissing)" },
  { connectorType: "*", stereotype: "knowledgerequirement", elementType: "knowReq", opmerking: "idem omdraaien" },
  { connectorType: "*", stereotype: "authorityrequirement", elementType: "authReq", opmerking: "idem omdraaien" },
  { connectorType: "*", stereotype: "association", elementType: "notitielijn", opmerking: "alleen als een uiteinde een annotatie is" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "InformationFlow", elementType: "infoReq", opmerking: "zonder stereotype: informatie-eis" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = [];
