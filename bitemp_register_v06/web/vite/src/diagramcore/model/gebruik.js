// @ts-check
/**
 * gebruik — op welke diagrammen een element staat (melding #5 van Hugo, 16-10-2026: "zien waar
 * een element overal wordt gebruikt, en als het nergens wordt gebruikt cursief tonen: dan kan ik
 * het weggooien zonder een diagram stuk te maken").
 *
 * Gebruikt = het element staat als knoop op een diagram (ook ingebed in een samenstel: dat is een
 * knoop met een gedaante). Connectoren tellen niet: die liggen tussen knopen en zijn geen knoop.
 * Puur; per profiel (een element leeft in één profielstore).
 */

/**
 * @param {string} elementId
 * @param {Record<string, {id: string, naam?: string, nodes?: {elementId: string}[]}>} diagrams
 * @returns {{id: string, naam: string, aantal: number}[]} diagrammen met het aantal voorkomens, op naam
 */
export function gebruikVan(elementId, diagrams) {
  const uit = [];
  for (const d of Object.values(diagrams || {})) {
    const aantal = (d?.nodes || []).filter((n) => n?.elementId === elementId).length;
    if (aantal) uit.push({ id: d.id, naam: d.naam || d.id, aantal });
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam));
}

/** Ids van alle elementen die op minstens één diagram staan (één keer rekenen voor een hele lijst). */
export function gebruikteIds(diagrams) {
  const ids = new Set();
  for (const d of Object.values(diagrams || {})) for (const n of d?.nodes || []) if (n?.elementId) ids.add(n.elementId);
  return ids;
}
