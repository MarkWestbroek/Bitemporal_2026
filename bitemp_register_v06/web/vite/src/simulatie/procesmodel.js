// @ts-check
/**
 * procesmodel — leest de processen uit een BPMN-model op de motor (profiel
 * bpmn-motor), voor de simulatie. Ontwerp §9.1.
 *
 * Een proces is een diagram: er is geen proceselement. Welke elementen erbij
 * horen volgt uit de `nodes` van het diagram; een pool met zijn leden die
 * buiten het proces valt is een deelnemer (`deelnemersBuitenProces`, zoals de
 * BPMN-schrijver). De process-id staat in het e-dienstmodel (artefact van
 * soort `bpmn`, `bron.diagram`); zonder e-dienst is elk diagram met een
 * startevent een proces, met een id uit de naam.
 *
 * Puur.
 */
import { deelnemersBuitenProces, bpmnIdUit } from "../transformatie/bpmnXmlSchrijver.js";

/**
 * @typedef {Object} Proces
 * @property {string} id - process-id
 * @property {string} naam
 * @property {string} diagramId
 * @property {Set<string>} elementen - de stroomelementen van het proces
 * @property {Map<string, any[]>} uit - element-id → uitgaande sequence flows
 * @property {Map<string, any[]>} in - element-id → inkomende sequence flows
 * @property {Map<string, string>} partner - element-id → naam van de pool buiten het proces waarmee het een bericht wisselt
 */

/**
 * @param {any} modelBestand - {model: {elements, diagrams}} of het model zelf
 * @param {any} [edienst]
 * @returns {{elementen: Record<string, any>, processen: Proces[]}}
 */
export function leesProcessen(modelBestand, edienst) {
  const model = modelBestand?.model || modelBestand;
  const elementen = model?.elements || {};
  const diagrammen = Object.values(model?.diagrams || {});
  const aangewezen = (edienst?.artefacten || []).filter((a) => a.soort === "bpmn");
  const keuze = aangewezen.length
    ? aangewezen.map((a) => ({ id: a.identifier, diagram: diagrammen.find((d) => d.naam === a.bron?.diagram || d.id === a.bron?.diagram) })).filter((k) => k.diagram)
    : diagrammen
        .filter((d) => (d.nodes || []).some((n) => elementen[n.elementId]?.elementType === "start-event"))
        .map((d) => ({ id: bpmnIdUit(d.naam), diagram: d }));

  const flows = Object.values(elementen).filter((e) => e.elementType === "sequence-flow" && e.source && e.target);
  const berichten = Object.values(elementen).filter((e) => e.elementType === "message-flow" && e.source && e.target);

  const processen = keuze.map(({ id, diagram }) => {
    const { buiten } = deelnemersBuitenProces(model, diagram);
    const eigen = new Set((diagram.nodes || []).map((n) => n.elementId).filter((eid) => elementen[eid] && !buiten.has(eid) && !["pool", "lane", "notitie", "data-object", "data-store"].includes(elementen[eid].elementType)));
    const uit = new Map();
    const inkomend = new Map();
    for (const f of flows) {
      if (!eigen.has(f.source) || !eigen.has(f.target)) continue;
      uit.set(f.source, [...(uit.get(f.source) || []), f]);
      inkomend.set(f.target, [...(inkomend.get(f.target) || []), f]);
    }
    // Een message flow tussen een element van het proces en iets daarbuiten: een partner.
    const poolNaam = (eid) => {
      let e = elementen[eid];
      const gezien = new Set();
      while (e && e.elementType !== "pool" && !gezien.has(e.id)) {
        gezien.add(e.id);
        const ouder = Object.values(elementen).find((b) => b.elementType === "bevat" && b.target === e.id);
        e = ouder ? elementen[ouder.source] : null;
      }
      return e?.naam || "een andere partij";
    };
    const partner = new Map();
    for (const b of berichten) {
      if (eigen.has(b.source) && buiten.has(b.target)) partner.set(b.source, poolNaam(b.target));
      if (eigen.has(b.target) && buiten.has(b.source)) partner.set(b.target, poolNaam(b.source));
    }
    return { id, naam: diagram.naam, diagramId: diagram.id, elementen: eigen, uit, in: inkomend, partner };
  });
  return { elementen, processen };
}

/**
 * Een e-dienstmodel met andere processen: de artefacten van soort `bpmn` vervangen door
 * `processen` ({identifier, diagram}). Voor een model dat de processen anders indeelt dan het
 * e-dienstmodel (het GPK-voorbeeld in vier processen, ontwerp §11.6); de rest blijft gelijk.
 * @param {any} edienst
 * @param {{identifier: string, diagram: string}[]} processen
 */
export function metProcessen(edienst, processen) {
  if (!edienst || !processen?.length) return edienst;
  const anders = (edienst.artefacten || []).filter((a) => a.soort !== "bpmn");
  const bpmn = processen.map((p) => ({ soort: "bpmn", identifier: p.identifier, bron: { model: "project:bpmnMotor05", diagram: p.diagram } }));
  return { ...edienst, artefacten: [...anders, ...bpmn] };
}

/** Het startevent zonder trigger van een proces (of null). */
export const gewoneStart = (proces, elementen) =>
  [...proces.elementen].map((id) => elementen[id]).find((e) => e.elementType === "start-event" && !e.data?.soort) || null;

/**
 * Waar een proces begint als je het zelf start: het startevent zonder trigger,
 * en anders zijn eerste startevent (een proces dat op een bericht start, start
 * je dan alsof dat bericht binnenkomt).
 */
export const startVan = (proces, elementen) =>
  gewoneStart(proces, elementen) || [...proces.elementen].map((id) => elementen[id]).find((e) => e.elementType === "start-event") || null;

/** Het proces met een message start event voor dit bericht, en dat event. */
export function startOpBericht(processen, elementen, naam) {
  for (const proces of processen) {
    const start = [...proces.elementen].map((id) => elementen[id]).find((e) => e.elementType === "start-event" && e.data?.soort === "bericht" && e.data?.bericht === naam);
    if (start) return { proces, start };
  }
  return null;
}
