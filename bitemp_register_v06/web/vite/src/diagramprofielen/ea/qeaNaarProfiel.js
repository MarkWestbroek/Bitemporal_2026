// @ts-check
/**
 * qeaNaarProfiel — één gegevensgestuurde EA-lezer voor de profielen die M3-MOF
 * op 10-10 bouwde (component-deployment, object, requirements, business, xsd,
 * wsdl, composite-structure, communication). De vertaaltabel per profiel staat
 * in `diagramprofielen/<id>/eaMapping.js` (OBJECTEN, CONNECTOREN,
 * RAND_ELEMENTEN, CONTAINERS, EA_DIAGRAM_TYPES); wat niet in een tabel past
 * (compartimenten uit t_attribute, requirement-velden, RunState-slots,
 * berichten samenvouwen) zit als hook in `eaProfielen.js`.
 *
 * Werking per diagram van het pakket dat bij dit profiel hoort:
 *   1. objecten op het diagram (plus hun kinderen via ParentID: poorten) →
 *      element via de OBJECTEN-tabel (Object_Type + stereotype, specifiek
 *      vóór algemeen); naam, notities, kleur, stereotypen, tags reizen mee;
 *   2. rand-elementen (RAND_ELEMENTEN) krijgen `data.randVan` = gastheer;
 *      kinderen van een CONTAINERS-type krijgen een `bevat`-lijn;
 *   3. connectoren met beide uiteinden hier → via de CONNECTOREN-tabel
 *      (Connector_Type + stereotype); "bevat" wordt lidmaatschap;
 *      kardinaliteiten/rollen/richting op data; een stereotype dat de tabel
 *      niet opsnoepte komt op `data.stereotype` (label op de lijn);
 *   4. het profiel mag per element/connector verrijken of de keuze bijsturen;
 *   5. diagrammen via bouwDiagram (posities, maten, lijndata per diagram).
 */
import { idUitGuid, deelboomPakketten, EA_SCHAAL, kleurUitBgr } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, maakConnectorElement, maakBevat, bouwDiagram } from "./qeaKern.js";

/** @typedef {{objectType: string, stereotype?: string, elementType: string}} ObjectRij */
/** @typedef {{connectorType: string, stereotype?: string, elementType: string}} ConnectorRij */
/**
 * @typedef {Object} EaProfiel
 * @property {string} diagramTypeId - Omnium DiagramType.id
 * @property {{EA_DIAGRAM_TYPES: string[], OBJECTEN: ObjectRij[], CONNECTOREN: ConnectorRij[], RAND_ELEMENTEN: string[], CONTAINERS: string[]}} mapping
 * @property {(d: any, bron: any) => boolean} [diagramPast] - welk t_diagram hier landt (default: Diagram_Type in EA_DIAGRAM_TYPES)
 * @property {(kandidaat: string, o: any, stereotypen: string[], ctx: any) => string|null} [kiesObject] - elementtype bijsturen vóór het element bestaat (bv. boundary-event, gateway-soort)
 * @property {(o: any, elementType: string, ctx: any) => any[]} [compartimenten]
 * @property {(el: any, o: any, ctx: any) => void} [verrijkElement]
 * @property {(kandidaat: string|null, c: any, bron: any, doel: any, ctx: any) => string|null} [kiesConnector]
 * @property {(el: any, c: any, ctx: any) => void} [verrijkConnector]
 * @property {(c: any, type: string, bron: any, doel: any, ctx: any) => boolean} [draaiOm] - bron en doel wisselen (EA tekent bv. een DMN-eis andersom)
 * @property {(ctx: any) => void} [naLezen]
 * @property {(o: any) => ({width:number,height:number}|null)} [vasteMaat]
 * @property {ObjectRij[]} [extraObjecten] - rijen vóór de tabel van het profiel (EA-eigenaardigheden zoals ProvidedInterface)
 * @property {boolean} [ruitAanDoel] - het profiel tekent deel → geheel (ruit aan het doel): niet omdraaien
 */

const STEREO_LOS = /[«»]/g;
export const laag = (s) => String(s || "").replace(STEREO_LOS, "").trim().toLowerCase();

/**
 * Eerste rij die past: met stereotype vóór zonder; een rij met `"*"` als
 * Object_Type/Connector_Type geldt voor elk type (DMN: het stereotype is
 * leidend, EA wisselt het Object_Type per versie) — een exacte typematch wint.
 */
const typePast = (rijType, type) => rijType === type || rijType === "*";
export function zoekObjectRij(OBJECTEN, objectType, stereotypen) {
  const st = new Set(stereotypen.map(laag));
  const metSt = (ster) => OBJECTEN.find((r) => typePast(r.objectType, objectType) && (r.objectType !== "*") === ster && r.stereotype && st.has(laag(r.stereotype)));
  const zonder = (ster) => OBJECTEN.find((r) => typePast(r.objectType, objectType) && (r.objectType !== "*") === ster && !r.stereotype);
  return metSt(true) || metSt(false) || zonder(true) || zonder(false) || null;
}
export function zoekConnectorRij(CONNECTOREN, connectorType, stereotype) {
  const s = laag(stereotype);
  const metSt = (exact) => (s ? CONNECTOREN.find((r) => typePast(r.connectorType, connectorType) && (r.connectorType !== "*") === exact && r.stereotype && laag(r.stereotype) === s) : null);
  const zonder = (exact) => CONNECTOREN.find((r) => typePast(r.connectorType, connectorType) && (r.connectorType !== "*") === exact && !r.stereotype);
  return metSt(true) || metSt(false) || zonder(true) || zonder(false) || null;
}

/** Stereotypen (kleine letters) van de objecten op een diagram — voor diagramPast-keuzes (BPMN vs Eriksson-Penker op "Analysis"). */
const _stereoCache = new WeakMap();
export function stereotypenOpDiagram(bron, d) {
  let per = _stereoCache.get(bron);
  if (!per) {
    per = new Map();
    const objectPerId = new Map((bron.t_object || []).map((o) => [o.Object_ID, o]));
    for (const dobj of bron.t_diagramobjects || []) {
      const o = objectPerId.get(dobj.Object_ID);
      if (!o) continue;
      if (!per.has(dobj.Diagram_ID)) per.set(dobj.Diagram_ID, new Set());
      if (o.Stereotype) per.get(dobj.Diagram_ID).add(laag(o.Stereotype));
    }
    _stereoCache.set(bron, per);
  }
  return per.get(d.Diagram_ID) || new Set();
}

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId: number, profiel: EaProfiel, schaal?: number}} opties
 */
export function qeaNaarProfiel(bron, { packageId, profiel, schaal = EA_SCHAAL }) {
  const { mapping } = profiel;
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const past = profiel.diagramPast || ((d) => mapping.EA_DIAGRAM_TYPES.includes(d.Diagram_Type));
  const diagrammen = (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && past(d, bron));
  const h = maakHulptabellen(bron, schaal, { diagramVoorkeur: diagrammen.map((d) => d.Diagram_ID), vasteMaat: profiel.vasteMaat || null });

  /** @type {Record<string, any>} */
  const elements = {};
  const idVanObject = new Map();
  const idVanConnector = new Map();
  const OBJECTEN = [...(profiel.extraObjecten || []), ...mapping.OBJECTEN];
  const kandidaten = new Map();
  const ctx = { bron, h, elements, idVanObject, idVanConnector, verslag, schaal, pakketIds, diagrammen, objecten: kandidaten };

  // ── 1. Objecten: op de diagrammen + hun kinderen (poorten, parts) ──────
  for (const d of diagrammen) for (const dobj of h.objectenPerDiagram.get(d.Diagram_ID) || []) {
    const o = h.objectPerId.get(dobj.Object_ID);
    if (o) kandidaten.set(o.Object_ID, o);
  }
  for (const o of bron.t_object || []) if (o.ParentID && kandidaten.has(o.ParentID) && !kandidaten.has(o.Object_ID)) kandidaten.set(o.Object_ID, o);
  const stereotypenVan = (o) => {
    const uit = [];
    if (o.Stereotype) uit.push(o.Stereotype);
    for (const s of h.stereoPerGuid.get(o.ea_guid) || []) if (!uit.includes(s)) uit.push(s);
    return uit;
  };
  const rijVan = new Map();
  for (const o of kandidaten.values()) {
    const gevonden = zoekObjectRij(OBJECTEN, o.Object_Type, stereotypenVan(o));
    const gekozen = gevonden && profiel.kiesObject ? profiel.kiesObject(gevonden.elementType, o, stereotypenVan(o), ctx) : gevonden?.elementType || null;
    if (!gekozen) {
      sla(verslag, `${o.Object_Type}${o.Stereotype ? `«${o.Stereotype}»` : ""}`);
      continue;
    }
    const rij = { ...gevonden, elementType: gekozen };
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    rijVan.set(o.Object_ID, rij);
    const isNotitie = rij.elementType === "notitie";
    const data = {
      ...extraData(h, o.ea_guid, o.Object_ID),
      eaPakket: o.Package_ID,
      eaObjectType: o.Object_Type,
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && !isNotitie ? { notes: o.Note } : {}),
      ...(String(o.Abstract) === "1" ? { abstract: true } : {}),
    };
    // Stereotype dat de tabel niet verbruikte: als label op het element.
    const st = stereotypenVan(o);
    if (st.length && !rij.stereotype) data.stereotype = st[0];
    const kleur = kleurUitBgr(o.Backcolor) || h.kleurPerObject.get(o.Object_ID);
    if (kleur) data.kleur = kleur;
    const el = {
      id,
      naam: isNotitie ? "" : o.Name || "",
      elementType: rij.elementType,
      compartimenten: isNotitie ? [] : profiel.compartimenten?.(o, rij.elementType, ctx) || [],
      data,
    };
    if (isNotitie) el.data.tekst = o.Note || o.Name || "";
    elements[id] = el;
    verslag.elementen += 1;
  }
  // Rand-elementen en containers via ParentID.
  for (const o of kandidaten.values()) {
    const id = idVanObject.get(o.Object_ID);
    const ouderId = o.ParentID ? idVanObject.get(o.ParentID) : null;
    if (!id || !ouderId) continue;
    const el = elements[id], ouder = elements[ouderId];
    if (mapping.RAND_ELEMENTEN.includes(el.elementType)) el.data.randVan = ouderId;
    else if (mapping.CONTAINERS.includes(ouder.elementType)) maakBevat(elements, ouderId, id);
    else {
      // Ouder is geen container (bv. een taak ín een BPMN-subproces): hang het
      // element in de dichtstbijzijnde container erboven (de pool). Anders
      // valt het buiten de nesting en tekent de canvas het onder zijn ouder,
      // die als poolkind een laag hoger ligt (Mark, 10-10: "Opgave doen"
      // bedekte "Samenstellen" en "Ondertekenen").
      // De ouder toont inhoud op dit diagram: uitgeklapt (EA zet de naam dan linksboven).
      ouder.data = { ...(ouder.data || {}), uitgeklapt: true };
      let cursor = kandidaten.get(o.ParentID) || h.objectPerId.get(o.ParentID);
      for (let n = 0; cursor?.ParentID && n < 20; n++) {
        const hogerId = idVanObject.get(cursor.ParentID);
        if (hogerId && mapping.CONTAINERS.includes(elements[hogerId]?.elementType)) {
          maakBevat(elements, hogerId, id);
          break;
        }
        cursor = kandidaten.get(cursor.ParentID) || h.objectPerId.get(cursor.ParentID);
      }
    }
  }
  for (const o of kandidaten.values()) {
    const id = idVanObject.get(o.Object_ID);
    if (id) profiel.verrijkElement?.(elements[id], o, ctx);
  }

  // ── 2. Connectoren ─────────────────────────────────────────────────────
  for (const c of bron.t_connector || []) {
    if (c.Connector_Type === "Sequence" || c.Connector_Type === "Collaboration") continue; // berichten: zie naLezen (communication)
    const bronId = idVanObject.get(c.Start_Object_ID), doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) continue;
    const stereotype = c.Stereotype || h.stereoPerGuid.get(c.ea_guid)?.[0] || "";
    const rij = zoekConnectorRij(mapping.CONNECTOREN, c.Connector_Type, stereotype);
    const bronEl = elements[bronId], doelEl = elements[doelId];
    const type = profiel.kiesConnector ? profiel.kiesConnector(rij?.elementType || null, c, bronEl, doelEl, ctx) : rij?.elementType || null;
    if (!type) {
      sla(verslag, `connector ${c.Connector_Type}${stereotype ? `«${stereotype}»` : ""}`);
      continue;
    }
    // Geheel/deel: EA zet de ruit aan de kant met *IsAggregate (2 = compositie).
    const geheelAanDoel = Number(c.DestIsAggregate) > 0;
    const geheelAanBron = Number(c.SourceIsAggregate) > 0;
    if (type === "bevat") {
      // Lidmaatschap: Nesting loopt van lid naar container; aggregatie heeft de ruit bij het geheel.
      const geheel = geheelAanBron ? bronId : doelId;
      const deel = geheel === bronId ? doelId : bronId;
      maakBevat(elements, geheel, deel);
      idVanConnector.set(c.Connector_ID, `${geheel}~bevat~${deel}`);
      verslag.connectoren += 1;
      continue;
    }
    const richting = String(c.Direction || "");
    const data = {
      ...(c.SourceCard ? { bronKardinaliteit: c.SourceCard } : {}),
      ...(c.DestCard ? { doelKardinaliteit: c.DestCard } : {}),
      ...(c.SourceRole ? { bronRol: c.SourceRole } : {}),
      ...(c.DestRole ? { doelRol: c.DestRole } : {}),
      ...(richting === "Source -> Destination" ? { directioneel: true } : {}),
      ...(stereotype && !(rij?.stereotype && laag(rij.stereotype) === laag(stereotype)) ? { stereotype } : {}),
    };
    const vertaald = { elementType: type, naam: c.Name || "", source: bronId, target: doelId, data, omgedraaid: false };
    // Ruit-typen (aggregatie/compositie in onze profielen hebben de ruit aan de bron):
    // staat EA's ruit aan het doel, dan draaien we om — behalve waar het profiel
    // deel → geheel tekent (requirements-aggregatie), dat regelt kiesConnector/verrijk.
    if (/^(aggregatie|compositie)$/.test(type) && geheelAanDoel && !profiel.ruitAanDoel) {
      vertaald.source = doelId;
      vertaald.target = bronId;
      vertaald.omgedraaid = true;
      if (data.bronKardinaliteit || data.doelKardinaliteit) {
        [data.bronKardinaliteit, data.doelKardinaliteit] = [data.doelKardinaliteit, data.bronKardinaliteit];
        [data.bronRol, data.doelRol] = [data.doelRol, data.bronRol];
        for (const k of ["bronKardinaliteit", "doelKardinaliteit", "bronRol", "doelRol"]) if (data[k] === undefined) delete data[k];
      }
    }
    if (profiel.draaiOm?.(c, type, bronEl, doelEl, ctx)) {
      [vertaald.source, vertaald.target] = [vertaald.target, vertaald.source];
      vertaald.omgedraaid = !vertaald.omgedraaid;
    }
    const el = maakConnectorElement(h, c, vertaald);
    profiel.verrijkConnector?.(el, c, ctx);
    elements[el.id] = el;
    idVanConnector.set(c.Connector_ID, el.id);
    verslag.connectoren += 1;
  }

  profiel.naLezen?.(ctx);

  // ── 3. Diagrammen ──────────────────────────────────────────────────────
  const diagrams = {};
  for (const d of diagrammen) {
    const diagram = bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId: profiel.diagramTypeId, elements });
    diagrams[diagram.id] = diagram;
    verslag.diagrammen += 1;
  }
  return { diagramTypeId: profiel.diagramTypeId, elements, diagrams, verslag };
}

/** t_attribute-rijen → velden van een compartiment. */
export function veldenUitAttributen(attrs, fieldType, extra = () => ({})) {
  return attrs.map((a) => ({
    naam: a.Name || "",
    fieldType,
    data: {
      ...(a.ea_guid ? { eaGuid: a.ea_guid } : {}),
      ...(a.Type ? { typeLabel: a.Type } : {}),
      ...(a.Notes ? { notes: a.Notes } : {}),
      ...extra(a),
    },
  }));
}
export function veldenUitOperaties(ops, fieldType = "operatie") {
  return ops.map((op) => ({
    naam: `${op.Name || ""}()`,
    fieldType,
    data: { ...(op.ea_guid ? { eaGuid: op.ea_guid } : {}), ...(op.Type ? { typeLabel: op.Type } : {}), ...(op.Notes ? { notes: op.Notes } : {}) },
  }));
}
