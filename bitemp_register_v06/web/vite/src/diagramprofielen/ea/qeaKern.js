// @ts-check
/**
 * qeaKern — wat alle EA-lezers delen: hulptabellen over de rijen (stereotypen,
 * tagged values, attributen, diagramrechthoeken), de extra `data` per element,
 * knikpunten per connector (inclusief EA's "Orthogonal - Square") en het bouwen
 * van een diagram uit `t_diagramobjects`/`t_diagramlinks`.
 *
 * Pure functies; de profiel-specifieke vertaling (welk EA-type wordt welk
 * elementtype) zit in `qeaNaarPuurUml.js` en `qeaNaarActivity.js`.
 */
import {
  stereotypenUitXref,
  customPropertiesUitXref,
  knikkenUitPath,
  rechthoekNaarNode,
  sleutelWaarden,
  idUitGuid,
  haaksAanhechtpunt,
  maakHaaks,
} from "./qeaHulp.js";

/**
 * @typedef {Object} QeaBron
 * @property {any[]} t_package
 * @property {any[]} t_object
 * @property {any[]} [classifiers] - naam-lookup van Classifier-doelen buiten het bereik
 * @property {any[]} t_attribute
 * @property {any[]} [t_operation]
 * @property {any[]} t_connector
 * @property {any[]} [t_xref]
 * @property {any[]} [t_objectproperties]
 * @property {any[]} [t_attributetag]
 * @property {any[]} [t_connectortag]
 * @property {any[]} [t_diagram]
 * @property {any[]} [t_diagramobjects]
 * @property {any[]} [t_diagramlinks]
 */

/**
 * Groepeer rijen per sleutel, gesorteerd op een volgorde-kolom.
 * @template T
 * @param {T[]} rijen
 * @param {(r:T)=>any} sleutel
 * @param {(r:T)=>any} volgorde
 * @returns {Map<any, T[]>}
 */
export function groepeer(rijen, sleutel, volgorde) {
  const m = new Map();
  for (const r of rijen) {
    const k = sleutel(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  for (const lijst of m.values()) lijst.sort((a, b) => (Number(volgorde(a)) || 0) - (Number(volgorde(b)) || 0));
  return m;
}

/** Lege verslag-structuur. */
export function maakVerslag() {
  return {
    elementen: 0,
    connectoren: 0,
    diagrammen: 0,
    /** @type {Record<string, number>} EA-typen zonder plek in dit profiel */
    overgeslagen: {},
    /** @type {string[]} */
    meldingen: [],
  };
}

export function sla(verslag, soort) {
  verslag.overgeslagen[soort] = (verslag.overgeslagen[soort] || 0) + 1;
}

/**
 * Hulptabellen over de bron, eenmalig opgebouwd.
 * @param {QeaBron} bron
 * @param {number} schaal
 */
export function maakHulptabellen(bron, schaal, { vasteMaat = null } = {}) {
  const stereoPerGuid = new Map();
  const customPerGuid = new Map();
  for (const x of bron.t_xref || []) {
    if (x.Name === "Stereotypes") stereoPerGuid.set(x.Client, stereotypenUitXref(x.Description));
    else if (x.Name === "CustomProperties") customPerGuid.set(x.Client, customPropertiesUitXref(x.Description));
  }
  // Tagged values: EA zet lange waarden als `<memo>` in VALUE en de tekst in
  // NOTES; dubbele namen worden een lijst.
  const tagsVan = (rijen, sleutelKolom, waardeKolom, notesKolom) => {
    const uit = new Map();
    for (const t of rijen || []) {
      const m = uit.get(t[sleutelKolom]) || {};
      const ruw = t[waardeKolom];
      const waarde = ruw === "<memo>" ? t[notesKolom] ?? "" : ruw ?? "";
      const vorig = m[t.Property];
      m[t.Property] = vorig === undefined ? waarde : [].concat(vorig, waarde);
      uit.set(t[sleutelKolom], m);
    }
    return uit;
  };
  const tagsPerObject = tagsVan(bron.t_objectproperties, "Object_ID", "Value", "Notes");
  const tagsPerAttribuut = tagsVan(bron.t_attributetag, "ElementID", "VALUE", "NOTES");
  const tagsPerConnector = tagsVan(bron.t_connectortag, "ElementID", "VALUE", "NOTES");
  const objectPerId = new Map((bron.t_object || []).map((o) => [o.Object_ID, o]));
  const classifierPerId = new Map((bron.classifiers || []).map((c) => [c.Object_ID, c]));
  for (const o of bron.t_object || []) if (!classifierPerId.has(o.Object_ID)) classifierPerId.set(o.Object_ID, o);
  // Rechthoek per diagramobject. Een vorm met een vaste maat in Omnium (ruit,
  // begin-/eindstip, pin) krijgt niet de EA-maat maar wordt gecentreerd in de
  // EA-rechthoek — anders liggen de handles buiten de vorm (Mark, 09-10).
  const objectPerIdVoorMaat = new Map((bron.t_object || []).map((o) => [o.Object_ID, o]));
  const rectPerDiagram = new Map();
  for (const dobj of bron.t_diagramobjects || []) {
    if (!rectPerDiagram.has(dobj.Diagram_ID)) rectPerDiagram.set(dobj.Diagram_ID, new Map());
    const { position, size } = rechthoekNaarNode(dobj, schaal);
    const vast = vasteMaat ? vasteMaat(objectPerIdVoorMaat.get(dobj.Object_ID)) : null;
    const rect = vast
      ? { x: Math.round(position.x + size.width / 2 - vast.width / 2), y: Math.round(position.y + size.height / 2 - vast.height / 2), width: vast.width, height: vast.height, vast: true }
      : { ...position, ...size, vast: false };
    rectPerDiagram.get(dobj.Diagram_ID).set(dobj.Object_ID, rect);
  }
  const linkPerConnector = new Map();
  for (const l of bron.t_diagramlinks || []) {
    if (!linkPerConnector.has(l.ConnectorID)) linkPerConnector.set(l.ConnectorID, l);
  }
  return {
    schaal,
    stereoPerGuid,
    customPerGuid,
    tagsPerObject,
    tagsPerAttribuut,
    tagsPerConnector,
    objectPerId,
    classifierPerId,
    attrsPerObject: groepeer(bron.t_attribute || [], (a) => a.Object_ID, (a) => a.Pos),
    opsPerObject: groepeer(bron.t_operation || [], (o) => o.Object_ID, (o) => o.Pos),
    rectPerDiagram,
    linkPerConnector,
    objectenPerDiagram: groepeer(bron.t_diagramobjects || [], (d) => d.Diagram_ID, (d) => d.Sequence),
    linksPerDiagram: groepeer(bron.t_diagramlinks || [], (l) => l.DiagramID, () => 0),
    /** Activity-/use case-frames: Object_ID → Diagram_ID van het diagram dat erin tekent. */
    diagramPerFrame: new Map((bron.t_diagram || []).filter((d) => d.ParentID).map((d) => [d.ParentID, d.Diagram_ID])),
  };
}

/**
 * De `data` die elk element meekrijgt: externe identiteit, stereotypen,
 * custom properties en tagged values. Niets gaat verloren.
 * @param {ReturnType<typeof maakHulptabellen>} h
 */
export function extraData(h, guid, objectId) {
  const st = h.stereoPerGuid.get(guid);
  const cu = h.customPerGuid.get(guid);
  const tags = objectId != null ? h.tagsPerObject.get(objectId) : null;
  return {
    eaGuid: guid,
    ...(st?.length ? { stereotypen: st } : {}),
    ...(cu && Object.keys(cu).length ? { custom: cu } : {}),
    ...(tags ? { tags } : {}),
  };
}

/** Stabiel diagram-id uit de EA-GUID van het diagram. */
export function diagramId(d) {
  return "ead-" + String(d.ea_guid || d.Diagram_ID).replace(/[{}]/g, "").toLowerCase();
}

/**
 * Knikpunten van een connector: uit de eerste diagram-link waarop hij staat.
 * Bij EA's "Orthogonal - Square" (TREE=OS) komen de haakse aanhechtpunten erbij.
 * @param {ReturnType<typeof maakHulptabellen>} h
 */
export function knikkenVoor(h, c) {
  const link = h.linkPerConnector.get(c.Connector_ID);
  const stijl = sleutelWaarden(link?.Style);
  let knikken = stijl.Mode === "1" ? [] : knikkenUitPath(link?.Path, h.schaal);
  if (knikken.length) {
    // EA tekent het eerste en laatste stuk haaks op de rand (bij elke lijn
    // met hoekpunten, niet alleen "Orthogonal - Square"): zet de aanhechtpunten
    // erbij, met wat tolerantie voor vormen die in Omnium anders gemeten zijn.
    const rects = h.rectPerDiagram.get(link.DiagramID);
    const rb = rects?.get(c.Start_Object_ID), rd = rects?.get(c.End_Object_ID);
    const tol = 12 * h.schaal;
    const begin = rb ? haaksAanhechtpunt(rb, knikken[0], tol) : null;
    const eind = rd ? haaksAanhechtpunt(rd, knikken[knikken.length - 1], tol) : null;
    knikken = [...(begin ? [begin] : []), ...knikken, ...(eind ? [eind] : [])];
    if (stijl.TREE === "OS") knikken = maakHaaks(knikken);
  }
  return knikken;
}

/**
 * Connector-element in de standaardvorm.
 * @param {ReturnType<typeof maakHulptabellen>} h
 */
export function maakConnectorElement(h, c, vertaald) {
  const id = idUitGuid(c.ea_guid);
  // EA's Path loopt van Start naar End; is de vertaling omgedraaid (ruit aan
  // het geheel), dan draaien de knikken mee.
  let knikken = knikkenVoor(h, c);
  if (vertaald.omgedraaid) knikken = knikken.slice().reverse();
  // Lijnvorm: een EA-lijn zonder hoekpunten is een rechte lijn (Direct, of
  // Custom zonder waypoints) — tenzij EA hem zelf routeert (Mode=2, Auto
  // Routing: orthogonaal). Dan volgt Omnium's "hoekig" dat het dichtst.
  const link = h.linkPerConnector.get(c.Connector_ID);
  const mode = sleutelWaarden(link?.Style).Mode;
  const vorm = !knikken.length && link && mode !== "2" ? "recht" : null;
  return {
    id,
    naam: vertaald.naam,
    elementType: vertaald.elementType,
    source: vertaald.source,
    target: vertaald.target,
    compartimenten: [],
    data: {
      ...extraData(h, c.ea_guid, null),
      ...(c.Notes ? { notes: c.Notes } : {}),
      ...vertaald.data,
      ...(knikken.length ? { knikken } : {}),
      ...(vorm ? { vorm } : {}),
    },
  };
}

/** Lidmaatschaps-connector (package → lid, partitie → lid). */
export function maakBevat(elements, ouderId, kindId, elementType = "bevat") {
  if (!ouderId || !kindId || ouderId === kindId) return;
  const id = `${ouderId}~${elementType}~${kindId}`;
  elements[id] = { id, naam: "", elementType, source: ouderId, target: kindId, compartimenten: [], data: {} };
}

/**
 * Eén EA-diagram → Omnium-diagram: nodes (positie, maat, z-volgorde),
 * meerdere voorkomens, verborgen connectoren.
 * @param {ReturnType<typeof maakHulptabellen>} h
 * @param {any} d - t_diagram-rij
 * @param {{idVanObject: Map<number,string>, idVanConnector: Map<number,string>, diagramTypeId: string,
 *          elements: Record<string, any>}} ctx
 */
export function bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId, elements }) {
  const gezien = new Set();
  const nodes = [];
  const rects = h.rectPerDiagram.get(d.Diagram_ID) || new Map();
  // Sequence laag = bovenop in EA; in de node-lijst tekent de laatste bovenop.
  for (const dobj of [...(h.objectenPerDiagram.get(d.Diagram_ID) || [])].reverse()) {
    const elementId = idVanObject.get(dobj.Object_ID);
    if (!elementId) continue;
    const rect = rects.get(dobj.Object_ID) || { ...rechthoekNaarNode(dobj, h.schaal).position, ...rechthoekNaarNode(dobj, h.schaal).size, vast: false };
    const position = { x: rect.x, y: rect.y };
    const size = { width: rect.width, height: rect.height };
    // Vaste maat: geen size op de node (de vorm bepaalt hem), wel gecentreerd.
    const node = rect.vast ? { elementId, position } : { elementId, position, size };
    // Rand-element (pin): positie relatief aan de gastheer op dit diagram
    // (React Flow-kind), zoals de motor hem bewaart.
    const randVan = elements[elementId]?.data?.randVan;
    if (randVan) {
      const gastheerObj = [...idVanObject.entries()].find(([, id]) => id === randVan)?.[0];
      const gr = gastheerObj != null ? rects.get(gastheerObj) : null;
      if (gr) node.position = { x: position.x - gr.x, y: position.y - gr.y };
    }
    if (gezien.has(elementId)) node.nodeId = `${elementId}#${dobj.Instance_ID}`;
    gezien.add(elementId);
    nodes.push(node);
  }
  const verborgen = (h.linksPerDiagram.get(d.Diagram_ID) || [])
    .filter((l) => Number(l.Hidden) === 1)
    .map((l) => idVanConnector.get(l.ConnectorID))
    .filter(Boolean);
  return {
    id: diagramId(d),
    naam: d.Name || `Diagram ${d.Diagram_ID}`,
    diagramType: diagramTypeId,
    // EA-pakket van het diagram: nodig om bij een merge "verdwenen" te zien.
    eaPakket: d.Package_ID,
    nodes,
    edges: [],
    ...(verborgen.length ? { verborgenConnectoren: verborgen } : {}),
  };
}
