// @ts-check
/**
 * eaMapping — Sparx EA → composite-structure-profiel (Diagram_Type
 * "CompositeStructure"). Puur data; id's zijn een contract (EA-GUID → id).
 *
 * EA: parts zijn Object_Type "Part" met ParentID = de klasse; poorten
 * Object_Type "Port" met ParentID = gastheer; een collaboration use is
 * Object_Type "CollaborationOccurrence" (Classifier → de collaboratie).
 */

export const EA_DIAGRAM_TYPES = ["CompositeStructure"];

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Class", elementType: "klasse" },
  { objectType: "Component", elementType: "klasse", opmerking: "component als gestructureerde klasse" },
  { objectType: "Part", elementType: "part", opmerking: "ParentID → bevat; Classifier → typeLabel; PDATA multiplicity" },
  { objectType: "Property", elementType: "part" },
  { objectType: "Port", elementType: "poort", opmerking: "ParentID → gastheer (randElement)" },
  { objectType: "Interface", elementType: "interface" },
  { objectType: "ProvidedInterface", elementType: "interface", opmerking: "exposed interface → interface + realisatie vanaf de poort" },
  { objectType: "RequiredInterface", elementType: "interface", opmerking: "exposed interface → interface + gebruikt vanaf de poort" },
  { objectType: "Collaboration", elementType: "collaboratie" },
  { objectType: "CollaborationOccurrence", elementType: "collaboratiegebruik", opmerking: "Classifier → typeLabel" },
  { objectType: "Package", elementType: "package" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Connector", elementType: "connector", opmerking: "SourceRole/DestRole → rollen; SourceCard/DestCard → kardinaliteiten" },
  { connectorType: "Assembly", elementType: "connector", opmerking: "isAssembly = true" },
  { connectorType: "Association", elementType: "connector" },
  { connectorType: "Delegate", elementType: "delegatie" },
  { connectorType: "Dependency", stereotype: "delegate", elementType: "delegatie" },
  { connectorType: "RoleBinding", elementType: "rolbinding" },
  { connectorType: "Dependency", stereotype: "role binding", elementType: "rolbinding" },
  { connectorType: "Realisation", elementType: "realisatie" },
  { connectorType: "Realization", elementType: "realisatie" },
  { connectorType: "Usage", elementType: "gebruikt" },
  { connectorType: "Dependency", stereotype: "use", elementType: "gebruikt" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "overig stereotype → data.stereotype" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
  { connectorType: "Aggregation", elementType: "bevat", opmerking: "klasse ◆ part als lidmaatschap" },
];

export const RAND_ELEMENTEN = ["poort"];
export const CONTAINERS = ["klasse", "part", "collaboratie", "package"];
