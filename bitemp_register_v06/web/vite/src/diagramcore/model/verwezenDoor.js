// @ts-check
/**
 * verwezenDoor — de andere kant van de doorklik (Mark, 20-10: "een lijstje 'naar verwezen door'"):
 * welke elementen, in welk profiel ook, naar een diagram doorklikken (`verwijst naar` of de
 * gedragsverwijzing; zie verwijstNaar.js `doorklikVan`). Puur en store-loos.
 */
import { doorklikVan } from "./verwijstNaar.js";
import { gebruikVan } from "./gebruik.js";

/**
 * Welke elementen (in elk profiel) klikken door naar dit diagram? Puur op de meegegeven profielen,
 * zodat het te testen is. Elk resultaat: {profielId, elementId, naam, type, diagrammen} met de
 * diagrammen waarop het element staat (om het te openen).
 * @param {string} profielId
 * @param {string} diagramId
 * @param {Array<{profielId: string, elementTypes: any[], elements: Record<string, any>, diagrams: Record<string, any>}>} profielen
 */
export function verwezenDoor(profielId, diagramId, profielen) {
  const uit = [];
  for (const p of profielen) {
    const typen = new Map((p.elementTypes || []).map((t) => [t.id, t]));
    for (const el of Object.values(p.elements || {})) {
      if (!el || el.source) continue;
      const et = typen.get(el.elementType);
      const v = doorklikVan(el, et, p.profielId);
      if (!v || v.diagramId !== diagramId || (v.profielId || p.profielId) !== profielId) continue;
      uit.push({ profielId: p.profielId, elementId: el.id, naam: el.naam || `(${et?.label || el.elementType})`, type: et?.label || el.elementType, diagrammen: gebruikVan(el.id, p.diagrams || {}) });
    }
  }
  return uit.sort((a, b) => String(a.naam).localeCompare(String(b.naam)));
}

