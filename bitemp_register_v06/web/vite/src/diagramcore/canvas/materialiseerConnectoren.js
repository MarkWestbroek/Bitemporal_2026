// @ts-check
/**
 * materialiseerConnectoren — leidt de visuele gedaante af van connector-
 * elementen (metamodel: Connector = Element met source/target).
 *
 * Twee gedaanten (plan §4.4, het veralgemeniseerde ASOC-patroon):
 *
 *  1. **Kaal** (geen compartiment-velden): één edge bron→doel met de
 *     `edgePresentatie` van het connector-ElementType.
 *
 *  2. **Gematerialiseerd** (wél velden): het association-class-patroon —
 *     een klein **anker** op de lijn tussen bron en doel, en de connector
 *     zelf als **box-node** (klasse-box met de velden) via een dashed link:
 *
 *         [bron] ───o─── [doel]
 *                   ┆
 *              [connector-box]
 *
 *     De box-positie leeft als gewoon diagram-lidmaatschap (DiagramNode van
 *     het connector-element); de anker-positie als `ankerPosition` op
 *     datzelfde lidmaatschap. Ontbreken ze, dan worden middelpunt-defaults
 *     gebruikt (verschijnen "vanzelf" — het oude "normaliseer relaties" is
 *     hiermee ingebouwd gedrag).
 *
 * Labels komen uit de optionele profiel-hook
 * `elementType.hooks.edgeLabels(connector)` →
 *   { bron?: Label[], doel?: Label[], kaal?: Label[] } (ConnectorEdge-vorm).
 *
 * Puur en store-loos: testbaar met kale objecten.
 */

export const ANKER_PREFIX = "anker:";

/**
 * Zoek het connector-ElementType dat een verbinding bron→doel toestaat.
 * Bij een expliciete voorkeur (taakbalk "Verbinding") is die leidend; zonder
 * voorkeur wint de eerste passende in descriptor-volgorde.
 */
export function vindConnectorType(diagramType, bronElement, doelElement, voorkeur = null) {
  if (!bronElement || !doelElement) return null;
  const kandidaten = (diagramType?.elementTypes || []).filter((et) => et.isConnector);
  const past = (et) =>
    (et.bron?.elementTypes || []).includes(bronElement.elementType) &&
    (et.doel?.elementTypes || []).includes(doelElement.elementType);
  if (voorkeur) {
    const gekozen = kandidaten.find((et) => et.id === voorkeur);
    return gekozen && past(gekozen) ? gekozen : null;
  }
  return kandidaten.find(past) || null;
}

/** Heeft de connector inhoud die een box-gedaante rechtvaardigt? */
function heeftVelden(connector) {
  return (connector.compartimenten || []).some((c) => (c.velden || []).length > 0);
}

/**
 * @param {Record<string, Object>} elements
 * @param {Object} diagram
 * @param {Record<string, Object>} elementTypesById
 * @returns {{edges: Array<Object>, extraNodes: Array<Object>}}
 *   edges       — React Flow-compatibele edges (type zet de canvas)
 *   extraNodes  — synthetische nodes: ankers (id `anker:<conn>`) en, waar een
 *                 DiagramNode ontbreekt, de connector-box zelf (id = conn.id)
 */
export function materialiseerConnectoren(elements, diagram, elementTypesById) {
  const nodeRefs = new Map((diagram?.nodes || []).map((n) => [n.elementId, n]));
  const edges = [];
  const extraNodes = [];

  const positieVan = (id) => nodeRefs.get(id)?.position || null;

  for (const el of Object.values(elements || {})) {
    const et = elementTypesById[el.elementType];
    if (!et?.isConnector || !el.source || !el.target) continue;

    const bronPos = positieVan(el.source);
    const doelPos = positieVan(el.target);
    if (!bronPos || !doelPos) continue; // beide uiteinden moeten op het diagram staan

    const labels = et.hooks?.edgeLabels?.(el) || {};
    const basisPresentatie = { ...(et.edgePresentatie || {}) };

    if (!heeftVelden(el)) {
      // ── Kale gedaante: één edge ──────────────────────────────────────────
      const kaalLabels = [...(basisPresentatie.labels || []), ...(labels.kaal || [])];
      if (el.naam) {
        kaalLabels.push({ zijde: "midden", delen: [{ tekst: el.naam, soort: "rolnaam" }] });
      }
      edges.push({
        id: `conn:${el.id}`,
        source: el.source,
        target: el.target,
        sourceHandle: el.data?.sourceHandle || null,
        targetHandle: el.data?.targetHandle || null,
        data: { connectorId: el.id, presentatie: { ...basisPresentatie, labels: kaalLabels } },
      });
      continue;
    }

    // ── Gematerialiseerde gedaante: anker + box + 3 edges ──────────────────
    const connRef = nodeRefs.get(el.id);
    const midden = {
      x: (bronPos.x + doelPos.x) / 2,
      y: (bronPos.y + doelPos.y) / 2,
    };
    const ankerPos = connRef?.ankerPosition || midden;
    const ankerId = `${ANKER_PREFIX}${el.id}`;

    extraNodes.push({
      id: ankerId,
      position: ankerPos,
      connectorId: el.id,
      soort: "anker",
    });
    if (!connRef) {
      // Box nog niet op het diagram geplaatst → default onder het anker.
      extraNodes.push({
        id: el.id,
        position: { x: ankerPos.x + 40, y: ankerPos.y + 90 },
        connectorId: el.id,
        soort: "box",
      });
    }

    edges.push({
      id: `conn:${el.id}:bron`,
      source: el.source,
      target: ankerId,
      sourceHandle: el.data?.sourceHandle || null,
      targetHandle: null,
      data: {
        connectorId: el.id,
        presentatie: { lijn: "solid", kleur: basisPresentatie.kleur || "#64748b", labels: labels.bron || [] },
      },
    });
    edges.push({
      id: `conn:${el.id}:doel`,
      source: ankerId,
      target: el.target,
      sourceHandle: null,
      targetHandle: el.data?.targetHandle || null,
      data: {
        connectorId: el.id,
        presentatie: {
          lijn: "solid",
          kleur: basisPresentatie.kleur || "#64748b",
          markerEnd: el.data?.directioneel ? "pijl-open" : null,
          labels: labels.doel || [],
        },
      },
    });
    edges.push({
      id: `conn:${el.id}:link`,
      source: ankerId,
      target: el.id,
      sourceHandle: null,
      targetHandle: null,
      data: {
        connectorId: el.id,
        presentatie: { lijn: "dash-4-3", kleur: "#94a3b8", labels: [] },
      },
    });
  }
  return { edges, extraNodes };
}
