// @ts-check
/**
 * dataObjecten — welk object van de simulatie hoort bij welk data-object op het procesdiagram
 * (ontwerp Simulatie §11.8, stap 3; Mark 15-11).
 *
 * Een BPMN-data-object heeft een type: een verwijzing `{profielId, elementId}` naar een element
 * met M3-aard "gegevens" (bv. de cm-entiteit Aanvraag). Een object in de simulatie hoort erbij als
 * zijn type die naam heeft, of de naam van een subtype (generalisatie sub → super, ook over meer
 * stappen): een GehandicaptenparkeerkaartAanvraag is een Aanvraag. Hoofdletters tellen niet.
 *
 * Per data-object: de objecten met hun versie (versiesVan, store.js), of ze in de laatste stap
 * veranderden, hun toestand (`state` of `status`) en of die klopt met de toestand die het model
 * op het data-object zet (BPMN dataState, "[ingediend]"). Lege modeltoestand = niets te toetsen.
 *
 * Puur: de elementen van de andere taal komen van de aanroeper.
 */
import { versiesVan, PROCESINSTANTIE } from "./store.js";

/**
 * De namen (kleine letters) van een element en al zijn subtypen.
 * @param {string} elementId
 * @param {Record<string, any>} elementen - de elementen van de taal van het type
 * @returns {Set<string>}
 */
export function typeNamen(elementId, elementen) {
  const uit = new Set();
  const subs = new Map(); // super → [sub]
  for (const c of Object.values(elementen || {})) {
    if (c?.elementType !== "generalisatie" || !c.source || !c.target) continue;
    if (!subs.has(c.target)) subs.set(c.target, []);
    subs.get(c.target).push(c.source);
  }
  const bezocht = new Set();
  const rij = [elementId];
  while (rij.length) {
    const id = rij.shift();
    if (!id || bezocht.has(id)) continue;
    bezocht.add(id);
    const naam = elementen?.[id]?.naam;
    if (naam) uit.add(String(naam).toLowerCase());
    rij.push(...(subs.get(id) || []));
  }
  return uit;
}

/** De toestand van een object zoals de simulatie hem kent. */
export const toestandVan = (data) => {
  const w = data?.state ?? data?.status;
  return w === undefined || w === null || w === "" ? null : String(w);
};

/**
 * @param {{
 *   bpmnElementen: Record<string, any>,
 *   elementenVan: (profielId: string) => Record<string, any> | null,
 *   toestand: { objecten: Record<string, any> } | null,
 *   log: any[],
 * }} p
 * @returns {Record<string, { typeNaam: string, modelToestand: string|null,
 *   objecten: { id: string, type: string, versie: number, gewijzigd: boolean, toestand: string|null, klopt: boolean|null }[] }>}
 *   per data-object-id (alleen data-objecten en data stores met een type)
 */
export function objectenBijDataObjecten({ bpmnElementen, elementenVan, toestand, log }) {
  /** @type {Record<string, any>} */
  const uit = {};
  const objecten = Object.values(toestand?.objecten || {}).filter((o) => o.type !== PROCESINSTANTIE);
  for (const el of Object.values(bpmnElementen || {})) {
    if (el?.elementType !== "data-object" && el?.elementType !== "data-store") continue;
    const ref = el.data?.type;
    if (!ref?.profielId || !ref?.elementId) continue;
    const elementen = elementenVan(ref.profielId);
    const namen = typeNamen(ref.elementId, elementen || {});
    const modelToestand = el.data?.toestand ? String(el.data.toestand).trim() || null : null;
    uit[el.id] = {
      typeNaam: elementen?.[ref.elementId]?.naam || ref.elementId,
      modelToestand,
      objecten: objecten
        .filter((o) => namen.has(String(o.type).toLowerCase()))
        .map((o) => {
          const versies = versiesVan(log, o.id);
          const laatste = versies[versies.length - 1];
          const t = toestandVan(o.data);
          return {
            id: o.id,
            type: o.type,
            versie: versies.length,
            gewijzigd: !!laatste && laatste.nr === log.length,
            toestand: t,
            klopt: modelToestand && t ? modelToestand.toLowerCase() === t.toLowerCase() : null,
          };
        }),
    };
  }
  return uit;
}
