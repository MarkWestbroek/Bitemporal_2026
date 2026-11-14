// @ts-check
/**
 * conditiesNaarCel — de condities op de sequence flows van een BPMN-model van
 * JUEL naar CEL (besluit Mark 12-11-2026: CEL in het model, JUEL is uitvoer).
 *
 * Voor een model dat nog JUEL bevat: een BPMN-import, of een project dat van
 * vóór het besluit is (Marks project Inrichten, 13-11). De export zet het weer
 * om (`bpmnXmlSchrijver` → `celNaarJuel`). Wat geen CEL wordt blijft JUEL en
 * komt terug in `blijft`; de export laat JUEL ongemoeid door, dus er gaat
 * niets verloren.
 *
 * Puur: geeft patches in de vorm van `updateElementen` (één undo-stap).
 */
import { juelNaarCel } from "../../transformatie/celOmzetting.js";

/**
 * @param {Record<string, any>} elements
 * @returns {{patches: Record<string, {data: {conditie: string}}>, omgezet: number, blijft: {id: string, naam: string, conditie: string, fout: string}[]}}
 */
export function conditiesNaarCel(elements) {
  /** @type {Record<string, {data: {conditie: string}}>} */
  const patches = {};
  const blijft = [];
  for (const el of Object.values(elements || {})) {
    const conditie = el?.data?.conditie;
    if (el?.elementType !== "sequence-flow" || typeof conditie !== "string" || !conditie.trim()) continue;
    const uit = juelNaarCel(conditie);
    if (uit.geenJuel) continue;
    if (uit.fout || uit.tekst === null) blijft.push({ id: el.id, naam: el.naam || "", conditie, fout: uit.fout || "" });
    else patches[el.id] = { data: { conditie: uit.tekst } };
  }
  return { patches, omgezet: Object.keys(patches).length, blijft };
}

/** Hoeveel condities staan nog in JUEL. */
export const juelCondities = (elements) => {
  const { omgezet, blijft } = conditiesNaarCel(elements);
  return omgezet + blijft.length;
};
