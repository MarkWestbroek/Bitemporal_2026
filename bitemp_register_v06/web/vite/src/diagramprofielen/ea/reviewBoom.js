// reviewBoom.js — de review van een EA-import als boom: profiel → EA-pakket
// (genest zoals in EA) → diagrammen en elementen. Grote imports (Zandbak MW:
// 21.000 regels) zijn zo te overzien: standaard alles aan, en je vinkt een
// pakket of een tak uit (Mark, 09-10). Puur: geen UI, geen store.

/**
 * @typedef {{sleutel?: string, label: string, status?: string, detail?: string, aan?: boolean, kinderen?: ReviewKnoop[]}} ReviewKnoop
 *   Een blad heeft een `sleutel` (de keuze die terugkomt); een tak heeft `kinderen`.
 */

/**
 * @param {{naam: string, model: {elements: Record<string, any>, diagrams: Record<string, any>}, plan: any,
 *          bestaand: {elements: Record<string, any>, diagrams: Record<string, any>}}[]} stappen
 *   per profiel: de naam (prefix van de sleutels), het gelezen model, het
 *   vergelijkplan (`vergelijkMetStore`) en de bestaande store-stand.
 * @param {{t_package?: {Package_ID: number, Parent_ID: number, Name: string}[]}} bron
 * @param {Set<number>} pakketIds  de pakketten in het geïmporteerde bereik
 * @returns {ReviewKnoop[]}  één tak per profiel
 */
export function bouwReviewBoom(stappen, bron, pakketIds) {
  const pakketPerId = new Map((bron?.t_package || []).map((p) => [p.Package_ID, p]));
  const beschrijf = (r) => (r.verschillen?.length ? r.verschillen.join(", ") : "");
  const boom = [];
  for (const { naam, model, plan, bestaand } of stappen) {
    const ongewijzigd = (plan.elementen.ongewijzigd?.length || 0) + (plan.diagrammen.ongewijzigd?.length || 0);
    const wortel = { label: `${naam}${ongewijzigd ? ` — ${ongewijzigd} ongewijzigd` : ""}`, kinderen: [] };
    const knoopPerPakket = new Map();
    // Twee vaste takken onderaan: elementen van buiten het gekozen pakket (EA
    // tekent gerust klassen van elders op een diagram) en regels zonder
    // pakket — zodat de profielwortel zelf geen duizenden bladeren krijgt.
    const BUITEN = { label: "Buiten het gekozen pakket (op diagrammen gebruikt)", kinderen: [], _vast: true };
    const OVERIG = { label: "Overig", kinderen: [], _vast: true };
    /** Tak van een EA-pakket (genest tot het gekozen pakket; daarbuiten = BUITEN/OVERIG). */
    const pakketKnoop = (pid) => {
      const id = Number(pid);
      if (!Number.isFinite(id) || pid == null) return OVERIG;
      if (!pakketIds?.has(id)) return BUITEN;
      if (knoopPerPakket.has(id)) return knoopPerPakket.get(id);
      const p = pakketPerId.get(id);
      const ouder = p && pakketIds.has(Number(p.Parent_ID)) ? pakketKnoop(p.Parent_ID) : wortel;
      const knoop = { label: p?.Name || `Pakket ${id}`, kinderen: [], _pakket: true };
      ouder.kinderen.push(knoop);
      knoopPerPakket.set(id, knoop);
      return knoop;
    };
    const diagramPakket = (id) => model.diagrams?.[id]?.eaPakket;
    // Een connector heeft geen pakket: neem dat van zijn bron (anders doel).
    const pakketVan = (elements, id, diepte = 0) => {
      const el = elements?.[id];
      if (!el) return undefined;
      if (el.data?.eaPakket != null) return el.data.eaPakket;
      if (diepte > 2) return undefined;
      return pakketVan(elements, el.source, diepte + 1) ?? pakketVan(elements, el.target, diepte + 1);
    };
    const elementPakket = (id) => pakketVan(model.elements, id);
    const bestaandDiagramPakket = (id) => bestaand?.diagrams?.[id]?.eaPakket;
    const bestaandElementPakket = (id) => pakketVan(bestaand?.elements, id);
    const blad = (pakket, knoop) => pakketKnoop(pakket).kinderen.push(knoop);

    for (const r of plan.diagrammen.nieuw) blad(diagramPakket(r.id), { sleutel: `${naam}|di:${r.id}`, label: `diagram ${r.naam}`, status: "nieuw" });
    for (const r of plan.diagrammen.gewijzigd) blad(diagramPakket(r.id), { sleutel: `${naam}|di:${r.id}`, label: `diagram ${r.naam}`, status: "gewijzigd", detail: beschrijf(r) });
    for (const r of plan.diagrammen.verdwenen)
      blad(bestaandDiagramPakket(r.bestaandId), { sleutel: `${naam}|weg:${r.bestaandId}`, label: `diagram ${r.naam}`, status: "verdwenen", detail: "in EA weg; aanvinken = hier ook weg", aan: false });
    for (const r of plan.elementen.nieuw) if (r.elementType !== "bevat") blad(elementPakket(r.id), { sleutel: `${naam}|el:${r.id}`, label: `${r.elementType} ${r.naam || "(naamloos)"}`, status: "nieuw" });
    for (const r of plan.elementen.gewijzigd)
      if (r.elementType !== "bevat") blad(elementPakket(r.id), { sleutel: `${naam}|el:${r.id}`, label: `${r.elementType} ${r.naam || "(naamloos)"}`, status: "gewijzigd", detail: beschrijf(r) });
    for (const r of plan.elementen.verdwenen)
      blad(bestaandElementPakket(r.bestaandId), { sleutel: `${naam}|weg:${r.bestaandId}`, label: `${r.elementType} ${r.naam || "(naamloos)"}`, status: "verdwenen", detail: "in EA weg; aanvinken = hier ook weg", aan: false });

    sorteer(wortel);
    for (const vast of [BUITEN, OVERIG]) if (vast.kinderen.length) wortel.kinderen.push(vast);
    boom.push(wortel);
  }
  return boom;
}

/** Takken (pakketten) eerst, op naam; dan bladeren in de volgorde van het plan. */
function sorteer(knoop) {
  const takken = knoop.kinderen.filter((k) => k.kinderen);
  const bladeren = knoop.kinderen.filter((k) => !k.kinderen);
  takken.sort((a, b) => a.label.localeCompare(b.label, "nl"));
  for (const t of takken) sorteer(t);
  knoop.kinderen = [...takken, ...bladeren];
}

/** Alle bladsleutels onder een knoop (of een lijst knopen). */
export function bladSleutels(knopen) {
  const uit = [];
  const loop = (k) => {
    if (k.kinderen) for (const c of k.kinderen) loop(c);
    else if (k.sleutel) uit.push(k.sleutel);
  };
  for (const k of Array.isArray(knopen) ? knopen : [knopen]) loop(k);
  return uit;
}

/** Aantallen per status onder een knoop: { nieuw, gewijzigd, verdwenen, totaal }. */
export function telStatus(knoop) {
  const t = { nieuw: 0, gewijzigd: 0, verdwenen: 0, totaal: 0 };
  const loop = (k) => {
    if (k.kinderen) for (const c of k.kinderen) loop(c);
    else {
      t.totaal += 1;
      if (k.status in t) t[k.status] += 1;
    }
  };
  loop(knoop);
  return t;
}
