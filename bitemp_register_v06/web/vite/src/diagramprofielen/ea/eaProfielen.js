// @ts-check
/**
 * eaProfielen — de EA-lezersregistratie van de gegevensgestuurde profielen:
 * per profiel de vertaaltabel (`<profiel>/eaMapping.js`, van M3-MOF, 10-10)
 * plus de hooks die niet in een tabel passen. `qeaNaarProfiel` doet de rest.
 *
 * Volgorde = Marks volgorde: component/deployment, object, requirements,
 * business (Eriksson-Penker), xsd, wsdl, composite-structure, communication.
 * Interaction overview landt in `activity` (elementtype `interactiegebruik`);
 * Timing slaan we over (past niet in het M3, M3-MOF §6).
 */
import * as cd from "../component-deployment/eaMapping.js";
import * as ob from "../object/eaMapping.js";
import * as rq from "../requirements/eaMapping.js";
import * as bz from "../business/eaMapping.js";
import * as xs from "../xsd/eaMapping.js";
import * as ws from "../wsdl/eaMapping.js";
import * as cs from "../composite-structure/eaMapping.js";
import * as cm from "../communication/eaMapping.js";
import * as bp from "../bpmn/eaMapping.js";
import * as dm from "../dmn-drd/eaMapping.js";
import { veldenUitAttributen, veldenUitOperaties, laag, stereotypenOpDiagram } from "./qeaNaarProfiel.js";
import { idUitGuid } from "./qeaHulp.js";

/** Diagram met een MDG-technologie in StyleEx (`MDGDgm=XSD::…`). */
const mdgVan = (d) => (String(d.StyleEx || "").match(/MDGDgm=([^;]*)/) || [])[1] || "";
/** Tagged values van een object: { naam: waarde } (laatste waarde bij herhaling). */
const tagsVan = (ctx, o) => Object.fromEntries(Object.entries(ctx.h.tagsPerObject.get(o.Object_ID) || {}).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v]));
const attrs = (ctx, o) => ctx.h.attrsPerObject.get(o.Object_ID) || [];
const ops = (ctx, o) => ctx.h.opsPerObject.get(o.Object_ID) || [];
const classifierNaam = (ctx, o) => (o.Classifier && o.Classifier !== 0 && o.Classifier !== "0" ? ctx.h.classifierPerId.get(o.Classifier)?.Name || "" : "");
const NODE_TYPEN = new Set(["node", "device", "executieomgeving"]);
/** "Analysis" is in EA zowel Eriksson-Penker als BPMN als DMN: de stereotypen op het diagram beslissen. */
const BPMN_STEREOTYPEN = new Set(["activity", "task", "subprocess", "businessprocess", "startevent", "intermediateevent", "endevent", "gateway", "pool", "lane", "dataobject", "datastore", "sequenceflow", "messageflow"]);
const DMN_STEREOTYPEN = new Set(["decision", "inputdata", "businessknowledgemodel", "knowledgesource"]);
const heeft = (bron, d, set) => [...stereotypenOpDiagram(bron, d)].some((st) => set.has(st));
const isBpmnDiagram = (d, bron) => /BPMN/i.test(mdgVan(d)) || (["Analysis", "Business Process", "BPMN2.0"].includes(d.Diagram_Type) && heeft(bron, d, BPMN_STEREOTYPEN));
const isDmnDiagram = (d, bron) => /DMN/i.test(mdgVan(d)) || heeft(bron, d, DMN_STEREOTYPEN);
const tagsVanConnector = (ctx, c) => Object.fromEntries(Object.entries(ctx.h.tagsPerConnector.get(c.Connector_ID) || {}).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v]));
/** EA's lollipops: ProvidedInterface/RequiredInterface zijn kind-objecten van een poort. */
const EXPOSED_INTERFACES = [
  { objectType: "ProvidedInterface", elementType: "interface" },
  { objectType: "RequiredInterface", elementType: "interface" },
];
/** Na het lezen: realisatie (provided) of gebruikt (required) van de poort (of zijn gastheer) naar de interface. */
function koppelExposedInterfaces(ctx) {
  const { elements, idVanObject, verslag } = ctx;
  for (const o of ctx.objecten.values()) {
    if (o.Object_Type !== "ProvidedInterface" && o.Object_Type !== "RequiredInterface") continue;
    const ifId = idVanObject.get(o.Object_ID), poortId = o.ParentID ? idVanObject.get(o.ParentID) : null;
    if (!ifId || !poortId) continue;
    const type = o.Object_Type === "ProvidedInterface" ? "realisatie" : "gebruikt";
    const id = `${poortId}~${type}~${ifId}`;
    elements[id] = { id, naam: "", elementType: type, source: poortId, target: ifId, compartimenten: [], data: { eaAfgeleid: true } };
    verslag.connectoren += 1;
  }
}

/** @type {Record<string, import("./qeaNaarProfiel.js").EaProfiel & {profielId: string, naam: string}>} */
export const EA_PROFIELEN = {
  componentDeployment: {
    profielId: "componentDeployment05",
    naam: "Component/deployment",
    diagramTypeId: "component-deployment",
    mapping: cd,
    extraObjecten: EXPOSED_INTERFACES,
    naLezen: koppelExposedInterfaces,
    // EA-poorten zijn kleine vierkantjes op de rand; vaste maat, gecentreerd op EA's plek.
    vasteMaat: (o) => (o?.Object_Type === "Port" ? { width: 16, height: 16 } : null),
    compartimenten: (o, type, ctx) => {
      const uit = [];
      if (["component", "node", "device", "executieomgeving", "artifact", "deploymentspec"].includes(type) && attrs(ctx, o).length)
        uit.push({ compartmentType: "eigenschappen", velden: veldenUitAttributen(attrs(ctx, o), "eigenschap") });
      if (type === "interface" && ops(ctx, o).length) uit.push({ compartmentType: "operaties", velden: veldenUitOperaties(ops(ctx, o)) });
      return uit;
    },
    verrijkElement: (el, o) => {
      if (el.elementType === "poort" && o.Alias) el.data.typeLabel = o.Alias;
    },
    // Association is alleen een communicatiepad tussen node-typen; anders een dependency.
    kiesConnector: (kandidaat, c, bron, doel) => (kandidaat === "communicatiepad" && !(NODE_TYPEN.has(bron.elementType) && NODE_TYPEN.has(doel.elementType)) ? "dependency" : kandidaat),
  },
  object: {
    profielId: "object05",
    naam: "Object",
    diagramTypeId: "object",
    mapping: ob,
    compartimenten: (o, type) => {
      if (type !== "object" && type !== "multiobject") return [];
      const slots = ob.slotsUitRunState(o.RunState).map((s) => ({ naam: s.naam, fieldType: "slot", data: { typeLabel: s.typeLabel } }));
      return slots.length ? [{ compartmentType: "slots", velden: slots }] : [];
    },
    verrijkElement: (el, o, ctx) => {
      if (el.elementType !== "object" && el.elementType !== "multiobject") return;
      if (o.Object_Type === "Class") el.data.klassifierLabel = o.Name || "";
      else {
        const klasse = classifierNaam(ctx, o);
        if (klasse) el.data.klassifierLabel = klasse;
      }
    },
    // Aggregation zonder Strong is een gewone link.
    kiesConnector: (kandidaat, c) => (kandidaat === "compositie" && String(c.SubType || "") !== "Strong" ? "link" : kandidaat),
  },
  requirements: {
    profielId: "requirements05",
    naam: "Requirements",
    diagramTypeId: "requirements",
    mapping: rq,
    // EA tekent requirements vaak op een "Custom"-diagram met MDG Extended::Requirements.
    diagramPast: (d) => d.Diagram_Type === "Requirements" || (d.Diagram_Type === "Custom" && /Requirements/i.test(mdgVan(d))),
    // Ons aggregatie-type tekent deel → geheel (ruit bij het geheel = doel): niet omdraaien.
    ruitAanDoel: true,
    verrijkElement: (el, o) => {
      if (["requirement", "feature", "issue", "change"].includes(el.elementType)) {
        if (o.Alias) el.data.reqId = o.Alias;
        if (o.Note) el.data.tekst = o.Note;
        if (o.Status) el.data.status = laag(o.Status);
        if (o.PDATA2) el.data.prioriteit = laag(o.PDATA2); // EA: Priority
        if (o.PDATA3) el.data.moeilijkheid = laag(o.PDATA3); // EA: Difficulty
        if (el.elementType === "requirement" && o.Stereotype) el.data.soort = laag(o.Stereotype);
        delete el.data.notes;
        delete el.data.stereotype; // is de soort geworden
      }
      if (el.elementType === "verwijzing") el.data.stereotype = o.Object_Type === "UseCase" ? "use case" : laag(o.Object_Type);
    },
  },
  business: {
    profielId: "business05",
    naam: "Business (Eriksson-Penker)",
    diagramTypeId: "business",
    mapping: bz,
    diagramPast: (d, bron) => d.Diagram_Type === "Analysis" && !isBpmnDiagram(d, bron) && !isDmnDiagram(d, bron),
    // ObjectFlow: naar een proces = invoer, vanaf een proces = uitvoer.
    kiesConnector: (kandidaat, c, bron, doel) =>
      c.Connector_Type === "ObjectFlow" ? (doel.elementType === "proces" ? "invoer" : "uitvoer") : kandidaat,
  },
  xsd: {
    profielId: "xsd05",
    naam: "XML Schema",
    diagramTypeId: "xsd",
    mapping: xs,
    diagramPast: (d) => d.Diagram_Type === "Logical" && /XSD|XML Schema/i.test(mdgVan(d)),
    compartimenten: (o, type, ctx) => {
      const a = attrs(ctx, o);
      const isAttr = (x) => laag(x.Stereotype) === "xsdattribute";
      const occurs = (x) => ({ ...(x.LowerBound ? { minOccurs: x.LowerBound } : {}), ...(x.UpperBound ? { maxOccurs: x.UpperBound === "*" ? "unbounded" : x.UpperBound } : {}) });
      const uit = [];
      if (type === "complexType") {
        const el = a.filter((x) => !isAttr(x)), at = a.filter(isAttr);
        if (el.length) uit.push({ compartmentType: "elementen", velden: veldenUitAttributen(el, "xsElement", occurs) });
        if (at.length) uit.push({ compartmentType: "attributen", velden: veldenUitAttributen(at, "xsAttribute") });
      } else if (type === "simpleType" && a.length) uit.push({ compartmentType: "facets", velden: veldenUitAttributen(a, "xsFacet", (x) => ({ typeLabel: x.Default || x.Type || "" })) });
      else if (type === "enumeration" && a.length) uit.push({ compartmentType: "waarden", velden: a.map((x) => ({ naam: x.Name || "", fieldType: "xsLiteral", data: {} })) });
      else if (type === "group" && a.length) uit.push({ compartmentType: "elementen", velden: veldenUitAttributen(a, "xsElement", occurs) });
      else if (type === "attributeGroup" && a.length) uit.push({ compartmentType: "attributen", velden: veldenUitAttributen(a, "xsAttribute") });
      return uit;
    },
    verrijkElement: (el, o, ctx) => {
      const t = tagsVan(ctx, o);
      for (const k of ["targetNamespace", "prefix", "elementFormDefault", "version", "base", "derivation", "mixed"]) if (t[k] !== undefined && t[k] !== "") el.data[k] = t[k];
    },
    verrijkConnector: (el, c) => {
      if (el.elementType === "vanType") {
        if (c.DestRole) el.data.rolnaam = c.DestRole;
        const m = String(c.DestCard || "").match(/^(\d+)(?:\.\.(\d+|\*))?$/);
        if (m) { el.data.minOccurs = m[1]; el.data.maxOccurs = m[2] === "*" ? "unbounded" : m[2] || m[1]; }
      }
      if (el.elementType === "import") el.data.soort = laag(c.Stereotype).replace(/^xsd/, "") || "";
    },
  },
  wsdl: {
    profielId: "wsdl05",
    naam: "WSDL",
    diagramTypeId: "wsdl",
    mapping: ws,
    diagramPast: (d) => d.Diagram_Type === "Logical" && /WSDL/i.test(mdgVan(d)),
    compartimenten: (o, type, ctx) => {
      const a = attrs(ctx, o), op = ops(ctx, o);
      if (type === "service" && a.length) return [{ compartmentType: "ports", velden: veldenUitAttributen(a, "wsPort") }];
      if ((type === "portType" || type === "binding") && op.length) return [{ compartmentType: "operaties", velden: veldenUitOperaties(op, "wsOperatie").map((v) => ({ ...v, naam: v.naam.replace(/\(\)$/, "") })) }];
      if (type === "message" && a.length) return [{ compartmentType: "parts", velden: veldenUitAttributen(a, "wsPart") }];
      return [];
    },
    verrijkElement: (el, o, ctx) => {
      const t = tagsVan(ctx, o);
      for (const k of ["targetNamespace", "prefix", "protocol", "transport"]) if (t[k] !== undefined && t[k] !== "") el.data[k] = t[k];
      if (t.style) el.data.stijl = t.style;
    },
    verrijkConnector: (el, c) => {
      if (el.elementType === "gebruiktMessage") {
        const st = laag(c.Stereotype);
        if (["input", "output", "fault"].includes(st)) el.data.rol = st;
        if (c.Name) el.data.operatie = c.Name;
      }
    },
  },
  compositeStructure: {
    profielId: "compositeStructure05",
    naam: "Composite structure",
    diagramTypeId: "composite-structure",
    mapping: cs,
    naLezen: koppelExposedInterfaces,
    vasteMaat: (o) => (o?.Object_Type === "Port" ? { width: 16, height: 16 } : null),
    compartimenten: (o, type, ctx) => (["klasse", "part", "collaboratie"].includes(type) && attrs(ctx, o).length ? [{ compartmentType: "attributen", velden: veldenUitAttributen(attrs(ctx, o), "attribuut") }] : []),
    verrijkElement: (el, o, ctx) => {
      if (el.elementType === "part" || el.elementType === "collaboratiegebruik") {
        const t = classifierNaam(ctx, o);
        if (t) el.data.typeLabel = t;
        if (el.elementType === "part" && o.Multiplicity) el.data.multipliciteit = o.Multiplicity;
      }
    },
    verrijkConnector: (el, c) => {
      if (el.elementType === "connector" && c.Connector_Type === "Assembly") el.data.isAssembly = true;
      if (el.elementType === "rolbinding" && c.Name) el.data.rol = c.Name;
    },
  },
  communication: {
    profielId: "communication05",
    naam: "Communication",
    diagramTypeId: "communication",
    mapping: cm,
    verrijkElement: (el, o, ctx) => {
      if (el.elementType !== "object") return;
      if (o.Object_Type === "Class") el.data.klassifierLabel = o.Name || "";
      else {
        const k = classifierNaam(ctx, o);
        if (k) el.data.klassifierLabel = k;
      }
      if (laag(o.Stereotype) === "multiobject") el.data.multi = true;
    },
    // EA heeft één connector per bericht (Sequence/Collaboration, met SeqNo):
    // vouw ze per paar samen tot één link met een berichten-compartiment.
    naLezen: (ctx) => {
      const { bron, elements, idVanObject, idVanConnector, verslag } = ctx;
      const berichten = [];
      for (const c of bron.t_connector || []) {
        if (c.Connector_Type !== "Sequence" && c.Connector_Type !== "Collaboration") continue;
        const source = idVanObject.get(c.Start_Object_ID), target = idVanObject.get(c.End_Object_ID);
        if (!source || !target) continue;
        berichten.push({ id: idUitGuid(c.ea_guid), eaId: c.Connector_ID, source, target, seqNo: c.SeqNo, naam: c.Name || "", ...(laag(c.PDATA1) === "asynchronous" ? { soort: "asynchroon" } : {}) });
      }
      for (const link of cm.vouwBerichtenTotLinks(berichten)) {
        elements[link.id] = {
          id: link.id,
          naam: "",
          elementType: "link",
          source: link.source,
          target: link.target,
          compartimenten: [{ compartmentType: "berichten", velden: link.berichten.map((b) => ({ naam: b.naam, fieldType: "bericht", data: { typeLabel: b.typeLabel, ...(b.soort ? { soort: b.soort } : {}) } })) }],
          data: {},
        };
        for (const b of berichten) if ([b.source, b.target].sort().join("|") === [link.source, link.target].sort().join("|")) idVanConnector.set(b.eaId, link.id);
        verslag.connectoren += 1;
      }
    },
  },
};

EA_PROFIELEN.bpmn = {
  profielId: "bpmnMotor05",
  naam: "BPMN",
  diagramTypeId: "bpmn-motor",
  mapping: bp,
  diagramPast: isBpmnDiagram,
  // Tagged values beslissen over de soort: activityType Sub-Process → subproces,
  // gatewayType → parallel/inclusief, en een IntermediateEvent mét ParentID =
  // activiteit is een boundary-event (rand-element).
  kiesObject: (kandidaat, o, stereotypen, ctx) => {
    const t = tagsVan(ctx, o);
    if (kandidaat === "taak" && /sub-?process/i.test(String(t.activityType || ""))) return "subproces";
    if (kandidaat === "exclusief" && t.gatewayType) return bp.GATEWAY_TYPE[laag(t.gatewayType)] || "exclusief";
    // Boundary-event: alleen als de gastheer een activiteit is (in het GGM hangen
    // tussen-events aan de pool — dat zijn gewone tussen-events).
    const ouder = o.ParentID ? ctx.objecten.get(o.ParentID) : null;
    if (kandidaat === "tussen-event" && ouder && ["activity", "task", "subprocess", "businessprocess"].includes(laag(ouder.Stereotype))) return "boundary-event";
    return kandidaat;
  },
  verrijkElement: (el, o, ctx) => {
    const t = tagsVan(ctx, o);
    if (/-event$/.test(el.elementType)) {
      const soort = bp.EVENT_SOORT[laag(t.eventDefinition || t.trigger || "")];
      if (soort) el.data.soort = soort;
      if (el.elementType === "boundary-event") el.data.onderbrekend = laag(t.cancelActivity) !== "false";
    }
    if (el.elementType === "notitie" && o.Note) el.data.tekst = o.Note;
  },
  // Dependency«Association» is alleen een notitielijn als een uiteinde een annotatie is.
  kiesConnector: (kandidaat, c, bron, doel) => (kandidaat === "notitielijn" && c.Connector_Type !== "NoteLink" && bron.elementType !== "notitie" && doel.elementType !== "notitie" ? null : kandidaat),
  verrijkConnector: (el, c, ctx) => {
    if (el.elementType !== "sequence-flow") return;
    const t = tagsVanConnector(ctx, c);
    const cond = c.PDATA2 || t.conditionExpression;
    if (cond && String(cond) !== "<memo>") el.data.conditie = String(cond);
    if (laag(t.isDefault) === "true" || laag(t.conditionType) === "default") el.data.standaard = true;
    delete el.data.stereotype;
  },
};
EA_PROFIELEN.dmn = {
  profielId: "dmnDrd05",
  naam: "DMN",
  diagramTypeId: "dmn-drd",
  mapping: dm,
  diagramPast: isDmnDiagram,
  verrijkElement: (el, o, ctx) => {
    const t = tagsVan(ctx, o);
    if (el.elementType === "decision" && t.question) el.data.vraag = t.question;
    if (["decision", "inputData", "bkm", "knowledgeSource"].includes(el.elementType) && o.Note) {
      el.data.toelichting = o.Note;
      delete el.data.notes;
    }
    delete el.data.stereotype; // het stereotype ís het type
  },
  kiesConnector: (kandidaat, c, bron, doel) => (kandidaat === "notitielijn" && c.Connector_Type !== "NoteLink" && bron.elementType !== "notitie" && doel.elementType !== "notitie" ? null : kandidaat),
  // EA tekent een eis als Dependency van de beslissing (client) naar wat ze nodig
  // heeft (supplier); in een DRD loopt de pijl van het vereiste naar de beslissing.
  draaiOm: (c, type) => /Req$/.test(type) && (c.Connector_Type === "Dependency" || c.Connector_Type === "Abstraction"),
  verrijkConnector: (el) => {
    delete el.data.stereotype;
  },
};

/** Lezers in Marks volgorde, voor de project-import. */
export const EA_PROFIEL_LEZERS = Object.values(EA_PROFIELEN);

/** EA Diagram_Types die een eigen lezer hebben (voor de klasse-lezer: die slaat ze over). */
export const EIGEN_LEZER_DIAGRAMTYPEN = new Set(["Component", "Deployment", "Object", "Requirements", "Analysis", "CompositeStructure", "Collaboration", "Communication", "InteractionOverview"]);
