// @ts-check
/**
 * boomRegels — zuivere regels van de projectboom (BOOM-1, 14-10-2026).
 *
 * **Een niet-ingedeeld element volgt het eerste geplaatste diagram waarop het staat.** De boom
 * is de plek waar je een element terugvindt, en het diagram is zijn context (Mark: "vanzelf
 * waar de context is: het diagram"). Daardoor landt een nieuw getekend element meteen in de map
 * van zijn diagram, volgen de elementen van een geïmporteerd diagram zodra dat diagram in een
 * map komt, en wordt een bestaand project bij het laden opgeruimd. "Niet ingedeeld" houdt dan
 * alleen wezen over: elementen die op geen enkel geplaatst diagram staan.
 *
 * Triggers (modellerenActivity): een lokale modelwijziging (nieuwe knopen op een diagram), een
 * diagram dat in een map wordt geplaatst, en het laden van een project. Niet bij operaties van
 * een ander (die sturen hun eigen plaatsing mee) en niet tijdens het laden van een snapshot.
 */

/**
 * Welke elementen moeten waar geplaatst worden.
 * @param {Object} p
 * @param {string} p.profielId
 * @param {Record<string, any>} p.elements
 * @param {Record<string, any>} p.diagrams
 * @param {Record<string, string>} p.plaatsing  - boomsleutel → map-id (sleutelvolgorde = boomvolgorde)
 * @param {Map<string, string>} [p.ouderVan]    - hiërarchie (kind → ouder): een kind reist met zijn top-voorouder mee
 * @param {Iterable<string>|null} [p.diagramIds] - alleen elementen die op deze diagrammen staan (lokale wijziging); null = alles
 * @returns {Record<string, string[]>} map-id → boomsleutels (`el::profiel::element`)
 */
export function volgDiagram({ profielId, elements, diagrams, plaatsing, ouderVan = new Map(), diagramIds = null }) {
  const perMap = {};
  const gepland = new Set();
  const top = (id) => {
    let cursor = id;
    for (let i = 0; i < 16 && ouderVan.has(cursor); i += 1) cursor = ouderVan.get(cursor);
    return cursor;
  };
  // Alleen elementen die op de gewijzigde diagrammen staan — maar hun map komt van het
  // eerste geplaatste diagram in de boom waarop ze staan.
  let alleen = null;
  if (diagramIds) {
    alleen = new Set();
    for (const id of diagramIds) for (const n of diagrams?.[id]?.nodes || []) alleen.add(n.elementId);
    if (!alleen.size) return perMap;
  }
  const prefix = `${profielId}::`;
  for (const [key, mapId] of Object.entries(plaatsing || {})) {
    if (!mapId || !key.startsWith(prefix)) continue;
    const d = diagrams?.[key.slice(prefix.length)];
    if (!d) continue;
    for (const n of d.nodes || []) {
      const el = elements?.[n.elementId];
      if (!el || el.source) continue; // connectoren staan niet in de boom
      if (alleen && !alleen.has(el.id)) continue;
      const sleutel = `el::${profielId}::${top(el.id)}`;
      if (plaatsing[sleutel] || gepland.has(sleutel)) continue;
      gepland.add(sleutel);
      (perMap[mapId] ||= []).push(sleutel);
    }
  }
  return perMap;
}
