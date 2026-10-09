// @ts-check
/**
 * eaMapping — Sparx EA (Business Modeling / Eriksson-Penker) → business-
 * profiel. EA's "Analysis"-diagram (Diagram_Type "Analysis") draagt de
 * EP-toolbox; de elementen zijn gewone UML-typen met EP-stereotypen. Puur
 * data; id's zijn een contract (EA-GUID → id).
 */

export const EA_DIAGRAM_TYPES = ["Analysis"];

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Activity", stereotype: "process", elementType: "proces" },
  { objectType: "Activity", stereotype: "business process", elementType: "proces" },
  { objectType: "Process", elementType: "proces" },
  { objectType: "Activity", elementType: "proces", opmerking: "EA-activiteit op een EP-diagram = deelproces" },
  { objectType: "Object", stereotype: "goal", elementType: "doel" },
  { objectType: "Class", stereotype: "goal", elementType: "doel" },
  { objectType: "Object", stereotype: "physical", elementType: "fysiek" },
  { objectType: "Object", stereotype: "people", elementType: "mensen" },
  { objectType: "Object", stereotype: "information", elementType: "informatie" },
  { objectType: "Object", stereotype: "resource", elementType: "fysiek", opmerking: "ongespecificeerde resource → fysiek" },
  { objectType: "Class", stereotype: "physical", elementType: "fysiek" },
  { objectType: "Class", stereotype: "people", elementType: "mensen" },
  { objectType: "Class", stereotype: "information", elementType: "informatie" },
  { objectType: "Object", stereotype: "event", elementType: "gebeurtenis" },
  { objectType: "Event", elementType: "gebeurtenis" },
  { objectType: "Object", stereotype: "business object", elementType: "bedrijfsobject" },
  { objectType: "Class", stereotype: "business object", elementType: "bedrijfsobject" },
  { objectType: "Object", elementType: "bedrijfsobject", opmerking: "object zonder EP-stereotype" },
  { objectType: "Class", elementType: "bedrijfsobject" },
  { objectType: "Actor", elementType: "actor" },
  { objectType: "Package", elementType: "package" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Dependency", stereotype: "input", elementType: "invoer" },
  { connectorType: "Dependency", stereotype: "output", elementType: "uitvoer" },
  { connectorType: "Dependency", stereotype: "control", elementType: "besturing" },
  { connectorType: "Dependency", stereotype: "supply", elementType: "levering" },
  { connectorType: "Dependency", stereotype: "goal", elementType: "doelkoppeling" },
  { connectorType: "Dependency", stereotype: "achieve", elementType: "doelkoppeling" },
  { connectorType: "ControlFlow", elementType: "stroom" },
  { connectorType: "ObjectFlow", elementType: "invoer", opmerking: "object → proces; proces → object wordt uitvoer (lezer kijkt naar de richting)" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "overig stereotype → data.stereotype" },
  { connectorType: "Association", elementType: "associatie" },
  { connectorType: "Generalization", elementType: "generalisatie" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = ["proces", "package"];
