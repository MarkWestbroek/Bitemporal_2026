// @ts-check
/**
 * verschilMetMain — het verschil tussen een afgeleid project (branch) en MAIN, als zuivere
 * functie op drie werkbestanden ("studio-project" v3).
 *
 * Plan: werkplaats-plan §4B (Fundament-docs), stap 1 van "branchen van een projectmap" (Mark
 * 09-11). Een branch is een afgeleid project: een kopie van het hele project op basisvolgnummer N,
 * met herkomst {ouderProject, basisVolgnummer, mapId}. De ids blijven gelijk. De map is de scope;
 * mergen gaat in stap 1 nog met de hand.
 *
 * Drie standen, elk al gematerialiseerd (snapshot + ops nagespeeld, zie sidecarImport.maakStand):
 *   - basis: MAIN zoals hij was bij het afsplitsen;
 *   - tak:   de branch nu;
 *   - main:  MAIN nu.
 *
 * Per eenheid (element, diagram, map, kruisverband) en per id een status:
 *   - "nieuw":      alleen in de tak (niet in de basis);
 *   - "gewijzigd":  in de tak veranderd, op MAIN niet;
 *   - "weg":        in de tak verwijderd, op MAIN niet veranderd;
 *   - "conflict":   aan beide kanten veranderd, en niet op dezelfde manier (ook: weg aan de ene,
 *                   gewijzigd aan de andere kant);
 *   - "main":       alleen op MAIN veranderd (nieuw, gewijzigd of weg). In de tak niet zichtbaar
 *                   tot bijwerken of mergen (Mark 09-11); gemeld zodat je weet wat er wacht.
 * Een eenheid die aan beide kanten precies hetzelfde veranderde, telt niet mee.
 *
 * `velden` noemt de bovenste sleutels die verschillen (bij `data` de sleutels daarbinnen, als
 * `data.<sleutel>`), voor de lijst en later de inspector.
 *
 * `inScope`: ligt de eenheid in de afgesplitste map of een submap? Een element via zijn plaatsing
 * (`el::<profiel>::<id>`), een relatie via haar bron, een diagram via `<profiel>::<id>`, een map
 * via zijn ouderketen. Een kind in de hiërarchie zonder eigen plaatsing volgt zijn boomouder als
 * `ouderVan` die geeft (anders: geen map, dus buiten de scope).
 *
 * Een plaatsing kan ook naar een **element** wijzen (`el::<profiel>::<id>`: element als ouder in de
 * boom, M3 `uitwerking`, bv. een diagram onder het package "besluit"). Dan volgt de map de keten
 * tot een echte map (gemeld door Mark 14-11: diagrammen onder een package stonden "buiten de map").
 * Zo'n ouder-element dat zelf niet veranderde, staat in `context` (naam, map, eigen ouder), zodat
 * de keuzeboom het als ouder kan tonen.
 */
import { gelijk } from "../sync/operaties.js";

/** @typedef {"nieuw"|"gewijzigd"|"weg"|"conflict"|"main"} VerschilStatus */
/**
 * @typedef {{soort: "element"|"diagram"|"map"|"kruisverband"|"bundel", profielId: string|null, id: string,
 *            naam: string, status: VerschilStatus, velden: string[], inScope: boolean,
 *            kant?: "tak"|"main", sleutel: string, mapId: string|null, ouderId: string|null,
 *            elementType?: string}} Verschil
 *
 * Voor de keuze per eenheid (branch terugmergen stap 2, 14-11):
 *   - `sleutel`: vaste naam van de eenheid (`verschilSleutel`), ook de sleutel in `keuze` bij
 *     samenvoegen;
 *   - `mapId`: de map waarin de eenheid in de branch ligt (anders op MAIN, anders in de basis);
 *   - `ouderId`: bij een element de bron (relatie) of de boomouder, om het in de keuzeboom onder
 *     zijn ouder te hangen; anders null;
 *   - `elementType`: bij een element het type uit het profiel (M2), zodat de boom "entiteit",
 *     "gegevenselement", "domein" … kan tonen in plaats van "element" (Mark 14-11).
 */

const leeg = Object.freeze({});

/**
 * Vaste sleutel van een eenheid: `<soort>:<profielId>:<id>` (profielId leeg bij map en
 * kruisverband). Een plaatsing hoort bij haar element of diagram; een bundel heet
 * `bundel::<id>`, de soortenlijst `koppelsoorten::koppelsoorten`.
 * @param {{soort: string, profielId?: string|null, id: string}} v
 */
export const verschilSleutel = (v) => `${v.soort}:${v.profielId ?? ""}:${v.id}`;

/**
 * Wijst een plaatsing naar een element (`el::<profiel>::<id>`, element als ouder in de boom)?
 * Dan `{profielId, id}`, anders null (een gewone map-id).
 * @param {unknown} waarde
 */
export function elementVanPlaatsing(waarde) {
  if (typeof waarde !== "string" || !waarde.startsWith("el::")) return null;
  const rest = waarde.slice(4);
  const i = rest.indexOf("::");
  return i > 0 ? { profielId: rest.slice(0, i), id: rest.slice(i + 2) } : null;
}

/** Velden (bovenste sleutels, `data.*` uitgesplitst) die tussen a en b verschillen. */
export function verschillendeVelden(a, b) {
  if (!a || !b) return [];
  const uit = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (gelijk(a[k], b[k])) continue;
    const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (k === "data" && (isObj(a[k]) || isObj(b[k]))) {
      for (const d of verschillendeVelden(a[k] || leeg, b[k] || leeg)) uit.push(`data.${d}`);
    } else uit.push(k);
  }
  return uit.sort();
}

/**
 * Drieweg-status van één id. null = geen verschil dat telt.
 * @returns {{status: VerschilStatus, velden: string[], kant?: "tak"|"main"}|null}
 */
export function drieweg(basis, tak, main) {
  const takAnders = !gelijk(basis, tak);
  const mainAnders = !gelijk(basis, main);
  if (!takAnders && !mainAnders) return null;
  if (takAnders && mainAnders) {
    if (gelijk(tak, main)) return null; // beide kanten deden hetzelfde
    const velden = verschillendeVelden(tak || basis || leeg, main || basis || leeg);
    return { status: "conflict", velden };
  }
  if (mainAnders) return { status: "main", velden: verschillendeVelden(basis || main, main || basis), kant: "main" };
  if (basis === undefined) return { status: "nieuw", velden: [] };
  if (tak === undefined) return { status: "weg", velden: [] };
  return { status: "gewijzigd", velden: verschillendeVelden(basis, tak) };
}

/** Ids van de map en al zijn submappen (in een of meer standen). */
function mapEnSubmappen(mapId, ...mappenLijst) {
  const alle = Object.assign({}, ...mappenLijst.map((m) => m || leeg));
  const uit = new Set(mapId ? [mapId] : []);
  let groeide = true;
  while (groeide) {
    groeide = false;
    for (const m of Object.values(alle)) {
      if (m?.ouderId && uit.has(m.ouderId) && !uit.has(m.id)) { uit.add(m.id); groeide = true; }
    }
  }
  return uit;
}

const naamVan = (...kandidaten) => {
  for (const k of kandidaten) if (k && (k.naam || k.name)) return String(k.naam || k.name);
  return "";
};

/**
 * Het verschil tussen tak en MAIN, ten opzichte van de basis.
 * @param {{basis: any, tak: any, main: any, mapId?: string|null,
 *          ouderVan?: (profielId: string, elementId: string, stand: any) => string|null}} p
 * @returns {{verschillen: Verschil[], telling: Record<VerschilStatus, number>, scope: string[],
 *            mappen: Record<string, {id: string, naam: string, ouderId: string|null}>,
 *            context: Record<string, {sleutel: string, profielId: string, id: string, naam: string, mapId: string|null, ouderId: string|null, elementType?: string}>}}
 */
export function verschilMetMain({ basis, tak, main, mapId = null, ouderVan = null }) {
  const standen = { basis: basis || leeg, tak: tak || leeg, main: main || leeg };
  const scope = mapEnSubmappen(mapId, standen.basis.structuur?.mappen, standen.tak.structuur?.mappen, standen.main.structuur?.mappen);
  /** @type {Verschil[]} */
  const verschillen = [];

  // Een plaatsing die naar een element wijst, volgen tot een map.
  const naarMap = (stand, waarde, diepte = 0) => {
    const el = elementVanPlaatsing(waarde);
    return el ? mapVanElement(stand, el.profielId, el.id, diepte + 1) : waarde ?? null;
  };
  // De map van een element in een stand: eigen plaatsing, anders de boomouder, anders (relatie) de bron.
  const mapVanElement = (stand, profielId, id, diepte = 0) => {
    if (!id || diepte > 32) return null;
    const plaatsing = stand.structuur?.plaatsing || leeg;
    const eigen = plaatsing[`el::${profielId}::${id}`];
    if (eigen) return naarMap(stand, eigen, diepte);
    const el = stand.profielen?.[profielId]?.elements?.[id];
    if (el?.source) return mapVanElement(stand, profielId, el.source, diepte + 1);
    const ouder = ouderVan ? ouderVan(profielId, id, stand) : null;
    return ouder ? mapVanElement(stand, profielId, ouder, diepte + 1) : null;
  };
  // In de scope als het in een van de standen in de scope ligt (verplaatsen uit de map telt ook).
  const inScopeVia = (vind) => !!mapId && ["tak", "basis", "main"].some((k) => scope.has(vind(standen[k])));

  const profielIds = new Set(["basis", "tak", "main"].flatMap((k) => Object.keys(standen[k].profielen || leeg)));
  for (const pid of [...profielIds].sort()) {
    for (const [soort, veld] of /** @type {const} */ ([["element", "elements"], ["diagram", "diagrams"]])) {
      const b = standen.basis.profielen?.[pid]?.[veld] || leeg;
      const t = standen.tak.profielen?.[pid]?.[veld] || leeg;
      const m = standen.main.profielen?.[pid]?.[veld] || leeg;
      for (const id of new Set([...Object.keys(b), ...Object.keys(t), ...Object.keys(m)])) {
        const r = drieweg(b[id], t[id], m[id]);
        if (!r) continue;
        const inScope = soort === "element"
          ? inScopeVia((st) => mapVanElement(st, pid, id))
          : inScopeVia((st) => naarMap(st, st.structuur?.plaatsing?.[`${pid}::${id}`]));
        verschillen.push({ soort, profielId: pid, id, naam: naamVan(t[id], m[id], b[id]), ...r, inScope });
      }
    }
  }

  // Mappen zelf (naam, ouder, beschrijving).
  {
    const b = standen.basis.structuur?.mappen || leeg, t = standen.tak.structuur?.mappen || leeg, m = standen.main.structuur?.mappen || leeg;
    for (const id of new Set([...Object.keys(b), ...Object.keys(t), ...Object.keys(m)])) {
      const r = drieweg(b[id], t[id], m[id]);
      if (r) verschillen.push({ soort: "map", profielId: null, id, naam: naamVan(t[id], m[id], b[id]), ...r, inScope: scope.has(id) });
    }
  }

  // Verplaatsen tussen mappen: een plaatsing die verandert telt als wijziging van "map" op het element/diagram.
  {
    const b = standen.basis.structuur?.plaatsing || leeg, t = standen.tak.structuur?.plaatsing || leeg, m = standen.main.structuur?.plaatsing || leeg;
    for (const sleutel of new Set([...Object.keys(b), ...Object.keys(t), ...Object.keys(m)])) {
      const r = drieweg(b[sleutel], t[sleutel], m[sleutel]);
      if (!r) continue;
      const isEl = sleutel.startsWith("el::");
      const rest = isEl ? sleutel.slice(4) : sleutel;
      const i = rest.indexOf("::");
      const pid = rest.slice(0, i), id = rest.slice(i + 2);
      const soort = isEl ? "element" : "diagram";
      const al = verschillen.find((v) => v.soort === soort && v.profielId === pid && v.id === id);
      const inScope = scope.has(naarMap(standen.basis, b[sleutel])) || scope.has(naarMap(standen.tak, t[sleutel])) || scope.has(naarMap(standen.main, m[sleutel]));
      if (al) {
        if (!al.velden.includes("map")) al.velden = [...al.velden, "map"].sort();
        if (r.status === "conflict") al.status = "conflict";
        al.inScope = al.inScope || inScope;
      } else {
        // Alleen verplaatst: status volgt de plaatsing; nieuw/weg van een plaatsing is een verplaatsing.
        const status = r.status === "nieuw" || r.status === "weg" ? "gewijzigd" : r.status;
        const kant = r.status === "main" ? "main" : undefined;
        const el = standen.tak.profielen?.[pid]?.[isEl ? "elements" : "diagrams"]?.[id] || standen.main.profielen?.[pid]?.[isEl ? "elements" : "diagrams"]?.[id];
        verschillen.push({ soort, profielId: pid, id, naam: naamVan(el), status, velden: ["map"], inScope, ...(kant ? { kant } : {}) });
      }
    }
  }

  // Diagrambundels (gedeeld in het project, `structuur.bundels`; Mark 14-11: "bundels worden niet
  // meegesynct"). Een bundel ligt in de scope als een van zijn diagrammen erin ligt.
  {
    const b = standen.basis.structuur?.bundels || leeg, t = standen.tak.structuur?.bundels || leeg, m = standen.main.structuur?.bundels || leeg;
    for (const id of new Set([...Object.keys(b), ...Object.keys(t), ...Object.keys(m)])) {
      const r = drieweg(b[id], t[id], m[id]);
      if (!r) continue;
      const x = t[id] || m[id] || b[id];
      const tabs = Array.isArray(x?.tabs) ? x.tabs : [];
      const inScope = !!mapId && (tabs.length === 0 || tabs.some((tab) => ["tak", "basis", "main"].some((k) =>
        scope.has(naarMap(standen[k], standen[k].structuur?.plaatsing?.[`${tab.profielId}::${tab.diagramId}`])))));
      verschillen.push({ soort: "bundel", profielId: null, id, naam: naamVan(x), ...r, inScope });
    }
  }

  // Kruisverbanden (lijst, op id).
  {
    const perId = (st) => new Map((Array.isArray(st.kruisverbanden) ? st.kruisverbanden : []).map((x) => [x.id, x]));
    const b = perId(standen.basis), t = perId(standen.tak), m = perId(standen.main);
    for (const id of new Set([...b.keys(), ...t.keys(), ...m.keys()])) {
      const r = drieweg(b.get(id), t.get(id), m.get(id));
      if (!r) continue;
      const x = t.get(id) || m.get(id) || b.get(id);
      const inScope = inScopeVia((st) => {
        // Een kruisverband ({id, rij:{profielId,elementId}, kolom:{…}, soort}) ligt in de scope
        // als een van zijn kanten erin ligt.
        for (const kant of [x?.rij, x?.kolom]) {
          const k = kant?.profielId && kant?.elementId ? mapVanElement(st, kant.profielId, kant.elementId) : null;
          if (k && scope.has(k)) return k;
        }
        return null;
      });
      verschillen.push({ soort: "kruisverband", profielId: null, id, naam: naamVan(x) || String(x?.soort || ""), ...r, inScope });
    }
  }

  // Sleutel, map en ouder per verschil (voor de keuzeboom). Ouder van een element: de bron
  // (relatie), anders het element waaronder het geplaatst is, anders de boomouder. Ouder van een
  // diagram: het element waaronder het geplaatst is (zelfde profiel).
  const ouderVanEenheid = (soort, pid, id) => {
    for (const k of ["tak", "main", "basis"]) {
      const st = standen[k];
      const x = st.profielen?.[pid]?.[soort === "element" ? "elements" : "diagrams"]?.[id];
      if (!x) continue;
      if (soort === "element" && x.source) return String(x.source);
      const pl = elementVanPlaatsing(st.structuur?.plaatsing?.[soort === "element" ? `el::${pid}::${id}` : `${pid}::${id}`]);
      if (pl && pl.profielId === pid) return pl.id;
      if (soort !== "element") return null;
      const o = ouderVan ? ouderVan(pid, id, st) : null;
      return o ? String(o) : null;
    }
    return null;
  };
  const mapVan = (soort, pid, id) => {
    for (const k of ["tak", "main", "basis"]) {
      const st = standen[k];
      const m = soort === "element" ? mapVanElement(st, pid, id)
        : soort === "diagram" ? naarMap(st, st.structuur?.plaatsing?.[`${pid}::${id}`])
          : soort === "map" ? (st.structuur?.mappen?.[id] ? st.structuur.mappen[id].ouderId ?? null : undefined)
            : null;
      if (m !== undefined && m !== null) return String(m);
      if (soort === "map" && m === null) return null; // map in de wortel
    }
    return null;
  };
  for (const v of verschillen) {
    v.sleutel = verschilSleutel(v);
    v.ouderId = v.soort === "element" || v.soort === "diagram" ? ouderVanEenheid(v.soort, v.profielId, v.id) : null;
    v.mapId = mapVan(v.soort, v.profielId, v.id);
    if (v.soort === "element") {
      const el = ["tak", "main", "basis"].map((k) => standen[k].profielen?.[v.profielId]?.elements?.[v.id]).find(Boolean);
      if (el?.elementType) v.elementType = String(el.elementType);
    }
  }

  // Ouder-elementen die zelf niet veranderden (bv. het package waaronder een nieuw diagram staat):
  // naam, map en eigen ouder, zodat de boom de keten kan tonen.
  /** @type {Record<string, {sleutel: string, profielId: string, id: string, naam: string, mapId: string|null, ouderId: string|null}>} */
  const context = {};
  const inVerschil = new Set(verschillen.map((v) => v.sleutel));
  const voegContextToe = (pid, id, diepte = 0) => {
    const sleutel = verschilSleutel({ soort: "element", profielId: pid, id });
    if (!id || diepte > 32 || inVerschil.has(sleutel) || context[sleutel]) return;
    const el = ["tak", "main", "basis"].map((k) => standen[k].profielen?.[pid]?.elements?.[id]).find(Boolean);
    if (!el) return;
    const ouderId = ouderVanEenheid("element", pid, id);
    context[sleutel] = { sleutel, profielId: pid, id, naam: naamVan(el) || id, mapId: mapVan("element", pid, id), ouderId, ...(el.elementType ? { elementType: String(el.elementType) } : {}) };
    if (ouderId) voegContextToe(pid, ouderId, diepte + 1);
  };
  for (const v of verschillen) if (v.ouderId) voegContextToe(v.profielId, v.ouderId);

  // Alle mappen (naam en ouder), de branch het zwaarst: om de boom te tekenen.
  /** @type {Record<string, {id: string, naam: string, ouderId: string|null}>} */
  const mappen = {};
  for (const k of ["basis", "main", "tak"]) {
    for (const [id, m] of Object.entries(standen[k].structuur?.mappen || leeg)) {
      mappen[id] = { id, naam: String(m?.naam || id), ouderId: m?.ouderId ?? null };
    }
  }

  const volgorde = { conflict: 0, nieuw: 1, gewijzigd: 2, weg: 3, main: 4 };
  const soortVolgorde = { map: 0, element: 1, diagram: 2, bundel: 3, kruisverband: 4 };
  verschillen.sort((a, b) => volgorde[a.status] - volgorde[b.status]
    || soortVolgorde[a.soort] - soortVolgorde[b.soort]
    || String(a.profielId).localeCompare(String(b.profielId))
    || a.naam.localeCompare(b.naam) || a.id.localeCompare(b.id));
  const telling = { nieuw: 0, gewijzigd: 0, weg: 0, conflict: 0, main: 0 };
  for (const v of verschillen) telling[v.status] += 1;
  return { verschillen, telling, scope: [...scope], mappen, context };
}

/**
 * Wijzigingen in de tak buiten de scope: in stap 1 niet geblokkeerd, wel gemeld (de branch hoort
 * alleen zijn map te wijzigen; stap 2 dwingt dat af).
 * @param {Verschil[]} verschillen
 */
export const buitenScope = (verschillen) => verschillen.filter((v) => v.status !== "main" && !v.inScope);
