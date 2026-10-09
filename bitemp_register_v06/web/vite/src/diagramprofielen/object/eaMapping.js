// @ts-check
/**
 * eaMapping — Sparx EA → object-profiel (Diagram_Type "Object"). Puur data;
 * id's zijn een contract (EA-GUID → id). Zie component-deployment/eaMapping.js
 * voor de conventies.
 *
 * EA-object: `t_object.Object_Type = "Object"`, de classifier staat in
 * `t_object.Classifier` (Object_ID van de klasse) → `data.klassifierLabel`
 * = naam van die klasse; de runstate (slots) staat in `t_object.RunState`
 * als "@VAR;Variable=x;Value=1;Op==;@ENDVAR;" → slots (naam, typeLabel).
 */

export const EA_DIAGRAM_TYPES = ["Object"];

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Object", stereotype: "multiobject", elementType: "multiobject" },
  { objectType: "Object", elementType: "object", opmerking: "Classifier → data.klassifierLabel; RunState → slots" },
  { objectType: "Package", elementType: "package" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
  // Een klasse op een objectdiagram: als object met de klassenaam (EA
  // tekent soms de klasse naast haar instanties).
  { objectType: "Class", elementType: "object", opmerking: "verwijzing; naam → klassifierLabel" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Association", elementType: "link", opmerking: "SourceRole/DestRole → bronRol/doelRol; Direction → directioneel" },
  { connectorType: "Aggregation", elementType: "compositie", opmerking: "alleen SubType Strong; anders link" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "stereotype → data.stereotype" },
  { connectorType: "InstanceOf", elementType: "dependency", opmerking: "stereotype 'instantiate'" },
  { connectorType: "Generalization", elementType: "generalisatie" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = ["package"];

/**
 * Zet een EA-RunState-string om in slots voor het slots-compartiment.
 * "@VAR;Variable=naam;Value=Jan;Op==;@ENDVAR;@VAR;…" → [{naam, typeLabel}]
 * @param {string} runState
 */
export function slotsUitRunState(runState) {
  const slots = [];
  for (const blok of String(runState || "").split("@ENDVAR;")) {
    const m = /Variable=([^;]*);Value=([^;]*)/.exec(blok);
    if (m) slots.push({ naam: m[1].trim(), typeLabel: m[2].trim() });
  }
  return slots;
}
