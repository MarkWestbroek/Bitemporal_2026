/**
 * repCreation.js — gedeelde aanmaakacties voor de IDE.
 *
 * Houdt het model, de structurele edges en het actieve diagram in sync wanneer
 * de gebruiker vanuit de IDE een nieuw REP toevoegt (toolbar, browser-contextmenu
 * of canvas-snelactie zoals Ctrl-drag).
 */
import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";
import {
  generateId,
  maakLeegType,
  maakLegeEnumeratie,
  maakLeegGegevenstype,
  maakReferentielijstSet,
  maakReferentielijstInstantie,
} from "@umleditor/metamodel/types";

const DEFAULT_DIAGRAM_ID = "overzicht";
const GRID_SIZE = 15;

const HANDLE_POSITIES = ["top", "bottom", "left", "right"];

/**
 * Bereken welke handle-combinatie de kortste lijn oplevert tussen twee nodes.
 * Werkt met positie-objecten { x, y } en optionele afmetingen.
 */
function berekenKortsteHandles(srcPos, tgtPos, srcW = 180, srcH = 80, tgtW = 180, tgtH = 80) {
  function ankerpunt(pos, w, h, handle) {
    switch (handle) {
      case "top":    return { x: pos.x + w / 2, y: pos.y };
      case "bottom": return { x: pos.x + w / 2, y: pos.y + h };
      case "left":   return { x: pos.x,         y: pos.y + h / 2 };
      case "right":  return { x: pos.x + w,     y: pos.y + h / 2 };
    }
  }
  let best = { sourceHandle: "source-bottom", targetHandle: "target-top", dist: Infinity };
  for (const sh of HANDLE_POSITIES) {
    for (const th of HANDLE_POSITIES) {
      const a = ankerpunt(srcPos, srcW, srcH, sh);
      const b = ankerpunt(tgtPos, tgtW, tgtH, th);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best.dist) {
        best = { sourceHandle: `source-${sh}`, targetHandle: `target-${th}`, dist: d };
      }
    }
  }
  return best;
}

function snapToGrid(position = { x: 120, y: 120 }) {
  return {
    x: Math.round((position.x || 0) / GRID_SIZE) * GRID_SIZE,
    y: Math.round((position.y || 0) / GRID_SIZE) * GRID_SIZE,
  };
}

function normaliseerNaam(rawValue, fallback = "NieuwElement") {
  const basis = String(rawValue || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return basis || fallback;
}

function bepaalStartPositie(diagram, fallback = { x: 120, y: 120 }) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  if (nodes.length === 0) return snapToGrid(fallback);
  const laatste = nodes[nodes.length - 1];
  return snapToGrid({
    x: (laatste?.position?.x ?? fallback.x) + 45,
    y: (laatste?.position?.y ?? fallback.y) + 45,
  });
}

function bouwStoreElement(kind, domein = "") {
  switch (kind) {
    case "entiteit": {
      const basis = maakLeegType("entiteit");
      const naam = "NieuweEntiteit";
      return {
        id: basis.id,
        naam,
        type: "entiteit",
        domein,
        data: {
          ...basis,
          domein,
          typenaam: naam,
          klassenaam: naam,
          meervoud: `${naam}en`,
        },
      };
    }
    case "gegevenselement": {
      const basis = maakLeegType("gegevenselement");
      const naam = "NieuwGE";
      return {
        id: basis.id,
        naam,
        type: "gegevenselement",
        domein,
        data: {
          ...basis,
          domein,
          typenaam: naam,
          klassenaam: naam,
          meervoud: `${naam}s`,
        },
      };
    }
    case "relatie": {
      const basis = maakLeegType("relatie");
      const naam = "NieuweRelatie";
      return {
        id: basis.id,
        naam,
        type: "relatie",
        domein,
        data: {
          ...basis,
          domein,
          typenaam: naam,
          klassenaam: naam,
          meervoud: `${naam}s`,
          doelEntiteit: "",
          velden: [],
        },
      };
    }
    case "enumeratie": {
      const basis = maakLegeEnumeratie();
      const naam = basis.naam || "NieuweEnumeratie";
      return {
        id: basis.id,
        naam,
        type: "enumeratie",
        domein,
        data: {
          ...basis,
          naam,
          domein,
          waarden: basis.waarden?.length ? basis.waarden : ["Waarde"],
        },
      };
    }
    case "gegevenstype": {
      const basis = maakLeegGegevenstype();
      const naam = basis.naam || "NieuwGegevenstype";
      return {
        id: basis.id,
        naam,
        type: "gegevenstype",
        domein,
        data: {
          ...basis,
          naam,
          domein,
        },
      };
    }
    case "referentielijstInstantie": {
      const basis = maakReferentielijstInstantie();
      const systeemnaam = basis.systeemnaam || "nieuwe_referentielijst";
      return {
        id: basis.id,
        naam: basis.naam || "Nieuwe Ref.lijst instantie",
        type: "referentielijstInstantie",
        domein,
        data: {
          ...basis,
          naam: basis.naam || "Nieuwe Ref.lijst instantie",
          systeemnaam,
          domein,
        },
      };
    }
    // C8: notitie
    case "notitie": {
      const id = generateId("notitie");
      return {
        id,
        naam: id,
        type: "notitie",
        domein,
        data: {
          tekst: "",
          kleur: "",
          breedte: null,
          hoogte: null,
        },
      };
    }
    // C8: constraint
    case "constraint": {
      const id = generateId("constraint");
      return {
        id,
        naam: "NieuweConstraint",
        type: "constraint",
        domein,
        data: {
          expressie: "",
          taal: "ocl",
          breedte: null,
          hoogte: null,
        },
      };
    }
    default:
      return null;
  }
}

function bouwDiagramEdge(edge, elementsLookup) {
  const targetElement = elementsLookup[edge.target] || null;
  const targetType = targetElement?.type || "";
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "metamodel",
    sourceHandle: edge.sourceHandle || null,
    targetHandle: edge.targetHandle || null,
    data: edge.data || {
      rolnaam: targetElement?.naam || "",
      jsonRolnaam: (targetElement?.data?.meervoud || targetElement?.naam || "").toLowerCase(),
      momentvoorkomen: targetType === "relatie" ? "meervoudig" : "enkelvoudig",
      kardinaliteit: targetType === "relatie" ? "0..*" : "0..1",
    },
  };
}

function commitCreatie({
  nieuweElementen = [],
  diagramNodes = [],
  structuralEdges = [],
  extraDiagramEdges = [],
  voorkeurDiagramId = DEFAULT_DIAGRAM_ID,
  geselecteerdElementId = null,
}) {
  const doelDiagramId = voorkeurDiagramId || useUIStore.getState().activeDiagramId || DEFAULT_DIAGRAM_ID;

  useModelStore.setState((state) => {
    const diagramId = state.diagrams[doelDiagramId] ? doelDiagramId : DEFAULT_DIAGRAM_ID;
    const diagram = state.diagrams[diagramId] || null;
    const elementsLookup = { ...state.elements };
    for (const item of nieuweElementen) {
      if (item?.id) elementsLookup[item.id] = item;
    }

    const volgendeElements = { ...state.elements };
    const volgendeDomeinen = new Set(state.domains || []);
    for (const item of nieuweElementen) {
      if (!item?.id) continue;
      volgendeElements[item.id] = item;
      if (item.domein) volgendeDomeinen.add(item.domein);
    }

    const diagNodeIds = new Set((diagram?.nodes || []).map((item) => item.elementId));
    const mergedDiagramNodes = diagram
      ? [
          ...(diagram.nodes || []),
          ...diagramNodes.filter((item) => item?.elementId && !diagNodeIds.has(item.elementId)),
        ]
      : [];

    const huidigeStructuralEdges = Array.isArray(state.structuralEdges) ? state.structuralEdges : [];
    const bestaandeStructuralEdgeIds = new Set(huidigeStructuralEdges.map((edge) => edge.id));
    const extraStructuralEdges = structuralEdges.filter((edge) => edge?.id && !bestaandeStructuralEdgeIds.has(edge.id));
    const mergedStructuralEdges = [...huidigeStructuralEdges, ...extraStructuralEdges];

    let mergedDiagramEdges = diagram?.edges || [];
    if (diagram) {
      const bestaandeDiagramEdgeIds = new Set((diagram.edges || []).map((edge) => edge.id));
      const zichtbaarIds = new Set(mergedDiagramNodes.map((item) => item.elementId));
      const autoDiagramEdges = extraStructuralEdges
        .filter((edge) => zichtbaarIds.has(edge.source) && zichtbaarIds.has(edge.target))
        .map((edge) => bouwDiagramEdge(edge, elementsLookup));
      const alleNieuweDiagramEdges = [...autoDiagramEdges, ...extraDiagramEdges].filter(
        (edge) => edge?.id && !bestaandeDiagramEdgeIds.has(edge.id)
      );
      mergedDiagramEdges = [...(diagram.edges || []), ...alleNieuweDiagramEdges];
    }

    return {
      isDirty: true,
      elements: volgendeElements,
      structuralEdges: mergedStructuralEdges,
      domains: [...volgendeDomeinen].sort(),
      diagrams: diagram
        ? {
            ...state.diagrams,
            [diagramId]: {
              ...diagram,
              nodes: mergedDiagramNodes,
              edges: mergedDiagramEdges,
            },
          }
        : state.diagrams,
    };
  });

  if (geselecteerdElementId) {
    useUIStore.getState().setActiveDiagramId(doelDiagramId);
    useUIStore.getState().setSelectedElementId(geselecteerdElementId);
  }

  return {
    diagramId: doelDiagramId,
    elementIds: nieuweElementen.map((item) => item.id),
    primaryElementId: geselecteerdElementId,
  };
}

export function voegNieuwRepToe(kind, opties = {}) {
  const state = useModelStore.getState();
  const actiefDiagramId = opties.diagramId || useUIStore.getState().activeDiagramId || DEFAULT_DIAGRAM_ID;
  const diagram = state.diagrams[actiefDiagramId] || state.diagrams[DEFAULT_DIAGRAM_ID] || null;
  const domein = opties.domein || opties.parentDomein || useUIStore.getState().actiefDomein || "";
  const basisPositie = snapToGrid(opties.position || bepaalStartPositie(diagram));

  if (kind === "referentielijst") {
    const setResult = maakReferentielijstSet();
    const nieuweElementen = (setResult.nodes || []).map((node, index) => ({
      id: node.data.id,
      naam: node.data.typenaam || node.data.klassenaam || `NieuweRef${index + 1}`,
      type: node.type,
      domein,
      data: {
        ...node.data,
        domein,
      },
    }));
    const diagramNodes = (setResult.nodes || []).map((node, index) => ({
      elementId: node.data.id,
      position: snapToGrid({
        x: basisPositie.x + index * 220,
        y: basisPositie.y + (index === 2 ? 90 : 0),
      }),
    }));
    const edges = (setResult.edges || []).map((edge) => ({
      ...edge,
      id: edge.id || generateId("edge"),
    }));
    return commitCreatie({
      nieuweElementen,
      diagramNodes,
      structuralEdges: edges,
      voorkeurDiagramId: actiefDiagramId,
      geselecteerdElementId: nieuweElementen[0]?.id || null,
    });
  }

  const nieuwElement = bouwStoreElement(kind, domein);
  if (!nieuwElement) return null;

  const diagramNodes = [{ elementId: nieuwElement.id, position: basisPositie }];
  const structuralEdges = [];
  const extraDiagramEdges = [];

  if (opties.parentId && ["gegevenselement", "relatie"].includes(nieuwElement.type)) {
    structuralEdges.push({
      id: generateId("edge"),
      source: opties.parentId,
      target: nieuwElement.id,
      sourceHandle: null,
      targetHandle: null,
      data: {
        rolnaam: nieuwElement.naam,
        jsonRolnaam: normaliseerNaam(nieuwElement.naam, "nieuw").toLowerCase(),
        momentvoorkomen: nieuwElement.type === "relatie" ? "meervoudig" : "enkelvoudig",
        kardinaliteit: nieuwElement.type === "relatie" ? "0..*" : "0..1",
      },
    });
  }

  if (opties.secondaireEntiteitId && nieuwElement.type === "relatie") {
    const doelElement = state.elements[opties.secondaireEntiteitId] || null;
    const doelNaam = doelElement?.data?.typenaam || doelElement?.naam || "";
    nieuwElement.data.doelEntiteit = doelNaam;
    extraDiagramEdges.push({
      id: generateId("edge"),
      source: nieuwElement.id,
      target: opties.secondaireEntiteitId,
      type: "metamodel",
      data: {
        rolnaam: doelElement?.data?.meervoud || doelElement?.naam || "",
        jsonRolnaam: normaliseerNaam(doelNaam, "doel").toLowerCase(),
        momentvoorkomen: "meervoudig",
        kardinaliteit: "0..*",
      },
    });
  }

  return commitCreatie({
    nieuweElementen: [nieuwElement],
    diagramNodes,
    structuralEdges,
    extraDiagramEdges,
    voorkeurDiagramId: actiefDiagramId,
    geselecteerdElementId: nieuwElement.id,
  });
}

export function maakRelatieTussenEntiteiten(opties = {}) {
  const state = useModelStore.getState();
  const bronId = opties.bronEntiteitId;
  const doelId = opties.doelEntiteitId;
  if (!bronId || !doelId || bronId === doelId) return null;

  const bron = state.elements[bronId] || null;
  const doel = state.elements[doelId] || null;
  const domein = opties.domein || bron?.domein || doel?.domein || "";
  const basis = bouwStoreElement("relatie", domein);
  if (!basis) return null;

  const bronNaam = normaliseerNaam(bron?.data?.typenaam || bron?.naam || bronId, "Entiteit");
  const doelNaam = normaliseerNaam(doel?.data?.typenaam || doel?.naam || doelId, "Entiteit");
  const relatieNaam = `Rel_${bronNaam}_${doelNaam}`;
  basis.naam = relatieNaam;
  basis.data.typenaam = relatieNaam;
  basis.data.klassenaam = relatieNaam;
  basis.data.meervoud = `${relatieNaam}en`;
  basis.data.doelEntiteit = doel?.data?.typenaam || doel?.naam || doelId;
  basis.data.velden = [];

  const positie = snapToGrid(opties.position || { x: 180, y: 180 });

  // Normaliseer edge handles als posities beschikbaar zijn
  const bronPos = opties.bronPositie || null;
  const doelPos = opties.doelPositie || null;
  let ownerHandles = {};
  let doelHandles = {};
  if (bronPos && doelPos) {
    ownerHandles = berekenKortsteHandles(bronPos, positie, 180, 80, 120, 36);
    doelHandles = berekenKortsteHandles(positie, doelPos, 120, 36, 180, 80);
  }

  const ownerEdge = {
    id: generateId("edge"),
    source: bronId,
    target: basis.id,
    sourceHandle: ownerHandles.sourceHandle || null,
    targetHandle: ownerHandles.targetHandle || null,
    data: {
      rolnaam: "",
      jsonRolnaam: relatieNaam.toLowerCase(),
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  };
  const doelEdge = {
    id: generateId("edge"),
    source: basis.id,
    target: doelId,
    sourceHandle: doelHandles.sourceHandle || null,
    targetHandle: doelHandles.targetHandle || null,
    data: {
      rolnaam: doel?.data?.meervoud || doel?.naam || "",
      jsonRolnaam: normaliseerNaam(doelNaam, "doel").toLowerCase(),
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  };

  return commitCreatie({
    nieuweElementen: [basis],
    diagramNodes: [{ elementId: basis.id, position: positie }],
    structuralEdges: [ownerEdge],
    extraDiagramEdges: [bouwDiagramEdge(doelEdge, { ...state.elements, [basis.id]: basis })],
    voorkeurDiagramId: opties.diagramId || useUIStore.getState().activeDiagramId || DEFAULT_DIAGRAM_ID,
    geselecteerdElementId: basis.id,
  });
}
