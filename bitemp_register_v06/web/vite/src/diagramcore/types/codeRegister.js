// @ts-check
/**
 * codeRegister — **code op id** (PROF-1, het sidecar-project; Mark 19-11).
 *
 * Een profiel (M2) is gegevens plus code: hooks, reference-resolvers en eigen layouts zijn
 * functies. Een model kan geen functie bevatten, wel een verwijzing ernaar. Dit register geeft elk
 * stuk code van een geregistreerd profiel een vaste id, zodat het Profiel-ontwerp en het
 * sidecar-project ernaar kunnen wijzen en de tool het bij het laden weer vindt.
 *
 * De id volgt uit waar de code staat, bij de registratie van het profiel:
 *
 *   <profiel>:<elementtype>.hooks.<soort>     een hook op een elementtype
 *   <profiel>:hooks.<soort>                   een hook op het profiel (migreerModel, …)
 *   <profiel>:referenceResolvers.<type>       een reference-resolver
 *   <profiel>:layouts.<layout>                een eigen layout (een object met code)
 *
 * Wie het eerst registreert, geeft de naam: een functie die twee profielen delen, heet naar de
 * eerste. Een andere instantie van dezelfde tool kent dezelfde id's; een id die hier niet bestaat,
 * is bij het laden een duidelijke fout (`vertaalHooks`), nooit een stille gok.
 *
 * Afgeleide layouts (uit de layoutstijlen, met `stijl`) zijn geen eigen code: die maakt de
 * registratie opnieuw (`vulLayoutsAan`).
 */

/** @type {Map<string, any>} id → code */
const _code = new Map();
/** @type {WeakMap<object, string>} code → id (de eerste registratie wint) */
const _ids = new WeakMap();

/** Meld één stuk code aan; bestaat het al onder een andere id, dan blijft die. */
export function registreerCode(id, code) {
  if (!code || (typeof code !== "function" && typeof code !== "object")) return;
  if (!_code.has(id)) _code.set(id, code);
  if (!_ids.has(code)) _ids.set(code, id);
}

/** De code bij een id, of undefined. */
export const codeVan = (id) => _code.get(id);

/** De id van een stuk code, of undefined als het niet aangemeld is. */
export const codeIdVan = (code) => (code && (typeof code === "function" || typeof code === "object") ? _ids.get(code) : undefined);

/** Alle id's (voor tests en de dekking). */
export const alleCodeIds = () => [..._code.keys()];

/** Is dit een eigen layout (code), en geen afgeleide uit een layoutstijl? */
export const isEigenLayout = (layout) => !!layout && typeof layout === "object" && !("stijl" in layout);

/**
 * Meld de code van een descriptor aan (vóór het uitvlakken van de erfenis, zodat een geërfde hook
 * de id van zijn eigenaar houdt). Idempotent.
 * @param {any} dt
 */
export function meldCodeAan(dt) {
  if (!dt?.id) return;
  for (const [soort, fn] of Object.entries(dt.hooks || {})) registreerCode(`${dt.id}:hooks.${soort}`, fn);
  for (const et of dt.elementTypes || []) {
    for (const [soort, fn] of Object.entries(et?.hooks || {})) registreerCode(`${dt.id}:${et.id}.hooks.${soort}`, fn);
  }
  for (const [type, resolver] of Object.entries(dt.referenceResolvers || {})) registreerCode(`${dt.id}:referenceResolvers.${type}`, resolver);
  for (const layout of dt.layouts || []) if (isEigenLayout(layout) && layout.id) registreerCode(`${dt.id}:layouts.${layout.id}`, layout);
}
