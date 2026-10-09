// @ts-check
/**
 * vergelijkImport — het verschil-overzicht tussen een gelezen EA-model en wat
 * er al in een profielstore staat, op de externe identiteit (`data.eaGuid`
 * voor elementen, de GUID in het diagram-id voor diagrammen).
 *
 * Levert een **plan**: per element en diagram de status
 *   - nieuw        — bestaat nog niet in de store
 *   - gewijzigd    — bestaat, maar naam/velden/data/bron-doel/nodes verschillen
 *   - ongewijzigd  — bestaat en is gelijk
 *   - verdwenen    — staat in de store met een eaGuid uit hetzelfde EA-pakket
 *                    (`data.eaPakket`), maar zit niet meer in de import
 * plus een id-afbeelding import-id → bestaand-id, zodat het toepassen
 * (`pasPlanToe`) bestaande ids houdt: plaatsingen, kruisverbanden en
 * verwijzingen blijven staan. Dit is de bron voor de review-dialoog
 * (aan-/uitvinken per regel) én voor de merge op GUID (Mark, 09-10).
 *
 * Pure functies; de store komt als `state` ({elements, diagrams}) binnen.
 */

/** Sleutels op `data` die lokaal zijn en niet uit EA komen: die tellen niet als verschil. */
// Lokale data: wat Omnium zelf bijhoudt en EA niet levert. `vorm` hoort er
// níet bij: de lijnvorm komt uit EA's Line Style (recht/hoekig), en bij een
// her-import wint EA (de bron) — anders bleef de vorm van een oude import
// staan (Mark, 10-10). Een handmatig gekozen vorm gaat dus mee bij her-import.
const LOKALE_DATA = new Set(["labelOffsets", "zOrde", "gedaante"]);

/** GUID uit een diagram-id (`ead-<guid>` of een hernoemde `imp…_ead-<guid>`). */
export function diagramGuid(id) {
  return (String(id || "").match(/ead-([0-9a-f-]{36})/) || [])[1] || null;
}

function zonderLokaal(data) {
  const uit = {};
  for (const [k, v] of Object.entries(data || {})) if (!LOKALE_DATA.has(k)) uit[k] = v;
  return uit;
}

function gelijk(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Verschillen tussen een geïmporteerd element en zijn bestaande tegenhanger.
 * Verwijzingen (source/target) worden vergeleken via `idVanImport` (bestaand
 * id van het import-id), zodat een ongewijzigde lijn niet als gewijzigd
 * telt omdat zijn eindpunten andere ids dragen.
 */
function verschillenElement(nieuw, bestaand, idVanImport) {
  const uit = [];
  if ((nieuw.naam || "") !== (bestaand.naam || "")) uit.push("naam");
  if (nieuw.elementType !== bestaand.elementType) uit.push("type");
  if (!gelijk(nieuw.compartimenten || [], bestaand.compartimenten || [])) uit.push("velden");
  if (nieuw.source && idVanImport(nieuw.source) !== bestaand.source) uit.push("bron");
  if (nieuw.target && idVanImport(nieuw.target) !== bestaand.target) uit.push("doel");
  const dn = zonderLokaal(nieuw.data), db = zonderLokaal(bestaand.data);
  // Verwijzingen in data (randVan, gedragDiagramId) via de afbeelding.
  for (const s of ["randVan", "gedragDiagramId"]) {
    if (dn[s]) dn[s] = idVanImport(dn[s]);
  }
  const sleutels = new Set([...Object.keys(dn), ...Object.keys(db)]);
  for (const k of sleutels) if (!gelijk(dn[k], db[k])) uit.push(`data.${k}`);
  return uit;
}

function verschillenDiagram(nieuw, bestaand, idVanImport) {
  const uit = [];
  if ((nieuw.naam || "") !== (bestaand.naam || "")) uit.push("naam");
  const norm = (d, map) =>
    (d.nodes || [])
      .map((n) => ({ e: map(n.elementId), x: Math.round(n.position?.x || 0), y: Math.round(n.position?.y || 0), w: n.size?.width ?? null, h: n.size?.height ?? null }))
      .sort((a, b) => (a.e < b.e ? -1 : a.e > b.e ? 1 : a.x - b.x || a.y - b.y));
  if (!gelijk(norm(nieuw, idVanImport), norm(bestaand, (x) => x))) uit.push("plaatsing");
  const verb = (d, map) => [...(d.verborgenConnectoren || [])].map(map).sort();
  if (!gelijk(verb(nieuw, idVanImport), verb(bestaand, (x) => x))) uit.push("verborgen lijnen");
  // Lijndata per diagram (knikken, vorm, handles); labelposities zijn lokaal.
  const lijn = (d, map) =>
    Object.fromEntries(
      Object.entries(d.lijnen || {})
        .map(([cid, l]) => [map(cid), zonderLokaal(l)])
        .filter(([, l]) => Object.keys(l).length)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );
  if (!gelijk(lijn(nieuw, idVanImport), lijn(bestaand, (x) => x))) uit.push("lijnen");
  if (!!nieuw.verbergCompartimenten !== !!bestaand.verbergCompartimenten) uit.push("compartimenten");
  return uit;
}

/**
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} model - de import (ids uit de lezer)
 * @param {{elements?: Record<string, any>, diagrams?: Record<string, any>}} state - de profielstore
 * @param {{pakketIds?: Set<number>|number[]}} [opties] - EA-pakketten van deze import, voor "verdwenen"
 */
export function vergelijkMetStore(model, state, { pakketIds = [] } = {}) {
  const bestaandeEl = state?.elements || {};
  const bestaandeDi = state?.diagrams || {};
  const pakketten = new Set([...(pakketIds instanceof Set ? pakketIds : pakketIds)].map(Number));

  // Bestaande elementen/diagrammen op GUID.
  const elPerGuid = new Map();
  for (const el of Object.values(bestaandeEl)) if (el?.data?.eaGuid) elPerGuid.set(el.data.eaGuid, el);
  const diPerGuid = new Map();
  for (const d of Object.values(bestaandeDi)) {
    const g = diagramGuid(d.id);
    if (g) diPerGuid.set(g, d);
  }

  /** import-id → bestaand id (alleen voor gevonden tegenhangers). */
  const idMap = new Map();
  for (const el of Object.values(model.elements || {})) {
    const b = el.data?.eaGuid ? elPerGuid.get(el.data.eaGuid) : null;
    if (b) idMap.set(el.id, b.id);
  }
  for (const d of Object.values(model.diagrams || {})) {
    const g = diagramGuid(d.id);
    const b = g ? diPerGuid.get(g) : null;
    if (b) idMap.set(d.id, b.id);
  }
  // Bevat-connectoren (package → lid) hebben geen GUID maar een samengesteld
  // id; hun tegenhanger is de bevat-lijn tussen dezelfde (bestaande) ids.
  const bevatBestaand = new Map();
  for (const el of Object.values(bestaandeEl)) {
    if (el.elementType === "bevat" && el.source && el.target) bevatBestaand.set(`${el.source}~${el.target}`, el);
  }
  for (const el of Object.values(model.elements || {})) {
    if (el.elementType !== "bevat" || idMap.has(el.id)) continue;
    const b = bevatBestaand.get(`${idMap.get(el.source) || el.source}~${idMap.get(el.target) || el.target}`);
    if (b) idMap.set(el.id, b.id);
  }
  const idVanImport = (id) => idMap.get(id) || id;

  const elementen = { nieuw: [], gewijzigd: [], ongewijzigd: [], verdwenen: [] };
  for (const el of Object.values(model.elements || {})) {
    const bestaandId = idMap.get(el.id);
    if (!bestaandId) {
      elementen.nieuw.push({ id: el.id, naam: el.naam, elementType: el.elementType });
      continue;
    }
    const verschillen = verschillenElement(el, bestaandeEl[bestaandId], idVanImport);
    (verschillen.length ? elementen.gewijzigd : elementen.ongewijzigd).push({
      id: el.id,
      bestaandId,
      naam: el.naam || bestaandeEl[bestaandId].naam,
      elementType: el.elementType,
      verschillen,
    });
  }
  const diagrammen = { nieuw: [], gewijzigd: [], ongewijzigd: [], verdwenen: [] };
  for (const d of Object.values(model.diagrams || {})) {
    const bestaandId = idMap.get(d.id);
    if (!bestaandId) {
      diagrammen.nieuw.push({ id: d.id, naam: d.naam });
      continue;
    }
    const verschillen = verschillenDiagram(d, bestaandeDi[bestaandId], idVanImport);
    (verschillen.length ? diagrammen.gewijzigd : diagrammen.ongewijzigd).push({ id: d.id, bestaandId, naam: d.naam, verschillen });
  }

  // Verdwenen: bestaand, uit dezelfde EA-pakketten, niet meer in de import.
  if (pakketten.size) {
    const geimporteerdeGuids = new Set(Object.values(model.elements || {}).map((e) => e.data?.eaGuid).filter(Boolean));
    for (const el of Object.values(bestaandeEl)) {
      const g = el?.data?.eaGuid;
      if (!g || !pakketten.has(Number(el.data?.eaPakket)) || geimporteerdeGuids.has(g)) continue;
      elementen.verdwenen.push({ bestaandId: el.id, naam: el.naam, elementType: el.elementType });
    }
    const geimporteerdeDi = new Set(Object.values(model.diagrams || {}).map((d) => diagramGuid(d.id)).filter(Boolean));
    for (const d of Object.values(bestaandeDi)) {
      const g = diagramGuid(d.id);
      if (!g || !pakketten.has(Number(d.eaPakket)) || geimporteerdeDi.has(g)) continue;
      diagrammen.verdwenen.push({ bestaandId: d.id, naam: d.naam });
    }
  }

  return { idMap, elementen, diagrammen };
}

/**
 * Herschrijf de import op bestaande ids (uit het plan), zodat nieuwe
 * connectoren naar bestaande elementen wijzen en diagrammen bestaande
 * voorkomens hergebruiken.
 */
export function herschrijfOpBestaandeIds(model, idMap) {
  const her = (x) => (x == null ? x : idMap.get(x) ?? x);
  const elements = {};
  for (const el of Object.values(model.elements || {})) {
    const id = her(el.id);
    const data = { ...(el.data || {}) };
    if (data.randVan) data.randVan = her(data.randVan);
    if (data.gedragDiagramId) data.gedragDiagramId = her(data.gedragDiagramId);
    elements[id] = { ...el, id, ...(el.source ? { source: her(el.source) } : {}), ...(el.target ? { target: her(el.target) } : {}), data };
  }
  const diagrams = {};
  for (const d of Object.values(model.diagrams || {})) {
    const id = her(d.id);
    diagrams[id] = {
      ...d,
      id,
      nodes: (d.nodes || []).map((n) => ({ ...n, elementId: her(n.elementId), ...(n.nodeId ? { nodeId: her(n.nodeId) } : {}) })),
      edges: (d.edges || []).map((e) => ({ ...e, source: her(e.source), target: her(e.target) })),
      ...(d.verborgenConnectoren ? { verborgenConnectoren: d.verborgenConnectoren.map(her) } : {}),
      ...(d.lijnen ? { lijnen: Object.fromEntries(Object.entries(d.lijnen).map(([cid, l]) => [her(cid), l])) } : {}),
      ...(d.gedaanteOverrides ? { gedaanteOverrides: Object.fromEntries(Object.entries(d.gedaanteOverrides).map(([cid, v]) => [her(cid), v])) } : {}),
    };
  }
  return { ...model, elements, diagrams };
}

/**
 * Pas een plan toe op een profielstore volgens de keuzes.
 * @param {any} st - store-state met acties (importeerModel, updateElementen, zetDiagram, deleteElement, deleteDiagram)
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} model - de import (lezer-ids)
 * @param {ReturnType<typeof vergelijkMetStore>} plan
 * @param {{aan: Set<string>}} keuzes - sleutels `el:<importId>` / `di:<importId>` / `weg:<bestaandId>` die aan staan
 * @returns {{toegevoegd: number, bijgewerkt: number, verwijderd: number, diagrammenToegevoegd: number, diagrammenBijgewerkt: number}}
 */
export function pasPlanToe(st, model, plan, keuzes) {
  const aan = keuzes?.aan || new Set();
  const her = herschrijfOpBestaandeIds(model, plan.idMap);
  const uit = { toegevoegd: 0, bijgewerkt: 0, verwijderd: 0, diagrammenToegevoegd: 0, diagrammenBijgewerkt: 0 };

  // 1. Nieuw (aangevinkt): in één keer via importeerModel. Een nieuwe
  //    connector naar een niet-aangevinkt nieuw element valt af.
  const nieuweEl = new Set(plan.elementen.nieuw.filter((r) => aan.has(`el:${r.id}`)).map((r) => r.id));
  const bestaatStraks = (id) => !!st.elements?.[id] || nieuweEl.has(plan.idMap.has(id) ? id : id);
  const elements = {};
  for (const id of nieuweEl) {
    const el = her.elements[id];
    if (!el) continue;
    if (el.source && !st.elements?.[el.source] && !nieuweEl.has(el.source)) continue;
    if (el.target && !st.elements?.[el.target] && !nieuweEl.has(el.target)) continue;
    elements[el.id] = el;
  }
  const diagrams = {};
  for (const r of plan.diagrammen.nieuw) {
    if (!aan.has(`di:${r.id}`)) continue;
    const d = her.diagrams[r.id];
    if (!d) continue;
    diagrams[d.id] = { ...d, nodes: d.nodes.filter((n) => st.elements?.[n.elementId] || elements[n.elementId]) };
  }
  if (Object.keys(elements).length || Object.keys(diagrams).length) {
    st.importeerModel({ diagramTypeId: model.diagramTypeId, elements, diagrams }, { modus: "toevoegen" });
    uit.toegevoegd = Object.keys(elements).length;
    uit.diagrammenToegevoegd = Object.keys(diagrams).length;
  }

  // 2. Gewijzigd (aangevinkt): patch op het bestaande id, in één stap.
  const patches = {};
  for (const r of plan.elementen.gewijzigd) {
    if (!aan.has(`el:${r.id}`)) continue;
    const el = her.elements[r.bestaandId];
    if (!el) continue;
    const bestaand = st.elements?.[r.bestaandId] || {};
    // Lokale data (labelposities, z-volgorde, gedaante) blijft staan; wat EA
    // niet meer levert (bv. knikken die weg zijn, een tag) gaat weg — de
    // store merget data per sleutel, dus expliciet op undefined zetten.
    const data = { ...(el.data || {}) };
    for (const k of Object.keys(bestaand.data || {})) if (!(k in data)) data[k] = LOKALE_DATA.has(k) ? bestaand.data[k] : undefined;
    patches[r.bestaandId] = {
      naam: el.naam,
      elementType: el.elementType,
      compartimenten: el.compartimenten || [],
      ...(el.source ? { source: el.source } : {}),
      ...(el.target ? { target: el.target } : {}),
      data,
    };
  }
  if (Object.keys(patches).length) {
    st.updateElementen(patches);
    uit.bijgewerkt = Object.keys(patches).length;
  }
  for (const r of plan.diagrammen.gewijzigd) {
    if (!aan.has(`di:${r.id}`)) continue;
    const d = her.diagrams[r.bestaandId];
    if (!d) continue;
    // Lijndata per diagram uit EA; lokale labelposities op dit diagram blijven.
    const bestaandeLijnen = st.diagrams?.[r.bestaandId]?.lijnen || {};
    const lijnen = {};
    for (const cid of new Set([...Object.keys(d.lijnen || {}), ...Object.keys(bestaandeLijnen)])) {
      const uitEa = d.lijnen?.[cid] || {};
      const lokaal = {};
      for (const k of LOKALE_DATA) if (bestaandeLijnen[cid]?.[k] !== undefined) lokaal[k] = bestaandeLijnen[cid][k];
      const samen = { ...uitEa, ...lokaal };
      if (Object.keys(samen).length) lijnen[cid] = samen;
    }
    st.zetDiagram(r.bestaandId, {
      naam: d.naam,
      nodes: d.nodes.filter((n) => st.elements?.[n.elementId] || elements[n.elementId]),
      verborgenConnectoren: d.verborgenConnectoren || [],
      lijnen,
      verbergCompartimenten: !!d.verbergCompartimenten,
    });
    uit.diagrammenBijgewerkt += 1;
  }

  // 3. Verdwenen (aangevinkt): weg.
  for (const r of plan.diagrammen.verdwenen) {
    if (!aan.has(`weg:${r.bestaandId}`)) continue;
    st.deleteDiagram(r.bestaandId);
    uit.verwijderd += 1;
  }
  for (const r of plan.elementen.verdwenen) {
    if (!aan.has(`weg:${r.bestaandId}`)) continue;
    st.deleteElement(r.bestaandId);
    uit.verwijderd += 1;
  }
  return uit;
}

/** Standaardkeuze: alles aan behalve "verdwenen" (weghalen vraagt een bewuste vink). */
export function standaardKeuzes(plan) {
  const aan = new Set();
  for (const r of [...plan.elementen.nieuw, ...plan.elementen.gewijzigd]) aan.add(`el:${r.id}`);
  for (const r of [...plan.diagrammen.nieuw, ...plan.diagrammen.gewijzigd]) aan.add(`di:${r.id}`);
  return { aan };
}
