// @ts-check
/**
 * sleutel — een modelwaarde als sleutel in een doelsysteem.
 *
 * Een waarde in het canonieke model is camelCase (`nietInBehandeling`); GZAC
 * schrijft sleutels met koppeltekens (`niet-in-behandeling`). Eén functie,
 * zodat de BPMN-schrijver (de taak die een dossierstatus zet) en het artefact
 * met de dossierstatussen dezelfde sleutel maken (docs/TRANSFORMATIES.md §11.9).
 */

/** nietInBehandeling → niet-in-behandeling; een sleutel die al koppeltekens heeft blijft gelijk. */
export function kebab(waarde) {
  return String(waarde ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
