/**
 * weergaveNaam — naam van een element voor lijsten en labels.
 *
 * Kleine vaste vormen (begin/eind, gateway, junction: `naamLabel` "buiten"
 * of "geen") mogen naamloos zijn; dan is hun id (`act_1791…_10`) ruis. Zo'n
 * element heet in lijsten naar zijn type: "(Begin)". Andere naamloze
 * elementen tonen hun id tussen haakjes, zodat je ze nog kunt terugvinden.
 */
export function weergaveNaam(element, elementType) {
  if (element?.naam) return element.naam;
  const et = elementType;
  if (et && (et.naamLabel === "buiten" || et.naamLabel === "geen")) return `(${et.label || et.id})`;
  return `(${element?.id ?? "naamloos"})`;
}
