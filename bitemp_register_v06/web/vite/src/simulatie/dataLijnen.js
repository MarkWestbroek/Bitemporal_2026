// @ts-check
/**
 * dataLijnen — passen de data-associaties op het procesdiagram bij wat de run met de objecten doet?
 * (ontwerp Simulatie §11.8, stap 4; Mark 16-11)
 *
 * Een data-associatie van een data-object naar een taak zegt "de taak leest dit"; van een taak naar
 * een data-object "de taak schrijft dit"; `richting: "beide"` allebei. Alleen data-objecten met een
 * type doen mee: hun objecten zijn die van dat type of een subtype (typeNamen, dataObjecten.js).
 *
 * Drie toetsen, over het log tot nu toe:
 * - **leest wat er nog niet is**: de taak loopt (zijn eerste regel) en er is nog geen object van het
 *   type van een data-object dat hij leest;
 * - **schrijft niet**: de taak heeft gelopen, heeft een lijn naar een data-object, maar schreef geen
 *   object van dat type;
 * - **schrijft zonder lijn**: de taak schreef een object, op zijn diagram staat een data-object van dat
 *   type, en er loopt geen schrijvende lijn van de taak naartoe.
 *
 * Wat telt als schrijven: een regel met de taak als plek die een object maakt, zet, van toestand
 * laat veranderen of verbindt. Een externe actie (zaak aanmaken, rol koppelen, status zetten) schrijft
 * de zaak: in werkelijkheid verandert die bij de zaakbron, in de simulatie niet op het object.
 * Procesinstanties tellen niet. Puur: de elementen van de andere taal komen van de aanroeper.
 */
import { toestandUit, PROCESINSTANTIE } from "./store.js";
import { typeNamen } from "./dataObjecten.js";

const DATA = new Set(["data-object", "data-store"]);
const ACTIVITEIT = new Set(["taak", "subproces"]);
/** Het object dat een externe actie raakt: de zaak (simulatie.js, ZAAK). */
const ZAAK = "zaak";

/**
 * @typedef {{ soort: "leest-niets"|"schrijft-niet"|"schrijft-zonder-lijn", taak: string, dataObject: string, lijn: string|null, reden: string }} Bevinding
 */

/**
 * @param {{
 *   bpmnElementen: Record<string, any>,
 *   diagrams: Record<string, any>,
 *   elementenVan: (profielId: string) => Record<string, any> | null,
 *   log: any[],
 * }} p
 * @returns {{ bevindingen: Bevinding[], lijnen: Record<string, Bevinding[]>, taken: Record<string, Bevinding[]> }}
 */
export function toetsLijnen({ bpmnElementen, diagrams, elementenVan, log }) {
  const el = bpmnElementen || {};
  const naam = (id) => el[id]?.naam || id;
  const toestandNaam = (d) => (d.data?.toestand ? `${d.naam} [${d.data.toestand}]` : d.naam || d.id);

  // Data-objecten met een type: de namen (klein) van hun type en subtypen.
  /** @type {Map<string, Set<string>>} */
  const namenVan = new Map();
  /** @type {Map<string, string>} de naam van het type van een data-object */
  const typeVan = new Map();
  for (const d of Object.values(el)) {
    if (!DATA.has(d?.elementType)) continue;
    const ref = d.data?.type;
    if (!ref?.profielId || !ref?.elementId) continue;
    const taal = elementenVan(ref.profielId) || {};
    namenVan.set(d.id, typeNamen(ref.elementId, taal));
    typeVan.set(d.id, taal[ref.elementId]?.naam || ref.elementId);
  }

  // De lijnen tussen een getypt data-object en een activiteit.
  const lijnen = Object.values(el)
    .filter((c) => c?.elementType === "data-associatie")
    .map((c) => {
      const vanData = namenVan.has(c.source) && ACTIVITEIT.has(el[c.target]?.elementType);
      const naarData = namenVan.has(c.target) && ACTIVITEIT.has(el[c.source]?.elementType);
      if (!vanData && !naarData) return null;
      const beide = c.data?.richting === "beide";
      return { id: c.id, taak: vanData ? c.target : c.source, dataObject: vanData ? c.source : c.target, leest: vanData || beide, schrijft: naarData || beide };
    })
    .filter(Boolean);

  // Per taak: de diagrammen waarop hij staat, en de data-objecten daarop.
  const dataOpDiagramVan = (taak) => {
    const uit = new Set();
    for (const dg of Object.values(diagrams || {})) {
      const ids = (dg.nodes || []).map((n) => n.elementId);
      if (!ids.includes(taak)) continue;
      for (const id of ids) if (namenVan.has(id)) uit.add(id);
    }
    return uit;
  };

  /** @type {Bevinding[]} */
  const bevindingen = [];
  const gelopen = new Set();
  /** @type {Map<string, Map<string, string>>} taak → (object-id → type) */
  const geschreven = new Map();

  log.forEach((regel, i) => {
    const taak = regel.plek;
    if (!taak || !ACTIVITEIT.has(el[taak]?.elementType)) return;
    const eerste = !gelopen.has(taak);
    gelopen.add(taak);
    const na = toestandUit(log, i + 1);
    if (eerste) {
      const voor = toestandUit(log, i);
      const aanwezig = Object.values(voor.objecten).filter((o) => o.type !== PROCESINSTANTIE);
      for (const l of lijnen) {
        if (l.taak !== taak || !l.leest) continue;
        const namen = namenVan.get(l.dataObject);
        if (aanwezig.some((o) => namen.has(String(o.type).toLowerCase()))) continue;
        bevindingen.push({ soort: "leest-niets", taak, dataObject: l.dataObject, lijn: l.id, reden: `${naam(taak)} leest ${toestandNaam(el[l.dataObject])}, maar er is nog geen object van type ${typeVan.get(l.dataObject)} (of een subtype)` });
      }
    }
    const ids = new Set();
    for (const w of regel.wijzigingen || []) {
      if (["maak", "zet", "overgang"].includes(w.soort) && w.id) ids.add(w.id);
      if (w.soort === "verbind" && w.van) ids.add(w.van);
      if (w.soort === "extern" && na.objecten[ZAAK]) ids.add(ZAAK);
    }
    for (const id of ids) {
      const o = na.objecten[id];
      if (!o || o.type === PROCESINSTANTIE) continue;
      if (!geschreven.has(taak)) geschreven.set(taak, new Map());
      geschreven.get(taak).set(id, o.type);
    }
  });

  for (const l of lijnen) {
    if (!l.schrijft || !gelopen.has(l.taak)) continue;
    const namen = namenVan.get(l.dataObject);
    const typen = [...(geschreven.get(l.taak)?.values() || [])];
    if (typen.some((t) => namen.has(String(t).toLowerCase()))) continue;
    bevindingen.push({ soort: "schrijft-niet", taak: l.taak, dataObject: l.dataObject, lijn: l.id, reden: `${naam(l.taak)} schrijft ${toestandNaam(el[l.dataObject])} volgens de lijn, maar raakte in deze run geen object van type ${typeVan.get(l.dataObject)} (of een subtype)` });
  }

  for (const [taak, objecten] of geschreven) {
    const opDiagram = dataOpDiagramVan(taak);
    for (const [id, type] of objecten) {
      for (const d of opDiagram) {
        if (!namenVan.get(d).has(String(type).toLowerCase())) continue;
        if (lijnen.some((l) => l.taak === taak && l.dataObject === d && l.schrijft)) continue;
        const leest = lijnen.find((l) => l.taak === taak && l.dataObject === d && l.leest);
        bevindingen.push({
          soort: "schrijft-zonder-lijn",
          taak,
          dataObject: d,
          lijn: leest?.id || null,
          reden: `${naam(taak)} schrijft ${id} (${type}), maar er loopt geen schrijvende lijn naar ${toestandNaam(el[d])}${leest ? " (alleen een lezende; zet de richting op lezen en schrijven)" : ""}`,
        });
      }
    }
  }

  const perSleutel = (sleutel) => {
    /** @type {Record<string, Bevinding[]>} */
    const uit = {};
    for (const b of bevindingen) {
      const k = b[sleutel];
      if (!k) continue;
      (uit[k] ||= []).push(b);
    }
    return uit;
  };
  return { bevindingen, lijnen: perSleutel("lijn"), taken: perSleutel("taak") };
}
