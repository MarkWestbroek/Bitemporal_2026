// @ts-check
/**
 * controle — modelleerregels voor een use case (2026-10-18, Mark; naar Cockburn,
 * *Writing Effective Use Cases*): een use case dient het doel van een
 * **primaire actor** (de belanghebbende) en wordt gestart door een **trigger**
 * (een actor, een tijdstip of een gebeurtenis). UML 2.5.1 eist geen van beide —
 * het begrip primaire actor bestaat in de taal niet — dus dit zijn
 * waarschuwingen, geen fouten.
 *
 * Implementatie van de M3-hook `valideer` op het use case-type:
 * `(element, {elements}) → [{niveau, tekst}]`. Puur en store-loos.
 */

/** Associaties tussen een actor en deze use case (in beide richtingen getekend). */
function associatiesVan(useCaseId, elements) {
  return Object.values(elements || {}).filter(
    (c) => c?.elementType === "associatie" && (c.source === useCaseId || c.target === useCaseId)
  );
}

/** Heeft de use case een primaire actor (een associatie met `primair`)? */
export function heeftPrimaireActor(useCaseId, elements) {
  return associatiesVan(useCaseId, elements).some((c) => {
    const ander = elements[c.source === useCaseId ? c.target : c.source];
    return c.data?.primair === true && ander?.elementType === "actor";
  });
}

/**
 * @param {Record<string, any>} element - de use case
 * @param {{elements: Record<string, any>}} ctx
 * @returns {Array<{niveau: "waarschuwing", tekst: string}>}
 */
export function controleerUseCase(element, { elements }) {
  if (element?.elementType !== "usecase") return [];
  const uit = [];
  const trigger = String(element.data?.trigger || "").trim();
  if (!heeftPrimaireActor(element.id, elements) && !trigger) {
    uit.push({
      niveau: "waarschuwing",
      tekst: "Geen primaire actor en geen trigger: voor wie is deze use case, en wat start hem? Vink bij de associatie \"primaire actor\" aan, of vul een trigger in (bv. een tijdstip voor een batch).",
    });
  }
  return uit;
}
