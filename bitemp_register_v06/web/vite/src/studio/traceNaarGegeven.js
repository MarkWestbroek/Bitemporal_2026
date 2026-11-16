// @ts-check
/**
 * traceNaarGegeven — een getekende lijn «traceert naar» van een DMN-invoergegeven wordt het
 * gegeven van dat invoergegeven (Mark 16-11).
 *
 * Het gegeven (eigenschap `gegeven`, datatype "veld-verwijzing") is de bron; de lijn volgt eruit
 * als afgeleide koppeling (diagramcore/model/afgeleideKoppelingen.js). Een met de hand getekende
 * lijn zou hetzelfde feit dubbel bewaren. Daarom zetten we haar om:
 *   - het element waar de lijn naar wijst wordt het element van het gegeven;
 *   - heeft dat element precies één veld, dan wordt dat het veld; bij meer blijft het veld open
 *     (kiezen in Eigenschappen);
 *   - de getekende lijn verdwijnt; de afgeleide lijn neemt haar plaats in.
 * Wijst het gegeven al naar hetzelfde element, dan verdwijnt alleen de lijn (dubbel). Wijst het
 * naar een ander element, dan blijft de lijn staan: dat is een keuze voor de gebruiker.
 *
 * Puur: `planTraceOmzetting` zegt wat er moet gebeuren; `koppelTraceOmzetting` (studio) voert
 * het uit, bij elke wijziging van de koppelingen of van een DMN-model.
 */

export const TRACE_SOORT = "traceert naar";

/**
 * De velden van een element (alle compartimenten), als [{naam, uuid, type}]. Een veld heeft geen
 * eigen id: binnen het element is de naam de sleutel, en de uuid (als die er is) de blijvende binding.
 * @param {any} element
 */
export function veldenVanElement(element) {
  const uit = [];
  for (const c of element?.compartimenten || []) {
    for (const v of c.velden || []) {
      if (v?.naam) uit.push({ naam: v.naam, uuid: v.data?.uuid || "", type: v.data?.typeLabel || "" });
    }
  }
  return uit;
}

/** Het gegeven bij een element: met het veld als het er precies één heeft. */
export function gegevenVoor(profielId, element) {
  const velden = veldenVanElement(element);
  const veld = velden.length === 1 ? velden[0] : null;
  return { profielId, elementId: element.id, ...(veld ? { veldNaam: veld.naam, ...(veld.uuid ? { uuid: veld.uuid } : {}) } : {}) };
}

/**
 * @param {{
 *   links: {id: string, rij: {profielId: string, elementId: string}, kolom: {profielId: string, elementId: string}, soort: string, omgekeerd?: boolean}[],
 *   dmnProfielen: string[],
 *   elementVan: (ref: {profielId: string, elementId: string}) => any,
 * }} p
 * @returns {{wis: string[], zet: {profielId: string, elementId: string, gegeven: any}[]}}
 */
export function planTraceOmzetting({ links, dmnProfielen, elementVan }) {
  const dmn = new Set(dmnProfielen);
  const wis = [];
  const zet = [];
  const gezet = new Set();
  for (const l of links || []) {
    if (l?.soort !== TRACE_SOORT) continue;
    const van = l.omgekeerd ? l.kolom : l.rij;
    const naar = l.omgekeerd ? l.rij : l.kolom;
    if (!dmn.has(van?.profielId)) continue;
    const invoer = elementVan(van);
    if (invoer?.elementType !== "inputData") continue;
    const doel = elementVan(naar);
    if (!doel || doel.source) continue;
    const sleutel = `${van.profielId}::${van.elementId}`;
    const bestaand = invoer.data?.gegeven;
    if (bestaand?.elementId || gezet.has(sleutel)) {
      // Al een gegeven: dubbel als het naar hetzelfde element wijst; anders laten staan.
      const zelfde = gezet.has(sleutel)
        ? zet.find((z) => `${z.profielId}::${z.elementId}` === sleutel)?.gegeven
        : bestaand;
      if (zelfde?.profielId === naar.profielId && zelfde?.elementId === naar.elementId) wis.push(l.id);
      continue;
    }
    gezet.add(sleutel);
    zet.push({ profielId: van.profielId, elementId: van.elementId, gegeven: gegevenVoor(naar.profielId, doel) });
    wis.push(l.id);
  }
  return { wis, zet };
}

/**
 * Voer de omzetting uit tegen de stores (studio): koppelingen (useKruisStore) en de profielen
 * met descriptor dmn-drd. Eén keer per wijziging, na de huidige taak (microtask), zodat een
 * wijziging die zelf een omzetting oplevert niet in zichzelf terugloopt.
 * @param {{useKruisStore: any, getProfieltypen: () => any[], getProfieltype: (id: string) => any}} s
 */
export function voerTraceOmzettingUit({ useKruisStore, getProfieltypen, getProfieltype }) {
  const dmnProfielen = getProfieltypen().filter((p) => p?.descriptor?.id === "dmn-drd" && p.useStore).map((p) => p.id);
  if (!dmnProfielen.length) return false;
  const elementVan = (r) => getProfieltype(r?.profielId)?.useStore?.getState?.().elements?.[r.elementId] || null;
  const { wis, zet } = planTraceOmzetting({ links: useKruisStore.getState().links, dmnProfielen, elementVan });
  if (!wis.length && !zet.length) return false;
  const perProfiel = new Map();
  for (const z of zet) {
    if (!perProfiel.has(z.profielId)) perProfiel.set(z.profielId, {});
    perProfiel.get(z.profielId)[z.elementId] = { data: { gegeven: z.gegeven } };
  }
  for (const [pid, patches] of perProfiel) getProfieltype(pid)?.useStore?.getState?.().updateElementen(patches);
  if (wis.length) useKruisStore.getState().patchLinks({ wis });
  return true;
}
