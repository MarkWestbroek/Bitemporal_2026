/**
 * importXMI.js — Importeer XMI 1.1 (UML 1.4) naar editor nodes + edges.
 *
 * Ondersteunt:
 *   - UML:Class → entiteit of gegevenselement (op basis van stereotype)
 *   - UML:Class met <<enumeration>> → enumeratie
 *   - UML:DataType → gegevenstype
 *   - UML:AssociationClass → relatie
 *   - EA AssociationClass patroon: UML:Class met conID + UML:Association met associationclass TV → relatie
 *   - UML:Association → edge
 *   - UML:Dependency → dependency-edge
 *   - UML:Generalization → generalisatie-edge (MIM: «Generalisatie»)
 *   - MIM stereotypes: Objecttype, Gegevensgroeptype, Relatiesoort, Gestructureerd datatype
 *   - MIM tagged values: isAbstract, Indicatie materiële historie, Heeft tijdlijn geldigheid, etc.
 *   - EA-extensie diagramposities (indien aanwezig)
 *
 * @module import/importXMI
 */

import { generateId, defaultKleur } from "../metamodel/types";

/**
 * Parseer XMI-tekst en retourneer { nodes, edges }.
 *
 * @param {string} xmlText - XMI 1.1 XML als string
 * @returns {{ nodes: Array, edges: Array }}
 */
export function importVanXMI(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const nodes = [];
  const edges = [];
  const idMap = new Map(); // xmi.id → editor node id
  // EA AssociationClass detectie: Association xmi.id → relatie editor node id
  const assocIdToRelatieNodeId = new Map();

  // EA top-level tagged values: modelElement → Map(tag → value)
  // EA plaatst sommige tags (isMaterieel, documentation, jsonRolnaam, etc.)
  // buiten het element, met een modelElement-verwijzing.
  const topLevelTVs = new Map();
  for (const tv of doc.querySelectorAll("XMI\\.content > TaggedValue")) {
    const me = tv.getAttribute("modelElement");
    const tag = tv.getAttribute("tag");
    const value = tv.getAttribute("value") || "";
    if (me && tag) {
      if (!topLevelTVs.has(me)) topLevelTVs.set(me, new Map());
      topLevelTVs.get(me).set(tag, value);
    }
  }

  // Diagramposities uit EA-extensie (indien aanwezig)
  const posities = leesEAPosities(doc);

  // --- UML:Class ---
  const classes = doc.querySelectorAll("Class");
  for (const cls of classes) {
    const xmiId = cls.getAttribute("xmi.id");
    if (!xmiId) continue;

    const naam = cls.getAttribute("name") || "Unnamed";

    // Filter EA-interne artefacten
    if (naam === "EARootClass" || naam === "Unnamed" || !naam.trim()) continue;

    const stereo = leesStereotype(cls);
    const taggedValues = leesTVs(cls);
    // Merge top-level TVs (EA plaatst sommige tags buiten het element)
    const extraTVs = topLevelTVs.get(xmiId);
    if (extraTVs) {
      for (const [k, v] of extraTVs) {
        if (!taggedValues.has(k)) taggedValues.set(k, v);
      }
    }
    const isAbstract = cls.getAttribute("isAbstract") === "true";

    if (stereo === "enumeration") {
      const nodeId = generateId("enum");
      idMap.set(xmiId, nodeId);
      const waarden = [];
      for (const attr of cls.querySelectorAll("Attribute")) {
        waarden.push(attr.getAttribute("name") || "");
      }
      nodes.push({
        id: nodeId,
        type: "enumeratie",
        position: posities.get(xmiId) || autoPositie(nodes.length),
        data: { naam, waarden },
      });
      continue;
    }

    // MIM stereotype mapping + bestaande mapping
    // EA AssociationClass: Class met conID tagged value → relatie
    // Heuristiek: klassen met naam "Rel_*" zonder expliciete stereotype → relatie
    const conID = taggedValues.get("conID") || "";
    const metatype = conID
      ? "relatie"
      : stereo
        ? mapStereotypeNaarMetatype(stereo)
        : (/^Rel_/i.test(naam) ? "relatie" : "entiteit");

    // MIM: "Gestructureerd datatype" → gegevenstype-node (niet als Class/entiteit)
    if (metatype === "gegevenstype") {
      const nodeId = generateId("datatype");
      idMap.set(xmiId, nodeId);
      const velden = leesAttributen(cls);
      nodes.push({
        id: nodeId,
        type: "gegevenstype",
        position: posities.get(xmiId) || autoPositie(nodes.length),
        data: {
          id: nodeId,
          naam,
          description: taggedValues.get("documentation") || "",
          basistype: taggedValues.get("basistype") || "string",
          format: taggedValues.get("format") || "",
          validatie: { pattern: taggedValues.get("pattern") || "" },
          normalisatie: taggedValues.get("normalisatie") || "",
          weergave: {},
          velden,
        },
      });
      continue;
    }

    const nodeId = generateId(metatype);
    idMap.set(xmiId, nodeId);

    // EA AssociationClass: koppel de Association xmi.id aan deze relatie-node
    if (conID) {
      assocIdToRelatieNodeId.set(conID, nodeId);
    }

    const isMaterieel = taggedValues.get("isMaterieel") === "true"
      || leesIndicatieMaterieelUitTVs(taggedValues);
    const description = taggedValues.get("documentation") || "";
    const velden = leesAttributen(cls);

    // Verzamel MIM tagged values (indien aanwezig)
    const mimMetadata = leesMIMTaggedValues(taggedValues);

    nodes.push({
      id: nodeId,
      type: metatype,
      position: posities.get(xmiId) || autoPositie(nodes.length),
      data: {
        id: nodeId,
        typenaam: naam,
        description,
        metatype,
        isMaterieel,
        isAbstract,
        kleur: defaultKleur(metatype),
        velden,
        ...(Object.keys(mimMetadata).length > 0 ? { mimMetadata } : {}),
      },
    });
  }

  // --- UML:DataType ---
  const datatypes = doc.querySelectorAll("DataType");
  for (const dt of datatypes) {
    const xmiId = dt.getAttribute("xmi.id");
    if (!xmiId) continue;

    const naam = dt.getAttribute("name") || "Unnamed";

    // Filter EA-interne DataTypes (unnamed, eaxmiid-patronen, primitieve types)
    if (!naam.trim() || naam === "Unnamed") continue;
    if (/^eaxmiid\d+$/i.test(xmiId)) continue;
    // Primitieve types als los DataType-element (bijv. "int", "string") overslaan
    if (/^(int|integer|string|boolean|float|double|date|datetime|void)$/i.test(naam)) continue;
    const tvs = leesTVs(dt);
    const nodeId = generateId("datatype");
    idMap.set(xmiId, nodeId);

    nodes.push({
      id: nodeId,
      type: "gegevenstype",
      position: posities.get(xmiId) || autoPositie(nodes.length),
      data: {
        id: nodeId,
        naam,
        description: tvs.get("documentation") || "",
        basistype: tvs.get("basistype") || "string",
        format: tvs.get("format") || "",
        validatie: { pattern: tvs.get("pattern") || "" },
        normalisatie: tvs.get("normalisatie") || "",
        weergave: {},
      },
    });
  }

  // --- UML:AssociationClass ---
  const assocClasses = doc.querySelectorAll("AssociationClass");
  for (const ac of assocClasses) {
    const xmiId = ac.getAttribute("xmi.id");
    if (!xmiId) continue;

    const naam = ac.getAttribute("name") || "Unnamed";
    const tvs = leesTVs(ac);
    const nodeId = generateId("relatie");
    idMap.set(xmiId, nodeId);

    const velden = leesAttributen(ac);

    nodes.push({
      id: nodeId,
      type: "relatie",
      position: posities.get(xmiId) || autoPositie(nodes.length),
      data: {
        id: nodeId,
        typenaam: naam,
        description: tvs.get("documentation") || "",
        metatype: "relatie",
        isMaterieel: tvs.get("isMaterieel") === "true",
        kleur: defaultKleur("relatie"),
        velden,
      },
    });

    // Lees de twee associatie-einden en maak edges
    const ends = ac.querySelectorAll("AssociationEnd");
    const participants = [];
    for (const end of ends) {
      const typeRef = end.getAttribute("type");
      const endTvs = leesTVs(end);
      const eaEnd = endTvs.get("ea_end") || "";
      const mult = end.getAttribute("multiplicity") || "0..*";
      const aggr = end.getAttribute("aggregation") || "none";
      const rolnaam = end.getAttribute("name") || "";
      participants.push({ typeRef, eaEnd, mult, aggr, rolnaam });
    }

    // Target-end = eigenaar, source-end = doel
    const owner = participants.find((p) => p.eaEnd === "target" || p.aggr === "composite") || participants[0];
    const target = participants.find((p) => p !== owner) || participants[1];

    if (owner?.typeRef && idMap.has(owner.typeRef)) {
      // Maak anker-node voor association class pattern
      const ankerId = generateId("anker");
      const ownerNodeId = idMap.get(owner.typeRef);
      const ownerNode = nodes.find((n) => n.id === ownerNodeId);
      const relNode = nodes.find((n) => n.id === nodeId);
      const ankerPos = {
        x: ((ownerNode?.position?.x || 0) + (relNode?.position?.x || 200)) / 2,
        y: (ownerNode?.position?.y || 0) + 20,
      };
      nodes.push({
        id: ankerId,
        type: "associatieAnker",
        position: ankerPos,
        data: { relatieNaam: naam },
      });

      // Edge 1: Owner → Anker (associatie)
      edges.push({
        id: generateId("edge"),
        source: ownerNodeId,
        target: ankerId,
        type: "metamodel",
        data: {
          isAssociation: true,
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: "",
          kardinaliteit: target?.mult || "0..*",
        },
      });

      // Edge 2: Anker → Target entiteit (associatie)
      if (target?.typeRef && idMap.has(target.typeRef)) {
        edges.push({
          id: generateId("edge"),
          source: ankerId,
          target: idMap.get(target.typeRef),
          type: "metamodel",
          data: {
            isAssociation: true,
            rolnaam: "",
            jsonRolnaam: "",
            momentvoorkomen: "",
            kardinaliteit: owner.mult || "0..*",
          },
        });
      }

      // Edge 3: Anker ╌╌ Relatie-node (association class link)
      edges.push({
        id: generateId("edge"),
        source: ankerId,
        target: nodeId,
        type: "metamodel",
        data: {
          isAssociationClassLink: true,
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: "",
          kardinaliteit: "",
        },
      });
    }
  }

  // --- UML:Association ---
  const associations = doc.querySelectorAll(
    "Namespace\\.ownedElement > Association, ownedElement > Association"
  );
  // Fallback: ook los zoeken als CSS-selector niet matcht
  const allAssocs = associations.length > 0
    ? associations
    : doc.querySelectorAll("Association");

  for (const assoc of allAssocs) {
    // Skip als dit een AssociationClass is (al verwerkt)
    if (assoc.tagName.includes("AssociationClass")) continue;
    const xmiId = assoc.getAttribute("xmi.id");
    if (!xmiId) continue;
    // Skip als al verwerkt door AssociationClass
    if (idMap.has(xmiId)) continue;

    const naam = assoc.getAttribute("name") || "";
    const tvs = leesTVs(assoc);
    const momentvoorkomen = tvs.get("momentvoorkomen") || "";

    // EA AssociationClass: association met "associationclass" tagged value
    // → maak edges naar de relatie-node i.p.v. een directe edge tussen de twee entiteiten
    const assocClassRef = tvs.get("associationclass") || "";
    const relatieNodeId = assocClassRef
      ? (idMap.get(assocClassRef) || assocIdToRelatieNodeId.get(xmiId))
      : assocIdToRelatieNodeId.get(xmiId);

    const ends = assoc.querySelectorAll("AssociationEnd");
    const participants = [];
    for (const end of ends) {
      const typeRef = end.getAttribute("type");
      const endTvs = leesTVs(end);
      const eaEnd = endTvs.get("ea_end") || "";
      const mult = end.getAttribute("multiplicity") || "0..*";
      const aggr = end.getAttribute("aggregation") || "none";
      const rolnaam = end.getAttribute("name") || "";
      participants.push({ typeRef, eaEnd, mult, aggr, rolnaam });
    }

    // EA AssociationClass: drie edges via anker-node (owner → anker → target + anker╌╌relatie)
    if (relatieNodeId) {
      const owner = participants.find((p) => p.eaEnd === "target" || p.aggr === "composite") || participants[0];
      const target = participants.find((p) => p !== owner) || participants[1];

      if (owner?.typeRef && idMap.has(owner.typeRef)) {
        const ankerId = generateId("anker");
        const ownerNodeId = idMap.get(owner.typeRef);
        const ownerNode = nodes.find((n) => n.id === ownerNodeId);
        const relNode = nodes.find((n) => n.id === relatieNodeId);
        const ankerPos = {
          x: ((ownerNode?.position?.x || 0) + (relNode?.position?.x || 200)) / 2,
          y: (ownerNode?.position?.y || 0) + 20,
        };
        nodes.push({
          id: ankerId,
          type: "associatieAnker",
          position: ankerPos,
          data: { relatieNaam: naam },
        });

        // Edge 1: Owner → Anker (associatie)
        edges.push({
          id: generateId("edge"),
          source: ownerNodeId,
          target: ankerId,
          type: "metamodel",
          data: {
            isAssociation: true,
            rolnaam: "",
            jsonRolnaam: "",
            momentvoorkomen: "",
            kardinaliteit: target?.mult || "0..*",
          },
        });

        // Edge 2: Anker → Target entiteit (associatie)
        if (target?.typeRef && idMap.has(target.typeRef)) {
          edges.push({
            id: generateId("edge"),
            source: ankerId,
            target: idMap.get(target.typeRef),
            type: "metamodel",
            data: {
              isAssociation: true,
              rolnaam: "",
              jsonRolnaam: "",
              momentvoorkomen: "",
              kardinaliteit: owner.mult || "0..*",
            },
          });
        }

        // Edge 3: Anker ╌╌ Relatie-node (association class link)
        edges.push({
          id: generateId("edge"),
          source: ankerId,
          target: relatieNodeId,
          type: "metamodel",
          data: {
            isAssociationClassLink: true,
            rolnaam: "",
            jsonRolnaam: "",
            momentvoorkomen: "",
            kardinaliteit: "",
          },
        });
      }
      continue;
    }

    // Bepaal bron (target-end / composite) en doel (source-end)
    const sourceEnd = participants.find((p) => p.eaEnd === "target" || p.aggr === "composite") || participants[0];
    const targetEnd = participants.find((p) => p !== sourceEnd) || participants[1];

    if (sourceEnd?.typeRef && targetEnd?.typeRef) {
      const srcId = idMap.get(sourceEnd.typeRef);
      const tgtId = idMap.get(targetEnd.typeRef);
      if (srcId && tgtId) {
        edges.push({
          id: generateId("edge"),
          source: srcId,
          target: tgtId,
          type: "metamodel",
          data: {
            rolnaam: naam || targetEnd.rolnaam || sourceEnd.rolnaam || "",
            jsonRolnaam: tvs.get("jsonRolnaam") || "",
            momentvoorkomen: momentvoorkomen || parseKardVoorkomen(sourceEnd.mult),
            kardinaliteit: sourceEnd.mult || "0..*",
          },
        });
      }
    }
  }

  // --- UML:Dependency ---
  const deps = doc.querySelectorAll("Dependency");
  for (const dep of deps) {
    const clientRef = dep.getAttribute("client");
    const supplierRef = dep.getAttribute("supplier");
    if (!clientRef || !supplierRef) continue;
    const srcId = idMap.get(clientRef);
    const tgtId = idMap.get(supplierRef);
    if (srcId && tgtId) {
      edges.push({
        id: generateId("edge"),
        source: srcId,
        target: tgtId,
        type: "metamodel",
        data: {
          isDependency: true,
          rolnaam: "",
          jsonRolnaam: "",
          momentvoorkomen: "",
          kardinaliteit: "",
        },
      });
    }
  }

  // --- UML:Generalization (incl. MIM «Generalisatie») ---
  const generalizations = doc.querySelectorAll("Generalization");
  for (const gen of generalizations) {
    const subtypeRef = gen.getAttribute("subtype");
    const supertypeRef = gen.getAttribute("supertype");
    if (!subtypeRef || !supertypeRef) continue;
    const subId = idMap.get(subtypeRef);
    const superId = idMap.get(supertypeRef);
    if (subId && superId) {
      const tvs = leesTVs(gen);
      const mixin = tvs.get("Mixin") || "";
      edges.push({
        id: generateId("edge"),
        source: subId,
        target: superId,
        type: "metamodel",
        data: {
          isGeneralization: true,
          rolnaam: tvs.get("ea_sourceName") || "",
          jsonRolnaam: "",
          momentvoorkomen: "",
          kardinaliteit: "",
          mixin: mixin.toLowerCase() === "ja",
        },
      });
    }
  }

  // Optimaliseer edge routing: kies voor elke edge de handles die het kortste pad geven
  optimaliseerEdgeHandles(nodes, edges);

  return { nodes, edges };
}

// ============================================================================
// Hulpfuncties
// ============================================================================

function autoPositie(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 50 + col * 300, y: 50 + row * 250 };
}

function leesStereotype(el) {
  const stereoEl = el.querySelector("Stereotype");
  if (stereoEl) return (stereoEl.getAttribute("name") || "").toLowerCase();
  // Fallback: tagged value
  const tvs = leesTVs(el);
  return (tvs.get("stereotype") || "").toLowerCase();
}

/**
 * Map stereotype naar editor metatype.
 * Ondersteunt zowel onze eigen stereotypes als MIM stereotypes.
 */
function mapStereotypeNaarMetatype(stereo) {
  switch (stereo) {
    // Onze eigen stereotypes
    case "relatie":
    case "relatiesoort":         // MIM
    case "relatieklasse":        // EA / alternatief
    case "associationclass":     // UML
      return "relatie";
    case "gegevenselement":
    case "gegevensgroeptype":    // MIM
      return "gegevenselement";
    // MIM: Gestructureerd datatype → gegevenstype
    case "gestructureerd datatype":
    case "datatype":
      return "gegevenstype";
    // MIM: Objecttype = entiteit
    case "objecttype":
    case "entiteit":
    default:
      return "entiteit";
  }
}

/**
 * Lees MIM-specifieke tagged values die aangeven of materialiteit van toepassing is.
 */
function leesIndicatieMaterieelUitTVs(tvs) {
  // MIM tagged values voor materialiteit
  for (const [tag] of tvs) {
    const lower = tag.toLowerCase();
    if (lower.includes("materi") && lower.includes("historie")) {
      const val = tvs.get(tag) || "";
      if (val.toLowerCase() === "ja") return true;
    }
    if (lower === "heeft tijdlijn geldigheid") {
      const val = tvs.get(tag) || "";
      if (val.toLowerCase() === "ja") return true;
    }
  }
  return false;
}

/**
 * Verzamel relevante MIM tagged values in een metadata-object.
 */
function leesMIMTaggedValues(tvs) {
  const mimTags = [
    "Indicatie materiële historie", "Indicatie materi\u00eble historie",
    "Heeft tijdlijn geldigheid", "Heeft tijdlijn registratie",
    "Indicatie formele historie", "Authentiek",
    "Indicatie classificerend", "Mogelijk geen waarde",
    "Kwaliteit", "Populatie", "Begrip", "Herkomst",
  ];
  const result = {};
  for (const tag of mimTags) {
    // Zoek case-insensitive match
    for (const [key, val] of tvs) {
      if (key.toLowerCase() === tag.toLowerCase() && val && val !== "<memo>") {
        result[tag] = val;
        break;
      }
    }
  }
  return result;
}

function leesTVs(el) {
  const map = new Map();
  for (const tv of el.querySelectorAll("TaggedValue")) {
    const tag = tv.getAttribute("tag");
    const value = tv.getAttribute("value") || "";
    if (tag) map.set(tag, value);
  }
  return map;
}

function leesAttributen(el) {
  const velden = [];
  for (const attr of el.querySelectorAll("Classifier\\.feature > Attribute, feature > Attribute")) {
    const naam = attr.getAttribute("name") || "";
    // Skip enum-waarde attributen
    const stereo = leesStereotype(attr);
    if (stereo === "enum") continue;

    const tvs = leesTVs(attr);
    const typeStr = tvs.get("type") || "string";
    const isAuto = tvs.get("autoIncrement") === "true";
    const isDerived = tvs.get("derived") === "1" || tvs.get("derived") === "true";
    const description = tvs.get("documentation") || "";

    // Multiplicity via tagged values (EA/MIM) of MultiplicityRange
    const lowerBound = tvs.get("lowerBound");
    const multRange = attr.querySelector("MultiplicityRange");
    const lower = lowerBound || (multRange ? multRange.getAttribute("lower") : "1");
    const verplicht = lower !== "0";

    // Map typeStr naar editor type/format
    const { type, format } = mapXMIType(typeStr);

    velden.push({
      naam,
      type,
      format,
      enum: null,
      verplicht,
      autoIncrement: isAuto,
      description,
      ...(isDerived ? { isDerived: true } : {}),
    });
  }

  // Fallback: als CSS selector niet werkt, probeer directe children
  if (velden.length === 0) {
    for (const attr of el.querySelectorAll("Attribute")) {
      const naam = attr.getAttribute("name") || "";
      const stereo = leesStereotype(attr);
      if (stereo === "enum") continue;

      const tvs = leesTVs(attr);
      const typeStr = tvs.get("type") || "string";
      const isAuto = tvs.get("autoIncrement") === "true";
      const isDerived = tvs.get("derived") === "1" || tvs.get("derived") === "true";
      const description = tvs.get("documentation") || "";
      const lowerBound = tvs.get("lowerBound");
      const multRange = attr.querySelector("MultiplicityRange");
      const lower = lowerBound || (multRange ? multRange.getAttribute("lower") : "1");
      const { type, format } = mapXMIType(typeStr);

      velden.push({
        naam,
        type,
        format,
        enum: null,
        verplicht: lower !== "0",
        autoIncrement: isAuto,
        description,
        ...(isDerived ? { isDerived: true } : {}),
      });
    }
  }

  return velden;
}

function mapXMIType(typeStr) {
  const lower = (typeStr || "").toLowerCase();
  if (lower === "int" || lower === "integer") return { type: "integer", format: "" };
  if (lower === "float64" || lower === "number" || lower === "float" || lower === "double")
    return { type: "number", format: "float64" };
  if (lower === "bool" || lower === "boolean") return { type: "boolean", format: "" };
  if (lower === "date") return { type: "string", format: "date" };
  if (lower === "datetime" || lower === "time.time" || lower === "moment")
    return { type: "string", format: "date-time" };
  return { type: "string", format: "" };
}

function parseKardVoorkomen(mult) {
  if (mult === "0..*" || mult === "1..*" || mult === "*") return "meervoudig";
  return "enkelvoudig";
}

/**
 * Lees EA diagram-extensie posities uit de XMI.
 * EA slaat diagramposities op in:
 *   <XMI.extension extender="Enterprise Architect">
 *     <diagrams>
 *       <diagram>
 *         <elements>
 *           <element subject="EAID_xxx" left="..." right="..." top="..." bottom="..."/>
 *
 * Retourneert Map<xmiId, {x, y}>
 */
function leesEAPosities(doc) {
  const map = new Map();

  // Methode 1: EA extensie-blok
  const diagramElements = doc.querySelectorAll(
    "extension element, EADiagram\\.element, diagram element"
  );
  for (const el of diagramElements) {
    const subject = el.getAttribute("subject") || el.getAttribute("xmi.idref");
    if (!subject) continue;
    const left = parseFloat(el.getAttribute("left"));
    const top = parseFloat(el.getAttribute("top"));
    if (!isNaN(left) && !isNaN(top)) {
      // EA gebruikt soms negatieve top-waarden (scherm-Y is omgekeerd)
      map.set(subject, { x: left, y: Math.abs(top) });
    }
  }

  // Methode 2: EA DiagramElement met geometry="Left=100;Top=50;Right=280;Bottom=200;"
  const diagramElements2 = doc.querySelectorAll("DiagramElement");
  for (const el of diagramElements2) {
    const subjectId = el.getAttribute("subject");
    if (!subjectId) continue;
    // Sla edges over (geometry begint met SX= voor connectors)
    const geomAttr = el.getAttribute("geometry") || "";
    const leftMatch = geomAttr.match(/Left=(-?\d+)/);
    const topMatch = geomAttr.match(/Top=(-?\d+)/);
    if (leftMatch && topMatch) {
      const x = parseInt(leftMatch[1], 10);
      const y = parseInt(topMatch[1], 10);
      if (!map.has(subjectId)) {
        map.set(subjectId, { x, y });
      }
      continue;
    }
    // Fallback: l=100;t=-50 formaat
    const lMatch = geomAttr.match(/l=(-?\d+)/);
    const tMatch = geomAttr.match(/t=(-?\d+)/);
    if (lMatch && tMatch) {
      const x = parseInt(lMatch[1], 10);
      const y = Math.abs(parseInt(tMatch[1], 10));
      if (!map.has(subjectId)) {
        map.set(subjectId, { x, y });
      }
    }
  }

  return map;
}

/**
 * Optimaliseer edge handles: kies voor elke edge de source/target handles
 * (top, right, bottom, left) die het kortste pad opleveren.
 *
 * Standaard node-afmetingen worden gebruikt als de node geen measured/width heeft.
 */
function optimaliseerEdgeHandles(nodes, edges) {
  const DEFAULT_W = 180;
  const DEFAULT_H = 120;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;

    const srcW = srcNode.measured?.width || srcNode.width || DEFAULT_W;
    const srcH = srcNode.measured?.height || srcNode.height || DEFAULT_H;
    const tgtW = tgtNode.measured?.width || tgtNode.width || DEFAULT_W;
    const tgtH = tgtNode.measured?.height || tgtNode.height || DEFAULT_H;

    // Handle-posities per node (midden van elke zijde)
    const srcHandles = {
      top:    { x: srcNode.position.x + srcW / 2, y: srcNode.position.y },
      bottom: { x: srcNode.position.x + srcW / 2, y: srcNode.position.y + srcH },
      left:   { x: srcNode.position.x,             y: srcNode.position.y + srcH / 2 },
      right:  { x: srcNode.position.x + srcW,      y: srcNode.position.y + srcH / 2 },
    };
    const tgtHandles = {
      top:    { x: tgtNode.position.x + tgtW / 2, y: tgtNode.position.y },
      bottom: { x: tgtNode.position.x + tgtW / 2, y: tgtNode.position.y + tgtH },
      left:   { x: tgtNode.position.x,             y: tgtNode.position.y + tgtH / 2 },
      right:  { x: tgtNode.position.x + tgtW,      y: tgtNode.position.y + tgtH / 2 },
    };

    let bestDist = Infinity;
    let bestSrc = "bottom";
    let bestTgt = "top";

    for (const [srcKey, srcPt] of Object.entries(srcHandles)) {
      for (const [tgtKey, tgtPt] of Object.entries(tgtHandles)) {
        const dx = srcPt.x - tgtPt.x;
        const dy = srcPt.y - tgtPt.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestSrc = srcKey;
          bestTgt = tgtKey;
        }
      }
    }

    edge.sourceHandle = bestSrc;
    edge.targetHandle = bestTgt;
  }
}
