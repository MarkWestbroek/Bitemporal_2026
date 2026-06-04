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
 *   - selectie         : Set<nodeId>|nodeId[] → layout alleen deze nodes (sub-graaf).
 *                        Het resultaatblok wordt gecentreerd in de bounding-box van
 *                        de oorspronkelijke selectie zodat de rest van het diagram
 *                        op zijn plek blijft.
 *   - respecteerLocked : true (default) → nodes met `data.layoutLocked === true`
 *                        houden hun bestaande positie en worden niet verplaatst.
 *
 * Layout-modi:
 *   - TB/BT/LR/RL/radial: domein-gebaseerde blok-layout met geometrische
 *     richtingtransformatie (default: TB).
 *   - hierarchisch: gelaagde boomlayout op basis van generalisatie-edges.
 *     Entiteiten worden in lagen geplaatst (ouders boven, kinderen onder),
 *     met horizontale spreiding op basis van subboom-breedte.
 *     GE's en overige nodes worden per entiteit-cluster geordend.
 */

const DEFAULT_OPTS = {
  alleenZichtbaar: true,
  respecteerLocked: true,
  selectie: null,
  paddingX: 80,
  paddingY: 80,
  domainGap: 200,
  geMaxPerRij: 4,
  geRingDrempel: 8,
  // Richting waarin de layout wordt opgebouwd:
  //   "TB" = top-bottom (default), "BT" = bottom-top, "LR" = left-right,
  //   "RL" = right-left, "radial" = clusters in een waaier rond een centrum,
  //   "hierarchisch" = gelaagde boomlayout o.b.v. generalisatie-edges.
  richting: "TB",
  // Cross-domein hub-detectie: ENT's met (uitgaande+inkomende) verbindingen >= drempel
  // krijgen ringmodus voor hun eigen GE/REL-buren.
  hubDrempel: 6,
  // Force-directed nabewerking (na de deterministische blok-layout).
  // 0 = uit. 50–150 geeft typisch goede spreiding zonder structuur te slopen.
  forceIteraties: 80,
  // Streefafstand tussen randen van twee nodes; afstoting houdt op zodra ≥.
  forcePadding: 60,
  // Veerconstantes voor de spring-pass (Hooke). De rust-lengte is afgeleid van
  // de huidige afstand zodat de structuur grotendeels behouden blijft.
  forceSpring: 0.02,
  forceRepel: 1400,
  // Bij selectie: schaal het resultaat zodat het de bounding-box van de
  // oorspronkelijke selectie vult (i.p.v. alleen te hercentreren). Dit
  // voorkomt dat de selectie-layout opgepropt aanvoelt terwijl er ruimte is.
  vulSelectie: true,
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
  const relNaarSecundair = new Map();
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

    // REL → enum/datatype/reflijst (typisch voor REL-velden zoals Bereikbaarheid.soort)
    if (src.type === "relatie" && SECUNDAIR_TYPES.has(tgt.type)) {
      if (!relNaarSecundair.has(src.id)) relNaarSecundair.set(src.id, new Set());
      relNaarSecundair.get(src.id).add(tgt.id);
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

  return { nodeMap, geNaarEnt, geNaarSecundair, relNaarSecundair, relNaarEnts, relRichting, ankerNaarRel, entVerbindingen, entFlow };
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

  // Secundaire nodes (enums/datatypes/reflijsten) — geplaatst direct ONDER hun
  // consumer-GE in dezelfde kolom van het GE-grid. Zo blijven datatype/enum/reflijst
  // dicht bij hun owner en ontstaan er geen lange kruisende dependency-lijnen
  // tussen een eind-rij en de losse GE's bovenin.
  //
  // Algoritme:
  //  - Per GE-kolom: bereken de stack-hoogte van alle secundairen onder de GE's
  //    in die kolom (verticaal opgestapeld, kleinste lijn-overspanning).
  //  - Werkelijke kolombreedte wordt eventueel opgerekt voor brede secundairen.
  //  - Cluster-breedte/hoogte worden hierop aangepast en ENT/GE's gehercentreerd.
  const secGap = 18;
  const secKolomStacks = new Array(cols).fill(null).map(() => []); // {ge, sec[]}
  let heeftSec = false;
  geNodes.forEach((g, i) => {
    const sec = secundairPerGe.get(g.id);
    if (!sec || sec.length === 0) return;
    heeftSec = true;
    const c = i % cols;
    secKolomStacks[c].push({ geIdx: i, sec });
    // Kolombreedte oprekken voor brede secundairen
    for (const s of sec) {
      colWidths[c] = Math.max(colWidths[c], nodeBreedte(s, opts));
    }
  });

  if (heeftSec) {
    // Hercompute cluster-breedte na kolom-oprek
    const totalGeBreedte2 =
      colWidths.reduce((a, b) => a + b, 0) + colGap * (cols - 1);
    breedte = Math.max(entW, totalGeBreedte2);

    // ENT herpositioneren (gecentreerd op nieuwe breedte)
    posMap.set(entNode.id, { x: (breedte - entW) / 2, y: 0 });

    // GE's herpositioneren met nieuwe colWidths
    const geStartX2 = (breedte - totalGeBreedte2) / 2;
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

    // Plaats secundairen per kolom, gestapeld direct onder de laatste GE in die kolom
    const baseY = entH + 50 + rowHeights.reduce((a, b) => a + b, 0) + rowGap * (rows - 1) + secGap * 2;
    let maxKolomBodem = baseY;
    secKolomStacks.forEach((stack, c) => {
      if (stack.length === 0) return;
      let xC = geStartX2;
      for (let k = 0; k < c; k++) xC += colWidths[k] + colGap;
      let yCur = baseY;
      // Sorteer op GE-positie zodat de stack overeenkomt met de visuele volgorde
      stack.sort((a, b) => a.geIdx - b.geIdx);
      for (const { sec } of stack) {
        for (const s of sec) {
          const sw = nodeBreedte(s, opts);
          const sh = nodeHoogte(s, opts);
          const sx = xC + (colWidths[c] - sw) / 2;
          posMap.set(s.id, { x: sx, y: yCur });
          yCur += sh + secGap;
        }
      }
      if (yCur > maxKolomBodem) maxKolomBodem = yCur;
    });
    totHoogte = maxKolomBodem;
  }

  return { posMap, breedte, hoogte: totHoogte };
}

/**
 * Hiërarchische boomlayout — plaatst entiteiten in lagen op basis van
 * generalisatie-edges (kind → ouder). Gelaagde Sugiyama-achtige aanpak:
 *
 * 1. Bouw een boom uit generalisatie-edges (target=ouder, source=kind).
 * 2. Wijs lagen toe: wortels op laag 0, kinderen op ouder+1.
 * 3. Sorteer knopen binnen een laag op basis van subboom-breedte en
 *    ouderpositie om kruisingen te minimaliseren.
 * 4. Bereken horizontale posities recursief: elke ouder centreert zich
 *    boven zijn kinderen.
 * 5. Entiteiten zonder generalisatie-relaties worden onderaan (grootste
 *    laag+1) in een grid geplaatst.
 * 6. GE's, REL's, secundairen etc. worden per entiteit-cluster geplaatst
 *    zoals in de standaard TB-layout.
 */
function berekenHierarchischeLayout(nodes, edges, opts) {
  const result = new Map();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // --- Topologie ---
  const topo = bouwTopologie(nodes, edges, opts);
  const { geNaarEnt, geNaarSecundair, relNaarEnts, relNaarSecundair: topoRelNaarSecundair, ankerNaarRel } = topo;

  // --- Classificeer nodes ---
  const entNodes = nodes.filter((n) => n.type === "entiteit");
  const geNodes = nodes.filter((n) => n.type === "gegevenselement");
  const relNodes = nodes.filter((n) => n.type === "relatie");
  const ankerNodes = nodes.filter((n) => n.type === "associatieAnker");
  const secNodes = nodes.filter((n) => SECUNDAIR_TYPES.has(n.type));
  const floatNodes = nodes.filter((n) => FLOAT_TYPES.has(n.type));

  // --- Bouw parent-kind boom uit edges ---
  // generalisatie: source=kind, target=ouder (data.isGeneralization=true)
  // compositie: source=ouder(container), target=kind (data.isCompositie=true)
  // aggregatie: source=ouder, target=kind (data.isAggregatie=true)
  const parentMap = new Map();   // kindId → ouderId
  const childrenMap = new Map(); // ouderId → [kindIds]
  for (const n of entNodes) {
    childrenMap.set(n.id, []);
  }

  for (const e of edges) {
    let kindId = null, ouderId = null;
    if (e.data?.isGeneralization) {
      // generalisatie: source=kind, target=ouder
      kindId = e.source;
      ouderId = e.target;
    } else if (e.data?.isCompositie || e.data?.isAggregatie) {
      // compositie/aggregatie: source=ouder(container), target=kind
      ouderId = e.source;
      kindId = e.target;
    }
    if (kindId === null || ouderId === null) continue;
    const kind = nodeMap.get(kindId);
    const ouder = nodeMap.get(ouderId);
    if (!kind || !ouder || kind.type !== "entiteit" || ouder.type !== "entiteit") continue;
    // Voorkom dat een entiteit twee parents krijgt (overschrijven)
    if (!parentMap.has(kind.id)) {
      parentMap.set(kind.id, ouder.id);
    }
    if (!childrenMap.has(ouder.id)) childrenMap.set(ouder.id, []);
    if (!childrenMap.get(ouder.id).includes(kind.id)) {
      childrenMap.get(ouder.id).push(kind.id);
    }
  }

  // Diepte per entiteit (BFS vanaf wortels)
  const entDepth = new Map();
  const bfsQueue = [];
  for (const ent of entNodes) {
    if (!parentMap.has(ent.id)) {
      entDepth.set(ent.id, 0);
      bfsQueue.push(ent.id);
    }
  }
  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift();
    const curDepth = entDepth.get(current) ?? 0;
    for (const child of childrenMap.get(current) || []) {
      const nd = curDepth + 1;
      if (!entDepth.has(child) || entDepth.get(child) > nd) {
        entDepth.set(child, nd);
        bfsQueue.push(child);
      }
    }
  }
  for (const ent of entNodes) {
    if (!entDepth.has(ent.id)) entDepth.set(ent.id, 0);
  }

  // --- Groepeer per diepte ---
  const depthGroups = new Map(); // depth → [entId]
  for (const [id, d] of entDepth) {
    if (!depthGroups.has(d)) depthGroups.set(d, []);
    depthGroups.get(d).push(id);
  }
  const sortedDepths = [...depthGroups.keys()].sort((a, b) => a - b);
  const maxDepth = sortedDepths.length > 0 ? sortedDepths[sortedDepths.length - 1] : 0;

  // --- DEBUG: boomstructuur naar console ---
  if (typeof console !== "undefined") {
    console.log("=== HIERARCHISCHE LAYOUT: boomstructuur ===");
    for (let d = 0; d <= maxDepth; d++) {
      const ids = depthGroups.get(d) || [];
      const lines = ids.map((id) => {
        const kids = childrenMap.get(id) || [];
        const parent = parentMap.get(id);
        return `  ${id}${parent ? ` (parent:${parent})` : " (root)"}${kids.length ? ` → [${kids.join(", ")}]` : " (leaf)"}`;
      });
      console.log(`Diepte ${d}:`);
      lines.forEach((l) => console.log(l));
    }
    console.log("=== einde boomstructuur ===");
  }

  // --- Hulpfuncties ---
  const entW = new Map();
  for (const ent of entNodes) entW.set(ent.id, nodeBreedte(ent, opts));

  const nodeGap = 60;       // afstand tussen nodes
  const groupGap = 100;     // extra afstand tussen parent-groepjes
  const layerGap = 220;     // verticale afstand tussen lagen
  const entPos = new Map(); // entId → getal (x-positie, y later)

  // --- Bepaal L→R volgorde per diepte (top-down) ---
  const depthOrder = new Map(); // depth → [entId] in L→R volgorde
  const roots = depthGroups.get(0) || [];
  roots.sort((a, b) => {
    const ka = (childrenMap.get(a) || []).length;
    const kb = (childrenMap.get(b) || []).length;
    if (kb !== ka) return kb - ka;
    return (a || "").localeCompare(b || "");
  });
  depthOrder.set(0, [...roots]);
  for (let d = 0; d < maxDepth; d++) {
    const orderAbove = depthOrder.get(d) || [];
    const ids = depthGroups.get(d + 1) || [];
    const byParent = new Map();
    for (const id of ids) {
      const p = parentMap.get(id) ?? "__orphan__";
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(id);
    }
    const result = [];
    for (const pid of orderAbove) {
      if (byParent.has(pid)) {
        result.push(...byParent.get(pid));
        byParent.delete(pid);
      }
    }
    const rest = [...byParent.entries()].sort((a, b) => {
      const ka = (childrenMap.get(a[0]) || []).length;
      const kb = (childrenMap.get(b[0]) || []).length;
      if (kb !== ka) return kb - ka;
      return (a[0] || "").localeCompare(b[0] || "");
    });
    for (const [, kids] of rest) result.push(...kids);
    depthOrder.set(d + 1, result);
  }

  // --- Plaats bottom-up: exact volgens stappen 10-40 ---
  //
  // 10: Diepste laag: leaves naast elkaar, per parent gegroepeerd
  // 20: Parents centreren boven hun kinderen (al geplaatst in depth+1)
  // 30: Rechts van meest rechtse node in depth+1: leaves toevoegen
  // 40: Goto 20 als depth > 0

  for (let d = maxDepth; d >= 0; d--) {
    const ids = depthOrder.get(d) || [];
    const parents = ids.filter((id) => (childrenMap.get(id) || []).length > 0);
    const leaves = ids.filter((id) => (childrenMap.get(id) || []).length === 0);

    // Stap 20: parents centreren boven hun kinderen
    let rightmostEdge = 0;
    for (const id of parents) {
      const kids = childrenMap.get(id) || [];
      const kidsMetPos = kids.filter((k) => entPos.has(k));
      if (kidsMetPos.length > 0) {
        let minX = Infinity, maxX = -Infinity;
        for (const kid of kidsMetPos) {
          const kx = entPos.get(kid);
          const kw = entW.get(kid) || 220;
          minX = Math.min(minX, kx);
          maxX = Math.max(maxX, kx + kw);
        }
        const kidsMidden = (minX + maxX) / 2;
        const pw = entW.get(id) || 220;
        entPos.set(id, kidsMidden - pw / 2);
        rightmostEdge = Math.max(rightmostEdge, (entPos.get(id) || 0) + pw);
      }
    }

    // Stap 30: leaves rechts van parents, gegroepeerd per parent (depth d-1)
    if (leaves.length > 0) {
      const groups = new Map();
      for (const id of leaves) {
        const p = parentMap.get(id) ?? "__orphan__";
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(id);
      }

      const parentOrder = depthOrder.get(d - 1) || [];
      const orderedGroups = [];
      for (const pid of parentOrder) {
        if (groups.has(pid)) {
          orderedGroups.push(groups.get(pid));
          groups.delete(pid);
        }
      }
      for (const [, kids] of groups.entries()) {
        orderedGroups.push(kids);
      }

      let cx = rightmostEdge > 0 ? rightmostEdge + groupGap : 0;
      for (const group of orderedGroups) {
        let sx = cx;
        for (const kid of group) {
          entPos.set(kid, sx);
          sx += (entW.get(kid) || 220) + nodeGap;
        }
        cx = sx;
      }
    }

    // Stap 35: order-correctie — als een parent links staat van zijn
    // depthOrder-voorganger, schuif hem + hele subboom rechts.
    // Dit is de ENIGE correctie, en corrigeert alleen de parent-ordening.
    let orderRight = -Infinity;
    for (const id of ids) {
      if (!entPos.has(id)) continue;
      const x = entPos.get(id) || 0;
      const w = entW.get(id) || 220;
      if (orderRight > -Infinity && x < orderRight + nodeGap) {
        const shift = orderRight + nodeGap - x;
        (function shiftSub(nid, s) {
          if (s === 0) return;
          entPos.set(nid, (entPos.get(nid) || 0) + s);
          for (const c of (childrenMap.get(nid) || [])) shiftSub(c, s);
        })(id, shift);
        orderRight = x + shift + w;
      } else {
        orderRight = x + w;
      }
    }
  }

  // Alle overgebleven entiteiten zonder positie
  for (const ent of entNodes) {
    if (!entPos.has(ent.id)) {
      const lastX = Math.max(0, ...entPos.values()) + nodeGap;
      entPos.set(ent.id, lastX);
    }
  }

  // --- Cluster-layout voor GE's etc. ---
  const gePerEnt = new Map();
  for (const ent of entNodes) gePerEnt.set(ent.id, []);
  for (const ge of geNodes) {
    const entId = geNaarEnt.get(ge.id);
    if (entId && gePerEnt.has(entId)) gePerEnt.get(entId).push(ge);
  }

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

  const secPerGe = new Map();
  for (const ge of geNodes) {
    const ids = geNaarSecundair.get(ge.id);
    if (!ids) continue;
    const arr = [...ids].map((id) => nodeMap.get(id)).filter(Boolean);
    if (arr.length > 0) secPerGe.set(ge.id, arr);
  }

  const clusterResultaten = new Map();
  for (const ent of entNodes) {
    const ges = gePerEnt.get(ent.id) || [];
    const cl = layoutEntCluster(ent, ges, secPerGe, opts);
    clusterResultaten.set(ent.id, cl);
  }

  // --- Y-posities op basis van cluster-hoogtes ---
  const laagMaxHoogte = new Map();
  for (const [id, d] of entDepth) {
    const cl = clusterResultaten.get(id);
    const h = cl ? cl.hoogte : 120;
    const cur = laagMaxHoogte.get(d) || 0;
    laagMaxHoogte.set(d, Math.max(cur, h));
  }

  const laagY = new Map();
  let cumY = 0;
  for (const d of sortedDepths) {
    laagY.set(d, cumY);
    cumY += (laagMaxHoogte.get(d) || 120) + layerGap - 80;
  }

  for (const ent of entNodes) {
    const px = entPos.get(ent.id);
    const cl = clusterResultaten.get(ent.id);
    if (px === undefined || !cl) continue;
    const d = entDepth.get(ent.id) || 0;
    const offsetY = laagY.get(d) || 0;
    const entClusterPos = cl.posMap.get(ent.id);
    const entClusterX = entClusterPos ? entClusterPos.x : 0;

    result.set(ent.id, { x: px, y: offsetY });

    for (const [nid, pos] of cl.posMap.entries()) {
      if (nid === ent.id) continue;
      result.set(nid, {
        x: px - entClusterX + pos.x,
        y: offsetY + pos.y,
      });
    }
  }

  // --- REL's, ankers, floats, fallback (zelfde als TB) ---
  const relGeplaatst = new Set();
  for (const rel of relNodes) {
    const enden = (relNaarEnts.get(rel.id) || [])
      .map((id) => result.get(id))
      .filter(Boolean);
    if (enden.length >= 2) {
      const rw = nodeBreedte(rel, opts);
      const rh = nodeHoogte(rel, opts);
      result.set(rel.id, {
        x: (enden[0].x + enden[1].x) / 2 - rw / 2,
        y: (enden[0].y + enden[1].y) / 2 - rh / 2,
      });
      relGeplaatst.add(rel.id);
    } else if (enden.length === 1) {
      const rw = nodeBreedte(rel, opts);
      result.set(rel.id, { x: enden[0].x + 250, y: enden[0].y });
      relGeplaatst.add(rel.id);
    }
  }

  let relY = cumY + 40;
  for (const rel of relNodes) {
    if (relGeplaatst.has(rel.id)) continue;
    result.set(rel.id, { x: 0, y: relY });
    relY += nodeHoogte(rel, opts) + 20;
  }

  const relSecCursor = new Map();
  for (const sec of secNodes) {
    if (result.has(sec.id)) continue;
    let relId = null;
    for (const [rid, set] of topoRelNaarSecundair.entries()) {
      if (set.has(sec.id)) { relId = rid; break; }
    }
    if (!relId) continue;
    const relPos = result.get(relId);
    if (!relPos) continue;
    const relNode = nodeMap.get(relId);
    const rw = nodeBreedte(relNode, opts);
    const rh = nodeHoogte(relNode, opts);
    const sw = nodeBreedte(sec, opts);
    const sh = nodeHoogte(sec, opts);
    const yStart = relSecCursor.get(relId) ?? (relPos.y + rh + 30);
    result.set(sec.id, { x: relPos.x + (rw - sw) / 2, y: yStart });
    relSecCursor.set(relId, yStart + sh + 18);
  }

  for (const anker of ankerNodes) {
    const relId = ankerNaarRel.get(anker.id);
    const relPos = relId ? result.get(relId) : null;
    if (!relPos) continue;
    let entPosAnker = null;
    for (const e of edges) {
      if (e.source === anker.id && nodeMap.get(e.target)?.type === "entiteit") {
        entPosAnker = result.get(e.target);
        break;
      }
      if (e.target === anker.id && nodeMap.get(e.source)?.type === "entiteit") {
        entPosAnker = result.get(e.source);
        break;
      }
    }
    if (entPosAnker) {
      result.set(anker.id, {
        x: (relPos.x + entPosAnker.x) / 2,
        y: (relPos.y + entPosAnker.y) / 2,
      });
    } else {
      result.set(anker.id, { x: relPos.x - 60, y: relPos.y });
    }
  }

  let floatY = 0;
  const entXMax = entNodes.reduce((m, n) => {
    const p = result.get(n.id);
    const bw = entW.get(n.id) || 220;
    return p ? Math.max(m, p.x + bw) : m;
  }, 0);
  const floatX = entXMax > 0 ? entXMax + 80 : 600;

  for (const f of floatNodes) {
    const buren = [];
    for (const e of edges) {
      if (e.source === f.id) buren.push(e.target);
      else if (e.target === f.id) buren.push(e.source);
    }
    const buurPos = buren.map((id) => result.get(id)).filter(Boolean);
    if (buurPos.length > 0) {
      const cx = buurPos.reduce((s, p) => s + p.x, 0) / buurPos.length;
      result.set(f.id, { x: cx + 220, y: buurPos[0].y });
    } else {
      result.set(f.id, { x: floatX, y: floatY });
      floatY += nodeHoogte(f, opts) + 20;
    }
  }

  const ongeplaatst = nodes.filter((n) => !result.has(n.id));
  if (ongeplaatst.length > 0) {
    const cols = Math.min(ongeplaatst.length, 4);
    const maxW = Math.max(...ongeplaatst.map((n) => nodeBreedte(n, opts)), 180);
    const maxH = Math.max(...ongeplaatst.map((n) => nodeHoogte(n, opts)), 80);
    const gapX = 30;
    const gapY = 25;
    ongeplaatst.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.set(n.id, {
        x: col * (maxW + gapX),
        y: cumY + row * (maxH + gapY),
      });
    });
  }

  return result;
}

/**
 * Hoofdfunctie: bereken nieuwe posities voor alle (zichtbare) nodes.
 */
export function berekenAutoLayout(nodes, edges, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const result = new Map();

  // Normaliseer selectie naar Set<id>
  const selectieSet = o.selectie
    ? new Set(o.selectie instanceof Set ? [...o.selectie] : Array.from(o.selectie))
    : null;

  // Filter zichtbare nodes (hidden:true overslaan, maar wel in topologie laten meedoen)
  const zichtbaar = (n) => !o.alleenZichtbaar || !n.hidden;
  const alleZichtbaar = nodes.filter(zichtbaar);

  // Bepaal werkset:
  //  - Bij selectie: alleen geselecteerde nodes worden gerepositioneerd; de rest
  //    fungeert nog wel als referentie voor topologie (bv. om bron/doel-richting
  //    of ENT-eigenaar van een GE te kunnen bepalen).
  //  - Bij respecteerLocked: locked nodes blijven uit de werkset; ze worden later
  //    direct met hun originele positie ingevuld.
  const isLocked = (n) => o.respecteerLocked && n.data?.layoutLocked === true;
  const inSelectie = (n) => !selectieSet || selectieSet.has(n.id);
  const werkNodes = alleZichtbaar.filter((n) => inSelectie(n) && !isLocked(n));

  // Vooraf: locked + niet-geselecteerde nodes krijgen direct hun bestaande positie
  // in `result`, zodat REL-/anker-berekeningen op basis van resultaat werken.
  for (const n of alleZichtbaar) {
    if (n.position && (isLocked(n) || (selectieSet && !selectieSet.has(n.id)))) {
      result.set(n.id, { x: n.position.x, y: n.position.y });
    }
  }

  // Topologie wordt opgebouwd over ALLE zichtbare nodes (niet alleen werk),
  // zodat selectie-layout de juiste relaties met buiten-selectie ENTs kent.
  const topo = bouwTopologie(alleZichtbaar, edges, o);
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

  // === Hiërarchische layout (generalisatie-boom) ===
  // Wordt gekozen als richting="hierarchisch". Bouwt een gelaagde boom
  // op basis van generalisatie-edges en plaatst entiteiten in lagen.
  if (o.richting === "hierarchisch") {
    // Bouw hiërarchische layout over ALLE zichtbare nodes (nodig voor
    // correcte boomstructuur), maar overschrijf alleen posities van
    // nodes in de werkset. Locked nodes behouden hun bestaande positie.
    const hierResult = berekenHierarchischeLayout(alleZichtbaar, edges, o);

    // Voeg alleen werkset-posities toe aan result
    const werkSet = new Set(werkNodes.map((n) => n.id));
    for (const [id, pos] of hierResult.entries()) {
      if (werkSet.has(id)) {
        result.set(id, pos);
      }
    }

    // Selectie-modus: hercentreer (zelfde logica als stap 8)
    if (selectieSet) {
      const oldBox = boundingBox(
        alleZichtbaar.filter((n) => selectieSet.has(n.id)),
        o
      );
      const newPunten = [];
      for (const id of selectieSet) {
        const p = result.get(id);
        const node = nodeMap.get(id);
        if (p && node) {
          newPunten.push({
            x: p.x, y: p.y,
            w: nodeBreedte(node, o),
            h: nodeHoogte(node, o),
          });
        }
      }
      if (oldBox && newPunten.length > 0) {
        const minX = Math.min(...newPunten.map((p) => p.x));
        const minY = Math.min(...newPunten.map((p) => p.y));
        const maxX = Math.max(...newPunten.map((p) => p.x + p.w));
        const maxY = Math.max(...newPunten.map((p) => p.y + p.h));
        const newCx = (minX + maxX) / 2;
        const newCy = (minY + maxY) / 2;
        const oldCx = (oldBox.minX + oldBox.maxX) / 2;
        const oldCy = (oldBox.minY + oldBox.maxY) / 2;

        let scale = 1;
        if (o.vulSelectie) {
          const newW = Math.max(1, maxX - minX);
          const newH = Math.max(1, maxY - minY);
          const oldW = Math.max(1, oldBox.maxX - oldBox.minX);
          const oldH = Math.max(1, oldBox.maxY - oldBox.minY);
          scale = Math.max(1, Math.min(2.5, Math.min(oldW / newW, oldH / newH)));
        }

        for (const id of selectieSet) {
          const p = result.get(id);
          if (p) {
            result.set(id, {
              x: newCx + (p.x - newCx) * scale + (oldCx - newCx),
              y: newCy + (p.y - newCy) * scale + (oldCy - newCy),
            });
          }
        }
      }
      for (const id of [...result.keys()]) {
        if (!selectieSet.has(id)) result.delete(id);
      }
    }

    // Force-directed nabewerking (optioneel)
    if (o.forceIteraties > 0) {
      const pinSet = new Set();
      for (const n of alleZichtbaar) {
        if (isLocked(n)) pinSet.add(n.id);
        if (selectieSet && !selectieSet.has(n.id)) pinSet.add(n.id);
      }
      runForceDirected(result, edges, alleZichtbaar, pinSet, o);
    }

    // Nodes zonder positie: behoud bestaande
    for (const n of werkNodes) {
      if (!result.has(n.id)) {
        result.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
      }
    }

    return result;
  }

  // 2) Domein-groepering van ENTs (standaard TB/BT/LR/RL/radial)
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

  // 5b) Secundairen die door een REL worden geconsumeerd (en nog geen positie
  //     hebben) plaatsen we direct ONDER de REL, zodat de dependency-lijn
  //     kort blijft (bv. Bereikbaarheid.soort → Bereikbaarheidssoort enum).
  //     Voor secundairen die door een GE worden geconsumeerd doet
  //     `layoutEntCluster` het werk al; deze pass is alleen voor REL-eigen secs.
  const secGapRel = 18;
  const relSecCursor = new Map(); // relId → volgende y-offset
  for (const sec of secNodes) {
    if (result.has(sec.id)) continue;
    // Zoek de REL die deze sec aanstuurt
    let relId = null;
    for (const [rid, set] of topo.relNaarSecundair.entries()) {
      if (set.has(sec.id)) { relId = rid; break; }
    }
    if (!relId) continue;
    const relPos = result.get(relId);
    if (!relPos) continue;
    const relNode = nodeMap.get(relId);
    const rw = nodeBreedte(relNode, o);
    const rh = nodeHoogte(relNode, o);
    const sw = nodeBreedte(sec, o);
    const sh = nodeHoogte(sec, o);
    const yStart = relSecCursor.get(relId) ?? (relPos.y + rh + 30);
    const sx = relPos.x + (rw - sw) / 2;
    result.set(sec.id, { x: sx, y: yStart });
    relSecCursor.set(relId, yStart + sh + secGapRel);
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

  // 6b) Hub-ringmodus voor cross-domein hubs.
  //     Een ENT met >= o.hubDrempel verbindingen waarvan de tegenpartijen
  //     in meerdere domeinen leven, is een "hub". De midpoint-plaatsing
  //     van zijn RELs raakt dan vaak gepropt; we herverdelen die RELs
  //     daarom op een cirkel rondom de hub. Force-directed (stap 10)
  //     pikt dit op en spreidt verder uit.
  const entDomein = (en) => en?.data?.domein || "_geen";
  for (const ent of entNodes) {
    const tot = topo.entVerbindingen.get(ent.id) || 0;
    if (tot < o.hubDrempel) continue;

    // Verzamel RELs verbonden met deze ENT
    const eigenRels = relNodes.filter((rel) => {
      const ends = topo.relNaarEnts.get(rel.id) || [];
      return ends.includes(ent.id);
    });
    if (eigenRels.length < o.hubDrempel) continue;

    // Verzamel domeinen van de tegenpartijen
    const buurDomeinen = new Set();
    for (const rel of eigenRels) {
      const ends = topo.relNaarEnts.get(rel.id) || [];
      for (const otherId of ends) {
        if (otherId === ent.id) continue;
        const otherEnt = nodeMap.get(otherId);
        if (otherEnt) buurDomeinen.add(entDomein(otherEnt));
      }
    }
    if (buurDomeinen.size < 2) continue; // alleen cross-domein hubs

    // Herverdeel RELs op een cirkel rond de hub.
    const hubPos = result.get(ent.id);
    if (!hubPos) continue;
    const wEnt = nodeBreedte(ent, o);
    const hEnt = nodeHoogte(ent, o);
    const radius = Math.max(wEnt, hEnt) + 180;
    const N = eigenRels.length;
    // Sorteer RELs op huidige hoek t.o.v. hub-centrum, zodat de visuele
    // volgorde grofweg behouden blijft.
    const hubCx = hubPos.x + wEnt / 2;
    const hubCy = hubPos.y + hEnt / 2;
    const sorted = [...eigenRels].sort((a, b) => {
      const pa = result.get(a.id);
      const pb = result.get(b.id);
      const ta = Math.atan2((pa?.y ?? hubCy) - hubCy, (pa?.x ?? hubCx) - hubCx);
      const tb = Math.atan2((pb?.y ?? hubCy) - hubCy, (pb?.x ?? hubCx) - hubCx);
      return ta - tb;
    });
    for (let i = 0; i < N; i++) {
      const rel = sorted[i];
      const wRel = nodeBreedte(rel, o);
      const hRel = nodeHoogte(rel, o);
      const theta = (i / N) * 2 * Math.PI - Math.PI / 2;
      const cx = hubCx + radius * Math.cos(theta);
      const cy = hubCy + radius * Math.sin(theta);
      // Locked RELs niet verplaatsen
      if (isLocked(rel)) continue;
      result.set(rel.id, { x: cx - wRel / 2, y: cy - hRel / 2 });

      // Bijbehorend anker meeplaatsen tussen hub en deze REL
      const anker = ankerNodes.find((a) => topo.ankerNaarRel.get(a.id) === rel.id);
      if (anker && !isLocked(anker)) {
        result.set(anker.id, {
          x: (hubCx + cx) / 2 - nodeBreedte(anker, o) / 2,
          y: (hubCy + cy) / 2 - nodeHoogte(anker, o) / 2,
        });
      }
    }
  }

  // 7) Notities/constraints: probeer ze nabij hun "onderwerp" te plaatsen.
  //    Een notitie/constraint heeft typisch een (dependency-)edge naar de node
  //    waar het over gaat. We plaatsen 'm dan rechts naast die node. Heeft de
  //    notitie geen edges, dan stapelen we ze rechts van het hele diagram.
  let floatY = 0;
  const floatX = globaleMaxBreedte + o.paddingX * 2;
  for (const f of floatNodes) {
    const buren = [];
    for (const e of edges) {
      if (e.source === f.id) buren.push(e.target);
      else if (e.target === f.id) buren.push(e.source);
    }
    const buurPos = buren.map((id) => result.get(id)).filter(Boolean);
    if (buurPos.length > 0) {
      const cx = buurPos.reduce((s, p) => s + p.x, 0) / buurPos.length;
      const cy = buurPos.reduce((s, p) => s + p.y, 0) / buurPos.length;
      const fw = nodeBreedte(f, o);
      // Plaats rechts naast het zwaartepunt van de buren
      let probeY = cy - 10;
      let conflict = true;
      let safety = 8;
      while (conflict && safety-- > 0) {
        conflict = false;
        for (const other of floatNodes) {
          if (other.id === f.id) continue;
          const op = result.get(other.id);
          if (!op) continue;
          if (Math.abs(op.x - (cx + 220)) < fw && Math.abs(op.y - probeY) < 60) {
            probeY = op.y + nodeHoogte(other, o) + 20;
            conflict = true;
          }
        }
      }
      result.set(f.id, { x: cx + 220, y: probeY });
    } else {
      result.set(f.id, { x: floatX, y: floatY });
      floatY += nodeHoogte(f, o) + 20;
    }
  }

  // 8) Selectie-modus: hercentreer het hele resultaat zodat het in de
  //    bounding-box van de oorspronkelijke selectie past (zo blijft de rest
  //    van het diagram visueel op zijn plek). Verwijder daarna alle posities
  //    voor nodes die niet in de selectie zitten.
  if (selectieSet) {
    const oldBox = boundingBox(
      alleZichtbaar.filter((n) => selectieSet.has(n.id)),
      o
    );
    const newPunten = [];
    for (const id of selectieSet) {
      const p = result.get(id);
      const node = nodeMap.get(id);
      if (p && node) {
        newPunten.push({
          x: p.x,
          y: p.y,
          w: nodeBreedte(node, o),
          h: nodeHoogte(node, o),
        });
      }
    }
    if (oldBox && newPunten.length > 0) {
      const minX = Math.min(...newPunten.map((p) => p.x));
      const minY = Math.min(...newPunten.map((p) => p.y));
      const maxX = Math.max(...newPunten.map((p) => p.x + p.w));
      const maxY = Math.max(...newPunten.map((p) => p.y + p.h));
      const newCx = (minX + maxX) / 2;
      const newCy = (minY + maxY) / 2;
      const oldCx = (oldBox.minX + oldBox.maxX) / 2;
      const oldCy = (oldBox.minY + oldBox.maxY) / 2;

      // Optioneel: schaal de layout zodat hij de oude bbox vult.
      // Dit voorkomt het "opgepropt" gevoel als er duidelijk ruimte beschikbaar is.
      let scale = 1;
      if (o.vulSelectie) {
        const newW = Math.max(1, maxX - minX);
        const newH = Math.max(1, maxY - minY);
        const oldW = Math.max(1, oldBox.maxX - oldBox.minX);
        const oldH = Math.max(1, oldBox.maxY - oldBox.minY);
        const sx = oldW / newW;
        const sy = oldH / newH;
        // Behoud aspectratio en sta opschalen toe (max 2.5×); inkrimpen mag ook,
        // maar niet onder 1× anders kunnen nodes gaan overlappen.
        scale = Math.max(1, Math.min(2.5, Math.min(sx, sy)));
      }

      for (const id of selectieSet) {
        const p = result.get(id);
        if (p) {
          // Schaal rond het nieuwe centrum, en hercentreer naar het oude centrum.
          const sxNew = newCx + (p.x - newCx) * scale;
          const syNew = newCy + (p.y - newCy) * scale;
          result.set(id, { x: sxNew + (oldCx - newCx), y: syNew + (oldCy - newCy) });
        }
      }
    }
    for (const id of [...result.keys()]) {
      if (!selectieSet.has(id)) result.delete(id);
    }
  }

  // 9) Richting-transformatie: het kerngedeelte rekent altijd in TB.
  //    Vertaal nu naar de gewenste richting. Locked / niet-selectie posities
  //    worden mee-getransformeerd want zij staan al in result.
  if (o.richting && o.richting !== "TB") {
    pasRichtingToe(result, o.richting, o, alleZichtbaar, selectieSet);
  }

  // 10) Force-directed nabewerking (optioneel): spring-edges + Coulomb-repulsie.
  //    Locked nodes en (bij selectie) niet-selectie nodes worden vastgepind.
  //    Iteraties = o.forceIteraties; 0 → overslaan.
  if (o.forceIteraties > 0) {
    const pinSet = new Set();
    for (const n of alleZichtbaar) {
      if (isLocked(n)) pinSet.add(n.id);
      if (selectieSet && !selectieSet.has(n.id)) pinSet.add(n.id);
    }
    runForceDirected(result, edges, alleZichtbaar, pinSet, o);
  }

  // Nodes zonder positie (vergeten edge-cases): laat hun bestaande positie staan
  for (const n of werkNodes) {
    if (!result.has(n.id)) {
      result.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
    }
  }

  return result;
}

/** Bounding-box helper voor een set nodes (met fallback-afmetingen). */
function boundingBox(nodes, opts) {
  if (!nodes || nodes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    const w = nodeBreedte(n, opts);
    const h = nodeHoogte(n, opts);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Transformeer een TB-layout in-place naar BT, LR, RL of radial.
 *  - LR: swap (x,y); cluster-stromen lopen nu links→rechts
 *  - RL: LR, daarna x-spiegelen
 *  - BT: y-spiegelen
 *  - radial: parametrische polar(r=y, θ=x) plaatsing zodat domeinen als waaier
 *           rond een centrum komen te liggen
 */
function pasRichtingToe(result, richting, opts, alleZichtbaar, selectieSet) {
  const ids = selectieSet
    ? [...result.keys()].filter((id) => selectieSet.has(id))
    : [...result.keys()];
  if (ids.length === 0) return;

  // Bepaal huidige bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const p = result.get(id);
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (richting === "BT") {
    for (const id of ids) {
      const p = result.get(id);
      result.set(id, { x: p.x, y: 2 * cy - p.y });
    }
    return;
  }
  if (richting === "LR") {
    for (const id of ids) {
      const p = result.get(id);
      // Swap rond centrum, anders verschuift het blok
      result.set(id, { x: cx + (p.y - cy), y: cy + (p.x - cx) });
    }
    return;
  }
  if (richting === "RL") {
    for (const id of ids) {
      const p = result.get(id);
      const lx = cx + (p.y - cy);
      result.set(id, { x: 2 * cx - lx, y: cy + (p.x - cx) });
    }
    return;
  }
  if (richting === "radial") {
    // Map x → hoek (volle cirkel verdeeld over breedte), y → straal.
    // Resultaat: domeinblokken (die in TB naast elkaar staan) komen als
    // taartpunten rondom het centrum te liggen.
    const breedte = Math.max(1, maxX - minX);
    const baseR = 240;
    for (const id of ids) {
      const p = result.get(id);
      const t = (p.x - minX) / breedte; // 0..1
      const theta = -Math.PI / 2 + t * 2 * Math.PI;
      const r = baseR + (p.y - minY);
      result.set(id, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
    }
    return;
  }
}

/**
 * Force-directed nabewerking. Spring-aantrekking op edges (Hooke met
 * rust-lengte = huidige afstand zodat de structuur grofweg behouden blijft)
 * + Coulomb-achtige afstoting op overlappende/te-dichte node-paren.
 *
 * Eenvoudige semi-impliciete Verlet: verplaatsing per iteratie wordt geclamped
 * om instabiliteit te vermijden. Locked/gepinde nodes blijven exact staan.
 */
function runForceDirected(result, edges, alleZichtbaar, pinSet, opts) {
  const nodeMap = new Map(alleZichtbaar.map((n) => [n.id, n]));
  // Werkset = alleen nodes met een resultaatpositie
  const ids = [...result.keys()].filter((id) => nodeMap.has(id));
  if (ids.length < 2) return;

  // Alleen edges waarvan beide eindpunten in werkset zitten en niet beide gepind
  const springs = [];
  for (const e of edges) {
    if (!result.has(e.source) || !result.has(e.target)) continue;
    if (pinSet.has(e.source) && pinSet.has(e.target)) continue;
    const a = result.get(e.source);
    const b = result.get(e.target);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const rest = Math.max(80, Math.sqrt(dx * dx + dy * dy));
    springs.push({ s: e.source, t: e.target, rest });
  }

  const iters = Math.max(1, Math.min(300, opts.forceIteraties | 0));
  const kSpring = opts.forceSpring;
  const kRepel = opts.forceRepel;
  const padding = opts.forcePadding;
  const maxStep = 25; // pixels per iteratie

  for (let it = 0; it < iters; it++) {
    const fx = new Map();
    const fy = new Map();
    for (const id of ids) {
      fx.set(id, 0);
      fy.set(id, 0);
    }

    // Springs (aantrekkend richting rust-lengte)
    for (const sp of springs) {
      const a = result.get(sp.s);
      const b = result.get(sp.t);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = kSpring * (dist - sp.rest);
      const ux = (dx / dist) * f;
      const uy = (dy / dist) * f;
      fx.set(sp.s, fx.get(sp.s) + ux);
      fy.set(sp.s, fy.get(sp.s) + uy);
      fx.set(sp.t, fx.get(sp.t) - ux);
      fy.set(sp.t, fy.get(sp.t) - uy);
    }

    // Coulomb-repulsie (alleen als nodes te dicht op elkaar zitten)
    for (let i = 0; i < ids.length; i++) {
      const idA = ids[i];
      const a = result.get(idA);
      const na = nodeMap.get(idA);
      const wA = nodeBreedte(na, opts);
      const hA = nodeHoogte(na, opts);
      for (let j = i + 1; j < ids.length; j++) {
        const idB = ids[j];
        const b = result.get(idB);
        const nb = nodeMap.get(idB);
        const wB = nodeBreedte(nb, opts);
        const hB = nodeHoogte(nb, opts);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        // Minimale gewenste afstand = som van halve diameters + padding
        const desired = (Math.max(wA, hA) + Math.max(wB, hB)) / 2 + padding;
        if (dist >= desired * 1.4) continue; // ver weg → geen kracht
        const f = kRepel / (dist * dist);
        const ux = (dx / dist) * f;
        const uy = (dy / dist) * f;
        fx.set(idA, fx.get(idA) - ux);
        fy.set(idA, fy.get(idA) - uy);
        fx.set(idB, fx.get(idB) + ux);
        fy.set(idB, fy.get(idB) + uy);
      }
    }

    // Pas krachten toe (geclamped)
    for (const id of ids) {
      if (pinSet.has(id)) continue;
      let dx = fx.get(id);
      let dy = fy.get(id);
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > maxStep) {
        dx = (dx / mag) * maxStep;
        dy = (dy / mag) * maxStep;
      }
      const p = result.get(id);
      result.set(id, { x: p.x + dx, y: p.y + dy });
    }
  }
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
