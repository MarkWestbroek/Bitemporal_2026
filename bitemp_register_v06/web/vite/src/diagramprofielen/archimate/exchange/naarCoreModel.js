// @ts-check
import { AMX, diagnostic, exchangeFout } from "./diagnostics.js";
import { mapElementType, mapRelationshipType } from "./typeMapping.js";

const schoonId = (waarde) => String(waarde || "import").replace(/[^a-zA-Z0-9_.-]+/g, "_");
const internId = (importId, identifier) => `amx:${schoonId(importId)}:${identifier}`;
const viewObjectId = (importId, viewId, soort, identifier) => internId(importId, `view:${viewId}:${soort}:${identifier}`);

function primaireTaal(taal) {
  return String(taal || "").toLowerCase().split("-")[0];
}

/** Kies één zichtbare waarde en behoud de bronlijst elders. */
export function kiesTaalwaarde(waarden, taal = "nl", fallback = "(naamloos)") {
  const lijst = (waarden || []).filter((item) => item?.value);
  if (!lijst.length) return fallback;
  const gewenst = String(taal || "nl").toLowerCase();
  const primair = primaireTaal(gewenst);
  return (
    lijst.find((item) => String(item.lang || "").toLowerCase() === gewenst) ||
    lijst.find((item) => primaireTaal(item.lang) === primair) ||
    lijst.find((item) => primaireTaal(item.lang) === "en") ||
    lijst.find((item) => !item.lang) ||
    lijst[0]
  ).value;
}

function kleurNaarHex(kleur) {
  if (!kleur || [kleur.r, kleur.g, kleur.b].some((deel) => !Number.isFinite(deel))) return null;
  return `#${[kleur.r, kleur.g, kleur.b].map((deel) => Math.max(0, Math.min(255, deel)).toString(16).padStart(2, "0")).join("")}`;
}

function propertiesVan(concept, exchange) {
  return (concept.properties || []).map((property) => {
    const definitie = exchange.propertyDefinitions[property.definitionId];
    return {
      definitionId: property.definitionId,
      naam: kiesTaalwaarde(definitie?.naam, "nl", property.definitionId),
      type: definitie?.type || "string",
      waarden: property.waarden || [],
    };
  });
}

function exchangeData(concept, exchange) {
  return {
    identifier: concept.identifier,
    type: concept.type,
    names: concept.names || [],
    documentation: concept.documentation || [],
    properties: propertiesVan(concept, exchange),
    attributes: concept.attributes || {},
  };
}

function voegPresentatieDiagnostics(diagnostics, viewId, nodeOfConnection) {
  if (nodeOfConnection.style) diagnostics.push(diagnostic("info", AMX.LOSS_STIJL, "Stijl is als bronmetadata bewaard; niet alle stijlkenmerken worden weergegeven.", nodeOfConnection.identifier, `/views/${viewId}`));
  if (nodeOfConnection.bendpoints?.length) diagnostics.push(diagnostic("info", AMX.LOSS_ROUTING, "Bendpoints zijn als bronmetadata bewaard; diagramcore routeert de lijn zelf.", nodeOfConnection.identifier, `/views/${viewId}`));
  if (nodeOfConnection.sourceAttachment || nodeOfConnection.targetAttachment) diagnostics.push(diagnostic("info", AMX.LOSS_ATTACHMENT, "Attachmentpunten zijn als bronmetadata bewaard.", nodeOfConnection.identifier, `/views/${viewId}`));
}

/**
 * @param {import("./exchangeModel.js").ExchangeModel} exchange
 * @param {{importId?:string,taal?:string,stijlen?:boolean}} [opties]
 */
export function naarCoreModel(exchange, opties = {}) {
  const blokkerend = (exchange?.diagnostics || []).filter((item) => item.severity === "error");
  if (blokkerend.length) throw exchangeFout("Exchange-model bevat blokkerende fouten.", blokkerend);
  const importId = schoonId(opties.importId || exchange.model?.identifier || `import-${Date.now()}`);
  const taal = opties.taal || "nl";
  const stijlen = opties.stijlen !== false;
  const diagnostics = [...(exchange.diagnostics || [])];
  const elements = {};
  const elementIdMap = new Map();
  const relatieIdMap = new Map();

  for (const bron of Object.values(exchange.elements || {})) {
    const elementType = mapElementType(bron.type);
    if (!elementType) {
      diagnostics.push(diagnostic("warning", AMX.TYPE_ELEMENT, `Niet-ondersteund ArchiMate-elementtype: ${bron.type || "(leeg)"}.`, bron.identifier));
      continue;
    }
    const id = internId(importId, bron.identifier);
    elementIdMap.set(bron.identifier, id);
    elements[id] = {
      id,
      naam: kiesTaalwaarde(bron.names, taal),
      elementType,
      compartimenten: [],
      data: {
        ...(bron.type === "OrJunction" ? { soort: "of" } : {}),
        exchange: exchangeData(bron, exchange),
      },
    };
  }

  for (const bron of Object.values(exchange.relationships || {})) {
    const elementType = mapRelationshipType(bron.type);
    if (!elementType) {
      diagnostics.push(diagnostic("warning", AMX.TYPE_RELATIE, `Niet-ondersteund ArchiMate-relatietype: ${bron.type || "(leeg)"}.`, bron.identifier));
      continue;
    }
    const source = elementIdMap.get(bron.source);
    const target = elementIdMap.get(bron.target);
    if (!source || !target) {
      diagnostics.push(diagnostic("warning", AMX.TYPE_RELATIE, "Relatie overgeslagen omdat een uiteinde een niet-ondersteund elementtype heeft.", bron.identifier));
      continue;
    }
    const id = internId(importId, bron.identifier);
    relatieIdMap.set(bron.identifier, id);
    const accessType = bron.attributes?.accessType;
    const toegang = accessType === "Read" ? "r" : accessType === "Write" ? "w" : accessType === "ReadWrite" ? "rw" : "";
    elements[id] = {
      id,
      naam: kiesTaalwaarde(bron.names, taal, ""),
      elementType,
      source,
      target,
      compartimenten: [],
      data: {
        ...(elementType === "toegang" && toegang ? { toegang } : {}),
        ...(elementType === "beinvloeding" && bron.attributes?.modifier ? { invloed: bron.attributes.modifier } : {}),
        exchange: exchangeData(bron, exchange),
      },
    };
  }

  const diagrams = {};
  const gevisualiseerdeElementen = new Set();
  for (const view of Object.values(exchange.views || {})) {
    const diagramId = internId(importId, view.identifier);
    const diagramNodes = [];
    const nodeInfo = new Map();
    const voegNodeToe = (node, ouder = { x: 0, y: 0 }) => {
      const positie = { x: ouder.x + (node.bounds?.x || 0), y: ouder.y + (node.bounds?.y || 0) };
      const nodeId = viewObjectId(importId, view.identifier, "node", node.identifier);
      let elementId = node.elementRef ? elementIdMap.get(node.elementRef) : null;
      if (node.elementRef && !elementId) {
        diagnostics.push(diagnostic("warning", AMX.VIEW_NODE, `View-node verwijst naar een overgeslagen element: ${node.elementRef}.`, node.identifier, `/views/${view.identifier}`));
      } else if (!node.elementRef && node.type === "Label") {
        elementId = viewObjectId(importId, view.identifier, "label", node.identifier);
        elements[elementId] = { id: elementId, naam: "", elementType: "notitie", compartimenten: [], data: { tekst: kiesTaalwaarde(node.names, taal, ""), exchange: { identifier: node.identifier, type: node.type, names: node.names, documentation: node.documentation, style: node.style, raw: node.raw } } };
      } else if (!node.elementRef && node.type === "Container") {
        elementId = viewObjectId(importId, view.identifier, "container", node.identifier);
        elements[elementId] = { id: elementId, naam: kiesTaalwaarde(node.names, taal, ""), elementType: "kader", compartimenten: [], data: { exchange: { identifier: node.identifier, type: node.type, names: node.names, documentation: node.documentation, style: node.style, raw: node.raw } } };
      } else if (!node.elementRef) {
        diagnostics.push(diagnostic("warning", AMX.VIEW_NODE, `Niet-ondersteund view-nodetype: ${node.type}.`, node.identifier, `/views/${view.identifier}`));
      }
      if (elementId) {
        if (stijlen && node.style?.fillColor && elements[elementId]) {
          const kleur = kleurNaarHex(node.style.fillColor);
          if (kleur && !elements[elementId].data.kleur) elements[elementId].data.kleur = kleur;
        }
        diagramNodes.push({ nodeId, elementId, position: positie, ...(node.bounds?.w && node.bounds?.h ? { size: { width: node.bounds.w, height: node.bounds.h } } : {}), exchange: { identifier: node.identifier, type: node.type, style: node.style, raw: node.raw } });
        nodeInfo.set(node.identifier, { nodeId, elementId });
        gevisualiseerdeElementen.add(elementId);
        voegPresentatieDiagnostics(diagnostics, view.identifier, node);
      }
      node.nodes.forEach((kind) => voegNodeToe(kind, positie));
    };
    view.nodes.forEach((node) => voegNodeToe(node));

    const connectorVoorkomens = {};
    const zichtbareRelaties = new Set();
    for (const connection of view.connections || []) {
      voegPresentatieDiagnostics(diagnostics, view.identifier, connection);
      const bronNode = nodeInfo.get(connection.source);
      const doelNode = nodeInfo.get(connection.target);
      if (!bronNode || !doelNode) {
        diagnostics.push(diagnostic("warning", AMX.VIEW_CONNECTION, "View-connection overgeslagen omdat een bron- of doelvoorkomen ontbreekt.", connection.identifier, `/views/${view.identifier}`));
        continue;
      }
      if (connection.relationshipRef) {
        const connectorId = relatieIdMap.get(connection.relationshipRef);
        if (!connectorId) {
          diagnostics.push(diagnostic("warning", AMX.VIEW_CONNECTION, `Connection verwijst naar een overgeslagen relatie: ${connection.relationshipRef}.`, connection.identifier, `/views/${view.identifier}`));
          continue;
        }
        connectorVoorkomens[connectorId] = { bronNodeId: bronNode.nodeId, doelNodeId: doelNode.nodeId };
        zichtbareRelaties.add(connectorId);
      } else if (elements[bronNode.elementId]?.elementType === "notitie") {
        const connectorId = viewObjectId(importId, view.identifier, "connection", connection.identifier);
        elements[connectorId] = { id: connectorId, naam: kiesTaalwaarde(connection.names, taal, ""), elementType: "toelichting", source: bronNode.elementId, target: doelNode.elementId, compartimenten: [], data: { exchange: { identifier: connection.identifier, type: connection.type, style: connection.style, bendpoints: connection.bendpoints, sourceAttachment: connection.sourceAttachment, targetAttachment: connection.targetAttachment, raw: connection.raw } } };
        connectorVoorkomens[connectorId] = { bronNodeId: bronNode.nodeId, doelNodeId: doelNode.nodeId };
        zichtbareRelaties.add(connectorId);
      } else {
        diagnostics.push(diagnostic("warning", AMX.VIEW_CONNECTION, "Kale connection zonder Label-bron wordt nog niet weergegeven.", connection.identifier, `/views/${view.identifier}`));
      }
    }

    const elementIdsInView = new Set(diagramNodes.map((node) => node.elementId));
    const verborgenConnectoren = [];
    for (const connectorId of relatieIdMap.values()) {
      const connector = elements[connectorId];
      if (elementIdsInView.has(connector.source) && elementIdsInView.has(connector.target) && !zichtbareRelaties.has(connectorId)) {
        verborgenConnectoren.push(connectorId);
        diagnostics.push(diagnostic("info", AMX.VIEW_RELATIE_VERBORGEN, "Relatie is in deze view bewust verborgen omdat geen connection is gedeclareerd.", connector.data.exchange.identifier, `/views/${view.identifier}`));
      }
    }
    diagrams[diagramId] = {
      id: diagramId,
      naam: kiesTaalwaarde(view.names, taal, view.identifier),
      diagramType: "archimate",
      nodes: diagramNodes,
      edges: [],
      ...(Object.keys(connectorVoorkomens).length ? { connectorVoorkomens } : {}),
      ...(verborgenConnectoren.length ? { verborgenConnectoren } : {}),
      exchange: { identifier: view.identifier, names: view.names, documentation: view.documentation },
    };
  }

  return {
    diagramTypeId: "archimate",
    elements,
    diagrams,
    meta: {
      bronFormaat: "archimate-model-exchange",
      exchange: { importId, namespace: exchange.namespace, model: exchange.model, organizations: exchange.organizations, propertyDefinitions: exchange.propertyDefinitions },
      diagnostics,
    },
    diagnostics,
    stats: {
      modelElementen: elementIdMap.size,
      relaties: relatieIdMap.size,
      views: Object.keys(diagrams).length,
      ongevisualiseerdeElementIds: [...elementIdMap.values()].filter((id) => !gevisualiseerdeElementen.has(id)),
    },
  };
}