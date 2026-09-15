// @ts-check
import { AMX, diagnostic, exchangeFout } from "./diagnostics.js";

const XSI = "http://www.w3.org/2001/XMLSchema-instance";
const ARCHIMATE_NAMESPACE = /^https?:\/\/www\.opengroup\.org\/xsd\/archimate\/(?:3\.0|3\.1|3\.2)\/?$/;

const elementen = (ouder) => Array.from(ouder?.childNodes || []).filter((node) => node.nodeType === 1);
const kinderen = (ouder, naam) => elementen(ouder).filter((node) => node.localName === naam);
const eerste = (ouder, naam) => kinderen(ouder, naam)[0] || null;
const tekst = (node) => String(node?.textContent || "").trim();
const attr = (node, naam) => node?.getAttribute?.(naam) || null;
const typeVan = (node) => {
  const type = node?.getAttributeNS?.(XSI, "type") || attr(node, "xsi:type") || attr(node, "type") || "";
  return type.includes(":") ? type.split(":").pop() : type;
};
const attributen = (node) => Object.fromEntries(Array.from(node?.attributes || []).map((a) => [a.name, a.value]));
const langStrings = (ouder, naam) => kinderen(ouder, naam).map((node) => ({
  lang: node.getAttributeNS?.("http://www.w3.org/XML/1998/namespace", "lang") || attr(node, "xml:lang"),
  value: tekst(node),
}));
const bounds = (node) => node ? {
  x: Number(attr(node, "x") || 0),
  y: Number(attr(node, "y") || 0),
  ...(attr(node, "w") ? { w: Number(attr(node, "w")) } : {}),
  ...(attr(node, "h") ? { h: Number(attr(node, "h")) } : {}),
} : null;

function leesStyle(node) {
  const style = eerste(node, "style");
  if (!style) return null;
  const kleur = (naam) => {
    const el = eerste(style, naam);
    return el ? { r: Number(attr(el, "r")), g: Number(attr(el, "g")), b: Number(attr(el, "b")), a: attr(el, "a") ? Number(attr(el, "a")) : null } : null;
  };
  const font = eerste(style, "font");
  return {
    lineWidth: attr(style, "lineWidth") ? Number(attr(style, "lineWidth")) : null,
    lineColor: kleur("lineColor"),
    fillColor: kleur("fillColor"),
    font: font ? { attributes: attributen(font), color: (() => {
      const c = eerste(font, "color");
      return c ? { r: Number(attr(c, "r")), g: Number(attr(c, "g")), b: Number(attr(c, "b")) } : null;
    })() } : null,
  };
}

function leesProperties(node) {
  return kinderen(eerste(node, "properties"), "property").map((property) => ({
    definitionId: attr(property, "propertyDefinitionRef") || "",
    waarden: langStrings(property, "value"),
  }));
}

function leesViewNode(node) {
  return {
    identifier: attr(node, "identifier") || "",
    type: typeVan(node) || (attr(node, "elementRef") ? "Element" : "Container"),
    elementRef: attr(node, "elementRef"),
    names: [...langStrings(node, "label"), ...langStrings(node, "name")],
    documentation: langStrings(node, "documentation"),
    bounds: bounds(node),
    style: leesStyle(node),
    nodes: kinderen(node, "node").map(leesViewNode),
    raw: { attributes: attributen(node) },
  };
}

function leesConnection(node) {
  return {
    identifier: attr(node, "identifier") || "",
    type: typeVan(node) || "Line",
    relationshipRef: attr(node, "relationshipRef"),
    source: attr(node, "source"),
    target: attr(node, "target"),
    bendpoints: kinderen(node, "bendpoint").map(bounds),
    sourceAttachment: bounds(eerste(node, "sourceAttachment")),
    targetAttachment: bounds(eerste(node, "targetAttachment")),
    style: leesStyle(node),
    names: langStrings(node, "label"),
    raw: { attributes: attributen(node) },
  };
}

function leesOrganization(item) {
  return {
    identifier: attr(item, "identifier"),
    identifierRef: attr(item, "identifierRef"),
    labels: langStrings(item, "label"),
    items: kinderen(item, "item").map(leesOrganization),
  };
}

function registreerId(index, id, soort, diagnostics, path) {
  if (!id) {
    diagnostics.push(diagnostic("error", AMX.ID_ONTBREEKT, `${soort} heeft geen identifier.`, null, path));
    return false;
  }
  if (index.has(id)) {
    diagnostics.push(diagnostic("error", AMX.ID_DUBBEL, `Dubbele identifier: ${id}.`, id, path));
    return false;
  }
  index.add(id);
  return true;
}

/**
 * @param {string} xmlTekst
 * @param {{DOMParser?:typeof DOMParser}} [opties]
 * @returns {import("./exchangeModel.js").ExchangeModel}
 */
export function parseExchange(xmlTekst, opties = {}) {
  const Parser = opties.DOMParser || globalThis.DOMParser;
  if (!Parser) throw new Error("DOMParser is niet beschikbaar; injecteer opties.DOMParser.");
  const parseMeldingen = [];
  const parser = new Parser({
    onError: (niveau, melding) => {
      if (niveau !== "warning") parseMeldingen.push(String(melding));
    },
  });
  let doc;
  try {
    doc = parser.parseFromString(String(xmlTekst || ""), "application/xml");
  } catch (oorzaak) {
    const diagnostics = [diagnostic("error", AMX.XML_ONGELDIG, parseMeldingen[0] || oorzaak?.message || "Dit bestand is geen geldige XML.")];
    throw exchangeFout("Ongeldige ArchiMate Exchange XML.", diagnostics);
  }
  const parserError = Array.from(doc?.getElementsByTagName?.("parsererror") || [])[0];
  if (!doc?.documentElement || parserError || parseMeldingen.length) {
    const diagnostics = [diagnostic("error", AMX.XML_ONGELDIG, parseMeldingen[0] || tekst(parserError) || "Dit bestand is geen geldige XML.")];
    throw exchangeFout("Ongeldige ArchiMate Exchange XML.", diagnostics);
  }
  const root = doc.documentElement;
  if (root.localName !== "model") {
    const diagnostics = [diagnostic("error", AMX.XML_ROOT, `Verwachte root 'model', gevonden '${root.localName}'.`)];
    throw exchangeFout("Dit is geen ArchiMate Exchange-model.", diagnostics);
  }
  const namespace = root.namespaceURI || "";
  if (!ARCHIMATE_NAMESPACE.test(namespace)) {
    const diagnostics = [diagnostic("error", AMX.XML_NAMESPACE, `Onbekende ArchiMate Exchange-namespace: ${namespace || "(leeg)"}.`)];
    throw exchangeFout("Onbekende ArchiMate Exchange-namespace.", diagnostics);
  }

  const diagnostics = [];
  const propertyDefinitions = {};
  const elements = {};
  const relationships = {};
  const views = {};
  const conceptIds = new Set();

  for (const def of kinderen(eerste(root, "propertyDefinitions"), "propertyDefinition")) {
    const identifier = attr(def, "identifier") || "";
    if (!registreerId(conceptIds, identifier, "Property definition", diagnostics, "/model/propertyDefinitions")) continue;
    propertyDefinitions[identifier] = { identifier, naam: langStrings(def, "name"), type: attr(def, "type") || "string" };
  }
  for (const node of kinderen(eerste(root, "elements"), "element")) {
    const identifier = attr(node, "identifier") || "";
    if (!registreerId(conceptIds, identifier, "Element", diagnostics, "/model/elements")) continue;
    elements[identifier] = { identifier, type: typeVan(node), names: langStrings(node, "name"), documentation: langStrings(node, "documentation"), properties: leesProperties(node), attributes: attributen(node) };
  }
  for (const node of kinderen(eerste(root, "relationships"), "relationship")) {
    const identifier = attr(node, "identifier") || "";
    if (!registreerId(conceptIds, identifier, "Relatie", diagnostics, "/model/relationships")) continue;
    relationships[identifier] = { identifier, type: typeVan(node), source: attr(node, "source") || "", target: attr(node, "target") || "", names: langStrings(node, "name"), documentation: langStrings(node, "documentation"), properties: leesProperties(node), attributes: attributen(node) };
  }

  const diagramContainer = eerste(eerste(root, "views"), "diagrams");
  for (const node of kinderen(diagramContainer, "view")) {
    const identifier = attr(node, "identifier") || "";
    if (!registreerId(conceptIds, identifier, "View", diagnostics, "/model/views/diagrams")) continue;
    const view = { identifier, names: langStrings(node, "name"), documentation: langStrings(node, "documentation"), nodes: kinderen(node, "node").map(leesViewNode), connections: kinderen(node, "connection").map(leesConnection) };
    views[identifier] = view;
    const viewIds = new Set();
    const bezoek = (viewNode, path) => {
      registreerId(viewIds, viewNode.identifier, "View-node", diagnostics, path);
      if (viewNode.elementRef && !elements[viewNode.elementRef]) diagnostics.push(diagnostic("error", AMX.ID_REFERENTIE, `Node verwijst naar ontbrekend element ${viewNode.elementRef}.`, viewNode.identifier, path));
      viewNode.nodes.forEach((kind, i) => bezoek(kind, `${path}/node[${i}]`));
    };
    view.nodes.forEach((viewNode, i) => bezoek(viewNode, `/model/views/${identifier}/node[${i}]`));
    // Twee passen: eerst álle connection-ids registreren, dan pas de
    // referenties valideren. Een connection mag op een ándere connection
    // eindigen (lijn-op-lijn, geldig Exchange — GEMMA doet dit echt), en die
    // andere kan verderop in het bestand staan; één pas maakte dat een
    // volgorde-afhankelijke blokkerende fout.
    for (const [i, connection] of view.connections.entries()) {
      registreerId(viewIds, connection.identifier, "View-connection", diagnostics, `/model/views/${identifier}/connection[${i}]`);
    }
    for (const connection of view.connections) {
      if (connection.source && !viewIds.has(connection.source)) diagnostics.push(diagnostic("error", AMX.ID_REFERENTIE, `Connection-bron ontbreekt: ${connection.source}.`, connection.identifier));
      if (connection.target && !viewIds.has(connection.target)) diagnostics.push(diagnostic("error", AMX.ID_REFERENTIE, `Connection-doel ontbreekt: ${connection.target}.`, connection.identifier));
      if (connection.relationshipRef && !relationships[connection.relationshipRef]) diagnostics.push(diagnostic("error", AMX.ID_REFERENTIE, `Connection-relatie ontbreekt: ${connection.relationshipRef}.`, connection.identifier));
    }
  }

  for (const relatie of Object.values(relationships)) {
    if (!elements[relatie.source] || !elements[relatie.target]) diagnostics.push(diagnostic("error", AMX.ID_REFERENTIE, `Relatie ${relatie.identifier} heeft een ontbrekend uiteinde.`, relatie.identifier));
  }
  for (const concept of [...Object.values(elements), ...Object.values(relationships)]) {
    for (const property of concept.properties) {
      if (!propertyDefinitions[property.definitionId]) diagnostics.push(diagnostic("warning", AMX.PROPERTY_DEFINITION, `Property definition ontbreekt: ${property.definitionId}.`, concept.identifier));
    }
  }
  const organizations = kinderen(root, "organizations").flatMap((container) => kinderen(container, "item").map(leesOrganization));
  const model = { identifier: attr(root, "identifier") || "", version: attr(root, "version"), names: langStrings(root, "name"), documentation: langStrings(root, "documentation"), metadata: eerste(root, "metadata") ? { xml: tekst(eerste(root, "metadata")) } : null, properties: leesProperties(root), attributes: attributen(root) };
  return { formaat: "archimate-model-exchange", namespace, model, propertyDefinitions, elements, relationships, views, organizations, diagnostics };
}

export function lijktOpExchange({ tekst: inhoud }) {
  const tekst = String(inhoud || "").slice(0, 2000);
  return /<(?:\w+:)?model\b/i.test(tekst) && /opengroup\.org\/xsd\/archimate\//i.test(tekst) ? 1 : 0;
}