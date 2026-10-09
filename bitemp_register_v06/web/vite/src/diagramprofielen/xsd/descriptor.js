// @ts-check
/**
 * xsd — XML Schema als klassediagram met XSD-stereotypen (EA's XSD-profiel):
 * schema (container), complexType, simpleType, element, attribute, group,
 * attributeGroup en enumeration. Opdracht Mark via EA-SYNC (2026-10-09),
 * punt 5.
 *
 * Keuze: een **eigen profiel**, geen stereotype-laag op puur-uml. Redenen:
 *   - XSD-typen hebben eigen compartimenten en velden (elementen met type en
 *     minOccurs/maxOccurs, attributen met use; facets op een simpleType) die
 *     in een klasse niets betekenen;
 *   - net als oas31 en graphql is dit een *schema-profiel* (M2 voor een
 *     typesysteem) waar later een XSD-tekst-adapter (lezer/schrijver) op
 *     past — zo'n adapter hoort niet in puur-uml;
 *   - de EA-lezer beslist per diagram waar het landt; vermenging in de
 *     UML-sandbox maakt het klassemodel onzuiver.
 *   De shapes blijven class-boxen: het ís een klassediagram-familie.
 *
 * M3-gebruik: abstracte `xsdType` (complexType, simpleType, enumeration) als
 * bereik voor extension/restriction en voor "element van type"; `schema` is
 * de container (containerVoor "bevat", hierarchie).
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const XSD_ID = "xsd";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    // Lokaal element in een complexType/group: naam : type [min..max].
    id: "xsElement",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", datatype: "string", placeholder: "bijv. xs:string, Adres" },
      { key: "minOccurs", label: "minOccurs", datatype: "string", placeholder: "1" },
      { key: "maxOccurs", label: "maxOccurs", datatype: "string", placeholder: "1 of unbounded" },
    ],
  },
  {
    // Attribuut: naam : type, use (required/optional).
    id: "xsAttribute",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "type", datatype: "string", placeholder: "bijv. xs:ID" },
      {
        key: "use",
        label: "use",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "optional" },
          { waarde: "required", label: "required" },
          { waarde: "prohibited", label: "prohibited" },
        ],
      },
      { key: "default", label: "default", datatype: "string" },
    ],
  },
  {
    // Facet op een simpleType: pattern, minLength, enumeration-waarde, …
    id: "xsFacet",
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "facet", datatype: "string", verplicht: true, placeholder: "bijv. pattern, maxLength" },
      { key: "typeLabel", label: "waarde", datatype: "string" },
    ],
  },
  {
    id: "xsLiteral",
    viewer: "waarde",
    properties: [{ key: "naam", label: "waarde", datatype: "string", verplicht: true }],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "schema",
    label: "Schema",
    omschrijving: "xs:schema — de namespace; sleep typen en elementen erin.",
    kort: "XSD",
    stereotype: "«XSDschema»",
    icoon: "xs-schema",
    shape: "package",
    kleur: "#f1f5f9",
    containerVoor: "bevat",
    standaardDichtInBoom: true,
    properties: [
      { key: "targetNamespace", label: "targetNamespace", datatype: "string" },
      { key: "prefix", label: "prefix", datatype: "string" },
      { key: "elementFormDefault", label: "elementFormDefault", datatype: "keuze", opties: [{ waarde: "", label: "unqualified" }, { waarde: "qualified", label: "qualified" }] },
      { key: "version", label: "version", datatype: "string" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    // Abstracte wortel van de typen: wat complexType, simpleType en
    // enumeration delen; als bereik voor extend/restrict en "van type".
    id: "xsdType",
    label: "XSD-type",
    isAbstract: true,
    shape: "class-box",
    properties: [
      { key: "abstract", label: "abstract", datatype: "boolean" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "complexType",
    label: "complexType",
    erft: "xsdType",
    omschrijving: "Samengesteld type: elementen (sequence/choice/all) en attributen.",
    kort: "CT",
    stereotype: "«XSDcomplexType»",
    icoon: "xs-complex",
    kleur: "#dbeafe",
    properties: [
      {
        key: "modelGroup",
        label: "model group",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "sequence" },
          { waarde: "choice", label: "choice" },
          { waarde: "all", label: "all" },
        ],
      },
      { key: "mixed", label: "mixed content", datatype: "boolean" },
    ],
    compartments: [
      { id: "elementen", label: "elements", fieldType: "xsElement" },
      { id: "attributen", label: "attributes", fieldType: "xsAttribute" },
    ],
  },
  {
    id: "simpleType",
    label: "simpleType",
    erft: "xsdType",
    omschrijving: "Enkelvoudig type: restriction/list/union op een basistype, met facets.",
    kort: "ST",
    stereotype: "«XSDsimpleType»",
    icoon: "xs-simple",
    kleur: "#dcfce7",
    properties: [
      { key: "base", label: "base", datatype: "string", placeholder: "bijv. xs:string" },
      {
        key: "derivation",
        label: "afleiding",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "restriction" },
          { waarde: "list", label: "list" },
          { waarde: "union", label: "union" },
        ],
      },
    ],
    compartments: [{ id: "facets", label: "facets", fieldType: "xsFacet" }],
  },
  {
    id: "enumeration",
    label: "enumeration",
    erft: "simpleType",
    omschrijving: "simpleType met een vaste waardenlijst.",
    kort: "ENUM",
    stereotype: "«XSDenumeration»",
    icoon: "xs-enumeration",
    kleur: "#fef3c7",
    compartments: [{ id: "waarden", label: null, fieldType: "xsLiteral" }],
  },
  {
    id: "element",
    label: "element (globaal)",
    omschrijving: "Globaal xs:element — de wortel of een herbruikbaar element; type via 'van type'.",
    kort: "EL",
    stereotype: "«XSDelement»",
    icoon: "xs-element",
    shape: "class-box",
    kleur: "#fef9c3",
    properties: [
      { key: "typeLabel", label: "type (tekst)", datatype: "string" },
      { key: "nillable", label: "nillable", datatype: "boolean" },
      { key: "substitutionGroup", label: "substitutionGroup", datatype: "string" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    id: "attribute",
    label: "attribute (globaal)",
    omschrijving: "Globaal xs:attribute, herbruikbaar via ref.",
    kort: "AT",
    stereotype: "«XSDattribute»",
    icoon: "xs-attribute",
    shape: "chip",
    kleur: "#f5f3ff",
    properties: [{ key: "typeLabel", label: "type (tekst)", datatype: "string" }, TOELICHTING_VELD, KLEUR_VELD],
  },
  {
    id: "group",
    label: "group",
    omschrijving: "Herbruikbare model group (sequence/choice) van elementen.",
    kort: "GRP",
    stereotype: "«XSDgroup»",
    icoon: "xs-group",
    shape: "class-box",
    kleur: "#e0f2fe",
    properties: [
      { key: "modelGroup", label: "model group", datatype: "keuze", opties: [{ waarde: "", label: "sequence" }, { waarde: "choice", label: "choice" }, { waarde: "all", label: "all" }] },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
    compartments: [{ id: "elementen", label: null, fieldType: "xsElement" }],
  },
  {
    id: "attributeGroup",
    label: "attributeGroup",
    omschrijving: "Herbruikbare groep attributen.",
    kort: "AGRP",
    stereotype: "«XSDattributeGroup»",
    icoon: "xs-group",
    shape: "class-box",
    kleur: "#ede9fe",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
    compartments: [{ id: "attributen", label: null, fieldType: "xsAttribute" }],
  },
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "extension",
    label: "Extension",
    omschrijving: "complexContent/extension: het bron-type breidt het doel-type uit (generalisatie «extend»).",
    kort: "«extend»",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["xsdType"] },
    doel: { elementTypes: ["xsdType"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
    hooks: stereotypeLabel("«extend»"),
  },
  {
    id: "restriction",
    label: "Restriction",
    omschrijving: "restriction: het bron-type beperkt het doel-type (generalisatie «restrict»).",
    kort: "«restrict»",
    icoon: "generalisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["xsdType"] },
    doel: { elementTypes: ["xsdType"] },
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
    hooks: stereotypeLabel("«restrict»"),
  },
  {
    // Element/attribuut "van type" — EA tekent dit als associatie van het
    // element naar zijn type; met een lokaal element als rolnaam.
    id: "vanType",
    label: "Van type",
    omschrijving: "Element, attribuut of lokaal element (rolnaam) heeft dit type.",
    kort: ": T",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["element", "attribute", "complexType", "group", "attributeGroup"] },
    doel: { elementTypes: ["xsdType", "element"] },
    properties: [
      { key: "rolnaam", label: "lokaal element", datatype: "string", placeholder: "naam van het element in het bron-type" },
      { key: "minOccurs", label: "minOccurs", datatype: "string" },
      { key: "maxOccurs", label: "maxOccurs", datatype: "string" },
    ],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: {
      edgeLabels: (conn) => {
        const d = conn?.data || {};
        const kaal = [];
        if (d.rolnaam) kaal.push({ zijde: "doel", delen: [{ tekst: d.rolnaam, soort: "rolnaam" }] });
        const occ = d.minOccurs || d.maxOccurs ? `${d.minOccurs || "1"}..${d.maxOccurs || "1"}` : "";
        if (occ) kaal.push({ zijde: "doel", delen: [{ tekst: occ, soort: "kardinaliteit" }] });
        return { kaal };
      },
    },
  },
  {
    id: "groupRef",
    label: "Group ref",
    omschrijving: "complexType neemt een (attribute)group op via ref.",
    kort: "ref",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["complexType", "group", "attributeGroup"] },
    doel: { elementTypes: ["group", "attributeGroup"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«ref»"),
  },
  {
    id: "import",
    label: "Import / include",
    omschrijving: "xs:import (andere namespace) of xs:include (zelfde namespace) tussen schema's.",
    kort: "«import»",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["schema"] },
    doel: { elementTypes: ["schema"] },
    properties: [
      { key: "soort", label: "soort", datatype: "keuze", opties: [{ waarde: "", label: "import" }, { waarde: "include", label: "include" }, { waarde: "redefine", label: "redefine" }] },
    ],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: {
      edgeLabels: (conn) => ({ kaal: [{ zijde: "midden", delen: [{ tekst: `«${conn?.data?.soort || "import"}»`, soort: "constraint" }] }] }),
    },
  },
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Overige afhankelijkheid; stereotype uit EA als label.",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["xsdType", "element", "attribute", "group", "attributeGroup", "schema"] },
    doel: { elementTypes: ["xsdType", "element", "attribute", "group", "attributeGroup", "schema"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  notitielijn(["xsdType", "element", "attribute", "group", "attributeGroup", "schema", "boundary"]),
  bevat(["schema"], ["xsdType", "element", "attribute", "group", "attributeGroup", "schema", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const xsdDiagramType = {
  id: XSD_ID,
  label: "XML Schema (XSD)",
  style: "uml-klassiek",
  randAanhechting: "zwevend",
  hierarchie: "bevat",
  fieldTypes,
  elementTypes,
  taakbalken: [
    { id: "maken", label: "Maken", acties: "elementTypes" },
    { id: "verbinding", label: "Verbinding", acties: "connectorTypes" },
  ],
  layouts: [],
};
