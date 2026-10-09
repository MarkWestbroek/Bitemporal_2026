// @ts-check
/**
 * eaMapping — Sparx EA (WSDL-profiel) → wsdl-profiel. In EA is een WSDL-
 * diagram een klassediagram (Diagram_Type "Logical", StyleEx "MDGDgm=WSDL…")
 * met Package/Class-elementen onder WSDL-stereotypen. Puur data; id's zijn
 * een contract (EA-GUID → id).
 *
 * Compartimenten uit EA: operaties = `t_operation` van de «WSDLportType»-/
 * «WSDLbinding»-klasse (Name → naam; parameters/ReturnType → input/output);
 * parts = `t_attribute` van de «WSDLmessage»-klasse (Name → naam, Type →
 * typeLabel); ports = `t_attribute` van de «WSDLservice»-klasse.
 */

export const EA_DIAGRAM_TYPES = ["Logical"];
export const EA_MDG = "WSDL";

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Package", stereotype: "wsdlnamespace", elementType: "namespace", opmerking: "tagged value targetNamespace" },
  { objectType: "Package", stereotype: "wsdl", elementType: "namespace" },
  { objectType: "Class", stereotype: "wsdlservice", elementType: "service", opmerking: "t_attribute → ports" },
  { objectType: "Interface", stereotype: "wsdlporttype", elementType: "portType", opmerking: "t_operation → operaties" },
  { objectType: "Class", stereotype: "wsdlporttype", elementType: "portType" },
  { objectType: "Class", stereotype: "wsdlbinding", elementType: "binding", opmerking: "tagged values protocol/style/transport; t_operation → operaties" },
  { objectType: "Class", stereotype: "wsdlmessage", elementType: "message", opmerking: "t_attribute → parts" },
  { objectType: "Class", stereotype: "wsdltypes", elementType: "types" },
  { objectType: "Package", stereotype: "wsdltypes", elementType: "types" },
  { objectType: "Class", stereotype: "wsdlport", elementType: "service", opmerking: "losse port → service met één port" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Realisation", elementType: "realiseert" },
  { connectorType: "Realization", elementType: "realiseert" },
  { connectorType: "Association", stereotype: "wsdlport", elementType: "port" },
  { connectorType: "Dependency", stereotype: "wsdlport", elementType: "port" },
  { connectorType: "Association", elementType: "port", opmerking: "service → binding; anders dependency" },
  { connectorType: "Dependency", stereotype: "wsdlmessage", elementType: "gebruiktMessage" },
  { connectorType: "Dependency", stereotype: "input", elementType: "gebruiktMessage", opmerking: "rol input" },
  { connectorType: "Dependency", stereotype: "output", elementType: "gebruiktMessage", opmerking: "rol output" },
  { connectorType: "Dependency", stereotype: "fault", elementType: "gebruiktMessage", opmerking: "rol fault" },
  { connectorType: "Dependency", stereotype: "wsdltypes", elementType: "gebruiktTypes" },
  { connectorType: "Dependency", stereotype: "use", elementType: "gebruiktTypes", opmerking: "message → types" },
  { connectorType: "PackageImport", elementType: "import" },
  { connectorType: "Dependency", stereotype: "import", elementType: "import" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "overig stereotype → data.stereotype" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = ["namespace"];
