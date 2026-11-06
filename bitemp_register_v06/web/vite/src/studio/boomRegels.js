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

/**
 * De hiërarchie van een profiel voor de boom (DiagramType `hierarchie`, fase 0 van het plan
 * "Linked data als M2" §8, 06-11).
 *
 * `kinderenVan` is de weergave: een kind staat onder elke ouder die een hiërarchie-relatie naar
 * hem heeft. Dat blijft zo, want OAS (`ref`) en GraphQL (`veldtype`) gebruiken de hiërarchie
 * bewust als graaf: een schema staat onder elke operatie die het gebruikt.
 *
 * `ouderVan` is de **boomouder** (besluit Mark 04-11: hooguit één): die bepaalt waar een kind
 * met zijn voorouder meereist (plaatsen in een map, de boomregel, "Zoek in projectboom").
 * Bij meer kandidaten wint de **eerste in vaste volgorde**: relaties op connector-id (een
 * `bev_<tijd>_<n>` sorteert op aanmaakmoment), daarna de paren van de hook `hierarchieParen` in
 * hun eigen volgorde. Tot 06-11 won de laatste in elementvolgorde, en die verschilt per client.
 * Een kandidaat die een kring zou sluiten (A broader B broader A) wordt overgeslagen en staat in
 * `kringen`; de weergave kapt een kring op diepte 8 af.
 *
 * @param {Record<string, any>} elements
 * @param {Array<string|{type: string, omgekeerd?: boolean}>|string|undefined} hierarchie
 * @param {Array<[string, string]>} [extraParen] - [ouder, kind] uit de hook `hierarchieParen`
 * @returns {{kinderenVan: Map<string, string[]>, ouderVan: Map<string, string>, kringen: Array<[string, string]>}}
 */
export function bouwHierarchie(elements, hierarchie, extraParen = []) {
  const regels = [].concat(hierarchie || []).map((h) => (typeof h === "string" ? { type: h } : h)).filter((h) => h?.type);
  const kinderenVan = new Map();
  const ouderVan = new Map();
  const kringen = [];
  if (!regels.length) return { kinderenVan, ouderVan, kringen };
  const regelPerType = new Map();
  for (const h of regels) if (!regelPerType.has(h.type)) regelPerType.set(h.type, h);

  const gezien = new Set(); // "ouder\u0000kind"
  /** @type {Array<{ouder: string, kind: string, sleutel: string, extra: number}>} */
  const kandidaten = [];
  const voeg = (ouder, kind, sleutel, extra) => {
    if (ouder === kind || !elements[ouder] || !elements[kind]) return;
    const paar = ouder + "\u0000" + kind;
    if (gezien.has(paar)) return;
    gezien.add(paar);
    if (!kinderenVan.has(ouder)) kinderenVan.set(ouder, []);
    kinderenVan.get(ouder).push(kind);
    kandidaten.push({ ouder, kind, sleutel, extra });
  };
  for (const el of Object.values(elements)) {
    const regel = regelPerType.get(el?.elementType);
    if (!regel || !el.source || !el.target) continue;
    if (regel.omgekeerd) voeg(el.target, el.source, el.id, -1);
    else voeg(el.source, el.target, el.id, -1);
  }
  extraParen.forEach(([ouder, kind], i) => voeg(ouder, kind, "", i));

  // Boomouder: de eerste in vaste volgorde, zonder kring.
  kandidaten.sort((a, b) => (a.extra - b.extra) || (a.sleutel < b.sleutel ? -1 : a.sleutel > b.sleutel ? 1 : 0));
  const maaktKring = (ouder, kind) => {
    for (let c = ouder, i = 0; c && i < 10000; c = ouderVan.get(c), i++) if (c === kind) return true;
    return false;
  };
  for (const { ouder, kind } of kandidaten) {
    if (ouderVan.has(kind)) continue;
    if (maaktKring(ouder, kind)) { kringen.push([ouder, kind]); continue; }
    ouderVan.set(kind, ouder);
  }
  return { kinderenVan, ouderVan, kringen };
}
