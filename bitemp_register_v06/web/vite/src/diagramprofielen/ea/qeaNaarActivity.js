// @ts-check
/**
 * qeaNaarActivity — lezer: EA-activiteitendiagrammen → het activity-profiel.
 *
 * Hoe EA een activity opslaat (onderzoek §6.2): de knopen hangen via
 * `ParentID` onder een Activity-element dat zelf níet op het diagram staat
 * (`t_diagram.ParentID` wijst ernaar). Een call-activity is een Action zonder
 * naam met `Classifier` → de aangeroepen Activity en `kind=CallBehavior` in de
 * CustomProperties; pins zijn ActionPins met `ParentID` = de actie; guards
 * staan in `t_connector.PDATA2`; begin/eind zijn StateNodes met `NType`
 * 100/101/102.
 *
 * Omnium: EA-Activity ↔ diagram; aanroep → `gedragDiagramId` als het
 * aangeroepen diagram in dezelfde import zit; pins als rand-element
 * (`data.randVan`); partities als container (`bevat`).
 */
import { kleurUitBgr, idUitGuid, deelboomPakketten, EA_SCHAAL } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, maakConnectorElement, maakBevat, bouwDiagram, diagramId } from "./qeaKern.js";

export const ACTIVITY_DIAGRAMTYPE = "activity";

/** Typen van het activity-profiel die een knoop op het diagram zijn (geen pin/partitie/notitie). */
const KNOPEN = new Set(["begin", "actie", "aanroep", "beslissing", "fork", "object", "eind", "flow-eind"]);

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 */
export function qeaNaarActivity(bron, { packageId, diagramTypeId = ACTIVITY_DIAGRAMTYPE, schaal = EA_SCHAAL }) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const h = maakHulptabellen(bron, schaal);

  const activityDiagrammen = (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type === "Activity");
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && d.Diagram_Type !== "Activity")) {
    sla(verslag, `diagram ${d.Diagram_Type}`);
  }
  /** Object_IDs die op een activity-diagram staan. */
  const opActivityDiagram = new Set();
  for (const d of activityDiagrammen) for (const o of h.objectenPerDiagram.get(d.Diagram_ID) || []) opActivityDiagram.add(o.Object_ID);
  /** De frames (Activity-elementen waar een diagram in tekent) worden géén element. */
  const frames = new Set(activityDiagrammen.map((d) => d.ParentID).filter(Boolean));

  /** @type {Record<string, any>} */
  const elements = {};
  const idVanObject = new Map();

  // ── Elementen: alleen wat op een activity-diagram staat (of eronder hangt) ──
  const kandidaatIds = new Set();
  for (const o of bron.t_object || []) if (opActivityDiagram.has(o.Object_ID) || frames.has(o.ParentID)) kandidaatIds.add(o.Object_ID);
  // Kinderen van kandidaten (pins die EA niet tekent) horen bij het model.
  for (const o of bron.t_object || []) if (o.ParentID && kandidaatIds.has(o.ParentID)) kandidaatIds.add(o.Object_ID);
  const kandidaten = (bron.t_object || []).filter((o) => kandidaatIds.has(o.Object_ID));
  for (const o of kandidaten) {
    if (frames.has(o.Object_ID)) continue;
    const vertaald = vertaalObject(o, h);
    if (!vertaald) {
      sla(verslag, o.Object_Type);
      continue;
    }
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    const data = {
      ...extraData(h, o.ea_guid, o.Object_ID),
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && vertaald.elementType !== "notitie" ? { notes: o.Note } : {}),
      ...vertaald.data,
    };
    const kleur = kleurUitBgr(o.Backcolor);
    if (kleur) data.kleur = kleur;
    elements[id] = { id, naam: vertaald.naam, elementType: vertaald.elementType, compartimenten: [], data };
    verslag.elementen += 1;
  }
  // Tweede ronde: verwijzingen die een element-id nodig hebben.
  for (const o of kandidaten) {
    const id = idVanObject.get(o.Object_ID);
    if (!id) continue;
    const el = elements[id];
    if (el.elementType === "pin") {
      const gastheer = idVanObject.get(o.ParentID);
      if (gastheer) el.data.randVan = gastheer;
    }
    if (el.elementType === "aanroep") {
      const doelDiagramId = h.diagramPerFrame.get(o.Classifier);
      const doelDiagram = doelDiagramId != null ? activityDiagrammen.find((d) => d.Diagram_ID === doelDiagramId) : null;
      if (doelDiagram) el.data.gedragDiagramId = diagramId(doelDiagram);
    }
    // Partitie-lidmaatschap: ParentID = ActivityPartition.
    const ouder = o.ParentID ? elements[idVanObject.get(o.ParentID) || ""] : null;
    if (ouder?.elementType === "partitie" && el.elementType !== "pin") maakBevat(elements, ouder.id, id);
  }

  // ── Connectoren ───────────────────────────────────────────────────────
  const idVanConnector = new Map();
  for (const c of bron.t_connector || []) {
    const bronId = idVanObject.get(c.Start_Object_ID);
    const doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) continue; // buiten het activity-deel (klassediagram, use cases)
    const vertaald = vertaalConnector(c, bronId, doelId, elements);
    if (!vertaald) {
      sla(verslag, `connector ${c.Connector_Type}`);
      continue;
    }
    const el = maakConnectorElement(h, c, vertaald);
    idVanConnector.set(c.Connector_ID, el.id);
    elements[el.id] = el;
    verslag.connectoren += 1;
  }

  // ── Diagrammen ────────────────────────────────────────────────────────
  /** @type {Record<string, any>} */
  const diagrams = {};
  for (const d of activityDiagrammen) {
    const diagram = bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId, elements });
    diagrams[diagram.id] = diagram;
    verslag.diagrammen += 1;
  }

  return { diagramTypeId, elements, diagrams, verslag };
}

/**
 * EA-object → activity-elementtype met naam en extra data; null = onbekend.
 * @returns {{elementType:string, naam:string, data:Record<string,any>}|null}
 */
function vertaalObject(o, h) {
  const naam = o.Name || "";
  switch (o.Object_Type) {
    case "Action": {
      const kind = h.customPerGuid.get(o.ea_guid)?.kind || "";
      if (kind === "CallBehavior" || (o.Classifier && h.classifierPerId.get(o.Classifier)?.Object_Type === "Activity")) {
        const doel = h.classifierPerId.get(o.Classifier);
        return { elementType: "aanroep", naam: naam || doel?.Name || "", data: { ...(doel ? { aanroept: doel.Name } : {}) } };
      }
      return { elementType: "actie", naam, data: { ...(kind ? { soort: kind } : {}) } };
    }
    case "Activity":
      // Een geneste/geplaatste Activity (niet het frame) tekent als actie.
      return { elementType: "actie", naam, data: { eaType: "Activity" } };
    case "ActionPin": {
      const type = o.Classifier ? h.classifierPerId.get(o.Classifier)?.Name : null;
      const richting = h.customPerGuid.get(o.ea_guid)?.kind;
      return { elementType: "pin", naam, data: { ...(type ? { typeLabel: type } : {}), ...(richting ? { richting } : {}) } };
    }
    case "Decision":
    case "MergeNode":
      return { elementType: "beslissing", naam, data: {} };
    case "Synchronization":
      return { elementType: "fork", naam, data: {} };
    case "StateNode":
      if (Number(o.NType) === 100) return { elementType: "begin", naam: "", data: { ...(naam ? { notes: naam } : {}) } };
      if (Number(o.NType) === 101) return { elementType: "eind", naam, data: {} };
      if (Number(o.NType) === 102) return { elementType: "flow-eind", naam, data: {} };
      return null;
    case "Object":
    case "ObjectNode":
    case "CentralBufferNode":
    case "DataStore":
      return { elementType: "object", naam, data: {} };
    case "ActivityPartition":
      return { elementType: "partitie", naam, data: {} };
    case "Note":
    case "Text":
      return { elementType: "notitie", naam: "", data: { tekst: o.Note || naam } };
    default:
      return null;
  }
}

function vertaalConnector(c, bronId, doelId, elements) {
  const bron = elements[bronId]?.elementType, doel = elements[doelId]?.elementType;
  switch (c.Connector_Type) {
    case "ControlFlow":
    case "ObjectFlow": {
      const guard = c.PDATA2 || "";
      const objectKant = ["pin", "object"].includes(bron) || ["pin", "object"].includes(doel);
      if (c.Connector_Type === "ObjectFlow" || objectKant) {
        return { elementType: "objectstroom", naam: c.Name || "", source: bronId, target: doelId, data: { ...(guard ? { guard } : {}) } };
      }
      return { elementType: "controlestroom", naam: c.Name || "", source: bronId, target: doelId, data: { ...(guard ? { guard } : {}) } };
    }
    case "NoteLink": {
      const bronIsNotitie = bron === "notitie";
      if (bronIsNotitie === (doel === "notitie")) return null;
      return {
        elementType: "notitielijn",
        naam: "",
        source: bronIsNotitie ? bronId : doelId,
        target: bronIsNotitie ? doelId : bronId,
        data: {},
        omgedraaid: !bronIsNotitie,
      };
    }
    default:
      return null;
  }
}

export { KNOPEN };
