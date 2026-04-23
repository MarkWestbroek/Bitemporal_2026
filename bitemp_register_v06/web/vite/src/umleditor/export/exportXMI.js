/**
 * exportXMI.js — Converteer het editor-metamodel naar XMI 1.1 (UML 1.4)
 * formaat dat Sparx Enterprise Architect kan importeren.
 *
 * XMI 1.1 spec: OMG, gebruikt UML 1.4 metamodel.
 * Sparx EA import: File → Import/Export → Import Package from XMI…
 *
 * Mapping:
 *   - Entiteit, GE → UML:Class met stereotype
 *   - Relatie → UML:AssociationClass (wanneer er een A -> Relatie -> B patroon is)
 *   - Velden → UML:Attribute met type en multiplicity
 *   - Enumeratie → UML:Class met <<enumeration>> stereotype + UML:Attribute per waarde
 *   - Gegevenstype → UML:DataType met tagged values
 *   - Edges → UML:Association met rolnamen en kardinaliteit
 *
 * Alle XML wordt als string opgebouwd (geen DOM-dependency) zodat dit
 * framework-onafhankelijk en herbruikbaar blijft.
 *
 * @module export/exportXMI
 */

/**
 * Genereer XMI 1.1 (UML 1.4) XML string uit editor nodes + edges.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} [meta] - Optionele metadata
 * @param {string} [meta.modelNaam] - Naam van het UML-model (default: "Metamodel")
 * @param {string} [meta.packageNaam] - Naam van het UML-package (default: "Bitemporeel Register")
 * @returns {string} XMI 1.1 XML
 */
export function exportNaarXMI(nodes, edges, meta = {}) {
  const modelNaam = meta.modelNaam || "Metamodel";
  const packageNaam = meta.packageNaam || "Bitemporeel Register";
  const packageId = nextXmiId("pkg");

  // Verzamel alle elementen
  const classes = [];
  const datatypes = [];
  const associations = [];
  const associationClasses = [];

  const enumNodes = nodes.filter((n) => n.type === "enumeratie");
  const dtNodes = nodes.filter((n) => n.type === "gegevenstype");

  const relationNodes = nodes.filter((n) => n.type === "relatie");
  const associationClassRelationIds = new Set();
  const consumedEdgeIds = new Set();

  for (const relNode of relationNodes) {
    // Nieuw ASOC-patroon: anker → relNode via isAssociationClassLink,
    // A → anker en anker → B via isAssociation edges.
    const classLinkEdge = edges.find(
      (e) => e.target === relNode.id && e.data?.isAssociationClassLink
    );
    if (classLinkEdge) {
      const ankerId = classLinkEdge.source;
      const assocEdgeFromEnt = edges.find(
        (e) => e.target === ankerId && e.data?.isAssociation
      );
      const assocEdgeToDoel = edges.find(
        (e) => e.source === ankerId && e.data?.isAssociation
      );
      const primaryNode = nodes.find((n) => n.id === assocEdgeFromEnt?.source);
      const secondaryNode = nodes.find((n) => n.id === assocEdgeToDoel?.target);

      if (assocEdgeFromEnt && assocEdgeToDoel && primaryNode && secondaryNode) {
        // Bouw AssociationClass met de edges rondom het anker
        associationClasses.push(
          buildAssociationClass(relNode, assocEdgeFromEnt, assocEdgeToDoel, enumNodes, dtNodes)
        );
        associationClassRelationIds.add(relNode.id);
        consumedEdgeIds.add(classLinkEdge.id);
        consumedEdgeIds.add(assocEdgeFromEnt.id);
        consumedEdgeIds.add(assocEdgeToDoel.id);
        continue;
      }
    }

    // Legacy patroon: directe A → REL → B edges (backward compat)
    const incoming = edges.find((e) => e.target === relNode.id);
    const outgoing = edges.find((e) => e.source === relNode.id);
    const primaryNode = nodes.find((n) => n.id === incoming?.source);
    const secondaryNode = nodes.find((n) => n.id === outgoing?.target);

    // Alleen naar AssociationClass converteren als de relatie echt tussen twee classes hangt.
    if (incoming && outgoing && primaryNode && secondaryNode) {
      associationClasses.push(buildAssociationClass(relNode, incoming, outgoing, enumNodes, dtNodes));
      associationClassRelationIds.add(relNode.id);
      consumedEdgeIds.add(incoming.id);
      consumedEdgeIds.add(outgoing.id);
    }
  }

  // --- UML:Class / DataType per node ---
  for (const node of nodes) {
    if (["entiteit", "gegevenselement"].includes(node.type)) {
      classes.push(buildClass(node, enumNodes, dtNodes));
    }
    if (node.type === "relatie" && !associationClassRelationIds.has(node.id)) {
      classes.push(buildClass(node, enumNodes, dtNodes));
    }
    if (node.type === "enumeratie") {
      classes.push(buildEnumeration(node));
    }
    if (node.type === "gegevenstype") {
      datatypes.push(buildDataType(node));
    }
  }

  // --- UML:Association per edge ---
  const generalizations = [];
  for (const edge of edges) {
    if (consumedEdgeIds.has(edge.id)) {
      continue;
    }
    // Generalisatie-edges apart behandelen
    if (edge.data?.isGeneralization) {
      const childId = nodeXmiId(edge.source);
      const parentId = nodeXmiId(edge.target);
      const genId = nextXmiId("gen");
      generalizations.push([
        `<UML:Generalization xmi.id="${genId}" isSpecification="false">`,
        `  <UML:Generalization.child>`,
        `    <UML:Class xmi.idref="${childId}"/>`,
        `  </UML:Generalization.child>`,
        `  <UML:Generalization.parent>`,
        `    <UML:Class xmi.idref="${parentId}"/>`,
        `  </UML:Generalization.parent>`,
        `</UML:Generalization>`,
      ]);
      continue;
    }
    associations.push(buildAssociation(edge, nodes));
  }

  // --- UML:Dependency voor enum/datatype-gebruik ---
  const dependencies = [];
  const usedDeps = new Set();
  for (const node of nodes) {
    if (!["entiteit", "gegevenselement", "relatie"].includes(node.type)) continue;
    for (const v of node.data.velden || []) {
      if (v.enum && v.enum.length > 0) {
        const match = enumNodes.find((en) => arraysEqual(en.data.waarden, v.enum));
        if (match) {
          const depKey = `${node.id}->${match.id}`;
          if (!usedDeps.has(depKey)) {
            dependencies.push(buildDependency(node.id, match.id));
            usedDeps.add(depKey);
          }
        }
      }
      if (v.format) {
        const match = dtNodes.find((dt) => dt.data.format === v.format);
        if (match) {
          const depKey = `${node.id}->${match.id}`;
          if (!usedDeps.has(depKey)) {
            dependencies.push(buildDependency(node.id, match.id));
            usedDeps.add(depKey);
          }
        }
      }
    }
  }

  // --- XML opbouwen ---
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<XMI xmi.version="1.1" xmlns:UML="omg.org/UML1.4">`,
    `  <XMI.header>`,
    `    <XMI.documentation>`,
    `      <XMI.exporter>UML-editor</XMI.exporter>`,
    `      <XMI.exporterVersion>1.0</XMI.exporterVersion>`,
    `    </XMI.documentation>`,
    `  </XMI.header>`,
    `  <XMI.content>`,
    `    <UML:Model xmi.id="${nextXmiId("model")}" name="${esc(modelNaam)}" visibility="public"`,
    `              isSpecification="false" isRoot="false" isLeaf="false" isAbstract="false">`,
    `      <UML:Namespace.ownedElement>`,
    `        <UML:Package xmi.id="${packageId}" name="${esc(packageNaam)}"`,
    `                     visibility="public" isSpecification="false"`,
    `                     isRoot="false" isLeaf="false" isAbstract="false">`,
    `          <UML:Namespace.ownedElement>`,
  ];

  // Voeg classes toe
  for (const cls of classes) {
    xml.push(...cls.map((l) => `            ${l}`));
  }

  // Voeg datatypes toe
  for (const dt of datatypes) {
    xml.push(...dt.map((l) => `            ${l}`));
  }

  // Voeg associatie-classes toe
  for (const assocClass of associationClasses) {
    xml.push(...assocClass.map((l) => `            ${l}`));
  }

  // Voeg associations toe
  for (const assoc of associations) {
    xml.push(...assoc.map((l) => `            ${l}`));
  }

  // Voeg generalizations toe
  for (const gen of generalizations) {
    xml.push(...gen.map((l) => `            ${l}`));
  }

  // Voeg dependencies toe
  for (const dep of dependencies) {
    xml.push(...dep.map((l) => `            ${l}`));
  }

  xml.push(
    `          </UML:Namespace.ownedElement>`,
    `        </UML:Package>`,
    `      </UML:Namespace.ownedElement>`,
    `    </UML:Model>`,
    `  </XMI.content>`,
  );

  // EA-compatibele extensie met diagramposities
  xml.push(`  <XMI.extension extender="UML-editor">`);
  xml.push(`    <diagrams>`);
  xml.push(`      <diagram>`);
  xml.push(`        <elements>`);
  for (const node of nodes) {
    const xmiId = nodeXmiId(node.id);
    const x = Math.round(node.position?.x ?? 0);
    const y = Math.round(node.position?.y ?? 0);
    const w = node.measured?.width ?? node.width ?? 180;
    const h = node.measured?.height ?? node.height ?? 120;
    xml.push(`          <element subject="${xmiId}" left="${x}" right="${x + w}" top="${-y}" bottom="${-(y + h)}"/>`);
  }
  xml.push(`        </elements>`);
  xml.push(`      </diagram>`);
  xml.push(`    </diagrams>`);
  xml.push(`  </XMI.extension>`);

  xml.push(`</XMI>`);

  return xml.join("\n");
}

// ============================================================================
// Builders — elk retourneert een array van XML-regels
// ============================================================================

function buildClass(node, enumNodes = [], dtNodes = []) {
  const d = node.data;
  const id = nodeXmiId(node.id);
  const naam = d.typenaam || "Unnamed";
  const abstract = d.isAbstract ? "true" : "false";
  const lines = [];

  lines.push(`<UML:Class xmi.id="${id}" name="${esc(naam)}" visibility="public"`);
  lines.push(`           isSpecification="false" isRoot="false" isLeaf="false" isAbstract="${abstract}">`);

  // Stereotype
  lines.push(`  <UML:ModelElement.stereotype>`);
  lines.push(`    <UML:Stereotype name="${esc(d.metatype)}"/>`);
  lines.push(`  </UML:ModelElement.stereotype>`);

  // Tagged values (isMaterieel, description)
  if (d.isMaterieel || d.description) {
    lines.push(`  <UML:ModelElement.taggedValue>`);
    if (d.isMaterieel) {
      lines.push(`    <UML:TaggedValue tag="isMaterieel" value="true"/>`);
    }
    if (d.description) {
      lines.push(`    <UML:TaggedValue tag="documentation" value="${esc(d.description)}"/>`);
    }
    lines.push(`  </UML:ModelElement.taggedValue>`);
  }

  // Attributen (skip impliciete database-velden: id, *_id, rel_id, versie)
  const exportVelden = (d.velden || []).filter((v) => !isImplicitDBVeld(v.naam));
  if (exportVelden.length > 0) {
    lines.push(`  <UML:Classifier.feature>`);
    for (const v of exportVelden) {
      lines.push(...buildAttribute(v, enumNodes, dtNodes).map((l) => `    ${l}`));
    }
    lines.push(`  </UML:Classifier.feature>`);
  }

  lines.push(`</UML:Class>`);
  return lines;
}

function buildEnumeration(node) {
  const d = node.data;
  const id = nodeXmiId(node.id);
  const naam = d.naam || "Unnamed";
  const lines = [];

  lines.push(`<UML:Class xmi.id="${id}" name="${esc(naam)}" visibility="public"`);
  lines.push(`           isSpecification="false" isRoot="false" isLeaf="false" isAbstract="false">`);

  lines.push(`  <UML:ModelElement.stereotype>`);
  lines.push(`    <UML:Stereotype name="enumeration"/>`);
  lines.push(`  </UML:ModelElement.stereotype>`);

  lines.push(`  <UML:ModelElement.taggedValue>`);
  lines.push(`    <UML:TaggedValue tag="stereotype" value="enumeration"/>`);
  lines.push(`  </UML:ModelElement.taggedValue>`);

  // Enum waarden als attributen met «enum» stereotype
  if ((d.waarden || []).length > 0) {
    lines.push(`  <UML:Classifier.feature>`);
    for (const w of d.waarden) {
      const attrId = nextXmiId("enumval");
      lines.push(`    <UML:Attribute xmi.id="${attrId}" name="${esc(w)}" visibility="public"`);
      lines.push(`                   isSpecification="false" ownerScope="instance">`);
      lines.push(`      <UML:ModelElement.stereotype>`);
      lines.push(`        <UML:Stereotype name="enum"/>`);
      lines.push(`      </UML:ModelElement.stereotype>`);
      lines.push(`    </UML:Attribute>`);
    }
    lines.push(`  </UML:Classifier.feature>`);
  }

  lines.push(`</UML:Class>`);
  return lines;
}

function buildDataType(node) {
  const d = node.data;
  const id = nodeXmiId(node.id);
  const naam = d.naam || "Unnamed";
  const lines = [];

  lines.push(`<UML:DataType xmi.id="${id}" name="${esc(naam)}" visibility="public"`);
  lines.push(`              isSpecification="false" isRoot="false" isLeaf="false" isAbstract="false">`);

  lines.push(`  <UML:ModelElement.stereotype>`);
  lines.push(`    <UML:Stereotype name="datatype"/>`);
  lines.push(`  </UML:ModelElement.stereotype>`);

  // Tagged values voor datatype-specifieke info
  lines.push(`  <UML:ModelElement.taggedValue>`);
  lines.push(`    <UML:TaggedValue tag="basistype" value="${esc(d.basistype || "string")}"/>`);
  if (d.format) {
    lines.push(`    <UML:TaggedValue tag="format" value="${esc(d.format)}"/>`);
  }
  if (d.description) {
    lines.push(`    <UML:TaggedValue tag="documentation" value="${esc(d.description)}"/>`);
  }
  if (d.validatie?.pattern) {
    lines.push(`    <UML:TaggedValue tag="pattern" value="${esc(d.validatie.pattern)}"/>`);
  }
  if (d.normalisatie) {
    lines.push(`    <UML:TaggedValue tag="normalisatie" value="${esc(d.normalisatie)}"/>`);
  }
  lines.push(`  </UML:ModelElement.taggedValue>`);

  lines.push(`</UML:DataType>`);
  return lines;
}

function buildAttribute(veld, enumNodes = [], dtNodes = []) {
  const id = nextXmiId("attr");
  const lines = [];
  let typeStr = veld.type || "string";
  if (veld.enum && veld.enum.length > 0) {
    const match = enumNodes.find((en) => arraysEqual(en.data.waarden, veld.enum));
    if (match) typeStr = match.data.naam;
  } else if (veld.format) {
    const match = dtNodes.find((dt) => dt.data.format === veld.format);
    typeStr = match ? match.data.naam : `${veld.type}:${veld.format}`;
  }

  // Multiplicity: verplicht → 1..1, optioneel → 0..1
  const lower = veld.verplicht ? "1" : "0";

  lines.push(`<UML:Attribute xmi.id="${id}" name="${esc(veld.naam)}" visibility="public"`);
  lines.push(`               isSpecification="false" ownerScope="instance">`);

  // Type reference als tagged value (Sparx EA leest dit)
  lines.push(`  <UML:ModelElement.taggedValue>`);
  lines.push(`    <UML:TaggedValue tag="type" value="${esc(typeStr)}"/>`);
  if (veld.autoIncrement) {
    lines.push(`    <UML:TaggedValue tag="autoIncrement" value="true"/>`);
  }
  if (veld.description) {
    lines.push(`    <UML:TaggedValue tag="documentation" value="${esc(veld.description)}"/>`);
  }
  lines.push(`  </UML:ModelElement.taggedValue>`);

  // Multiplicity
  lines.push(`  <UML:StructuralFeature.multiplicity>`);
  lines.push(`    <UML:Multiplicity>`);
  lines.push(`      <UML:Multiplicity.range>`);
  lines.push(`        <UML:MultiplicityRange lower="${lower}" upper="1"/>`);
  lines.push(`      </UML:Multiplicity.range>`);
  lines.push(`    </UML:Multiplicity>`);
  lines.push(`  </UML:StructuralFeature.multiplicity>`);

  lines.push(`</UML:Attribute>`);
  return lines;
}

function buildAssociation(edge, nodes) {
  const id = edgeXmiId(edge.id || `${edge.source}->${edge.target}`);
  const d = edge.data || {};
  const lines = [];

  const sourceId = nodeXmiId(edge.source);
  const targetId = nodeXmiId(edge.target);

  const rolnaam = d.rolnaam || "";
  const kard = d.kardinaliteit || "0..*";
  const momentvoorkomen = d.momentvoorkomen || "enkelvoudig";

  // Compositie: entiteit → GE of entiteit → relatie
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);
  const isComposition =
    sourceNode?.type === "entiteit" &&
    ["gegevenselement", "relatie"].includes(targetNode?.type);

  const sourceName = edgeEndpointName(edge.source, nodes);
  const targetName = edgeEndpointName(edge.target, nodes);

  lines.push(`<UML:Association xmi.id="${id}" name="${esc(rolnaam)}" visibility="public"`);
  lines.push(`                 isRoot="false" isLeaf="false" isAbstract="false">`);

  // Tagged values (EA-compatibel)
  lines.push(`  <UML:ModelElement.taggedValue>`);
  if (isComposition) {
    lines.push(`    <UML:TaggedValue tag="ea_type" value="Aggregation"/>`);
    lines.push(`    <UML:TaggedValue tag="subtype" value="Strong"/>`);
  }
  lines.push(`    <UML:TaggedValue tag="direction" value="Unspecified"/>`);
  lines.push(`    <UML:TaggedValue tag="ea_sourceName" value="${esc(targetName)}"/>`);
  lines.push(`    <UML:TaggedValue tag="ea_targetName" value="${esc(sourceName)}"/>`);
  if (d.jsonRolnaam) {
    lines.push(`    <UML:TaggedValue tag="jsonRolnaam" value="${esc(d.jsonRolnaam)}"/>`);
  }
  lines.push(`    <UML:TaggedValue tag="momentvoorkomen" value="${esc(momentvoorkomen)}"/>`);
  lines.push(`    <UML:TaggedValue tag="lb" value="${esc(kard)}"/>`);
  lines.push(`    <UML:TaggedValue tag="lt" value="${esc(rolnaam)}"/>`);
  lines.push(`    <UML:TaggedValue tag="mt" value="${esc(rolnaam)}"/>`);
  lines.push(`    <UML:TaggedValue tag="rb" value="1"/>`);
  lines.push(`  </UML:ModelElement.taggedValue>`);

  lines.push(`  <UML:Association.connection>`);

  // Source end (child side — met kardinaliteit, EA source = child)
  lines.push(`    <UML:AssociationEnd visibility="public" multiplicity="${kard}" name="${esc(rolnaam)}"`);
  lines.push(`                        aggregation="none" isOrdered="false"`);
  lines.push(`                        targetScope="instance" isNavigable="false"`);
  lines.push(`                        type="${targetId}">`);
  lines.push(`      <UML:ModelElement.taggedValue>`);
  lines.push(`        <UML:TaggedValue tag="sourcestyle" value="Owned=0;Navigable=Unspecified;"/>`);
  lines.push(`        <UML:TaggedValue tag="ea_end" value="source"/>`);
  lines.push(`      </UML:ModelElement.taggedValue>`);
  lines.push(`    </UML:AssociationEnd>`);

  // Target end (parent side — altijd 1, compositie als entiteit→GE/relatie)
  const sourceAggr = isComposition ? "composite" : "none";
  lines.push(`    <UML:AssociationEnd visibility="public" multiplicity="1"`);
  lines.push(`                        aggregation="${sourceAggr}" isOrdered="false"`);
  lines.push(`                        targetScope="instance" isNavigable="false"`);
  lines.push(`                        type="${sourceId}">`);
  lines.push(`      <UML:ModelElement.taggedValue>`);
  lines.push(`        <UML:TaggedValue tag="deststyle" value="Navigable=Unspecified;Owned=0;"/>`);
  lines.push(`        <UML:TaggedValue tag="ea_end" value="target"/>`);
  lines.push(`      </UML:ModelElement.taggedValue>`);
  lines.push(`    </UML:AssociationEnd>`);

  lines.push(`  </UML:Association.connection>`);
  lines.push(`</UML:Association>`);

  return lines;
}

function buildAssociationClass(relNode, incomingEdge, outgoingEdge, enumNodes = [], dtNodes = []) {
  const d = relNode.data || {};
  const id = nodeXmiId(relNode.id);
  const lines = [];

  const leftParticipantId = nodeXmiId(incomingEdge.source);
  const rightParticipantId = nodeXmiId(outgoingEdge.target);

  const leftKard = parseKardinaliteit(outgoingEdge.data?.kardinaliteit || "0..*");
  const rightKard = parseKardinaliteit(incomingEdge.data?.kardinaliteit || "0..*");

  const leftRol = normalizeRoleName(outgoingEdge.data?.rolnaam || "");
  const rightRol = normalizeRoleName(incomingEdge.data?.rolnaam || d.typenaam || "");

  lines.push(`<UML:AssociationClass xmi.id="${id}" name="${esc(d.typenaam || "Unnamed")}" visibility="public"`);
  lines.push(`                      isSpecification="false" isRoot="false" isLeaf="false" isAbstract="false">`);

  lines.push(`  <UML:ModelElement.stereotype>`);
  lines.push(`    <UML:Stereotype name="relatie"/>`);
  lines.push(`  </UML:ModelElement.stereotype>`);

  if (d.isMaterieel || d.description || incomingEdge.data?.jsonRolnaam || outgoingEdge.data?.jsonRolnaam) {
    lines.push(`  <UML:ModelElement.taggedValue>`);
    if (d.isMaterieel) {
      lines.push(`    <UML:TaggedValue tag="isMaterieel" value="true"/>`);
    }
    if (d.description) {
      lines.push(`    <UML:TaggedValue tag="documentation" value="${esc(d.description)}"/>`);
    }
    if (incomingEdge.data?.jsonRolnaam) {
      lines.push(`    <UML:TaggedValue tag="jsonRolnaam:primair" value="${esc(incomingEdge.data.jsonRolnaam)}"/>`);
    }
    if (outgoingEdge.data?.jsonRolnaam) {
      lines.push(`    <UML:TaggedValue tag="jsonRolnaam:secondair" value="${esc(outgoingEdge.data.jsonRolnaam)}"/>`);
    }
    lines.push(`  </UML:ModelElement.taggedValue>`);
  }

  // Attributen van de relatie (skip impliciete database-velden)
  const exportVelden = (d.velden || []).filter((v) => !isImplicitDBVeld(v.naam));
  if (exportVelden.length > 0) {
    lines.push(`  <UML:Classifier.feature>`);
    for (const v of exportVelden) {
      lines.push(...buildAttribute(v, enumNodes, dtNodes).map((l) => `    ${l}`));
    }
    lines.push(`  </UML:Classifier.feature>`);
  }

  lines.push(`  <UML:Association.connection>`);
  // Left end = primaire entiteit (eigenaar) → composite, EA target
  lines.push(`    <UML:AssociationEnd visibility="public" multiplicity="${leftKard.lower === leftKard.upper ? leftKard.lower : leftKard.lower + '..' + (leftKard.upper === '-1' ? '*' : leftKard.upper)}"`);
  lines.push(`                        name="${esc(leftRol)}" aggregation="composite" isOrdered="false"`);
  lines.push(`                        targetScope="instance" isNavigable="false"`);
  lines.push(`                        type="${leftParticipantId}">`);
  lines.push(`      <UML:ModelElement.taggedValue>`);
  lines.push(`        <UML:TaggedValue tag="deststyle" value="Navigable=Unspecified;Owned=0;"/>`);
  lines.push(`        <UML:TaggedValue tag="ea_end" value="target"/>`);
  lines.push(`      </UML:ModelElement.taggedValue>`);
  lines.push(`    </UML:AssociationEnd>`);

  // Right end = secondaire entiteit (geen eigenaarschap), EA source
  lines.push(`    <UML:AssociationEnd visibility="public" multiplicity="${rightKard.lower === rightKard.upper ? rightKard.lower : rightKard.lower + '..' + (rightKard.upper === '-1' ? '*' : rightKard.upper)}"`);
  lines.push(`                        name="${esc(rightRol)}" aggregation="none" isOrdered="false"`);
  lines.push(`                        targetScope="instance" isNavigable="false"`);
  lines.push(`                        type="${rightParticipantId}">`);
  lines.push(`      <UML:ModelElement.taggedValue>`);
  lines.push(`        <UML:TaggedValue tag="sourcestyle" value="Owned=0;Navigable=Unspecified;"/>`);
  lines.push(`        <UML:TaggedValue tag="ea_end" value="source"/>`);
  lines.push(`      </UML:ModelElement.taggedValue>`);
  lines.push(`    </UML:AssociationEnd>`);
  lines.push(`  </UML:Association.connection>`);

  lines.push(`</UML:AssociationClass>`);

  return lines;
}

// ============================================================================
// Hulpfuncties
// ============================================================================

/** Genereer een deterministische XMI id op basis van een prefix.
 *  We gebruiken een teller zodat elke aanroep uniek is. */
let _xmiCounter = 0;
const _xmiStableIdMap = new Map();

function nextXmiId(prefix) {
  _xmiCounter += 1;
  return `EAID_${prefix}_${_xmiCounter}`;
}

function stableXmiId(kind, key) {
  const mapKey = `${kind}:${key}`;
  if (!_xmiStableIdMap.has(mapKey)) {
    _xmiStableIdMap.set(mapKey, nextXmiId(kind));
  }
  return _xmiStableIdMap.get(mapKey);
}

function nodeXmiId(nodeId) {
  return stableXmiId("node", nodeId);
}

function edgeXmiId(edgeId) {
  return stableXmiId("edge", edgeId);
}

/** Reset de id-teller (handig voor tests) */
export function resetXmiIdCounter() {
  _xmiCounter = 0;
  _xmiStableIdMap.clear();
}

/** XML-escape voor attribuut-waarden */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeRoleName(roleName) {
  return String(roleName || "").replace(/^\s*[-=]*>\s*/, "").trim();
}

/** Zoek de leesbare naam van een node op id */
function edgeEndpointName(nodeId, nodes) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  return node.data?.typenaam || node.data?.naam || nodeId;
}

/** Parseer kardinaliteit string naar lower/upper voor XMI multiplicity */
function parseKardinaliteit(kard) {
  switch (kard) {
    case "0..1": return { lower: "0", upper: "1" };
    case "1":    return { lower: "1", upper: "1" };
    case "1..1": return { lower: "1", upper: "1" };
    case "0..*": return { lower: "0", upper: "-1" };  // -1 = * in XMI
    case "1..*": return { lower: "1", upper: "-1" };
    case "*":    return { lower: "0", upper: "-1" };
    default:     return { lower: "0", upper: "-1" };
  }
}

function buildDependency(clientNodeId, supplierNodeId) {
  const id = nextXmiId("dep");
  const clientId = nodeXmiId(clientNodeId);
  const supplierId = nodeXmiId(supplierNodeId);
  const lines = [];
  lines.push(`<UML:Dependency xmi.id="${id}" visibility="public"`);
  lines.push(`                client="${clientId}" supplier="${supplierId}">`);
  lines.push(`  <UML:ModelElement.stereotype>`);
  lines.push(`    <UML:Stereotype name="use"/>`);
  lines.push(`  </UML:ModelElement.stereotype>`);
  lines.push(`</UML:Dependency>`);
  return lines;
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Bepaal of een veldnaam een impliciet database-artefact is dat niet in UML thuishoort.
 * Bijv. id, a_id, b_id, rel_id, versie — deze worden door de database-laag gegenereerd.
 */
function isImplicitDBVeld(naam) {
  if (!naam) return false;
  const lower = naam.toLowerCase();
  // Exacte matches: id, rel_id, versie
  if (lower === "id" || lower === "rel_id" || lower === "versie") return true;
  // Patroon: *_id (bijv. a_id, b_id, taak_id) — entiteit-FK's
  if (/^[a-z]_id$/.test(lower)) return true;
  return false;
}
