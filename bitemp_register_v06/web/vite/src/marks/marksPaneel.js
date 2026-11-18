// @ts-check
/**
 * marksPaneel — de regels achter het scherm van marks (plan 2026-11-18 Marks, stap 6): welk doel
 * hoort bij een element of veld, wat laat het paneel zien, en wat doet een klik. Puur, zodat het
 * onder node te testen is; het paneel zelf staat in studio/MarksPaneel.jsx.
 */
import { doelSleutel, effectieveMarks, contextLagen, markId, zetMark, wisMark } from "./marks.js";
import { marksoortenVoor, getMarksoort } from "./marksoorten.js";

/**
 * Het doel van een element: zijn uuid als hij er een heeft (canoniek model), anders profiel en
 * element-id (BPMN, DMN, …). Een verbinding is soort "relatie".
 * @param {string} profielId @param {any} element
 */
export function doelVanElement(profielId, element) {
  const soort = element?.source ? "relatie" : "element";
  return element?.data?.uuid ? { soort, uuid: element.data.uuid } : { soort, profielId, elementId: element.id };
}

/** Het doel van een veld: zijn uuid, anders profiel, element en veldnaam. */
export function doelVanVeld(profielId, element, veld) {
  return veld?.data?.uuid ? { soort: "veld", uuid: veld.data.uuid } : { soort: "veld", profielId, elementId: element.id, veldNaam: veld.naam };
}

/** De velden van een element (alle compartimenten, alleen met een naam). */
export function veldenVan(element) {
  return (element?.compartimenten || []).flatMap((c) => (c.velden || []).filter((v) => v?.naam));
}

/**
 * De lagen waarmee het scherm rekent: de gekozen context, of zonder keuze alle lagen in de
 * volgorde van het project.
 */
export function schermContext(st, actieveContext) {
  const gekozen = actieveContext ? contextLagen(st, actieveContext) : [];
  return gekozen.length ? gekozen : st.lagen.map((l) => l.id);
}

/**
 * Wat het paneel toont voor één element.
 * @param {{st: any, context: string[], profielId: string, descriptorId: string, element: any}} p
 * @returns {{
 *   element: {soort: any, doel: any, eff: any|null}[],
 *   veldSoorten: any[],
 *   velden: {naam: string, doel: any, cellen: {soort: any, eff: any|null}[]}[],
 *   aantal: number,
 * }}
 */
export function paneelVoorElement({ st, context, profielId, descriptorId, element }) {
  const eff = effectieveMarks(st, context);
  const bij = { profiel: descriptorId, elementType: element.elementType };
  const effVoor = (doel, soortId) => eff.get(doelSleutel(doel))?.soorten?.[soortId] || null;
  const elDoel = doelVanElement(profielId, element);
  // Ook soorten die niet (meer) geregistreerd zijn maar wel op het doel staan: tonen, niet verstoppen.
  const metBestaande = (doel, soorten) => {
    const ids = new Set(soorten.map((s) => s.id));
    const extra = Object.keys(eff.get(doelSleutel(doel))?.soorten || {}).filter((id) => !ids.has(id));
    return [...soorten, ...extra.map((id) => getMarksoort(id) || { id, label: id, datatype: "onbekend" })];
  };
  const elementRijen = metBestaande(elDoel, marksoortenVoor(elDoel, bij)).map((soort) => ({ soort, doel: elDoel, eff: effVoor(elDoel, soort.id) }));
  const veldSoorten = marksoortenVoor({ soort: "veld" }, bij);
  const velden = veldSoorten.length
    ? veldenVan(element).map((v) => {
        const doel = doelVanVeld(profielId, element, v);
        return { naam: v.naam, doel, cellen: veldSoorten.map((soort) => ({ soort, eff: effVoor(doel, soort.id) })) };
      })
    : [];
  const telt = (e) => !!e && !e.uit;
  const aantal = elementRijen.filter((r) => telt(r.eff)).length + velden.reduce((n, v) => n + v.cellen.filter((c) => telt(c.eff)).length, 0);
  return { element: elementRijen, veldSoorten, velden, aantal };
}

/**
 * De marks die op een element en zijn velden gelden, als korte regels (voor het teken op het
 * canvas en de tekst erbij).
 * @returns {string[]}
 */
export function markRegels({ st, context, profielId, descriptorId, element }) {
  const p = paneelVoorElement({ st, context, profielId, descriptorId, element });
  const toon = (soort, e) => `${soort.label || soort.id}${e.waarde === true ? "" : `: ${e.waarde}`}`;
  const uit = [];
  for (const r of p.element) if (r.eff && !r.eff.uit) uit.push(toon(r.soort, r.eff));
  for (const v of p.velden) {
    const delen = v.cellen.filter((c) => c.eff && !c.eff.uit).map((c) => toon(c.soort, c.eff));
    if (delen.length) uit.push(`${v.naam}: ${delen.join(", ")}`);
  }
  return uit;
}

/**
 * Zet een mark op een waarde in de werklaag, zó dat het effect in de context de gevraagde waarde
 * is. `waarde: undefined` betekent: hier geen mark (weg, of uitzetten als een onderliggende laag
 * hem zet). Geeft de nieuwe stand; dezelfde stand als er niets hoeft te gebeuren.
 * @param {any} st
 * @param {{laag: string, soort: string, doel: any, waarde: any, context: string[]}} p
 */
export function zetEffect(st, { laag, soort, doel, waarde, context }) {
  const sleutel = doelSleutel(doel);
  const effect = (s) => {
    const e = effectieveMarks(s, context).get(sleutel)?.soorten?.[soort];
    return e && !e.uit ? e.waarde : undefined;
  };
  if (effect(st) === waarde) return st;
  const zonder = wisMark(st, markId(laag, soort, doel));
  // Eerst proberen zonder eigen mark in deze laag: dan geldt wat eronder ligt.
  if (effect(zonder) === waarde) return zonder;
  return zetMark(st, { laag, soort, doel, waarde: waarde === undefined ? null : waarde });
}
