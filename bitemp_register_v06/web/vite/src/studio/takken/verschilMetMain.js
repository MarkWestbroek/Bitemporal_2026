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
 */
import { gelijk } from "../sync/operaties.js";

/** @typedef {"nieuw"|"gewijzigd"|"weg"|"conflict"|"main"} VerschilStatus */
/**
 * @typedef {{soort: "element"|"diagram"|"map"|"kruisverband", profielId: string|null, id: string,
 *            naam: string, status: VerschilStatus, velden: string[], inScope: boolean,
 *            kant?: "tak"|"main"}} Verschil
 */

const leeg = Object.freeze({});

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
 * @returns {{verschillen: Verschil[], telling: Record<VerschilStatus, number>, scope: string[]}}
 */
export function verschilMetMain({ basis, tak, main, mapId = null, ouderVan = null }) {
  const standen = { basis: basis || leeg, tak: tak || leeg, main: main || leeg };
  const scope = mapEnSubmappen(mapId, standen.basis.structuur?.mappen, standen.tak.structuur?.mappen, standen.main.structuur?.mappen);
  /** @type {Verschil[]} */
  const verschillen = [];

  // De map van een element in een stand: eigen plaatsing, anders de boomouder, anders (relatie) de bron.
  const mapVanElement = (stand, profielId, id, diepte = 0) => {
    if (!id || diepte > 16) return null;
    const plaatsing = stand.structuur?.plaatsing || leeg;
    const eigen = plaatsing[`el::${profielId}::${id}`];
    if (eigen) return eigen;
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
          : inScopeVia((st) => st.structuur?.plaatsing?.[`${pid}::${id}`]);
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
      const inScope = scope.has(b[sleutel]) || scope.has(t[sleutel]) || scope.has(m[sleutel]);
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

  const volgorde = { conflict: 0, nieuw: 1, gewijzigd: 2, weg: 3, main: 4 };
  const soortVolgorde = { map: 0, element: 1, diagram: 2, kruisverband: 3 };
  verschillen.sort((a, b) => volgorde[a.status] - volgorde[b.status]
    || soortVolgorde[a.soort] - soortVolgorde[b.soort]
    || String(a.profielId).localeCompare(String(b.profielId))
    || a.naam.localeCompare(b.naam) || a.id.localeCompare(b.id));
  const telling = { nieuw: 0, gewijzigd: 0, weg: 0, conflict: 0, main: 0 };
  for (const v of verschillen) telling[v.status] += 1;
  return { verschillen, telling, scope: [...scope] };
}

/**
 * Wijzigingen in de tak buiten de scope: in stap 1 niet geblokkeerd, wel gemeld (de branch hoort
 * alleen zijn map te wijzigen; stap 2 dwingt dat af).
 * @param {Verschil[]} verschillen
 */
export const buitenScope = (verschillen) => verschillen.filter((v) => v.status !== "main" && !v.inScope);
