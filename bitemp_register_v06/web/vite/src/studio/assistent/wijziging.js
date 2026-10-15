// @ts-check
/**
 * wijziging — de toepasser van de AI-assistent (AI-2 stap 1b, 14-10-2026), zuiver.
 *
 * Gecontroleerd plan (assistentKern.controleerPlan) + de huidige stand van het project →
 * één **wijziging**: nieuwe mappen, per profiel de elementen en diagrammen die gezet worden
 * (nieuw of aangevuld), de plaatsing in de boom en kruisverbanden. Alle ids worden hier
 * bepaald, zodat elke ontvanger hetzelfde toepast:
 *  - de Studio via de stores (nieuweMap, pasWijzigingToe, plaatsPerMap, patchLinks — gesynct);
 *  - de MCP via `naarOps` als projectsync-operaties (POST /api/studio/projecten/:id/ops).
 *
 * Opstelling: een nieuw diagram krijgt de kolommen-opstelling (kolommenLayout); op een
 * bestaand diagram komen de nieuwe knopen rechts naast wat er al staat.
 */
import { legUit } from "../../transformatie/kolommenLayout.js";
import { berekenUitlijning } from "../../diagramcore/layout/uitlijnen.js";

const slug = (tekst) =>
  String(tekst || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .toLowerCase();

const STANDAARD = { breedte: 160, hoogte: 70 };
const CONTAINER = { breedte: 320, hoogte: 200 };

/**
 * @param {any} plan          - uitvoer van controleerPlan
 * @param {{mappen?: Record<string, any>, plaatsing?: Record<string, string>, profielen: Record<string, {elements?: Record<string, any>, diagrams?: Record<string, any>}>}} stand
 * @param {{mapId?: string|null, samenvattingen: any[], prefix?: string, nu?: number, gemeten?: Record<string, {w: number, h: number}>}} opties
 *   `gemeten`: maten van knopen zoals het canvas ze tekent (voorkomen-id → {w, h}); uitlijnen
 *   rekent daarmee, net als de werkbalk (melding #11: een actor is 64×~70, geen schatting).
 */
export function maakWijziging(plan, stand, { mapId = null, samenvattingen, prefix = "ai", nu = Date.now(), gemeten = {} }) {
  const taal = new Map(samenvattingen.map((s) => [s.id, s]));
  const etVan = (profielId, type) => taal.get(profielId)?.elementen.find((e) => e.id === type);
  const profielen = {}; // profielId → {elements, diagrams}
  const bij = (profielId) => (profielen[profielId] ||= { elements: {}, diagrams: {} });
  const huidig = (profielId) => stand.profielen?.[profielId] || { elements: {}, diagrams: {} };
  const elementVan = (profielId, id) => bij(profielId).elements[id] || huidig(profielId).elements?.[id];

  // ── Ids ──
  const uniek = (profielId, basis) => {
    const h = huidig(profielId), b = bij(profielId);
    const bezet = (id) => !!(h.elements?.[id] || h.diagrams?.[id] || b.elements[id] || b.diagrams[id]);
    let id = basis;
    for (let n = 2; bezet(id); n += 1) id = `${basis}_${n}`;
    return id;
  };

  // ── 1. Mappen ──
  const mappen = [];
  const alleMappen = { ...(stand.mappen || {}) };
  const zoekSubmap = (naam) => {
    const n = String(naam).toLowerCase();
    return Object.values(alleMappen).find((m) => (m.ouderId || null) === (mapId || null) && String(m.naam).toLowerCase() === n)?.id || null;
  };
  const submap = (naam) => {
    if (!naam) return mapId;
    const al = zoekSubmap(naam);
    if (al) return al;
    const id = `map_${nu}_${prefix}${mappen.length + 1}`;
    const m = { id, naam, ouderId: mapId || null };
    mappen.push(m);
    alleMappen[id] = m;
    return id;
  };

  // ── 2. Diagrammen: id en map ──
  const diagramId = new Map(); // sleutel → {profielId, id, map, nieuw}
  for (const d of plan.diagrammen) {
    if (d.bestaandId) { diagramId.set(d.sleutel, { profielId: d.profielId, id: d.bestaandId, nieuw: false, map: stand.plaatsing?.[`${d.profielId}::${d.bestaandId}`] ?? mapId }); continue; }
    const id = uniek(d.profielId, `${prefix}_diagram_${slug(d.naam) || "nieuw"}`);
    bij(d.profielId).diagrams[id] = { id, naam: d.naam, diagramType: taal.get(d.profielId)?.diagramTypeId || d.profielId, nodes: [], edges: [] };
    diagramId.set(d.sleutel, { profielId: d.profielId, id, nieuw: true, map: null, mapRef: d.map }); // map: zie 3b
  }

  // ── 3. Elementen ──
  const idVan = new Map(); // sleutel → id
  const plaatsing = {}; // key → mapId
  for (const e of plan.elementen) {
    const id = uniek(e.profielId, `${prefix}_${slug(e.naam) || e.type}`);
    idVan.set(e.sleutel, id);
    bij(e.profielId).elements[id] = { id, naam: e.naam, elementType: e.type, compartimenten: [], data: { ...e.data } };
  }
  // ── 3b. De "map" van een nieuw diagram: een bestaande submap, een element met een
  // uitwerking (M3 `uitwerking`: bestaand en geplaatst, of nieuw in dit plan — het diagram hangt
  // dan in de boom onder dat element, zoals een activiteitendiagram onder een use case), of
  // anders een nieuwe submap. ──
  const uitwerkingOuder = (naam) => {
    const n = String(naam).toLowerCase();
    for (const e of plan.elementen) {
      if ((e.sleutel.toLowerCase() === n || (e.naam || "").toLowerCase() === n) && etVan(e.profielId, e.type)?.uitwerking) {
        return `el::${e.profielId}::${idVan.get(e.sleutel)}`;
      }
    }
    for (const [pid, p] of Object.entries(stand.profielen || {})) {
      for (const el of Object.values(p.elements || {})) {
        if (el.source || !etVan(pid, el.elementType)?.uitwerking) continue;
        if (el.id !== naam && String(el.naam || "").toLowerCase() !== n) continue;
        const key = `el::${pid}::${el.id}`;
        if (stand.plaatsing?.[key]) return key;
      }
    }
    return null;
  };
  for (const d of diagramId.values()) {
    if (!d.nieuw) continue;
    d.map = d.mapRef ? zoekSubmap(d.mapRef) || uitwerkingOuder(d.mapRef) || submap(d.mapRef) : mapId;
  }
  for (const e of plan.elementen) plaatsing[`el::${e.profielId}::${idVan.get(e.sleutel)}`] = diagramId.get(e.diagram)?.map ?? mapId;
  const ref = (r) => (r?.nieuw ? idVan.get(r.nieuw) : r?.id);
  for (const h of plan.hernoemd) {
    const el = elementVan(h.profielId, h.id);
    if (el) bij(h.profielId).elements[h.id] = { ...el, naam: h.naam };
  }

  // Lidmaatschap → container-connector ("bevat") + groep voor de opstelling.
  const groepVan = new Map(); // elementId → containerId
  for (const e of plan.elementen) {
    if (!e.in) continue;
    const lid = idVan.get(e.sleutel), container = ref(e.in);
    const ct = etVan(e.profielId, elementVan(e.profielId, container)?.elementType);
    if (!container || !ct?.container) continue;
    const id = uniek(e.profielId, `${prefix}_${ct.container}_${slug(e.naam)}`);
    bij(e.profielId).elements[id] = { id, naam: "", elementType: ct.container, source: container, target: lid, compartimenten: [], data: {} };
    groepVan.set(lid, container);
  }
  // Bestaande elementen in een container (melding #9): bevat-connector, tenzij die er al is.
  const containerOpDiagrammen = [];
  for (const l of plan.leden || []) {
    const container = ref(l.in);
    const ct = etVan(l.profielId, elementVan(l.profielId, container)?.elementType);
    if (!container || !ct?.container) continue;
    const al = Object.values(huidig(l.profielId).elements || {}).some((x) => x.elementType === ct.container && x.source === container && x.target === l.id);
    if (!al) {
      const id = uniek(l.profielId, `${prefix}_${ct.container}_${slug(elementVan(l.profielId, l.id)?.naam) || l.id}`);
      bij(l.profielId).elements[id] = { id, naam: "", elementType: ct.container, source: container, target: l.id, compartimenten: [], data: {} };
    }
    groepVan.set(l.id, container);
    containerOpDiagrammen.push({ profielId: l.profielId, lid: l.id, container });
  }

  // ── 4. Connectoren ──
  const nodesBij = new Map(); // diagram-sleutel → Set(elementId)
  const zetOp = (sleutel, id) => { if (!nodesBij.has(sleutel)) nodesBij.set(sleutel, new Set()); nodesBij.get(sleutel).add(id); };
  for (const e of plan.elementen) zetOp(e.diagram, idVan.get(e.sleutel));
  for (const o of plan.opDiagram) zetOp(o.diagram, o.id);
  const diagramVanElement = new Map(plan.elementen.map((e) => [idVan.get(e.sleutel), e.diagram]));
  const opBestaand = (profielId, elementId) =>
    Object.values(huidig(profielId).diagrams || {}).filter((d) => (d.nodes || []).some((n) => n.elementId === elementId)).map((d) => d.id);
  for (const { profielId, lid, container } of containerOpDiagrammen) {
    for (const did of opBestaand(profielId, lid)) {
      const sleutel = `bestaand:${did}`;
      if (!diagramId.has(sleutel)) diagramId.set(sleutel, { profielId, id: did, nieuw: false, map: null });
      zetOp(sleutel, container);
    }
  }
  const zonderDiagram = [];
  for (const c of plan.connectoren) {
    const bron = ref(c.bron), doel = ref(c.doel);
    const bronEl = elementVan(c.profielId, bron), doelEl = elementVan(c.profielId, doel);
    const id = uniek(c.profielId, `${prefix}_${c.type}_${slug(bronEl?.naam)}_${slug(doelEl?.naam)}`.slice(0, 60));
    bij(c.profielId).elements[id] = { id, naam: c.naam || "", elementType: c.type, source: bron, target: doel, compartimenten: [], data: { ...c.data } };
    // Op welk diagram? Expliciet, anders dat van een nieuw uiteinde, anders een bestaand
    // diagram waar beide al staan (dan niets te doen), anders een plandiagram van die taal,
    // anders een bestaand diagram met één uiteinde.
    let sleutel = c.diagram || diagramVanElement.get(bron) || diagramVanElement.get(doel) || null;
    if (!sleutel) {
      const opB = opBestaand(c.profielId, bron), opD = opBestaand(c.profielId, doel);
      if (opB.some((d) => opD.includes(d))) continue;
      const plan1 = plan.diagrammen.find((d) => d.profielId === c.profielId);
      if (plan1) sleutel = plan1.sleutel;
      else if (opB.length || opD.length) {
        const doelDiagram = opB[0] || opD[0];
        sleutel = `bestaand:${doelDiagram}`;
        if (!diagramId.has(sleutel)) diagramId.set(sleutel, { profielId: c.profielId, id: doelDiagram, nieuw: false, map: null });
      } else { zonderDiagram.push(id); continue; }
    }
    zetOp(sleutel, bron);
    zetOp(sleutel, doel);
  }

  // ── 5. Knopen en opstelling per diagram ──
  const openen = [];
  for (const [sleutel, ids] of nodesBij) {
    const d = diagramId.get(sleutel);
    if (!d) continue;
    const huidigDiagram = bij(d.profielId).diagrams[d.id] || huidig(d.profielId).diagrams?.[d.id];
    if (!huidigDiagram) continue;
    const al = new Set((huidigDiagram.nodes || []).map((n) => n.elementId));
    // Een lid zonder zijn container: de container erbij (als die nog niet op het diagram staat).
    for (const id of [...ids]) { const g = groepVan.get(id); if (g && !al.has(g)) ids.add(g); }
    const nieuw = [...ids].filter((id) => id && !al.has(id) && elementVan(d.profielId, id));
    if (!nieuw.length) continue;
    const maat = (id) => {
      const et = etVan(d.profielId, elementVan(d.profielId, id)?.elementType);
      return et?.container ? CONTAINER : STANDAARD;
    };
    const verbindingen = Object.values({ ...huidig(d.profielId).elements, ...bij(d.profielId).elements })
      .filter((x) => x.source && nieuw.includes(x.source) && nieuw.includes(x.target))
      .map((x) => ({ bron: x.source, doel: x.target }));
    // Rechts naast wat er al staat (bestaand diagram), anders linksboven.
    let oorsprong = { x: 40, y: 40 };
    const oud = huidigDiagram.nodes || [];
    if (oud.length) {
      const rechts = Math.max(...oud.map((n) => (n.position?.x || 0) + (n.size?.width || STANDAARD.breedte)));
      const boven = Math.min(...oud.map((n) => n.position?.y || 0));
      oorsprong = { x: rechts + 120, y: boven };
    }
    const plekken = legUit({
      knopen: nieuw.map((id) => ({ id, groep: nieuw.includes(groepVan.get(id)) ? groepVan.get(id) : null, container: !!etVan(d.profielId, elementVan(d.profielId, id)?.elementType)?.container, ...maat(id) })),
      verbindingen,
      oorsprong,
    });
    const nodes = nieuw.map((id) => {
      const p = plekken.get(id) || { x: oorsprong.x, y: oorsprong.y, ...maat(id) };
      const vast = etVan(d.profielId, elementVan(d.profielId, id)?.elementType)?.vast;
      return { elementId: id, position: { x: Math.round(p.x), y: Math.round(p.y) }, ...(vast ? {} : { size: { width: Math.round(p.breedte), height: Math.round(p.hoogte) } }) };
    });
    // Containers eerst (ze liggen onder hun leden).
    const isC = (n) => (etVan(d.profielId, elementVan(d.profielId, n.elementId)?.elementType)?.container ? 1 : 0);
    nodes.sort((a, b) => isC(b) - isC(a));
    bij(d.profielId).diagrams[d.id] = { ...huidigDiagram, nodes: [...oud, ...nodes] };
    openen.push({ profielId: d.profielId, diagramId: d.id });
  }
  // Leden die (nog) buiten hun container liggen, erin zetten — onder wat er al in ligt — en de
  // container zo nodig groter maken. Op elk gewijzigd diagram, en op bestaande diagrammen waar
  // een lid en zijn container allebei al staan.
  const maatVan = (profielId, n) => {
    const g = gemeten[n.nodeId || n.elementId];
    if (g?.w && g?.h) return g;
    if (n.size) return { w: n.size.width, h: n.size.height };
    const et = etVan(profielId, elementVan(profielId, n.elementId)?.elementType);
    // Zonder canvas (MCP): vaste vormen zoals een actor zijn ongeveer 64×70 (figuur + naam).
    return et?.container ? { w: CONTAINER.breedte, h: CONTAINER.hoogte } : et?.vast ? { w: 64, h: 70 } : { w: STANDAARD.breedte, h: STANDAARD.hoogte };
  };
  const nestel = (profielId, diagram) => {
    const nodes = (diagram.nodes || []).map((n) => ({ ...n, position: { ...n.position } }));
    const opId = new Map();
    for (const n of nodes) if (!opId.has(n.elementId)) opId.set(n.elementId, n);
    const perContainer = new Map();
    for (const [lid, c] of groepVan) {
      if (!opId.has(lid) || !opId.has(c) || !elementVan(profielId, lid) || !elementVan(profielId, c)) continue;
      if (!perContainer.has(c)) perContainer.set(c, []);
      perContainer.get(c).push(lid);
    }
    let veranderd = false;
    for (const [c, lids] of perContainer) {
      const cn = opId.get(c);
      const cm = maatVan(profielId, cn);
      const binnen = (n) => {
        const m = maatVan(profielId, n);
        return n.position.x >= cn.position.x && n.position.y >= cn.position.y && n.position.x + m.w <= cn.position.x + cm.w && n.position.y + m.h <= cn.position.y + cm.h;
      };
      const buiten = lids.map((id) => opId.get(id)).filter((n) => !binnen(n));
      if (!buiten.length) continue;
      const erin = nodes.filter((n) => n !== cn && binnen(n));
      let y = Math.max(cn.position.y + 50, ...erin.map((n) => n.position.y + maatVan(profielId, n).h + 16));
      const x = cn.position.x + 24;
      let rechts = cn.position.x + cm.w, onder = cn.position.y + cm.h;
      for (const n of buiten) {
        const m = maatVan(profielId, n);
        n.position = { x: Math.round(x), y: Math.round(y) };
        y += m.h + 16;
        rechts = Math.max(rechts, x + m.w + 24);
        onder = Math.max(onder, n.position.y + m.h + 24);
      }
      cn.size = { width: Math.round(rechts - cn.position.x), height: Math.round(onder - cn.position.y) };
      veranderd = true;
    }
    return veranderd ? nodes : null;
  };
  if (groepVan.size) {
    const profielIds = new Set([...Object.keys(profielen), ...(plan.leden || []).map((l) => l.profielId)]);
    for (const profielId of profielIds) {
      const kandidaten = { ...(huidig(profielId).diagrams || {}), ...bij(profielId).diagrams };
      for (const diagram of Object.values(kandidaten)) {
        const nodes = nestel(profielId, diagram);
        if (!nodes) continue;
        bij(profielId).diagrams[diagram.id] = { ...diagram, nodes };
        if (!openen.some((o) => o.profielId === profielId && o.diagramId === diagram.id)) openen.push({ profielId, diagramId: diagram.id });
      }
    }
  }

  // ── 5b. Opstelling (melding #11: "lijn alles horizontaal uit") ──
  // Zelfde rekenwerk als de werkbalk Uitlijnen; een container neemt zijn leden mee (tenzij die
  // zelf meedoen). "automatisch" = kolommen-opstelling over het hele diagram.
  const uitgelijnd = new Set();
  const ledenVan = (profielId) => {
    const m = new Map();
    for (const e of Object.values({ ...huidig(profielId).elements, ...bij(profielId).elements })) {
      if (!e?.source) continue;
      const ct = etVan(profielId, elementVan(profielId, e.source)?.elementType);
      if (ct?.container && ct.container === e.elementType) {
        if (!m.has(e.source)) m.set(e.source, []);
        m.get(e.source).push(e.target);
      }
    }
    return m;
  };
  for (const o of plan.opstelling || []) {
    const d = diagramId.get(o.diagram) || (plan.diagrammen.find((x) => x.sleutel === o.diagram) && diagramId.get(o.diagram));
    if (!d) continue;
    const diagram = bij(d.profielId).diagrams[d.id] || huidig(d.profielId).diagrams?.[d.id];
    if (!diagram) continue;
    const nodes = (diagram.nodes || []).map((n) => ({ ...n, position: { ...n.position } }));
    const opId = new Map();
    for (const n of nodes) if (!opId.has(n.elementId) && elementVan(d.profielId, n.elementId) && !elementVan(d.profielId, n.elementId).source) opId.set(n.elementId, n);
    const leden = ledenVan(d.profielId);
    // "Alles" bij verdelen: zonder de leden van een container die ook meedoet — die schuiven met
    // hem mee (anders verdeel je een kader en zijn inhoud naast elkaar). Bij uitlijnen doen ze
    // wel mee: dan komt een lid op dezelfde lijn, midden in zijn kader.
    const lidVanIets = new Set([...leden].filter(([c]) => opId.has(c)).flatMap(([, ls]) => ls));
    const verdelen = o.modus.startsWith("distribute");
    const gekozen = o.elementen.length ? o.elementen.map(ref).filter((id) => opId.has(id)) : [...opId.keys()].filter((id) => !verdelen || !lidVanIets.has(id));
    const item = (id) => { const n = opId.get(id), m = maatVan(d.profielId, n); return { id, x: n.position.x, y: n.position.y, width: m.w, height: m.h }; };
    let posities = {};
    if (o.modus === "automatisch") {
      const groep = new Map();
      for (const [c, ls] of leden) for (const l of ls) if (opId.has(c) && opId.has(l)) groep.set(l, c);
      const plekken = legUit({
        knopen: [...opId.keys()].map((id) => ({ id, groep: groep.get(id) ?? null, container: !!etVan(d.profielId, elementVan(d.profielId, id)?.elementType)?.container, breedte: item(id).width, hoogte: item(id).height })),
        verbindingen: Object.values({ ...huidig(d.profielId).elements, ...bij(d.profielId).elements }).filter((x) => x.source && opId.has(x.source) && opId.has(x.target)).map((x) => ({ bron: x.source, doel: x.target })),
      });
      for (const [id, p] of plekken) posities[id] = { x: p.x, y: p.y };
      for (const [id, p] of plekken) if (etVan(d.profielId, elementVan(d.profielId, id)?.elementType)?.container) opId.get(id).size = { width: Math.round(p.breedte), height: Math.round(p.hoogte) };
    } else {
      posities = berekenUitlijning(o.modus, gekozen.map(item));
      // Leden van een verschoven container schuiven mee (als ze zelf niet meedoen).
      for (const [id, p] of Object.entries({ ...posities })) {
        const n = opId.get(id);
        const dx = p.x - n.position.x, dy = p.y - n.position.y;
        for (const l of leden.get(id) || []) if (opId.has(l) && !gekozen.includes(l) && !posities[l]) posities[l] = { x: opId.get(l).position.x + dx, y: opId.get(l).position.y + dy };
      }
    }
    if (!Object.keys(posities).length) continue;
    for (const [id, p] of Object.entries(posities)) opId.get(id).position = { x: Math.round(p.x), y: Math.round(p.y) };
    bij(d.profielId).diagrams[d.id] = { ...diagram, nodes };
    uitgelijnd.add(`${d.profielId}::${d.id}`);
    if (!openen.some((x) => x.profielId === d.profielId && x.diagramId === d.id)) openen.push({ profielId: d.profielId, diagramId: d.id });
  }

  for (const [, d] of diagramId) {
    if (d.nieuw) plaatsing[`${d.profielId}::${d.id}`] = d.map ?? mapId;
    if (d.nieuw && !openen.some((o) => o.diagramId === d.id && o.profielId === d.profielId)) openen.push({ profielId: d.profielId, diagramId: d.id });
  }

  // ── 6. Kruisverbanden ──
  const links = plan.verbanden
    .map((v) => {
      const rij = { profielId: v.vanProfiel, elementId: ref(v.van) };
      const kolom = { profielId: v.naarProfiel, elementId: ref(v.naar) };
      if (!rij.elementId || !kolom.elementId) return null;
      return { id: `${rij.profielId}::${rij.elementId}##${kolom.profielId}::${kolom.elementId}`, rij, kolom, soort: v.soort, omgekeerd: false };
    })
    .filter(Boolean);

  // ── Samenvatting ──
  const nEl = plan.elementen.length;
  const nRel = plan.connectoren.length;
  const nDia = [...diagramId.values()].filter((d) => d.nieuw).length;
  const delen = [];
  if (mappen.length) delen.push(`${mappen.length} map${mappen.length === 1 ? "" : "pen"}`);
  if (nDia) delen.push(`${nDia} diagram${nDia === 1 ? "" : "men"}`);
  if (nEl) delen.push(`${nEl} element${nEl === 1 ? "" : "en"}`);
  if (nRel) delen.push(`${nRel} relatie${nRel === 1 ? "" : "s"}`);
  if (plan.hernoemd.length) delen.push(`${plan.hernoemd.length} hernoemd`);
  if (plan.leden?.length) delen.push(`${plan.leden.length} in een container gezet`);
  if (uitgelijnd.size) delen.push(`${uitgelijnd.size === 1 ? "diagram" : `${uitgelijnd.size} diagrammen`} opnieuw opgesteld`);
  if (links.length) delen.push(`${links.length} verband${links.length === 1 ? "" : "en"}`);

  return {
    mappen,
    profielen,
    plaatsing,
    links,
    openen,
    zonderDiagram,
    samenvatting: delen.length ? delen.join(", ") : "geen wijzigingen",
  };
}

/**
 * De wijziging als projectsync-operaties (zelfde vorm als de Studio ze verstuurt; zie
 * studio/sync/operaties.js). Alleen ops die hun ids meedragen, zodat elke client precies
 * hetzelfde toepast; patchElementen/patchDiagrammen gooien bij het naspelen nooit.
 */
export function naarOps(w) {
  const ops = [];
  for (const m of w.mappen) ops.push({ store: "structuur", op: "nieuweMap", args: [m.naam, m.ouderId, m.id] });
  for (const [profielId, p] of Object.entries(w.profielen)) {
    if (Object.keys(p.elements).length) ops.push({ store: `model:${profielId}`, op: "patchElementen", args: [{ zet: p.elements, wis: [] }] });
    if (Object.keys(p.diagrams).length) ops.push({ store: `model:${profielId}`, op: "patchDiagrammen", args: [{ zet: p.diagrams, wis: [] }] });
  }
  const perMap = {};
  for (const [key, mapId] of Object.entries(w.plaatsing)) (perMap[mapId ?? "null"] ||= []).push(key);
  if (Object.keys(perMap).length) ops.push({ store: "structuur", op: "plaatsPerMap", args: [perMap] });
  if (w.links.length) ops.push({ store: "kruis", op: "patchLinks", args: [{ zet: w.links, wis: [] }] });
  return ops;
}
