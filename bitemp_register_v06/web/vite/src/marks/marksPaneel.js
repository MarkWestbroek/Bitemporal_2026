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
 * @param {{st: any, context: string[], profielId: string, descriptorId: string, element: any, eff?: Map<string, any>}} p
 *   `eff`: de al uitgerekende effectieve marks (wie veel elementen afloopt rekent ze één keer uit)
 * @returns {{
 *   element: {soort: any, doel: any, eff: any|null}[],
 *   veldSoorten: any[],
 *   velden: {naam: string, doel: any, cellen: {soort: any, eff: any|null}[]}[],
 *   aantal: number,
 * }}
 */
export function paneelVoorElement({ st, context, profielId, descriptorId, element, eff = effectieveMarks(st, context) }) {
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
 * De marks die op een element en zijn velden gelden, als korte teksten (voor de tekens op het
 * canvas): die op het element zelf, en per veldnaam die op het veld. `null` als er geen zijn.
 * @returns {{element: string[], velden: Record<string, string[]>} | null}
 */
export function markRegels({ st, context, profielId, descriptorId, element, eff = undefined }) {
  const p = paneelVoorElement({ st, context, profielId, descriptorId, element, ...(eff ? { eff } : {}) });
  const toon = (soort, e) => `${soort.label || soort.id}${e.waarde === true ? "" : `: ${e.waarde}`}`;
  const opElement = p.element.filter((r) => r.eff && !r.eff.uit).map((r) => toon(r.soort, r.eff));
  /** @type {Record<string, string[]>} */
  const velden = {};
  for (const v of p.velden) {
    const delen = v.cellen.filter((c) => c.eff && !c.eff.uit).map((c) => toon(c.soort, c.eff));
    if (delen.length) velden[v.naam] = delen;
  }
  return opElement.length || Object.keys(velden).length ? { element: opElement, velden } : null;
}

/** Het teken voor `n` marks: alleen het ruitje bij één, met het aantal erbij vanaf twee. */
export const markTeken = (n) => (n > 1 ? `◆${n}` : n === 1 ? "◆" : "");

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

/**
 * Bestaat het doel van een mark nog? Geeft een functie voor `wezen` (marks/marks.js), gebouwd uit
 * de elementen van alle talen: een uuid moet op een element of veld staan, een verwijzing zonder
 * uuid moet naar een bestaand element (en veld) wijzen. Een map telt altijd als bestaand (de
 * mappen zitten niet in de modelstores).
 * @param {{id: string, elements: Record<string, any>}[]} profielen
 * @returns {(doel: any) => boolean}
 */
export function bestaatIn(profielen) {
  const uuids = new Set();
  const refs = new Set();
  for (const p of profielen || []) {
    for (const el of Object.values(p.elements || {})) {
      refs.add(`${p.id}::${el.id}`);
      if (el.data?.uuid) uuids.add(el.data.uuid);
      for (const v of veldenVan(el)) {
        refs.add(`${p.id}::${el.id}#${v.naam}`);
        if (v.data?.uuid) uuids.add(v.data.uuid);
      }
    }
  }
  return (doel) => {
    if (doel?.uuid) return uuids.has(doel.uuid);
    if (doel?.soort === "map") return true;
    return refs.has(`${doel?.profielId}::${doel?.elementId}${doel?.veldNaam ? `#${doel.veldNaam}` : ""}`);
  };
}
