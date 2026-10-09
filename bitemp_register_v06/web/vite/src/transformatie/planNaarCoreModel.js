// @ts-check
/**
 * planNaarCoreModel — generieke **aansluiting** van plan (toepasser) naar
 * core-model: ids, lidmaatschap, verbindingsregels van het profiel,
 * rand-elementen en de diagramlaag (posities, maten, knikpunten uit het
 * bronformaat; anders een automatische opstelling). Kent geen bron- of
 * doelsyntax; wel het Studio-modelcontract (`importeerModel`).
 *
 * Diagramlaag in de brongraaf (optioneel): `graaf.diagrammen[]` met per
 * diagram `vormen` {bronId → {x,y,width,height}} en `lijnen` {bronId →
 * waypoints}. Posities zijn absoluut (de store voert absolute posities, ook
 * voor leden van een container); een rand-element (knoop.randVan) krijgt
 * zijn positie relatief aan de gastheer. Tussenliggende waypoints worden
 * `data.knikken` op de connector (de plek op main; EA-SYNC's branch verhuist
 * lijndata naar `diagram.lijnen[connectorId]` en migreert `data.knikken`).
 *
 * Een knoop met `subproces` (BPMN: inhoud van een uitgeklapt subproces)
 * landt op een eigen diagram; het subproces-element krijgt daar een
 * `gedragDiagramId` naar.
 */
import { verbindingsregelsVan } from "../diagramcore/types/typeRegistry.js";
import { legUit } from "./kolommenLayout.js";

const slug = (tekst) =>
  String(tekst || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

/**
 * @param {{knopen: any[], groepen: any[], verbindingen: any[], diagrammen?: any[], naam?: string}} graaf
 * @param {{elementen: any[], connectoren: any[]}} plan
 * @param {Object} opties
 * @param {string} opties.prefix               - id-voorvoegsel (bv. "bp")
 * @param {string} opties.diagramTypeId
 * @param {any[]} [opties.elementTypes]        - ElementTypes van het profiel (verbindingsregels, containers, maten)
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} [opties.bestaand]
 * @param {string} [opties.bestandsnaam]
 * @param {(type: string, element: any) => {breedte: number, hoogte: number}} [opties.celMaat] - voor de automatische opstelling
 */
export function planNaarCoreModel(graaf, plan, { prefix, diagramTypeId, elementTypes = [], bestaand = {}, bestandsnaam = "", celMaat = null }) {
  const bestaandeElementen = bestaand.elements || {};
  const typeVan = new Map(elementTypes.map((et) => [et.id, et]));
  const elements = {};
  const diagrams = {};
  const diagnostics = [];
  const stats = { diagrammen: 0, nieuw: {}, connectoren: 0 };
  const meld = (severity, code, message, sourceId = null) => diagnostics.push({ severity, code, message, sourceId, path: null });

  const bezet = (id) => !!bestaandeElementen[id] || !!elements[id] || !!bestaand.diagrams?.[id] || !!diagrams[id];
  const uniek = (basis) => {
    let id = basis;
    for (let n = 2; bezet(id); n += 1) id = `${basis}_${n}`;
    return id;
  };
  const bronKnoop = new Map([...(graaf.knopen || []), ...(graaf.groepen || [])].map((k) => [k.id, k]));
  const typeVanId = (id) => elements[id]?.elementType;
  const magVerbinden = (connectorType, bronId, doelId) => {
    const et = typeVan.get(connectorType);
    if (!et) return !typeVan.size;
    return verbindingsregelsVan(et).some((r) => r.bron.includes(typeVanId(bronId)) && r.doel.includes(typeVanId(doelId)));
  };

  // 1. Elementen.
  const idVan = new Map();
  for (const pe of plan.elementen) {
    const id = uniek(`${prefix}_${slug(pe.sleutel) || pe.type}`);
    elements[id] = { id, naam: pe.naam, elementType: pe.type, compartimenten: [], data: { ...pe.data } };
    idVan.set(pe.sleutel, id);
    stats.nieuw[pe.type] = (stats.nieuw[pe.type] || 0) + 1;
  }
  // Rand-elementen: gastheer-verwijzing (element.data.randVan).
  for (const pe of plan.elementen) {
    const bron = bronKnoop.get(pe.sleutel);
    if (!bron?.randVan) continue;
    const gastheer = idVan.get(bron.randVan);
    if (gastheer) elements[idVan.get(pe.sleutel)].data.randVan = gastheer;
    else meld("warning", "TRF-RAND", `Rand-element ${pe.sleutel}: gastheer ${bron.randVan} is niet omgezet`, pe.sleutel);
  }

  // 2. Connectoren: lidmaatschap uit `groep`, dan de planconnectoren.
  const opUiteinden = new Set();
  const voegConnectorToe = (type, bron, doel, naam, data, sleutel) => {
    if (!bron || !doel || bron === doel) return null;
    if (!magVerbinden(type, bron, doel)) {
      meld("warning", "TRF-VERBINDINGSREGEL", `Het profiel staat ${type} van ${typeVanId(bron)} naar ${typeVanId(doel)} niet toe; niet overgenomen`, sleutel);
      return null;
    }
    const dubbel = `${type}|${bron}|${doel}`;
    if (opUiteinden.has(dubbel) && type === (typeVan.get(typeVanId(bron))?.containerVoor || "bevat")) return null;
    opUiteinden.add(dubbel);
    const id = uniek(`${prefix}_${slug(sleutel) || type}`);
    elements[id] = { id, naam: naam || "", elementType: type, source: bron, target: doel, compartimenten: [], data: { ...data } };
    stats.connectoren += 1;
    return id;
  };
  const groepVan = new Map();
  for (const pe of plan.elementen) {
    if (pe.groep == null) continue;
    const lid = idVan.get(pe.sleutel);
    const container = idVan.get(pe.groep);
    if (!lid || !container) continue;
    // Een rand-element (boundary event, pin) woont op zijn gastheer, niet in
    // de container: het reist met de gastheer mee.
    if (elements[lid].data.randVan) continue;
    const lidType = typeVan.get(typeVanId(container))?.containerVoor || "bevat";
    if (voegConnectorToe(lidType, container, lid, "", {}, `${pe.groep}_bevat_${pe.sleutel}`)) groepVan.set(lid, container);
  }
  const idVanConnector = new Map();
  for (const pc of plan.connectoren) {
    const id = voegConnectorToe(pc.type, idVan.get(pc.bron), idVan.get(pc.doel), pc.naam, pc.data, pc.sleutel);
    if (id) idVanConnector.set(pc.sleutel, id);
  }

  // 3. Diagrammen. Knopen met `subproces` horen op het diagram van dat subproces.
  const subprocesVan = new Map();
  for (const k of graaf.knopen || []) if (k.subproces && idVan.get(k.id)) subprocesVan.set(idVan.get(k.id), k.subproces);
  const isContainer = (id) => !!typeVan.get(typeVanId(id))?.containerVoor;
  const diepte = (id) => (groepVan.has(id) ? diepte(groepVan.get(id)) + 1 : 0);
  const sorteerNodes = (nodes) =>
    nodes.sort((a, b) => Number(isContainer(b.elementId)) - Number(isContainer(a.elementId)) || diepte(a.elementId) - diepte(b.elementId));
  const basisnaam = String(bestandsnaam || "").replace(/\.[^.]+$/, "") || graaf.naam || "Import";

  const maakDiagram = (naamBasis, elementIds, vormen, lijnen, sleutelBasis) => {
    const nodes = [];
    for (const id of elementIds) {
      const bronId = [...idVan.entries()].find(([, v]) => v === id)?.[0];
      const vorm = vormen?.[bronId];
      const et = typeVan.get(typeVanId(id));
      if (!vorm) continue;
      let position = { x: vorm.x, y: vorm.y };
      const randVan = elements[id].data.randVan;
      if (randVan) {
        const gastheerBron = [...idVan.entries()].find(([, v]) => v === randVan)?.[0];
        const gv = vormen?.[gastheerBron];
        if (gv) position = { x: vorm.x - gv.x, y: vorm.y - gv.y };
      }
      const node = { elementId: id, position };
      if (et?.resizebaar !== false && vorm.width && vorm.height) node.size = { width: vorm.width, height: vorm.height };
      nodes.push(node);
    }
    for (const [bronId, punten] of Object.entries(lijnen || {})) {
      const id = idVanConnector.get(bronId);
      if (!id || !Array.isArray(punten) || punten.length <= 2) continue;
      elements[id].data.knikken = punten.slice(1, -1).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    }
    const diagramId = uniek(`${prefix}_diagram_${slug(sleutelBasis) || stats.diagrammen + 1}`);
    diagrams[diagramId] = { id: diagramId, naam: naamBasis, diagramType: diagramTypeId, nodes: sorteerNodes(nodes), edges: [] };
    stats.diagrammen += 1;
    return diagramId;
  };

  const alleKnoopIds = Object.values(elements).filter((e) => !e.source).map((e) => e.id);
  const diagrammen = graaf.diagrammen || [];
  if (diagrammen.length) {
    diagrammen.forEach((di, index) => {
      const opDit = alleKnoopIds.filter((id) => di.vormen?.[[...idVan.entries()].find(([, v]) => v === id)?.[0]]);
      const hoofd = opDit.filter((id) => !subprocesVan.has(id));
      const naam = di.naam || (diagrammen.length > 1 ? `${basisnaam} ${index + 1}` : basisnaam);
      maakDiagram(naam, hoofd, di.vormen, di.lijnen, di.id);
      // Uitgeklapte subprocessen: eigen diagram per subproces, gekoppeld via gedragDiagramId.
      const perSub = new Map();
      for (const id of opDit) if (subprocesVan.has(id)) {
        const sub = idVan.get(subprocesVan.get(id));
        if (!perSub.has(sub)) perSub.set(sub, []);
        perSub.get(sub).push(id);
      }
      for (const [sub, leden] of perSub) {
        const subDiagram = maakDiagram(elements[sub]?.naam || "Subproces", leden, di.vormen, di.lijnen, `${di.id}_${sub}`);
        if (elements[sub] && !elements[sub].data.gedragDiagramId) elements[sub].data.gedragDiagramId = subDiagram;
      }
    });
  } else {
    // Geen diagramlaag: automatische opstelling.
    const maat = celMaat || ((type) => (typeVan.get(type)?.containerVoor ? { breedte: 320, hoogte: 200 } : { breedte: 160, hoogte: 70 }));
    const plekken = legUit({
      knopen: alleKnoopIds.map((id) => ({ id, groep: groepVan.get(id) ?? null, container: isContainer(id), ...maat(typeVanId(id), elements[id]) })),
      verbindingen: Object.values(elements).filter((e) => e.source).map((e) => ({ bron: e.source, doel: e.target })),
    });
    const vormen = {};
    for (const [id, plek] of plekken) {
      const bronId = [...idVan.entries()].find(([, v]) => v === id)?.[0];
      vormen[bronId] = { x: plek.x, y: plek.y, width: plek.breedte, height: plek.hoogte };
    }
    maakDiagram(basisnaam, alleKnoopIds, vormen, {}, basisnaam);
  }

  return { core: { elements, diagrams }, diagnostics, stats };
}
