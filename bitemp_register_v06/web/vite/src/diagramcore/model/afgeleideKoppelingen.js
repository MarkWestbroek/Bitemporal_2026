// @ts-check
/**
 * afgeleideKoppelingen — kruisverbanden die uit een eigenschap volgen, niet los getekend
 * (Mark 15-11: "de tracering is sowieso van belang").
 *
 * Een eigenschap met datatype `element-verwijzing` en een `koppelsoort` (bv. het type van een
 * BPMN-data-object: `koppelsoort: "traceert naar"`) legt al vast dat dit element naar dat element
 * in een andere taal wijst. Een losse koppeling erbij zou hetzelfde feit op twee plekken bewaren
 * (en uit elkaar lopen); daarom leiden we de koppeling af: de waarde van de eigenschap ís de bron.
 *
 * De afgeleide link heeft de vorm van een gewone link uit de koppelingen-store
 * (`{id, rij, kolom, soort}`), zodat `metKoppelingen` hem als lijn tekent en "Gerelateerde
 * elementen" hem volgt. Hij heeft `afgeleid: true` en een id met het voorvoegsel `afgeleid:`;
 * wijzigen of weghalen gaat via de eigenschap, niet via de lijn.
 *
 * Puur en store-loos.
 */

export const AFGELEID_PREFIX = "afgeleid:";

/** Datatypes waarvan de waarde `{profielId, elementId, …}` is. */
const VERWIJZINGEN = new Set(["element-verwijzing", "veld-verwijzing"]);

/** @param {unknown} linkId */
export const isAfgeleideLink = (linkId) => typeof linkId === "string" && linkId.startsWith(AFGELEID_PREFIX);

/**
 * @param {{ profielId: string, elements: Record<string, any>, elementTypes: any[] }} p
 * @returns {{ id: string, rij: {profielId: string, elementId: string}, kolom: {profielId: string, elementId: string},
 *   soort: string, afgeleid: true, eigenschap: string }[]}
 */
export function afgeleideKoppelingen({ profielId, elements, elementTypes }) {
  /** @type {Map<string, any[]>} eigenschappen met een koppelsoort, per elementtype */
  const perType = new Map();
  for (const t of elementTypes || []) {
    // Ook "veld-verwijzing" (16-11): die wijst naar een veld van een element; het kruisverband
    // loopt naar dat element.
    const props = (t?.properties || []).filter((p) => p?.koppelsoort && VERWIJZINGEN.has(p?.datatype));
    if (props.length) perType.set(t.id, props);
  }
  if (!perType.size) return [];
  const uit = [];
  for (const el of Object.values(elements || {})) {
    for (const p of perType.get(el?.elementType) || []) {
      const ref = el?.data?.[p.key];
      if (!ref?.profielId || !ref?.elementId) continue;
      uit.push({
        id: `${AFGELEID_PREFIX}${profielId}:${el.id}:${p.key}`,
        rij: { profielId, elementId: el.id },
        kolom: { profielId: ref.profielId, elementId: ref.elementId },
        soort: p.koppelsoort,
        afgeleid: /** @type {const} */ (true),
        eigenschap: p.label || p.key,
      });
    }
  }
  return uit;
}
