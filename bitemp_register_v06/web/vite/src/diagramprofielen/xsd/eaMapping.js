// @ts-check
/**
 * eaMapping — Sparx EA (XSD-profiel) → xsd-profiel. In EA is een XML
 * Schema-diagram een klassediagram (Diagram_Type "Logical") waarvan de
 * `StyleEx` "MDGDgm=XSD…" meldt; de elementen zijn Class/Package/Attribute
 * met XSD-stereotypen (`t_xref` Stereotypes of `t_object.Stereotype`).
 * Puur data; id's zijn een contract (EA-GUID → id).
 *
 * Attributen van een «XSDcomplexType»-klasse (t_attribute) worden de
 * velden van het elementen-compartiment; een attribuut met stereotype
 * XSDattribute gaat naar het attributen-compartiment. `t_attribute.LowerBound/
 * UpperBound` → minOccurs/maxOccurs; `Type` → typeLabel.
 */

export const EA_DIAGRAM_TYPES = ["Logical"];
export const EA_MDG = "XSD";

/** @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const OBJECTEN = [
  { objectType: "Package", stereotype: "xsdschema", elementType: "schema", opmerking: "tagged values targetNamespace/prefix/elementFormDefault" },
  { objectType: "Class", stereotype: "xsdschema", elementType: "schema" },
  { objectType: "Class", stereotype: "xsdcomplextype", elementType: "complexType", opmerking: "tagged value modelGroup/mixed; t_attribute → elementen/attributen" },
  { objectType: "Class", stereotype: "xsdenumeration", elementType: "enumeration", opmerking: "t_attribute → waarden" },
  { objectType: "Enumeration", elementType: "enumeration" },
  { objectType: "Class", stereotype: "xsdsimpletype", elementType: "simpleType", opmerking: "tagged value base/derivation; t_attribute → facets" },
  { objectType: "DataType", stereotype: "xsdsimpletype", elementType: "simpleType" },
  { objectType: "PrimitiveType", elementType: "simpleType", opmerking: "ingebouwd xs:-type" },
  { objectType: "Class", stereotype: "xsdtoplevelelement", elementType: "element" },
  { objectType: "Class", stereotype: "xsdelement", elementType: "element" },
  { objectType: "Class", stereotype: "xsdtoplevelattribute", elementType: "attribute" },
  { objectType: "Class", stereotype: "xsdattribute", elementType: "attribute" },
  { objectType: "Class", stereotype: "xsdgroup", elementType: "group" },
  { objectType: "Class", stereotype: "xsdattributegroup", elementType: "attributeGroup" },
  { objectType: "Class", stereotype: "xsdany", elementType: "element", opmerking: "xs:any → element met typeLabel 'any'" },
  { objectType: "Class", elementType: "complexType", opmerking: "klasse zonder XSD-stereotype" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
];

/** @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]} */
export const CONNECTOREN = [
  { connectorType: "Generalization", stereotype: "xsdextension", elementType: "extension" },
  { connectorType: "Generalization", stereotype: "xsdrestriction", elementType: "restriction" },
  { connectorType: "Generalization", elementType: "extension", opmerking: "zonder stereotype = extension" },
  { connectorType: "Association", elementType: "vanType", opmerking: "DestRole → rolnaam; DestCard → min/maxOccurs" },
  { connectorType: "Aggregation", elementType: "vanType", opmerking: "EA tekent lokale elementen soms als compositie" },
  { connectorType: "Dependency", stereotype: "xsdgroupref", elementType: "groupRef" },
  { connectorType: "Dependency", stereotype: "xsdimport", elementType: "import" },
  { connectorType: "Dependency", stereotype: "xsdinclude", elementType: "import", opmerking: "soort 'include'" },
  { connectorType: "Dependency", stereotype: "xsdredefine", elementType: "import", opmerking: "soort 'redefine'" },
  { connectorType: "PackageImport", elementType: "import" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "overig stereotype → data.stereotype" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
];

export const RAND_ELEMENTEN = [];
export const CONTAINERS = ["schema"];
