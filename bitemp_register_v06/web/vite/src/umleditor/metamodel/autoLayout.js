/**
 * Auto-layout — Logische, hiërarchische ordening van REPs op het canvas.
 *
 * Doelstelling:
 *   - Entiteit (ENT) centraal/bovenaan binnen zijn cluster
 *   - GE's eronder (rij of grid bij veel GE's, ring bij heel veel)
 *   - Relaties (REL) tussen 2 ENTs op halverwege geplaatst
 *   - AssociatieAnker (ANKER) tussen ENT en REL
 *   - Enums / datatypes / referentielijst-instanties klein, gegroepeerd onderaan per consumer-GE
 *   - Notities en constraints daarnaast
 *   - Domein-elementen visueel bij elkaar als er meerdere domeinen op het canvas staan
 *   - ENTs met veel verbindingen krijgen meer ruimte (worden niet "geknepen" door buren)
 *
 * Het algoritme is volledig deterministisch (geen force-directed simulatie),
 * zodat herhaald uitvoeren consistente resultaten oplevert. Per node wordt
 * alleen `position` aangepast; alle andere data (handles, edges, hidden-status)
 * blijft ongemoeid.
 *
 * API:
 *   const nieuwePosities = berekenAutoLayout(nodes, edges, opts?)
 *     → Map<nodeId, {x, y}>
 *
 *   pasAutoLayoutToe(nodes, edges, opts?) → nieuwe nodes-array (immutable)
 *
 * Opties (alle optioneel):
 *   - alleenZichtbaar  : true → negeer nodes met `hidden: true` (default true)
 *   - paddingX/Y       : ruimte tussen clusters (default 80)
 *   - domainGap        : extra ruimte tussen domeinblokken (default 200)
 *   - geMaxPerRij      : max aantal GE's naast elkaar onder ENT (default 4)
 *   - geRingDrempel    : vanaf dit aantal GE's → ring rondom ENT (default 8)
 *
 * Voor de eerste realisatie is gekozen voor een hiërarchische blok-layout
 * (per domein, per ENT-cluster). Een toekomstige uitbreiding kan force-directed
 * fine-tuning toevoegen.
 */

const DEFAULT_OPTS = {
  alleenZichtbaar: true,
  paddingX: 80,
  paddingY: 80,
  domainGap: 200,
  geMaxPerRij: 4,
  geRingDrempel: 8,
  // Schattingen voor afmetingen wanneer measured/width/height ontbreken.
  // Deze waarden zijn iets ruimer dan de werkelijke nodes om overlap te voorkomen.
  defaultBreedte: { entiteit: 220, gegevenselement: 200, relatie: 200, associatieAnker: 24, enumeratie: 140, gegevenstype: 140, referentielijstInstantie: 160, notitie: 200, constraint: 200 },
  defaultHoogte:  { entiteit: 120, gegevenselement: 80,  relatie: 100, associatieAnker: 24, enumeratie: 80,  gegevenstype: 80,  referentielijstInstantie: 80,  notitie: 100, constraint: 100 },
};

const SECUNDAIR_TYPES = new Set(["enumeratie", "gegevenstype", "referentielijstInstantie"]);
const FLOAT_TYPES = new Set(["notitie", "constraint"]);

/** Lever een veilige breedte/hoogte voor een node. */
function nodeBreedte(node, opts) {
  return node.measured?.width ?? node.width ?? opts.defaultBreedte[node.type] ?? 180;
}
function nodeHoogte(node, opts) {
  return node.measured?.height ?? node.height ?? opts.defaultHoogte[node.type] ?? 80;
}

/**
 * Bouw een lookup met:
 *   - geNaarEnt       : Map<geId, entId>           (compositie ENT → GE)
 *   - geNaarSecundair : Map<geId, Set<secundairId>> (dependency GE → enum/datatype/reflijst)
 *   - relNaarEnts     : Map<relId, [entIds]>       (REL is verbonden met deze ENT-uiteinden)
 *   - relRichting     : Map<relId, {bronId, doelId}> (gedirecteerde uiteinden, indien bekend)
 *   - ankerNaarRel    : Map<ankerId, relId>
 *   - entVerbindingen : Map<entId, count>          (totaal aantal verbindingen voor sizing)
 *   - entFlow         : Map<entId, {uit, in}>      (gerichte rel-tellingen → links/rechts ordening)
 */
function bouwTopologie(nodes, edges, _opts) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const geNaarEnt = new Map();
  const geNaarSecundair = new Map();
  const relNaarEnts = new Map();
  const relRichting = new Map();
  const ankerNaarRel = new Map();
  const entVerbindingen = new Map();
  const entFlow = new Map();

  // Lookup: typenaam → entId, om data.bronEntiteit / data.doelEntiteit (string-namen)
  // te kunnen koppelen aan concrete ENT-nodes.
  const entByTypenaam = new Map();
  for (const n of nodes) {
    if (n.type === "entiteit") {
      const t = n.data?.typenaam || n.data?.naam;
      if (t && !entByTypenaam.has(t)) entByTypenaam.set(t, n.id);
    }
  }

  // Bouw richting-info uit relatie-node data (bron/doelEntiteit zijn typenamen)
  for (const n of nodes) {
    if (n.type !== "relatie") continue;
    const bronId = entByTypenaam.get(n.data?.bronEntiteit);
    const doelId = entByTypenaam.get(n.data?.doelEntiteit);
    if (bronId || doelId) {
      relRichting.set(n.id, { bronId: bronId || null, doelId: doelId || null });
    }
    if (bronId && doelId && bronId !== doelId) {
      const fb = entFlow.get(bronId) || { uit: 0, in: 0 };
      fb.uit += 1;
      entFlow.set(bronId, fb);
      const fd = entFlow.get(doelId) || { uit: 0, in: 0 };
      fd.in += 1;
      entFlow.set(doelId, fd);
    }
  }

  // associatieAnker → relatie via data.relatieNaam (= relatie-node id)
  for (const n of nodes) {
    if (n.type === "associatieAnker" && n.data?.relatieNaam) {
      ankerNaarRel.set(n.id, n.data.relatieNaam);
    }
  }

  for (const e of edges) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (!src || !tgt) continue;

    const isDep = e.data?.isDependency === true;

    // Compositie ENT → GE
    if (!isDep && src.type === "entiteit" && tgt.type === "gegevenselement") {
      if (!geNaarEnt.has(tgt.id)) geNaarEnt.set(tgt.id, src.id);
    }

    // GE → enum/datatype/reflijst (dependency, of structurele edge)
    if (src.type === "gegevenselement" && SECUNDAIR_TYPES.has(tgt.type)) {
      if (!geNaarSecundair.has(src.id)) geNaarSecundair.set(src.id, new Set());
      geNaarSecundair.get(src.id).add(tgt.id);
    }

    // REL ↔ ENT (direct of via anker)
    const collect = (relId, otherId) => {
      const arr = relNaarEnts.get(relId) || [];
      if (!arr.includes(otherId)) arr.push(otherId);
      relNaarEnts.set(relId, arr);
    };
    if (src.type === "relatie" && tgt.type === "entiteit") collect(src.id, tgt.id);
    if (tgt.type === "relatie" && src.type === "entiteit") collect(tgt.id, src.id);
    if (src.type === "associatieAnker" && tgt.type === "entiteit") {
      const relId = ankerNaarRel.get(src.id);
      if (relId) collect(relId, tgt.id);
    }
    if (tgt.type === "associatieAnker" && src.type === "entiteit") {
      const relId = ankerNaarRel.get(tgt.id);
      if (relId) collect(relId, src.id);
    }

    // Tel verbindingen per ENT (voor sizing/sortering)
    for (const node of [src, tgt]) {
      if (node.type === "entiteit") {
        entVerbindingen.set(node.id, (entVerbindingen.get(node.id) || 0) + 1);
      }
    }
  }

  return { nodeMap, geNaarEnt, geNaarSecundair, relNaarEnts, relRichting, ankerNaarRel, entVerbindingen, entFlow };
}

/**
 * Verzamel domein → ent-ids in stabiele volgorde.
 * Een lege/onbekende domein-waarde wordt gegroepeerd onder "_overig".
 */
function groepeerEntsPerDomein(entNodes) {
  const map = new Map();
  for (const n of entNodes) {
    const d = (n.data?.domein || "").trim() || "_overig";
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(n);
  }
  // Stabiel sorteren: domeinen alfabetisch, "_overig" achteraan
  const sorted = [...map.entries()].sort(([a], [b]) => {
    if (a === "_overig") return 1;
    if (b === "_overig") return -1;
    return a.localeCompare(b);
  });
  return sorted;
}

/**
 * Bereken voor één ENT-cluster de relatieve posities van ENT, zijn GE's en
 * de bijbehorende secundaire nodes (enums/datatypes/reflijsten).
 *
 * Retourneert:
 *   { posMap: Map<nodeId, {x,y}>, breedte, hoogte }
 * met (0,0) linksboven van de cluster-bounding-box.
 */
function layoutEntCluster(entNode, geNodes, secundairPerGe, opts) {
  const posMap = new Map();
  const entW = nodeBreedte(entNode, opts);
  const entH = nodeHoogte(entNode, opts);

  // Bepaal layout-modus voor GE's
  const aantal = geNodes.length;
  const ringMode = aantal >= opts.geRingDrempel;

  if (aantal === 0) {
    posMap.set(entNode.id, { x: 0, y: 0 });
    return { posMap, breedte: entW, hoogte: entH };
  }

  if (ringMode) {
    // Cirkellayout: ENT in centrum, GE's in een ring eromheen.
    const maxGeW = Math.max(...geNodes.map((g) => nodeBreedte(g, opts)));
    const maxGeH = Math.max(...geNodes.map((g) => nodeHoogte(g, opts)));
    // Radius zo dat GE's elkaar niet raken
    const omtrek = aantal * (maxGeW + 30);
    const radius = Math.max(entW * 1.2, omtrek / (2 * Math.PI));
    const totaalDiameter = 2 * (radius + Math.max(maxGeW, maxGeH) / 2);

    // ENT in midden
    const cx = totaalDiameter / 2;
    const cy = totaalDiameter / 2;
    posMap.set(entNode.id, { x: cx - entW / 2, y: cy - entH / 2 });

    geNodes.forEach((g, i) => {
      const hoek = (2 * Math.PI * i) / aantal - Math.PI / 2;
      const gw = nodeBreedte(g, opts);
      const gh = nodeHoogte(g, opts);
      const gx = cx + Math.cos(hoek) * radius - gw / 2;
      const gy = cy + Math.sin(hoek) * radius - gh / 2;
      posMap.set(g.id, { x: gx, y: gy });

      // Secundaire nodes radiaal verder naar buiten
      const sec = secundairPerGe.get(g.id);
      if (sec && sec.length > 0) {
        const extraR = radius + maxGeH * 1.2;
        sec.forEach((s, j) => {
          const sw = nodeBreedte(s, opts);
          const sh = nodeHoogte(s, opts);
          const subHoek = hoek + (j - (sec.length - 1) / 2) * 0.08;
          const sx = cx + Math.cos(subHoek) * extraR - sw / 2;
          const sy = cy + Math.sin(subHoek) * extraR - sh / 2;
          posMap.set(s.id, { x: sx, y: sy });
        });
      }
    });

    return { posMap, breedte: totaalDiameter, hoogte: totaalDiameter };
  }

  // Grid-layout: ENT bovenaan, GE's in rijen eronder, secundairen daaronder.
  const cols = Math.min(aantal, opts.geMaxPerRij);
  const rows = Math.ceil(aantal / cols);
  const colWidths = new Array(cols).fill(0);
  const rowHeights = new Array(rows).fill(0);

  geNodes.forEach((g, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    colWidths[c] = Math.max(colWidths[c], nodeBreedte(g, opts));
    rowHeights[r] = Math.max(rowHeights[r], nodeHoogte(g, opts));
  });

  const colGap = 30;
  const rowGap = 25;
  const totalGeBreedte =
    colWidths.reduce((a, b) => a + b, 0) + colGap * (cols - 1);
  let breedte = Math.max(entW, totalGeBreedte);

  // ENT gecentreerd bovenaan
  const entX = (breedte - entW) / 2;
  const entY = 0;
  posMap.set(entNode.id, { x: entX, y: entY });

  // GE-grid eronder
  let yCursor = entH + 50;
  const geStartX = (breedte - totalGeBreedte) / 2;
  geNodes.forEach((g, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    let xC = geStartX;
    for (let k = 0; k < c; k++) xC += colWidths[k] + colGap;
    let yC = yCursor;
    for (let k = 0; k < r; k++) yC += rowHeights[k] + rowGap;
    // Centreer GE in zijn kolom
    const gx = xC + (colWidths[c] - nodeBreedte(g, opts)) / 2;
    posMap.set(g.id, { x: gx, y: yC });
  });

  let totHoogte = entH + 50 + rowHeights.reduce((a, b) => a + b, 0) + rowGap * (rows - 1);

  // Secundaire nodes (enums/datatypes/reflijsten) onderaan, gegroepeerd per consumer-GE.
  // Doel: een compact, ~vierkant blok in plaats van een lange smalle kolom of een
  // ultra-brede strook. Daarom kiezen we het aantal kolommen op basis van het totaal
  // aantal secundairen en hun gemiddelde aspect ratio, met een ondergrens van 4 en
  // een bovengrens van 8 zodat het blok visueel hanteerbaar blijft.
  const allSec = [];
  geNodes.forEach((g) => {
    const sec = secundairPerGe.get(g.id);
    if (sec && sec.length > 0) allSec.push(...sec);
  });
  if (allSec.length > 0) {
    const secGap = 20;
    const avgSw =
      allSec.reduce((a, s) => a + nodeBreedte(s, opts), 0) / allSec.length + secGap;
    const avgSh =
      allSec.reduce((a, s) => a + nodeHoogte(s, opts), 0) / allSec.length + secGap;
    // Ideale kolommen voor ~vierkant blok: cols ≈ sqrt(N * h / w)
    const idealCols = Math.max(
      4,
      Math.min(8, Math.ceil(Math.sqrt((allSec.length * avgSh) / avgSw)))
    );
    const secCols = Math.min(idealCols, allSec.length);
    const secColW = new Array(secCols).fill(0);
    const secRows = Math.ceil(allSec.length / secCols);
    const secRowH = new Array(secRows).fill(0);
    allSec.forEach((s, i) => {
      const c = i % secCols;
      const r = Math.floor(i / secCols);
      secColW[c] = Math.max(secColW[c], nodeBreedte(s, opts));
      secRowH[r] = Math.max(secRowH[r], nodeHoogte(s, opts));
    });
    const secBlokBreedte =
      secColW.reduce((a, b) => a + b, 0) + secGap * (secCols - 1);
    // Cluster mag breder worden als secundair-blok dat vereist (compactheid wint)
    if (secBlokBreedte > breedte) breedte = secBlokBreedte;
    // Eventueel ENT herpositioneren (gecentreerd)
    posMap.set(entNode.id, { x: (breedte - entW) / 2, y: 0 });
    // GE's herpositioneren naar nieuwe (bredere) cluster-breedte
    const geStartX2 = (breedte - totalGeBreedte) / 2;
    geNodes.forEach((g, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      let xC = geStartX2;
      for (let k = 0; k < c; k++) xC += colWidths[k] + colGap;
      let yC = entH + 50;
      for (let k = 0; k < r; k++) yC += rowHeights[k] + rowGap;
      const gx = xC + (colWidths[c] - nodeBreedte(g, opts)) / 2;
      posMap.set(g.id, { x: gx, y: yC });
    });

    const secStartX = (breedte - secBlokBreedte) / 2;
    let secYStart = totHoogte + 50;
    allSec.forEach((s, i) => {
      const c = i % secCols;
      const r = Math.floor(i / secCols);
      let xC = secStartX;
      for (let k = 0; k < c; k++) xC += secColW[k] + secGap;
      let yC = secYStart;
      for (let k = 0; k < r; k++) yC += secRowH[k] + secGap;
      const sx = xC + (secColW[c] - nodeBreedte(s, opts)) / 2;
      posMap.set(s.id, { x: sx, y: yC });
    });
    totHoogte =
      secYStart + secRowH.reduce((a, b) => a + b, 0) + secGap * (secRows - 1);
  }

  return { posMap, breedte, hoogte: totHoogte };
}

/**
 * Hoofdfunctie: bereken nieuwe posities voor alle (zichtbare) nodes.
 */
export function berekenAutoLayout(nodes, edges, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const result = new Map();

  // Filter zichtbare nodes (hidden:true overslaan, maar wel in topologie laten meedoen)
  const zichtbaar = (n) => !o.alleenZichtbaar || !n.hidden;
  const werkNodes = nodes.filter(zichtbaar);

  const topo = bouwTopologie(werkNodes, edges, o);
  const { nodeMap, geNaarEnt, geNaarSecundair, relNaarEnts } = topo;

  // 1) Verzamel ENT-clusters
  const entNodes = werkNodes.filter((n) => n.type === "entiteit");
  const geNodes = werkNodes.filter((n) => n.type === "gegevenselement");
  const relNodes = werkNodes.filter((n) => n.type === "relatie");
  const ankerNodes = werkNodes.filter((n) => n.type === "associatieAnker");
  const secNodes = werkNodes.filter((n) => SECUNDAIR_TYPES.has(n.type));
  const floatNodes = werkNodes.filter((n) => FLOAT_TYPES.has(n.type));

  // GE's per ENT
  const gePerEnt = new Map();
  for (const ent of entNodes) gePerEnt.set(ent.id, []);
  for (const ge of geNodes) {
    const entId = geNaarEnt.get(ge.id);
    if (entId && gePerEnt.has(entId)) gePerEnt.get(entId).push(ge);
  }
  // Ordening van GE's binnen een ENT: hub vóór data vóór aanvang/einde, daarna alfabetisch
  const subRank = (g) => {
    const s = (g.data?.geSubtype || "").toLowerCase();
    if (s === "hub") return 0;
    if (s === "data") return 1;
    if (s === "aanvang") return 2;
    if (s === "einde") return 3;
    return 4;
  };
  for (const arr of gePerEnt.values()) {
    arr.sort((a, b) => {
      const r = subRank(a) - subRank(b);
      if (r !== 0) return r;
      return (a.data?.naam || a.data?.typenaam || "").localeCompare(
        b.data?.naam || b.data?.typenaam || ""
      );
    });
  }

  // Secundaire nodes per GE
  const secPerGe = new Map();
  for (const ge of geNodes) {
    const ids = geNaarSecundair.get(ge.id);
    if (!ids) continue;
    const arr = [...ids].map((id) => nodeMap.get(id)).filter(Boolean);
    if (arr.length > 0) secPerGe.set(ge.id, arr);
  }

  // GE's die nergens via composition aan een ENT hangen → "wees-cluster"
  const weesGE = geNodes.filter((g) => !geNaarEnt.has(g.id));

  // 2) Domein-groepering van ENTs
  const domeinen = groepeerEntsPerDomein(entNodes);

  // Voeg een pseudo-domein "_wees" toe voor losse GE's die geen ENT hebben
  if (weesGE.length > 0) {
    domeinen.push(["_wees", []]);
  }

  // 3) Layout per domein-blok
  let blokYCursor = 0;
  let globaleMaxBreedte = 0;

  for (const [domein, ents] of domeinen) {
    // Ordening van ENTs binnen een domein:
    //  1) Directioneel: een ENT die vooral als BRON van relaties optreedt staat
    //     links van een ENT die vooral als DOEL optreedt (NP → bereikbaarheid → LOC).
    //     We meten dit via flowScore = in − uit (laag = bron-achtig = links).
    //  2) Bij gelijke flowScore: meeste verbindingen eerst (centraler).
    //  3) Tot slot alfabetisch op typenaam voor stabiliteit.
    const flowScore = (id) => {
      const f = topo.entFlow.get(id);
      if (!f) return 0;
      return f.in - f.uit;
    };
    let sortedEnts = [...ents].sort((a, b) => {
      const fs = flowScore(a.id) - flowScore(b.id);
      if (fs !== 0) return fs;
      const ca = topo.entVerbindingen.get(a.id) || 0;
      const cb = topo.entVerbindingen.get(b.id) || 0;
      if (cb !== ca) return cb - ca;
      return (a.data?.typenaam || "").localeCompare(b.data?.typenaam || "");
    });

    // Verfijning: iteratieve swap-pass voor concrete REL bron→doel paren binnen
    // hetzelfde domein. Dit corrigeert lokale paren die door de globale flowScore
    // nog niet correct staan (bv. twee ENTs met dezelfde flowScore).
    const idIndex = new Map(sortedEnts.map((e, i) => [e.id, i]));
    let veranderd = true;
    let safety = sortedEnts.length * 2;
    while (veranderd && safety-- > 0) {
      veranderd = false;
      for (const [, r] of topo.relRichting) {
        if (!r.bronId || !r.doelId) continue;
        const ib = idIndex.get(r.bronId);
        const id_ = idIndex.get(r.doelId);
        if (ib == null || id_ == null) continue;
        if (ib > id_) {
          // Swap zodat bron links komt te staan van doel
          const tmp = sortedEnts[ib];
          sortedEnts[ib] = sortedEnts[id_];
          sortedEnts[id_] = tmp;
          idIndex.set(r.bronId, id_);
          idIndex.set(r.doelId, ib);
          veranderd = true;
        }
      }
    }

    // Bereken cluster-layout per ENT
    const clusters = sortedEnts.map((ent) => {
      const ges = gePerEnt.get(ent.id) || [];
      return { ent, ...layoutEntCluster(ent, ges, secPerGe, o) };
    });

    // Wees-cluster (alleen voor "_wees" pseudo-domein): plaats losse GE's in een grid
    if (domein === "_wees") {
      const cols = Math.min(weesGE.length, 6);
      const colW = Math.max(...weesGE.map((g) => nodeBreedte(g, o)), 180) + 30;
      const rowH = Math.max(...weesGE.map((g) => nodeHoogte(g, o)), 80) + 25;
      const totaalB = cols * colW;
      const rows = Math.ceil(weesGE.length / cols);
      const totaalH = rows * rowH;
      const posMap = new Map();
      weesGE.forEach((g, i) => {
        posMap.set(g.id, { x: (i % cols) * colW, y: Math.floor(i / cols) * rowH });
      });
      clusters.push({ ent: null, posMap, breedte: totaalB, hoogte: totaalH });
    }

    if (clusters.length === 0) continue;

    // Plaats clusters in een grid binnen het domein-blok.
    // Aantal kolommen ≈ ceil(sqrt(N)) voor een "vierkant" domein.
    const ncols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
    const nrows = Math.ceil(clusters.length / ncols);
    const colWidths = new Array(ncols).fill(0);
    const rowHeights = new Array(nrows).fill(0);
    clusters.forEach((cl, i) => {
      const r = Math.floor(i / ncols);
      const c = i % ncols;
      colWidths[c] = Math.max(colWidths[c], cl.breedte);
      rowHeights[r] = Math.max(rowHeights[r], cl.hoogte);
    });

    const colGap = o.paddingX;
    const rowGap = o.paddingY;
    const blokBreedte =
      colWidths.reduce((a, b) => a + b, 0) + colGap * (ncols - 1);

    // Domein-label-ruimte (puur visueel)
    const labelHoogte = 30;

    // Plaats clusters in dit blok
    clusters.forEach((cl, i) => {
      const r = Math.floor(i / ncols);
      const c = i % ncols;
      let cellX = 0;
      for (let k = 0; k < c; k++) cellX += colWidths[k] + colGap;
      let cellY = 0;
      for (let k = 0; k < r; k++) cellY += rowHeights[k] + rowGap;
      // Centreer cluster horizontaal in zijn cel (zodat ENTs uitlijnen)
      const offsetX = cellX + (colWidths[c] - cl.breedte) / 2;
      const offsetY = blokYCursor + labelHoogte + cellY;

      for (const [id, pos] of cl.posMap.entries()) {
        result.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
      }
    });

    const blokHoogte =
      labelHoogte + rowHeights.reduce((a, b) => a + b, 0) + rowGap * (nrows - 1);

    // 4) Plaats RELs van dit domein tussen hun ENT-uiteinden.
    //    Een REL hoort bij dit blok als beide ENT-uiteinden in `ents` voorkomen
    //    (cross-domein RELs worden later los geplaatst).
    const entIdsInBlok = new Set(ents.map((e) => e.id));
    for (const rel of relNodes) {
      const enden = relNaarEnts.get(rel.id) || [];
      const lokaleEnden = enden.filter((id) => entIdsInBlok.has(id));
      if (lokaleEnden.length < 2) continue; // wordt later afgehandeld
      const a = result.get(lokaleEnden[0]);
      const b = result.get(lokaleEnden[1]);
      if (!a || !b) continue;
      const aw = nodeBreedte(nodeMap.get(lokaleEnden[0]), o);
      const ah = nodeHoogte(nodeMap.get(lokaleEnden[0]), o);
      const bw = nodeBreedte(nodeMap.get(lokaleEnden[1]), o);
      const bh = nodeHoogte(nodeMap.get(lokaleEnden[1]), o);
      const cxA = a.x + aw / 2;
      const cyA = a.y + ah / 2;
      const cxB = b.x + bw / 2;
      const cyB = b.y + bh / 2;
      const rw = nodeBreedte(rel, o);
      const rh = nodeHoogte(rel, o);
      result.set(rel.id, {
        x: (cxA + cxB) / 2 - rw / 2,
        y: (cyA + cyB) / 2 - rh / 2,
      });
    }

    blokYCursor += blokHoogte + o.domainGap;
    if (blokBreedte > globaleMaxBreedte) globaleMaxBreedte = blokBreedte;
  }

  // 5) Cross-domein RELs (en RELs die nog geen positie hebben)
  for (const rel of relNodes) {
    if (result.has(rel.id)) continue;
    const enden = (relNaarEnts.get(rel.id) || [])
      .map((id) => result.get(id))
      .filter(Boolean);
    if (enden.length >= 2) {
      const cx = (enden[0].x + enden[1].x) / 2;
      const cy = (enden[0].y + enden[1].y) / 2;
      result.set(rel.id, { x: cx, y: cy });
    } else if (enden.length === 1) {
      // Plaats naast het enige bekende uiteinde
      result.set(rel.id, { x: enden[0].x + 250, y: enden[0].y });
    } else {
      // Volledig losse REL: onderaan parkeren
      result.set(rel.id, { x: 0, y: blokYCursor });
      blokYCursor += nodeHoogte(rel, o) + 20;
    }
  }

  // 6) Anker-nodes: midden tussen REL en eerstvolgende ENT-uiteinde.
  for (const anker of ankerNodes) {
    const relId = topo.ankerNaarRel.get(anker.id);
    const relPos = relId ? result.get(relId) : null;
    if (!relPos) continue;
    // Zoek de ENT die via deze anker met de REL is verbonden
    let entPos = null;
    for (const e of edges) {
      if (e.source === anker.id && nodeMap.get(e.target)?.type === "entiteit") {
        entPos = result.get(e.target);
        break;
      }
      if (e.target === anker.id && nodeMap.get(e.source)?.type === "entiteit") {
        entPos = result.get(e.source);
        break;
      }
    }
    if (entPos) {
      result.set(anker.id, {
        x: (relPos.x + entPos.x) / 2,
        y: (relPos.y + entPos.y) / 2,
      });
    } else {
      result.set(anker.id, { x: relPos.x - 60, y: relPos.y });
    }
  }

  // 7) Notities/constraints: rechts van het hele blok stapelen
  let floatY = 0;
  const floatX = globaleMaxBreedte + o.paddingX * 2;
  for (const f of floatNodes) {
    result.set(f.id, { x: floatX, y: floatY });
    floatY += nodeHoogte(f, o) + 20;
  }

  // Nodes zonder positie (vergeten edge-cases): laat hun bestaande positie staan
  for (const n of werkNodes) {
    if (!result.has(n.id)) {
      result.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
    }
  }

  return result;
}

/**
 * Convenience-wrapper: geeft een nieuwe nodes-array met aangepaste posities.
 * Hidden nodes (en nodes buiten de zichtbare set) blijven onaangetast.
 */
export function pasAutoLayoutToe(nodes, edges, opts = {}) {
  const posMap = berekenAutoLayout(nodes, edges, opts);
  return nodes.map((n) => {
    const p = posMap.get(n.id);
    if (!p) return n;
    return { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } };
  });
}
