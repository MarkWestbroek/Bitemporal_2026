/**
 * weergaveNaam — naam van een element voor lijsten en labels.
 *
 * Kleine vaste vormen (begin/eind, gateway, junction: `naamLabel` "buiten"
 * of "geen") mogen naamloos zijn; dan is hun id (`act_1791…_10`) ruis. Zo'n
 * element heet in lijsten naar zijn type: "(Begin)". Een naamloze
 * diagramverwijzing (superprofiel) heet naar zijn doel: "⧉ Uitlenen" (Mark,
 * 21-10: "ik zie niets in de boom" — het was "(sp_…)"). Andere naamloze
 * elementen tonen hun id tussen haakjes, zodat je ze nog kunt terugvinden.
 */
import { normaliseerVerwijzing } from "./verwijstNaar.js";
import { diagramNaamVan } from "./diagramNamen.js";

export function weergaveNaam(element, elementType) {
  if (element?.naam) return element.naam;
  const et = elementType;
  if (et?.shape === "diagramverwijzing") {
    const verw = normaliseerVerwijzing(element?.data?.verwijstNaar);
    return `⧉ ${(verw && diagramNaamVan(verw)) || verw?.diagramId || "(kies een diagram)"}`;
  }
  if (et && (et.naamLabel === "buiten" || et.naamLabel === "geen")) return `(${et.label || et.id})`;
  return `(${element?.id ?? "naamloos"})`;
}
