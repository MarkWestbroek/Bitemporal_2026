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

/** Geschat middelpunt van een node (posities zijn linksboven; maat geschat). */
function midden(ref) {
  const w = ref?.size?.width ?? 200;
  const h = ref?.size?.height ?? 80;
  return { x: ref.position.x + w / 2, y: ref.position.y + h / 2 };
}

/**
 * Kortste-weg-handlekeuze: de zijde van `van` die naar `naar` wijst.
 * Gebruikt wanneer een connector geen expliciete handles heeft — en dat is
 * precies wat "normaliseer relaties" afdwingt door de handles te wissen.
 */
export function besteZijde(van, naar) {
  const dx = naar.x - van.x;
  const dy = naar.y - van.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
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

  for (const el of Object.values(elements || {})) {
    const et = elementTypesById[el.elementType];
    if (!et?.isConnector || !el.source || !el.target) continue;

    const bronRef = nodeRefs.get(el.source);
    const doelRef = nodeRefs.get(el.target);
    if (!bronRef || !doelRef) continue; // beide uiteinden moeten op het diagram staan
    const bronMid = midden(bronRef);
    const doelMid = midden(doelRef);

    const labels = et.hooks?.edgeLabels?.(el) || {};
    // Statisch (edgePresentatie) + dynamisch (hooks.edgePresentatie op basis
    // van de connector-data, bv. richting → pijl; §8.5c-familie).
    const basisPresentatie = {
      ...(et.edgePresentatie || {}),
      ...(et.hooks?.edgePresentatie?.(el) || {}),
    };

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
        // Expliciete handles winnen; anders de kortste weg.
        sourceHandle: el.data?.sourceHandle || `source-${besteZijde(bronMid, doelMid)}`,
        targetHandle: el.data?.targetHandle || `target-${besteZijde(doelMid, bronMid)}`,
        data: { connectorId: el.id, presentatie: { ...basisPresentatie, labels: kaalLabels } },
      });
      continue;
    }

    // ── Gematerialiseerde gedaante: anker + box + 3 edges ──────────────────
    const connRef = nodeRefs.get(el.id);
    const ankerPos = connRef?.ankerPosition || {
      x: (bronMid.x + doelMid.x) / 2 - 7,
      y: (bronMid.y + doelMid.y) / 2 - 7,
    };
    const ankerId = `${ANKER_PREFIX}${el.id}`;

    extraNodes.push({
      id: ankerId,
      position: ankerPos,
      connectorId: el.id,
      soort: "anker",
    });
    if (!connRef) {
      // Box nog niet op het diagram geplaatst → gecentreerd onder het anker.
      extraNodes.push({
        id: el.id,
        position: { x: ankerPos.x - 93, y: ankerPos.y + 90 },
        connectorId: el.id,
        soort: "box",
      });
    }

    const ankerMid = { x: ankerPos.x + 7, y: ankerPos.y + 7 };
    edges.push({
      id: `conn:${el.id}:bron`,
      source: el.source,
      target: ankerId,
      sourceHandle: el.data?.sourceHandle || `source-${besteZijde(bronMid, ankerMid)}`,
      targetHandle: `target-${besteZijde(ankerMid, bronMid)}`,
      data: {
        connectorId: el.id,
        // markerStart (bv. ruit) blijft in de gematerialiseerde gedaante
        // zichtbaar aan de bronzijde.
        presentatie: {
          lijn: "solid",
          kleur: basisPresentatie.kleur || "#64748b",
          markerStart: basisPresentatie.markerStart,
          labels: labels.bron || [],
        },
      },
    });
    edges.push({
      id: `conn:${el.id}:doel`,
      source: ankerId,
      target: el.target,
      sourceHandle: `source-${besteZijde(ankerMid, doelMid)}`,
      targetHandle: el.data?.targetHandle || `target-${besteZijde(doelMid, ankerMid)}`,
      data: {
        connectorId: el.id,
        presentatie: {
          lijn: "solid",
          kleur: basisPresentatie.kleur || "#64748b",
          markerEnd: basisPresentatie.markerEnd ?? (el.data?.directioneel ? "pijl-open" : null),
          labels: labels.doel || [],
        },
      },
    });
    const boxRef = connRef || extraNodes.find((n) => n.soort === "box" && n.id === el.id);
    const boxMid = boxRef ? midden({ position: boxRef.position, size: boxRef.size }) : ankerMid;
    edges.push({
      id: `conn:${el.id}:link`,
      source: ankerId,
      target: el.id,
      sourceHandle: `source-${besteZijde(ankerMid, boxMid)}`,
      targetHandle: `target-${besteZijde(boxMid, ankerMid)}`,
      data: {
        connectorId: el.id,
        presentatie: { lijn: "dash-4-3", kleur: "#94a3b8", labels: [] },
      },
    });
  }
  return { edges, extraNodes };
}
