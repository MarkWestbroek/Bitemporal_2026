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
import { kortsteVoorkomenPaar, voorkomenId, voorkomensPerElement } from "../model/voorkomens.js";

export const ANKER_PREFIX = "anker:";

/**
 * Zoek het connector-ElementType dat een verbinding bron→doel toestaat.
 * Bij een expliciete voorkeur (taakbalk "Verbinding") is die leidend; zonder
 * voorkeur wint de eerste passende in descriptor-volgorde.
 */
export function vindConnectorType(diagramType, bronElement, doelElement, voorkeur = null) {
  if (!bronElement || !doelElement) return null;
  const kandidaten = (diagramType?.elementTypes || []).filter((et) => et.isConnector);
  // 1..* verbindingsregels (volledige vorm) of de verkorte bron/doel-vorm:
  // een verbinding past zodra één regel de combinatie toestaat.
  const regelsVan = (et) =>
    Array.isArray(et.verbindingsregels) && et.verbindingsregels.length
      ? et.verbindingsregels.map((r) => ({
          bron: r?.bron?.elementTypes || r?.bron || [],
          doel: r?.doel?.elementTypes || r?.doel || [],
        }))
      : [{ bron: et.bron?.elementTypes || [], doel: et.doel?.elementTypes || [] }];
  const past = (et) =>
    regelsVan(et).some(
      (r) =>
        r.bron.includes(bronElement.elementType) && r.doel.includes(doelElement.elementType)
    );
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
 * Middelpunt van een node: expliciete size (diagram-lidmaatschap) wint,
 * daarna de gemeten maat (React Flow, via de `maten`-parameter), en pas
 * als laatste de 200×80-schatting. Zonder echte maten koos de kortste-weg
 * bij brede/lage nodes geregeld de verkeerde zijde.
 */
function midden(ref, maat) {
  const w = ref?.size?.width ?? maat?.width ?? 200;
  const h = ref?.size?.height ?? maat?.height ?? 80;
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
export function materialiseerConnectoren(elements, diagram, elementTypesById, maten = null) {
  const nodeRefs = voorkomensPerElement(diagram?.nodes || []);
  const verborgenConnectoren = new Set(diagram?.verborgenConnectoren || []);
  const edges = [];
  const extraNodes = [];

  for (const el of Object.values(elements || {})) {
    const et = elementTypesById[el.elementType];
    if (!et?.isConnector || !el.source || !el.target) continue;
    if (verborgenConnectoren.has(el.id)) continue;

    const bronVoorkomens = nodeRefs.get(el.source) || [];
    const doelVoorkomens = nodeRefs.get(el.target) || [];
    const expliciet = diagram?.connectorVoorkomens?.[el.id];
    const explicieteBron = expliciet
      ? bronVoorkomens.find((node) => voorkomenId(node) === expliciet.bronNodeId)
      : null;
    const explicietDoel = expliciet
      ? doelVoorkomens.find((node) => voorkomenId(node) === expliciet.doelNodeId)
      : null;
    const paar = explicieteBron && explicietDoel
      ? { bron: explicieteBron, doel: explicietDoel }
      : kortsteVoorkomenPaar(bronVoorkomens, doelVoorkomens, maten);
    if (!paar) continue; // beide uiteinden moeten op het diagram staan
    const { bron: bronRef, doel: doelRef } = paar;
    const bronVoorkomenId = voorkomenId(bronRef);
    const doelVoorkomenId = voorkomenId(doelRef);
    const bronMid = midden(bronRef, maten?.[bronVoorkomenId]);
    const doelMid = midden(doelRef, maten?.[doelVoorkomenId]);

    // Zwevende aanhechting per uiteinde (zie zwevendeRand.js). Twee
    // voorwaarden: het elementtype aan die kant moet het toestaan, én de
    // gebruiker mag daar niet zélf een handle hebben gekozen — een met de hand
    // gelegde aanhechting blijft waar hij ligt. Een zelf-lus zweeft nooit; de
    // ConnectorEdge vangt dat op, want daar is het pas te zien.
    const zwevendKant = (elementId, handleSleutel) =>
      elementTypesById[elements[elementId]?.elementType]?.randAanhechting === "zwevend" &&
      !el.data?.[handleSleutel];
    const zwevendBron = zwevendKant(el.source, "sourceHandle");
    const zwevendDoel = zwevendKant(el.target, "targetHandle");

    const labels = et.hooks?.edgeLabels?.(el) || {};
    // Handmatig versleepte label-posities (data.labelOffsets, per zijde).
    const offsets = el.data?.labelOffsets || null;
    const metOffsets = (lijst) =>
      offsets
        ? lijst.map((l) => (offsets[l.zijde] ? { ...l, offset: offsets[l.zijde] } : l))
        : lijst;
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
      // Zelf-lus (oortje): standaard hoekig en van boven naar rechts —
      // de kortste weg is bij één punt betekenisloos.
      const isLus = el.source === el.target;
      // Lidmaatschaps-lijnen (edgePresentatie.verbergBijNesting): de lijn is
      // ruis zolang het lid geometrisch ín zijn container ligt — de nesting
      // toont de relatie al. Ligt het lid erbuiten, dan is de lijn juist
      // informatief en blijft hij zichtbaar (vgl. EA/Archi-nesting).
      let verborgen = false;
      if (basisPresentatie.verbergBijNesting && !isLus) {
        const bw = bronRef?.size?.width ?? maten?.[el.source]?.width ?? 200;
        const bh = bronRef?.size?.height ?? maten?.[el.source]?.height ?? 80;
        verborgen =
          doelMid.x >= bronRef.position.x &&
          doelMid.x <= bronRef.position.x + bw &&
          doelMid.y >= bronRef.position.y &&
          doelMid.y <= bronRef.position.y + bh;
      }
      edges.push({
        ...(verborgen ? { hidden: true } : {}),
        id: `conn:${el.id}`,
        source: bronVoorkomenId,
        target: doelVoorkomenId,
        // Expliciete handles winnen; anders de kortste weg (of de lus-default).
        sourceHandle:
          el.data?.sourceHandle || (isLus ? "source-top" : `source-${besteZijde(bronMid, doelMid)}`),
        targetHandle:
          el.data?.targetHandle || (isLus ? "target-right" : `target-${besteZijde(doelMid, bronMid)}`),
        data: {
          connectorId: el.id,
          // Handmatige knikpunten (ctrl-klik; alleen in deze directe gedaante —
          // de gematerialiseerde gedaante heeft het anker al als handvat).
          knikken:
            Array.isArray(el.data?.knikken) && el.data.knikken.length ? el.data.knikken : null,
          presentatie: {
            ...basisPresentatie,
            // Per-connector lijnvorm (contextmenu) wint van het type-default;
            // een lus is standaard hoekig (het nette EA-oortje).
            vorm: el.data?.vorm || (isLus ? "hoekig" : basisPresentatie.vorm),
            zwevendBron,
            zwevendDoel,
            labels: metOffsets(kaalLabels),
          },
        },
      });
      continue;
    }

    // ── Gematerialiseerde gedaante: anker + box + 3 edges ──────────────────
    const connRef = nodeRefs.get(el.id)?.[0] || null;
    const connVoorkomenId = connRef ? voorkomenId(connRef) : el.id;
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
      source: bronVoorkomenId,
      target: ankerId,
      sourceHandle: el.data?.sourceHandle || `source-${besteZijde(bronMid, ankerMid)}`,
      targetHandle: `target-${besteZijde(ankerMid, bronMid)}`,
      data: {
        connectorId: el.id,
        // markerStart (bv. ruit) blijft in de gematerialiseerde gedaante
        // zichtbaar aan de bronzijde.
        presentatie: {
          lijn: "solid",
          vorm: el.data?.vorm || basisPresentatie.vorm,
          kleur: basisPresentatie.kleur || "#64748b",
          markerStart: basisPresentatie.markerStart,
          zwevendBron,
          labels: metOffsets(labels.bron || []),
        },
      },
    });
    edges.push({
      id: `conn:${el.id}:doel`,
      source: ankerId,
      target: doelVoorkomenId,
      sourceHandle: `source-${besteZijde(ankerMid, doelMid)}`,
      targetHandle: el.data?.targetHandle || `target-${besteZijde(doelMid, ankerMid)}`,
      data: {
        connectorId: el.id,
        presentatie: {
          lijn: "solid",
          vorm: el.data?.vorm || basisPresentatie.vorm,
          kleur: basisPresentatie.kleur || "#64748b",
          markerEnd: basisPresentatie.markerEnd ?? (el.data?.directioneel ? "pijl-open" : null),
          zwevendDoel,
          labels: metOffsets(labels.doel || []),
        },
      },
    });
    const boxRef = connRef || extraNodes.find((n) => n.soort === "box" && n.id === el.id);
    const boxMid = boxRef ? midden({ position: boxRef.position, size: boxRef.size }) : ankerMid;
    edges.push({
      id: `conn:${el.id}:link`,
      source: ankerId,
      target: connVoorkomenId,
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
