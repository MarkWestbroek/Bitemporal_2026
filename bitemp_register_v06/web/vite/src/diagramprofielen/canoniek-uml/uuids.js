// @ts-check
/**
 * uuids — identiteit binnen de tool voor de modelelementen van canoniek-uml (besluit Mark
 * 31-10): entiteit, gegevenselement, relatie, enumeratie, gegevenstype, referentielijst-
 * instantie en hun velden. De uuid gaat mee in V3 (`uuid`, ook naar codegen/BACKEND) en is
 * de sleutel voor de delta-import (v3DeltaImport.js); artefacten blijven op naampad.
 *
 * Een uuid wordt nooit bij een import bedacht (dan zou een her-import van hetzelfde
 * bestand zonder uuid niet meer op id matchen), maar bij een V3-export uit de Studio:
 * `ontbrekendeUuids` levert de patches, `vulUuids` zet ze in de store, zodat de volgende
 * export dezelfde uuid's draagt.
 */

/** Elementsoorten die een uuid krijgen. */
export const UUID_SOORTEN = new Set(["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"]);

const nieuweUuid = () => globalThis.crypto.randomUUID();

/**
 * Patches (voor updateElementen) voor elementen en velden zonder uuid.
 * @param {{elements?: Record<string, any>}} state
 * @param {() => string} [maak]
 * @returns {Record<string, {data?: {uuid: string}, compartimenten?: any[]}>}
 */
export function ontbrekendeUuids(state, maak = nieuweUuid) {
  const patches = {};
  for (const el of Object.values(state?.elements || {})) {
    if (!el || !UUID_SOORTEN.has(el.elementType)) continue;
    const patch = {};
    if (!el.data?.uuid) patch.data = { uuid: maak() };
    let veldenNieuw = false;
    const compartimenten = (el.compartimenten || []).map((c) => {
      if (c.compartmentType !== "velden") return c;
      return {
        ...c,
        velden: (c.velden || []).map((v) => {
          if (v.data?.uuid || !(v.naam || "").trim()) return v;
          veldenNieuw = true;
          return { ...v, data: { ...(v.data || {}), uuid: maak() } };
        }),
      };
    });
    if (veldenNieuw) patch.compartimenten = compartimenten;
    if (patch.data || patch.compartimenten) patches[el.id] = patch;
  }
  return patches;
}

/**
 * Geef alle modelelementen in de store een uuid (één stap; niets als ze er al zijn).
 * @param {{getState: () => any}} store - een diagramcore-store
 * @returns {number} aantal bijgewerkte elementen
 */
export function vulUuids(store) {
  const patches = ontbrekendeUuids(store.getState());
  const n = Object.keys(patches).length;
  if (n) store.getState().updateElementen(patches);
  return n;
}
