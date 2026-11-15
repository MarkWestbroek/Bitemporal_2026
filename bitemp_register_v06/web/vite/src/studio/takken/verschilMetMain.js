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
 *            elementType?: string, veldDetails?: {veld: string, status: VerschilStatus, label?: string, compartiment?: string}[]}} Verschil
 *
 * Voor de keuze per eenheid (branch terugmergen stap 2, 14-11):
 *   - `sleutel`: vaste naam van de eenheid (`verschilSleutel`), ook de sleutel in `keuze` bij
 *     samenvoegen;
 *   - `mapId`: de map waarin de eenheid in de branch ligt (anders op MAIN, anders in de basis);
 *   - `ouderId`: bij een element de bron (relatie) of de boomouder, om het in de keuzeboom onder
 *     zijn ouder te hangen; anders null;
 *   - `veldDetails` (stap 2b): bij een element dat in alle drie bestaat, per veld (`veldenVan`) de
 *     status. Het element is alleen een conflict als hetzelfde veld aan beide kanten anders
 *     veranderde; verschillende velden aan beide kanten is "gewijzigd" (de MAIN-velden komen mee).
 *     De plaatsing staat erin als veld `map`;
 *   - `elementType`: bij een element het type uit het profiel (M2), zodat de boom "entiteit",
 *     "gegevenselement", "domein" … kan tonen in plaats van "element" (Mark 14-11).
 */

const leeg = Object.freeze({});
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Vaste sleutel van een eenheid: `<soort>:<profielId>:<id>` (profielId leeg bij map en
 * kruisverband). Een plaatsing hoort bij haar element of diagram; een bundel heet
 * `bundel::<id>`, de soortenlijst `koppelsoorten::koppelsoorten`.
 * @param {{soort: string, profielId?: string|null, id: string}} v
 */
export const verschilSleutel = (v) => `${v.soort}:${v.profielId ?? ""}:${v.id}`;

/** Type van een compartiment (sleuteldeel). */
const compType = (c, i) => String(c?.compartmentType ?? c?.id ?? i);

/**
 * Uuid per (compartiment, veldnaam) uit een of meer versies van een element: zo krijgt een veld
 * zonder uuid dezelfde sleutel als zijn tegenhanger die er (na een V3-export) wel een heeft.
 * @param {...any} elementen
 * @returns {Map<string, string>}
 */
export function uuidPerVeldnaam(...elementen) {
  const kaart = new Map();
  for (const el of elementen) {
    (Array.isArray(el?.compartimenten) ? el.compartimenten : []).forEach((c, i) => {
      for (const v of Array.isArray(c?.velden) ? c.velden : []) {
        const naam = String(v?.naam || "").trim();
        if (naam && v?.data?.uuid && !kaart.has(`${compType(c, i)}\u0000${naam}`)) kaart.set(`${compType(c, i)}\u0000${naam}`, String(v.data.uuid));
      }
    });
  }
  return kaart;
}

/**
 * Lijn de velden van drie versies van een element uit (basis, tak, MAIN): veld-object → sleutel.
 * Eerst op uuid (ook via een naamgenoot, `uuidPerVeldnaam`), dan op naam. Een veld zonder uuid
 * met een naam die de basis niet kent, staand op dezelfde plek als een basisveld van hetzelfde
 * type dat in deze versie niet meer voorkomt, is een **hernoeming** van dat basisveld en krijgt
 * zijn sleutel (Mark 15-11: "ik heb alleen hernoemd" — zonder uuid leek dat op weg + nieuw).
 * @returns {Map<any, string>}
 */
export function lijnVeldenUit(b, t, m) {
  const kaart = uuidPerVeldnaam(m, t, b);
  const uit = new Map();
  const comps = (el) => (Array.isArray(el?.compartimenten) ? el.compartimenten : []);
  const naamVan = (v) => String(v?.naam || "").trim();
  const sleutelVan = (ct, v, j) => {
    const naam = naamVan(v);
    const uuid = v?.data?.uuid || (naam ? kaart.get(`${ct}\u0000${naam}`) : null);
    return uuid ? `uuid:${uuid}` : naam ? `naam:${naam}` : `pos:${j}`;
  };
  /** @type {Map<string, {veld: any, sleutel: string, naam: string}[]>} */
  const basis = new Map();
  comps(b).forEach((c, i) => {
    const ct = compType(c, i);
    const lijst = (Array.isArray(c?.velden) ? c.velden : []).map((v, j) => ({ veld: v, sleutel: sleutelVan(ct, v, j), naam: naamVan(v) }));
    basis.set(ct, lijst);
    for (const x of lijst) uit.set(x.veld, x.sleutel);
  });
  for (const el of [t, m]) {
    comps(el).forEach((c, i) => {
      const ct = compType(c, i);
      const vanBasis = basis.get(ct) || [];
      const basisSleutels = new Set(vanBasis.map((x) => x.sleutel));
      const velden = Array.isArray(c?.velden) ? c.velden : [];
      const sleutels = velden.map((v, j) => sleutelVan(ct, v, j));
      const gebruikt = new Set(sleutels);
      velden.forEach((v, j) => {
        let s = sleutels[j];
        if (!s.startsWith("uuid:") && !basisSleutels.has(s)) {
          const kand = vanBasis[j];
          if (kand && !gebruikt.has(kand.sleutel) && kand.veld?.fieldType === v?.fieldType) {
            s = kand.sleutel;
            gebruikt.add(s);
          }
        }
        uit.set(v, s);
      });
    });
  }
  return uit;
}

/**
 * De velden van een element, plat (stap 2b): elke eigenschap bovenaan (behalve `id`), elke
 * `data.*`-sleutel apart, en per compartiment de schil (`compartiment.<type>`, zonder velden)
 * plus elk veld apart: `compartiment.<type>/uuid:<uuid>`, of `…/naam:<naam>` zonder uuid, of
 * `…/pos:<i>` zonder naam (een veld in aanmaak). De uuid van een veld is `data.uuid` (canoniek
 * model, gezet bij de V3-export; besluit Mark 31-10); `uuidPerNaam` (zie `uuidPerVeldnaam`) geeft
 * een veld zonder uuid de uuid van zijn naamgenoot in een andere versie.
 * @param {any} el
 * @param {Map<string, string>} [uuidPerNaam]
 * @param {Map<any, string>|null} [uitlijning] sleutel per veld-object (`lijnVeldenUit`): gaat voor
 * @returns {Record<string, any>}
 */
export function veldenVan(el, uuidPerNaam = new Map(), uitlijning = null) {
  const uit = {};
  if (!isObject(el)) return uit;
  for (const [k, v] of Object.entries(el)) {
    if (k === "id" || v === undefined) continue;
    if (k === "data" && isObject(v)) {
      for (const [d, w] of Object.entries(v)) if (w !== undefined) uit[`data.${d}`] = w;
    } else if (k === "compartimenten" && Array.isArray(v)) {
      v.forEach((c, i) => {
        const ct = compType(c, i);
        if (!Array.isArray(c?.velden)) { uit[`compartiment.${ct}`] = c; return; }
        const { velden, ...schil } = c;
        uit[`compartiment.${ct}`] = schil;
        const gezien = new Map();
        velden.forEach((veld, j) => {
          const naam = String(veld?.naam || "").trim();
          const uuid = veld?.data?.uuid || (naam ? uuidPerNaam.get(`${ct}\u0000${naam}`) : null);
          let s = uitlijning?.get(veld) ?? (uuid ? `uuid:${uuid}` : naam ? `naam:${naam}` : `pos:${j}`);
          const n = (gezien.get(s) || 0) + 1;
          gezien.set(s, n);
          if (n > 1) s = `${s}~${n}`;
          uit[`compartiment.${ct}/${s}`] = veld;
        });
      });
    } else uit[k] = v;
  }
  return uit;
}

/** Is dit veld (uit `veldenVan`) één veld in een compartiment? Dan `{compartiment, sleutel}`. */
export function compartimentVeld(veld) {
  const m = /^compartiment\.([^/]+)\/(.+)$/.exec(String(veld));
  return m ? { compartiment: m[1], sleutel: m[2] } : null;
}

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

/**
 * Status van een element per veld (stap 2b). null = geen verschil dat telt.
 * @returns {{status: VerschilStatus, velden: string[], kant?: "main", veldDetails: {veld: string, status: VerschilStatus}[]}|null}
 */
export function perVeldStatus(b, t, m) {
  const kaart = uuidPerVeldnaam(m, t, b);
  const lijn = lijnVeldenUit(b, t, m);
  const vb = veldenVan(b, kaart, lijn), vt = veldenVan(t, kaart, lijn), vm = veldenVan(m, kaart, lijn);
  const veldDetails = [];
  for (const veld of new Set([...Object.keys(vm), ...Object.keys(vt), ...Object.keys(vb)])) {
    const r = drieweg(vb[veld], vt[veld], vm[veld]);
    if (!r) continue;
    // Een veld in een compartiment: zijn naam als label (de sleutel kan een uuid zijn).
    const cv = compartimentVeld(veld);
    const naam = cv ? String((vt[veld] || vm[veld] || vb[veld])?.naam || "").trim() : "";
    veldDetails.push({ veld, status: r.status, ...(cv ? { label: naam || "(zonder naam)", compartiment: cv.compartiment } : {}) });
  }
  if (!veldDetails.length) return null;
  veldDetails.sort((x, y) => x.veld.localeCompare(y.veld));
  const vanTak = veldDetails.filter((d) => d.status !== "main");
  if (!vanTak.length) return { status: "main", kant: "main", velden: veldDetails.map((d) => d.veld), veldDetails };
  const status = vanTak.some((d) => d.status === "conflict") ? "conflict" : "gewijzigd";
  return { status, velden: vanTak.map((d) => d.veld), veldDetails };
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
        let r = drieweg(b[id], t[id], m[id]);
        if (!r) continue;
        // Per veld (stap 2b): alleen voor een element dat in alle drie bestaat.
        if (soort === "element" && b[id] && t[id] && m[id]) r = perVeldStatus(b[id], t[id], m[id]) || r;
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
      const mapStatus = r.status === "nieuw" || r.status === "weg" ? "gewijzigd" : r.status;
      if (al) {
        if (r.status !== "main" || al.status === "main") {
          if (!al.velden.includes("map")) al.velden = [...al.velden, "map"].sort();
        }
        if (r.status === "conflict") al.status = "conflict";
        else if (r.status !== "main" && al.status === "main") { al.status = "gewijzigd"; delete al.kant; al.velden = ["map"]; }
        if (al.veldDetails) al.veldDetails = [...al.veldDetails.filter((d) => d.veld !== "map"), { veld: "map", status: mapStatus }].sort((x, y) => x.veld.localeCompare(y.veld));
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
