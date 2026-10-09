// @ts-check
/**
 * wsdl — WSDL 1.1 als klassediagram met WSDL-stereotypen (EA's WSDL-profiel):
 * namespace (container), service met ports, portType met operaties,
 * binding, message met parts, en types (de XSD-koppeling). Opdracht Mark
 * via EA-SYNC (2026-10-09), punt 5. Eigen profiel naast `xsd`, om dezelfde
 * redenen (eigen compartimenten; schema-profiel met later een tekst-adapter;
 * geen vermenging met puur-uml). De berichtdelen verwijzen naar XSD-typen
 * via een cross-profiel verwijzing (`element-verwijzing` naar het
 * xsd-profiel) of, uit EA, als tekst.
 *
 * M3-gebruik: `namespace` als container (containerVoor "bevat", hierarchie);
 * abstracte `wsdlElement` als bereik voor dependency/notitielijn.
 * Elementtype-id's zijn een contract met de EA-lezer: nooit wijzigen.
 */
import { TOELICHTING_VELD, KLEUR_VELD, NOTITIE, BOUNDARY, notitielijn, bevat, stereotypeLabel, stereotypeUitData } from "../uml2Basis.js";

export const WSDL_ID = "wsdl";

/** @type {import("../../diagramcore/types/schema.js").FieldType[]} */
export const fieldTypes = [
  {
    // Operatie van een portType/binding: naam(input) : output.
    id: "wsOperatie",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "output", datatype: "string", placeholder: "bijv. OpvragenResponse" },
      { key: "input", label: "input", datatype: "string", placeholder: "bijv. OpvragenRequest" },
      { key: "fault", label: "fault", datatype: "string" },
      {
        key: "mep",
        label: "patroon",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "request-response" },
          { waarde: "one-way", label: "one-way" },
          { waarde: "solicit-response", label: "solicit-response" },
          { waarde: "notification", label: "notification" },
        ],
      },
    ],
  },
  {
    // Part van een message: naam : element|type.
    id: "wsPart",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "element / type", datatype: "string", placeholder: "bijv. tns:Opvragen" },
      { key: "verwijzing", label: "XSD-element", datatype: "element-verwijzing" },
    ],
  },
  {
    // Port van een service: naam : binding @ adres.
    id: "wsPort",
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "binding", datatype: "string" },
      { key: "adres", label: "adres (soap:address)", datatype: "string" },
    ],
  },
];

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
export const elementTypes = [
  {
    id: "namespace",
    label: "Namespace (definitions)",
    omschrijving: "wsdl:definitions — de WSDL-namespace; sleep service, portType, binding, messages en types erin.",
    kort: "WSDL",
    stereotype: "«WSDLnamespace»",
    icoon: "ws-service",
    shape: "package",
    kleur: "#f1f5f9",
    containerVoor: "bevat",
    standaardDichtInBoom: true,
    properties: [
      { key: "targetNamespace", label: "targetNamespace", datatype: "string" },
      { key: "prefix", label: "prefix", datatype: "string" },
      TOELICHTING_VELD,
      KLEUR_VELD,
    ],
  },
  {
    // Abstracte wortel van de WSDL-onderdelen.
    id: "wsdlElement",
    label: "WSDL-onderdeel",
    isAbstract: true,
    shape: "class-box",
    properties: [TOELICHTING_VELD, KLEUR_VELD],
  },
  {
    id: "service",
    label: "Service",
    erft: "wsdlElement",
    omschrijving: "wsdl:service — bundel van ports (elk een binding op een adres).",
    kort: "SVC",
    stereotype: "«WSDLservice»",
    icoon: "ws-service",
    kleur: "#dbeafe",
    compartments: [{ id: "ports", label: "ports", fieldType: "wsPort" }],
  },
  {
    id: "portType",
    label: "PortType (interface)",
    erft: "wsdlElement",
    omschrijving: "wsdl:portType — de abstracte interface: operaties met input/output/fault-messages.",
    kort: "PT",
    stereotype: "«WSDLportType»",
    icoon: "ws-porttype",
    kleur: "#dcfce7",
    compartments: [{ id: "operaties", label: "operations", fieldType: "wsOperatie" }],
  },
  {
    id: "binding",
    label: "Binding",
    erft: "wsdlElement",
    omschrijving: "wsdl:binding — protocol en stijl (SOAP document/rpc, HTTP) voor een portType.",
    kort: "BND",
    stereotype: "«WSDLbinding»",
    icoon: "ws-binding",
    kleur: "#fef3c7",
    properties: [
      { key: "protocol", label: "protocol", datatype: "keuze", opties: [{ waarde: "", label: "SOAP 1.1" }, { waarde: "soap12", label: "SOAP 1.2" }, { waarde: "http", label: "HTTP" }] },
      { key: "stijl", label: "stijl", datatype: "keuze", opties: [{ waarde: "", label: "document" }, { waarde: "rpc", label: "rpc" }] },
      { key: "transport", label: "transport", datatype: "string", placeholder: "http://schemas.xmlsoap.org/soap/http" },
    ],
    compartments: [{ id: "operaties", label: "operations", fieldType: "wsOperatie" }],
  },
  {
    id: "message",
    label: "Message",
    erft: "wsdlElement",
    omschrijving: "wsdl:message — de parts (elk een XSD-element of -type) van een bericht.",
    kort: "MSG",
    stereotype: "«WSDLmessage»",
    icoon: "ws-message",
    kleur: "#f5f3ff",
    compartments: [{ id: "parts", label: "parts", fieldType: "wsPart" }],
  },
  {
    id: "types",
    label: "Types",
    erft: "wsdlElement",
    omschrijving: "wsdl:types — de ingesloten of geïmporteerde XML Schema's.",
    kort: "TYP",
    stereotype: "«WSDLtypes»",
    icoon: "ws-types",
    kleur: "#e0f2fe",
    properties: [{ key: "schema", label: "XSD-schema", datatype: "element-verwijzing" }],
  },
  NOTITIE,
  BOUNDARY,

  // ── Connectoren ────────────────────────────────────────────────────────
  {
    id: "realiseert",
    label: "Binding realiseert portType",
    omschrijving: "De binding implementeert deze abstracte interface.",
    kort: "⊳┄",
    icoon: "realisatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["binding"] },
    doel: { elementTypes: ["portType"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#475569", markerEnd: "driehoek" },
  },
  {
    id: "port",
    label: "Service port → binding",
    omschrijving: "De service biedt deze binding aan op een adres (wsdl:port).",
    kort: "«port»",
    icoon: "ws-service",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["service"] },
    doel: { elementTypes: ["binding"] },
    properties: [{ key: "adres", label: "adres", datatype: "string" }],
    edgePresentatie: { lijn: "solid", vorm: "hoekig", kleur: "#475569", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«port»"),
  },
  {
    id: "gebruiktMessage",
    label: "Operatie gebruikt message",
    omschrijving: "Een operatie van het portType gebruikt dit bericht als input, output of fault.",
    kort: "msg",
    icoon: "ws-operatie",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["portType"] },
    doel: { elementTypes: ["message"] },
    properties: [
      { key: "operatie", label: "operatie", datatype: "string" },
      { key: "rol", label: "rol", datatype: "keuze", opties: [{ waarde: "", label: "input" }, { waarde: "output", label: "output" }, { waarde: "fault", label: "fault" }] },
    ],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: {
      edgeLabels: (conn) => {
        const d = conn?.data || {};
        const tekst = [d.operatie, d.rol ? `«${d.rol}»` : "«input»"].filter(Boolean).join(" ");
        return { kaal: [{ zijde: "midden", delen: [{ tekst, soort: "constraint" }] }] };
      },
    },
  },
  {
    id: "gebruiktTypes",
    label: "Message gebruikt types",
    omschrijving: "De parts van het bericht komen uit deze types (XSD).",
    kort: "xsd",
    icoon: "ws-types",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["message"] },
    doel: { elementTypes: ["types"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«use»"),
  },
  {
    id: "import",
    label: "Import",
    omschrijving: "wsdl:import van een andere namespace.",
    kort: "«import»",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["namespace"] },
    doel: { elementTypes: ["namespace"] },
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeLabel("«import»"),
  },
  {
    id: "dependency",
    label: "Dependency",
    omschrijving: "Overige afhankelijkheid; stereotype uit EA als label.",
    kort: "dep",
    icoon: "dependency",
    shape: "edge",
    isConnector: true,
    bron: { elementTypes: ["wsdlElement", "namespace"] },
    doel: { elementTypes: ["wsdlElement", "namespace"] },
    properties: [{ key: "stereotype", label: "stereotype", datatype: "string" }],
    edgePresentatie: { lijn: "dash-6-3", vorm: "hoekig", kleur: "#64748b", markerEnd: "pijl-open" },
    hooks: stereotypeUitData,
  },
  notitielijn(["wsdlElement", "namespace", "boundary"]),
  bevat(["namespace"], ["wsdlElement", "namespace", "notitie"]),
];

/** @type {import("../../diagramcore/types/schema.js").DiagramType} */
export const wsdlDiagramType = {
  id: WSDL_ID,
  label: "WSDL",
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
