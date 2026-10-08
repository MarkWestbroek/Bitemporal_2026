// @ts-check
/**
 * qeaNaarPuurUml — lezer: rijen uit een Sparx EA-repository (één pakket met
 * deelpakketten) → een puur-uml-model ({elements, diagrams}) mét diagrammen,
 * posities, maten, knikpunten en verborgen lijnen.
 *
 * Principe (onderzoek §6.8): de lezer gooit niets weg. Wat puur-uml niet
 * kent reist mee op `data`: `eaGuid` (externe identiteit), `stereotypen`
 * (volledige namen uit t_xref), `tags` (tagged values), `notes`, `alias`.
 * Elementtypen die puur-uml niet heeft (Activity, UseCase, …) worden
 * overgeslagen en geteld in het verslag — die zijn voor de activity-/use
 * case-lezer (volgende stap).
 *
 * Pure functie, geen sql.js: de rijen komen uit `qeaLezer.js` (browser) of
 * uit een JSON-fixture (test). Kolomnamen = EA-kolomnamen.
 */
import {
  stereotypenUitXref,
  customPropertiesUitXref,
  knikkenUitPath,
  rechthoekNaarNode,
  kleurUitBgr,
  idUitGuid,
  kardinaliteitUitGrenzen,
  deelboomPakketten,
  sleutelWaarden,
  EA_SCHAAL,
  haaksAanhechtpunt,
  maakHaaks,
} from "./qeaHulp.js";

/**
 * @typedef {Object} QeaBron
 * @property {any[]} t_package
 * @property {any[]} t_object
 * @property {any[]} t_attribute
 * @property {any[]} [t_operation]
 * @property {any[]} t_connector
 * @property {any[]} [t_xref]
 * @property {any[]} [t_objectproperties]
 * @property {any[]} [t_diagram]
 * @property {any[]} [t_diagramobjects]
 * @property {any[]} [t_diagramlinks]
 */

export const PUUR_UML_DIAGRAMTYPE = "puur-uml";

/** EA Object_Type → puur-uml elementtype (null = overslaan). */
const OBJECTTYPE_NAAR_ELEMENTTYPE = {
  Class: "klasse",
  Interface: "interface",
  Enumeration: "enumeratie",
  DataType: "datatype",
  PrimitiveType: "datatype",
  Note: "notitie",
  Text: "notitie",
  Boundary: "boundary",
};

/**
 * @param {QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 *   `schaal` vergroot posities, maten en knikpunten (standaard `EA_SCHAAL`).
 */
export function qeaNaarPuurUml(bron, { packageId, diagramTypeId = PUUR_UML_DIAGRAMTYPE, schaal = EA_SCHAAL }) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = {
    elementen: 0,
    connectoren: 0,
    diagrammen: 0,
    /** NoteLinks (notitie ↔ element) — puur-uml tekent die (nog) niet. */
    notitieLijnen: 0,
    /** @type {Record<string, number>} EA-typen zonder plek in puur-uml */
    overgeslagen: {},
    /** @type {string[]} */
    meldingen: [],
  };
  const sla = (soort) => {
    verslag.overgeslagen[soort] = (verslag.overgeslagen[soort] || 0) + 1;
  };

  // ── Hulptabellen ──────────────────────────────────────────────────────
  const stereoPerGuid = new Map();
  const customPerGuid = new Map();
  for (const x of bron.t_xref || []) {
    if (x.Name === "Stereotypes") stereoPerGuid.set(x.Client, stereotypenUitXref(x.Description));
    else if (x.Name === "CustomProperties") customPerGuid.set(x.Client, customPropertiesUitXref(x.Description));
  }
  const tagsPerObject = new Map();
  for (const t of bron.t_objectproperties || []) {
    const m = tagsPerObject.get(t.Object_ID) || {};
    const vorig = m[t.Property];
    m[t.Property] = vorig === undefined ? t.Value ?? "" : [].concat(vorig, t.Value ?? "");
    tagsPerObject.set(t.Object_ID, m);
  }
  const attrsPerObject = groepeer(bron.t_attribute || [], (a) => a.Object_ID, (a) => a.Pos);
  const opsPerObject = groepeer(bron.t_operation || [], (o) => o.Object_ID, (o) => o.Pos);

  /** @type {Record<string, any>} */
  const elements = {};
  /** EA Object_ID → element-id (alleen voor gemapte objecten). */
  const idVanObject = new Map();
  /** EA Package_ID → element-id van het package-element. */
  const idVanPakket = new Map();

  const extraData = (guid, objectId) => {
    const st = stereoPerGuid.get(guid);
    const cu = customPerGuid.get(guid);
    const tags = tagsPerObject.get(objectId);
    return {
      eaGuid: guid,
      ...(st?.length ? { stereotypen: st } : {}),
      ...(cu && Object.keys(cu).length ? { custom: cu } : {}),
      ...(tags ? { tags } : {}),
    };
  };

  // ── Packages (t_package; het bijbehorende t_object van type Package slaan we over) ──
  const pakketten = (bron.t_package || []).filter((p) => pakketIds.has(p.Package_ID));
  for (const p of pakketten) {
    const id = idUitGuid(p.ea_guid);
    idVanPakket.set(p.Package_ID, id);
    elements[id] = {
      id,
      naam: p.Name || "",
      elementType: "package",
      compartimenten: [],
      data: { eaGuid: p.ea_guid, ...(p.Notes ? { notes: p.Notes } : {}) },
    };
    verslag.elementen += 1;
  }
  for (const p of pakketten) {
    const ouder = idVanPakket.get(p.Parent_ID);
    if (ouder) maakBevat(elements, ouder, idVanPakket.get(p.Package_ID));
  }

  // ── Elementen ─────────────────────────────────────────────────────────
  const objecten = (bron.t_object || []).filter((o) => pakketIds.has(o.Package_ID));
  for (const o of objecten) {
    if (o.Object_Type === "Package") continue; // dubbel met t_package
    const elementType = OBJECTTYPE_NAAR_ELEMENTTYPE[o.Object_Type];
    if (!elementType) {
      sla(o.Object_Type);
      continue;
    }
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    const data = {
      ...extraData(o.ea_guid, o.Object_ID),
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && elementType !== "notitie" ? { notes: o.Note } : {}),
      ...(String(o.Abstract) === "1" ? { abstract: true } : {}),
    };
    const kleur = kleurUitBgr(o.Backcolor);
    if (kleur) data.kleur = kleur;

    const element = {
      id,
      naam: elementType === "notitie" ? "" : o.Name || "",
      elementType,
      compartimenten: [],
      data,
    };
    if (elementType === "notitie") {
      element.data.tekst = o.Note || o.Name || "";
    } else {
      element.compartimenten = compartimentenVoor(o, elementType, attrsPerObject, opsPerObject);
    }
    elements[id] = element;
    verslag.elementen += 1;
    const pakket = idVanPakket.get(o.Package_ID);
    if (pakket) maakBevat(elements, pakket, id);
  }

  // ── Connectoren ───────────────────────────────────────────────────────
  /** Eerste diagram-link per connector (knikken, verborgen). */
  const linkPerConnector = new Map();
  for (const l of bron.t_diagramlinks || []) {
    if (!linkPerConnector.has(l.ConnectorID)) linkPerConnector.set(l.ConnectorID, l);
  }
  /** Diagram_ID → (Object_ID → geschaalde rechthoek) voor de aanhechtpunten. */
  const rectPerDiagram = new Map();
  for (const dobj of bron.t_diagramobjects || []) {
    if (!rectPerDiagram.has(dobj.Diagram_ID)) rectPerDiagram.set(dobj.Diagram_ID, new Map());
    const { position, size } = rechthoekNaarNode(dobj, schaal);
    rectPerDiagram.get(dobj.Diagram_ID).set(dobj.Object_ID, { ...position, ...size });
  }
  /** EA Connector_ID → element-id. */
  const idVanConnector = new Map();
  for (const c of bron.t_connector || []) {
    const bronId = idVanObject.get(c.Start_Object_ID);
    const doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) {
      if (c.Connector_Type !== "NoteLink") sla(`connector buiten bereik (${c.Connector_Type})`);
      continue;
    }
    if (c.Connector_Type === "NoteLink") {
      // puur-uml kent geen notitie-lijn; de notitie zelf komt wel mee.
      verslag.notitieLijnen += 1;
      continue;
    }
    const vertaald = vertaalConnector(c, bronId, doelId, elements);
    if (!vertaald) {
      sla(`connector ${c.Connector_Type}`);
      continue;
    }
    const id = idUitGuid(c.ea_guid);
    idVanConnector.set(c.Connector_ID, id);
    const link = linkPerConnector.get(c.Connector_ID);
    const stijl = sleutelWaarden(link?.Style);
    let knikken = stijl.Mode === "1" ? [] : knikkenUitPath(link?.Path, schaal);
    if (knikken.length && stijl.TREE === "OS") {
      // EA "Orthogonal - Square": alleen de hoekpunten staan in Path; het
      // eerste en laatste stuk staan haaks op de rand en de stukken ertussen
      // zijn haaks. Zet de aanhechtpunten erbij (anders mikt de motor op het
      // middelpunt van de andere doos en loopt het eerste stuk schuin).
      const rects = rectPerDiagram.get(link.DiagramID);
      const rb = rects?.get(c.Start_Object_ID), rd = rects?.get(c.End_Object_ID);
      const begin = rb ? haaksAanhechtpunt(rb, knikken[0]) : null;
      const eind = rd ? haaksAanhechtpunt(rd, knikken[knikken.length - 1]) : null;
      knikken = maakHaaks([...(begin ? [begin] : []), ...knikken, ...(eind ? [eind] : [])]);
    }
    elements[id] = {
      id,
      naam: vertaald.naam,
      elementType: vertaald.elementType,
      source: vertaald.source,
      target: vertaald.target,
      compartimenten: [],
      data: {
        ...extraData(c.ea_guid, null),
        ...(c.Notes ? { notes: c.Notes } : {}),
        ...vertaald.data,
        ...(knikken.length ? { knikken } : {}),
      },
    };
    verslag.connectoren += 1;
  }

  // ── Diagrammen ────────────────────────────────────────────────────────
  /** @type {Record<string, any>} */
  const diagrams = {};
  const objectenPerDiagram = groepeer(bron.t_diagramobjects || [], (d) => d.Diagram_ID, (d) => d.Sequence);
  const linksPerDiagram = groepeer(bron.t_diagramlinks || [], (l) => l.DiagramID, () => 0);
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID))) {
    const id = "ead-" + String(d.ea_guid || d.Diagram_ID).replace(/[{}]/g, "").toLowerCase();
    const gezien = new Set();
    const nodes = [];
    // Sequence laag = bovenop in EA; in de node-lijst tekent de laatste bovenop.
    for (const dobj of [...(objectenPerDiagram.get(d.Diagram_ID) || [])].reverse()) {
      const elementId = idVanObject.get(dobj.Object_ID);
      if (!elementId) continue;
      const { position, size } = rechthoekNaarNode(dobj, schaal);
      const node = { elementId, position, size };
      if (gezien.has(elementId)) node.nodeId = `${elementId}#${dobj.Instance_ID}`;
      gezien.add(elementId);
      nodes.push(node);
    }
    const verborgen = (linksPerDiagram.get(d.Diagram_ID) || [])
      .filter((l) => Number(l.Hidden) === 1)
      .map((l) => idVanConnector.get(l.ConnectorID))
      .filter(Boolean);
    diagrams[id] = {
      id,
      naam: d.Name || `Diagram ${d.Diagram_ID}`,
      diagramType: diagramTypeId,
      nodes,
      edges: [],
      ...(verborgen.length ? { verborgenConnectoren: verborgen } : {}),
    };
    verslag.diagrammen += 1;
  }

  return { diagramTypeId, elements, diagrams, verslag };
}

// ── Hulpfuncties ────────────────────────────────────────────────────────

/**
 * Groepeer rijen per sleutel, gesorteerd op een volgorde-kolom.
 * @template T
 * @param {T[]} rijen
 * @param {(r:T)=>any} sleutel
 * @param {(r:T)=>any} volgorde
 * @returns {Map<any, T[]>}
 */
function groepeer(rijen, sleutel, volgorde) {
  const m = new Map();
  for (const r of rijen) {
    const k = sleutel(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  for (const lijst of m.values()) lijst.sort((a, b) => (Number(volgorde(a)) || 0) - (Number(volgorde(b)) || 0));
  return m;
}

function maakBevat(elements, ouderId, kindId) {
  if (!ouderId || !kindId || ouderId === kindId) return;
  const id = `${ouderId}~bevat~${kindId}`;
  elements[id] = {
    id,
    naam: "",
    elementType: "bevat",
    source: ouderId,
    target: kindId,
    compartimenten: [],
    data: {},
  };
}

/** Attributen/operaties/literals als compartimenten van puur-uml. */
function compartimentenVoor(o, elementType, attrsPerObject, opsPerObject) {
  const attrs = attrsPerObject.get(o.Object_ID) || [];
  const ops = opsPerObject.get(o.Object_ID) || [];
  const comps = [];
  if (elementType === "enumeratie") {
    if (attrs.length) {
      comps.push({
        compartmentType: "literals",
        velden: attrs.map((a) => ({ naam: a.Name || "", fieldType: "literal", data: veldData(a) })),
      });
    }
    return comps;
  }
  if (["klasse", "datatype"].includes(elementType) && attrs.length) {
    comps.push({
      compartmentType: "attributen",
      velden: attrs.map((a) => {
        const kard = kardinaliteitUitGrenzen(a.LowerBound, a.UpperBound);
        return {
          naam: a.Name || "",
          fieldType: "attribuut",
          data: {
            ...veldData(a),
            ...(a.Type ? { typeLabel: a.Type } : {}),
            ...(kard ? { kardinaliteit: kard } : {}),
            ...(a.Scope ? { zichtbaarheid: a.Scope } : {}),
            ...(String(a.Derived) === "1" ? { afgeleid: true } : {}),
          },
        };
      }),
    });
  }
  if (["klasse", "interface"].includes(elementType) && ops.length) {
    comps.push({
      compartmentType: "operaties",
      velden: ops.map((op) => ({
        naam: `${op.Name || ""}()`,
        fieldType: "operatie",
        data: { ...veldData(op), ...(op.Type ? { typeLabel: op.Type } : {}) },
      })),
    });
  }
  return comps;
}

function veldData(rij) {
  return {
    ...(rij.ea_guid ? { eaGuid: rij.ea_guid } : {}),
    ...(rij.Notes ? { notes: rij.Notes } : {}),
    ...(rij.Stereotype ? { stereotypen: [rij.Stereotype] } : {}),
  };
}

/**
 * EA-connector → puur-uml-connector. Let op de richting van aggregaties: in
 * EA is Start het deel en End het geheel (ruit aan End); puur-uml tekent de
 * ruit aan de bron, dus bron = geheel.
 * @returns {{elementType:string, naam:string, source:string, target:string, data:Record<string,any>}|null}
 */
function vertaalConnector(c, bronId, doelId, elements) {
  const naam = c.Name || "";
  const type = c.Connector_Type;
  const gericht = c.Direction === "Source -> Destination";
  const kanten = {
    ...(c.SourceCard ? { bronKardinaliteit: c.SourceCard } : {}),
    ...(c.DestCard ? { doelKardinaliteit: c.DestCard } : {}),
    ...(c.SourceRole ? { bronRolNaam: c.SourceRole } : {}),
    ...(c.DestRole ? { doelRolNaam: c.DestRole } : {}),
  };
  switch (type) {
    case "Association": {
      const geheelAanDoel = Number(c.DestIsAggregate) > 0;
      const geheelAanBron = Number(c.SourceIsAggregate) > 0;
      if (geheelAanDoel || geheelAanBron) {
        // Associatie met aggregatie-vlag: zelfde behandeling als Aggregation.
        return aggregatie(c, bronId, doelId, naam, geheelAanDoel);
      }
      return { elementType: "associatie", naam, source: bronId, target: doelId, data: { ...kanten, ...(gericht ? { directioneel: true } : {}) } };
    }
    case "Aggregation":
      return aggregatie(c, bronId, doelId, naam, Number(c.SourceIsAggregate) === 0);
    case "Generalization":
      return { elementType: "generalisatie", naam, source: bronId, target: doelId, data: {} };
    case "Realisation":
    case "Realization":
      if (elements[doelId]?.elementType === "interface") {
        return { elementType: "realisatie", naam, source: bronId, target: doelId, data: {} };
      }
      // Realisatie naar een klasse mag in puur-uml niet; bewaar als dependency met label.
      return { elementType: "dependency", naam: naam || "«realize»", source: bronId, target: doelId, data: { eaConnectorType: type } };
    case "Dependency":
    case "Abstraction":
    case "Usage":
      return {
        elementType: "dependency",
        naam: naam || (c.Stereotype ? `«${c.Stereotype}»` : ""),
        source: bronId,
        target: doelId,
        data: { ...(type !== "Dependency" ? { eaConnectorType: type } : {}) },
      };
    default:
      return null;
  }
}

function aggregatie(c, bronId, doelId, naam, geheelAanDoel) {
  const sterk = Number(geheelAanDoel ? c.DestIsAggregate : c.SourceIsAggregate) === 2 || c.SubType === "Strong";
  const geheel = geheelAanDoel ? doelId : bronId;
  const deel = geheelAanDoel ? bronId : doelId;
  // Kardinaliteiten/rollen volgen de kant: bron (ruit) = geheel.
  const geheelCard = geheelAanDoel ? c.DestCard : c.SourceCard;
  const deelCard = geheelAanDoel ? c.SourceCard : c.DestCard;
  const geheelRol = geheelAanDoel ? c.DestRole : c.SourceRole;
  const deelRol = geheelAanDoel ? c.SourceRole : c.DestRole;
  return {
    elementType: sterk ? "compositie" : "aggregatie",
    naam,
    source: geheel,
    target: deel,
    data: {
      ...(geheelCard ? { bronKardinaliteit: geheelCard } : {}),
      ...(deelCard ? { doelKardinaliteit: deelCard } : {}),
      ...(geheelRol ? { bronRolNaam: geheelRol } : {}),
      ...(deelRol ? { doelRolNaam: deelRol } : {}),
    },
  };
}
