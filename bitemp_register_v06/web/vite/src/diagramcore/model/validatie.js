// @ts-check
/**
 * validatie — de uitkomst van `ElementType.hooks.valideer` gelijktrekken voor de inspector
 * (18-10; de hook stond in de catalogus maar niemand riep hem aan). Eerste gebruiker: de use case
 * (geen primaire actor én geen trigger → waarschuwing; diagramprofielen/usecase/controle.js).
 *
 * Een hook mag geven: niets, een tekst, of een lijst van teksten en/of {niveau, tekst}.
 * Niveaus: "fout", "waarschuwing" (standaard), "info". Een hook die gooit, telt als geen melding:
 * een profielregel mag de inspector niet laten vallen.
 */

const NIVEAUS = new Set(["fout", "waarschuwing", "info"]);

/**
 * @param {any} uitkomst
 * @returns {{niveau: "fout"|"waarschuwing"|"info", tekst: string}[]}
 */
export function normaliseerMeldingen(uitkomst) {
  const lijst = uitkomst == null ? [] : Array.isArray(uitkomst) ? uitkomst : [uitkomst];
  const uit = [];
  for (const m of lijst) {
    if (typeof m === "string") {
      if (m.trim()) uit.push({ niveau: "waarschuwing", tekst: m.trim() });
      continue;
    }
    const tekst = typeof m?.tekst === "string" ? m.tekst.trim() : "";
    if (!tekst) continue;
    uit.push({ niveau: NIVEAUS.has(m.niveau) ? m.niveau : "waarschuwing", tekst });
  }
  return uit;
}

/** Roep de valideer-hook van een type aan; nooit een uitzondering naar buiten. */
export function valideerElement(elementType, element, context = {}) {
  const hook = elementType?.hooks?.valideer;
  if (typeof hook !== "function" || !element) return [];
  try {
    return normaliseerMeldingen(hook(element, context));
  } catch {
    return [];
  }
}
