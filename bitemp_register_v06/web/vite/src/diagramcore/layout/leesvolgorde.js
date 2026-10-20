// @ts-check
/**
 * leesvolgorde — een algemene, deterministische gelaagde layout die de leesvolgorde van een
 * profiel volgt (Mark, 18-10-2026: "boven/onder is per profiel een ander concept; het heeft te
 * maken met leesvolgorde").
 *
 * De regels hieronder (het 'Leesvolgorde'-formaat) maakt `regelsVoorStijl` uit de aard en facetten
 * van de typen en de LayoutStijl van het profiel (types/layoutStijl.js, M3 18-10):
 *
 *   {
 *     richting:  "TB" | "LR",        standaard (smaak: AD van boven naar beneden, BPMN van links naar rechts)
 *     stroom:    [connector-ids],    de verbindingen die de volgorde bepalen (weg = alle)
 *     omgekeerd: [connector-ids],    lees doel → bron (generalisatie: de ouder eerst)
 *     negeer:    [connector-ids],    tellen niet mee (bv. message flow tussen pools)
 *     start:     [element-types],    beginpunten (er mogen er meer zijn)
 *     eind:      [element-types],    eindpunten: achteraan
 *     banen:     [container-types],  banen (lanes, partities): dwars op de leesrichting gestapeld,
 *                                    de stroom loopt erdoorheen
 *     lagen:     [[types], [types]], vaste lagen in plaats van de stroom (ArchiMate: strategie,
 *                                    business, applicatie, technologie, …)
 *     minimaal:  {type: [breedte, hoogte]}, kleinste maat van een container of baan zoals de vorm
 *                                    hem tekent (bv. een BPMN-lane), zodat niets overloopt
 *   }
 *
 * Het algoritme (per groep: het diagram, of de inhoud van één container):
 *  1. Containers eerst van binnen naar buiten: hun inhoud wordt opgesteld, de container groeit mee.
 *  2. Lagen: de langste weg vanaf de beginpunten over de stroom (cycli gebroken in een vaste
 *     volgorde); eindpunten achteraan; elementen zonder verbinding in een laag erachter.
 *  3. Volgorde binnen een laag: eerst zoals het nu staat (de hand van de modelleur), daarna een
 *     paar rondes barycentrum. Bij gelijke stand beslist de huidige plek, dan het id.
 *  4. Coördinaten: lagen langs de leesrichting, binnen een laag dwars, gecentreerd.
 *  5. Banen (lanes): de lagen gelden over alle banen samen, zodat de stroom recht doorloopt; elke
 *     baan krijgt een eigen strook dwars op de leesrichting, alle banen even lang.
 *
 * Puur: geen DOM, geen stores. Zie `leesvolgordeLayouts` voor de strategieën op een descriptor.
 */

/** Alleen de eindige getallen van de gegeven sleutels. */
const pick = (o, sleutels) => Object.fromEntries(sleutels.filter((k) => Number.isFinite(o?.[k])).map((k) => [k, o[k]]));

const MARGE_STANDAARD = { rand: 24, kop: 36 }; // binnenmarge van een container; boven ruimte voor de naam
const AFSTAND_STANDAARD = { laag: 70, dwars: 40, baan: 0 };

/** Standaard: verbindingen die "ouder/abstract eerst" lezen — woont bij de betekenis (types/layoutStijl.js). */
import { STANDAARD_OMGEKEERD, stijlVoor, regelsVoorStijl } from "../types/layoutStijl.js";
export { STANDAARD_OMGEKEERD };

/**
 * @typedef {{id: string, type?: string, x: number, y: number, w: number, h: number, ouder?: string|null, container?: boolean}} Knoop
 * @typedef {{bron: string, doel: string, soort?: string, data?: Record<string, any>}} Verbinding
 */

/**
 * @param {{knopen: Knoop[], verbindingen: Verbinding[], regels?: any, richting?: "TB"|"LR"|"BT"|"RL", afstanden?: {laag?: number, dwars?: number, baan?: number, marge?: number}}} invoer
 * @returns {{posities: Record<string, {x: number, y: number}>, maten: Record<string, {width: number, height: number}>}}
 */
export function legLeesvolgordeUit(invoer) {
  const { knopen, verbindingen, regels = {}, richting, afstanden = {} } = invoer;
  const lr = ["LR", "RL"].includes(richting || regels.richting || "TB");
  const gap = Number.isFinite(afstanden?.dwars) ? afstanden.dwars : AFSTAND_STANDAARD.dwars;
  const perId = new Map(knopen.map((k) => [k.id, k]));
  // Buren over alle verbindingen (ook over kadergrenzen heen), voor de volgorde en het uitlijnen.
  const buren = new Map(knopen.map((k) => [k.id, []]));
  for (const v of verbindingen) {
    if (!buren.has(v.bron) || !buren.has(v.doel) || v.bron === v.doel) continue;
    buren.get(v.bron).push(v.doel);
    buren.get(v.doel).push(v.bron);
  }
  const maatIn = (uit, id) => (uit.maten[id] ? { w: uit.maten[id].width, h: uit.maten[id].height } : { w: perId.get(id).w, h: perId.get(id).h });
  const midden = (uit, id) => { const p = uit.posities[id], m = maatIn(uit, id); return lr ? p.y + m.h / 2 : p.x + m.w / 2; };

  // Rondes (Mark/ARCH-PROJECT 18-10: "het lijkt modelvolgorde"): elke ronde ordent elk element
  // naar het gemiddelde van zijn buren uit de vorige ronde — ook buren in een ander kader, zodat
  // actoren en hun use cases (binnen het systeemkader) elkaars volgorde volgen.
  let uit = legEenmaal(invoer, null);
  for (let ronde = 0; ronde < 3; ronde++) {
    const hints = new Map();
    for (const k of knopen) {
      const b = buren.get(k.id);
      hints.set(k.id, b.length ? b.reduce((s, n) => s + midden(uit, n), 0) / b.length : midden(uit, k.id));
    }
    uit = legEenmaal(invoer, hints);
  }

  // Uitlijnen: elk element op het bovenste niveau dwars naar het midden van zijn buren in andere
  // lagen (een actor op de hoogte van zijn use cases), met behoud van volgorde en tussenruimte.
  const nazaten = (id) => { const uitL = []; for (const k of knopen) for (let c = k.ouder; c; c = perId.get(c)?.ouder) if (c === id) { uitL.push(k.id); break; } return uitL; };
  for (let ronde = 0; ronde < 2; ronde++) {
    for (const laag of uit.topLagen) {
      const inLaag = new Set(laag.flatMap((id) => [id, ...nazaten(id)]));
      const items = [...laag].sort((a, b) => (lr ? uit.posities[a].y - uit.posities[b].y : uit.posities[a].x - uit.posities[b].x));
      const doel = new Map();
      for (const id of items) {
        const eigen = [id, ...nazaten(id)];
        const b = eigen.flatMap((x) => buren.get(x)).filter((n) => !inLaag.has(n));
        if (b.length) doel.set(id, b.reduce((s, n) => s + midden(uit, n), 0) / b.length);
      }
      if (!doel.size) continue;
      const maatDw = (id) => (lr ? maatIn(uit, id).h : maatIn(uit, id).w);
      const begin = (id) => (lr ? uit.posities[id].y : uit.posities[id].x);
      // Volgorde op het gewenste midden (zonder buren: de huidige plek), zodat een actor met zijn
      // use cases onderaan niet boven een actor met zijn use cases in het midden blijft staan.
      const sleutel = (id) => (doel.has(id) ? doel.get(id) : begin(id) + maatDw(id) / 2);
      items.sort((a, b) => sleutel(a) - sleutel(b) || a.localeCompare(b));
      // Gretig plaatsen in volgorde, dan het blok zo schuiven dat de gemiddelde afwijking nul is.
      let eindVorige = -Infinity;
      const nieuw = new Map();
      for (const id of items) {
        const wens = doel.has(id) ? doel.get(id) - maatDw(id) / 2 : begin(id);
        const b = Math.max(wens, eindVorige + gap);
        nieuw.set(id, b);
        eindVorige = b + maatDw(id);
      }
      const afwijking = [...doel.keys()].reduce((s, id) => s + (doel.get(id) - maatDw(id) / 2 - nieuw.get(id)), 0) / doel.size;
      for (const id of items) {
        const delta = Math.round(nieuw.get(id) + afwijking - begin(id));
        if (!delta) continue;
        for (const x of [id, ...nazaten(id)]) {
          if (lr) uit.posities[x].y += delta;
          else uit.posities[x].x += delta;
        }
      }
    }
  }
  return { posities: uit.posities, maten: uit.maten };
}

/** Eén opstelling; `hints` (id → dwarspositie) bepaalt de beginvolgorde binnen een laag. */
function legEenmaal({ knopen, verbindingen, regels = {}, richting, afstanden = {} }, hints) {
  // Afstanden uit de LayoutStijl (laag, dwars, baan; marge = binnenrand van een container).
  const AFSTAND = { ...AFSTAND_STANDAARD, ...pick(afstanden, ["laag", "dwars", "baan"]) };
  const MARGE = { ...MARGE_STANDAARD, ...(Number.isFinite(afstanden?.marge) ? { rand: afstanden.marge } : {}) };
  const r = richting || regels.richting || "TB";
  const lr = r === "LR" || r === "RL";
  const perId = new Map(knopen.map((k) => [k.id, k]));
  const kinderenVan = new Map();
  for (const k of knopen) {
    const o = k.ouder && perId.has(k.ouder) ? k.ouder : null;
    if (!kinderenVan.has(o)) kinderenVan.set(o, []);
    kinderenVan.get(o).push(k.id);
  }
  const isContainer = (id) => !!perId.get(id)?.container || (kinderenVan.get(id)?.length ?? 0) > 0;
  const banen = new Set(regels.banen || []);
  const isBaan = (id) => banen.has(perId.get(id)?.type) && isContainer(id);

  // Gerichte stroom-verbindingen (na omdraaien en negeren).
  const stroom = regels.stroom ? new Set(regels.stroom) : null;
  const negeer = new Set(regels.negeer || []);
  const omgekeerd = new Set(regels.omgekeerd || STANDAARD_OMGEKEERD);
  const minimaal = regels.minimaal || {};
  const minVan = (id) => { const m = minimaal[perId.get(id)?.type]; return m ? { w: m[0] || 0, h: m[1] || 0 } : { w: 0, h: 0 }; };
  const pijlen = [];
  for (const v of verbindingen) {
    if (!perId.has(v.bron) || !perId.has(v.doel) || v.bron === v.doel) continue;
    if (negeer.has(v.soort) || (stroom && !stroom.has(v.soort))) continue;
    pijlen.push(omgekeerd.has(v.soort) ? { van: v.doel, naar: v.bron } : { van: v.bron, naar: v.doel });
  }
  const start = new Set(regels.start || []);
  // Buren op het oorspronkelijke niveau (zonder optillen naar een kader), voor 'secundair'.
  const origBuren = new Map(knopen.map((k) => [k.id, []]));
  for (const p of pijlen) { origBuren.get(p.van).push(p.naar); origBuren.get(p.naar).push(p.van); }
  const eind = new Set(regels.eind || []);
  const laagVanType = new Map();
  (regels.lagen || []).forEach((typen, i) => typen.forEach((t) => laagVanType.set(t, i)));

  // Afmeting langs (leesrichting) en dwars, en de huidige plek als volgorde-hint.
  const lang = (m) => (lr ? m.w : m.h);
  const dwars = (m) => (lr ? m.h : m.w);
  const hintLang = (k) => (lr ? k.x : k.y);
  const hintDwars = (k) => (hints?.has(k.id) ? hints.get(k.id) : lr ? k.y : k.x);

  // Uitkomst per groep: posities relatief aan de groep, en de maat van elke container.
  /** @type {Map<string, {x: number, y: number}>} */
  const rel = new Map();
  /** @type {Map<string, {w: number, h: number}>} */
  const maat = new Map(knopen.map((k) => [k.id, { w: k.w, h: k.h }]));

  /** Ouder binnen de opstelling (een ouder die niet meedoet telt als geen ouder). */
  const ouderVan = (id) => { const o = perId.get(id)?.ouder; return o && perId.has(o) ? o : null; };
  /** De voorouder van id (of id zelf) die direct kind is van groep g; null als id buiten g ligt. */
  const directKind = (id, g) => {
    for (let c = id; c; c = ouderVan(c)) if (ouderVan(c) === g) return c;
    return null;
  };

  /** Lagen + volgorde voor een verzameling elementen met hun pijlen (op dit niveau). */
  function rangschik(ids, lokalePijlen) {
    const volgorde = [...ids].sort((a, b) => hintLang(perId.get(a)) - hintLang(perId.get(b)) || hintDwars(perId.get(a)) - hintDwars(perId.get(b)) || a.localeCompare(b));
    const uit = new Map(ids.map((id) => [id, []]));
    const inn = new Map(ids.map((id) => [id, []]));
    for (const p of lokalePijlen) { uit.get(p.van).push(p.naar); inn.get(p.naar).push(p.van); }
    const laag = new Map();
    if (laagVanType.size) {
      // Vaste lagen (ArchiMate: business, applicatie, technologie, …), en binnen een laag de
      // relaties: wie samenstelt, toewijst of voorgaat staat boven (Mark 20-10: "de afhankelijkheid
      // volgen, dan weet je iets over boven en onder"). Langste weg per laag, cycli in vaste volgorde
      // gebroken; de lagen schuiven op naar gelang hoeveel rijen een laag nodig heeft.
      const max = Math.max(...laagVanType.values());
      const hoofd = new Map(ids.map((id) => [id, laagVanType.get(perId.get(id)?.type) ?? max + 1]));
      const sub = new Map(ids.map((id) => [id, 0]));
      const stand = new Map();
      const terug = new Set();
      const zelfde = (a, b) => hoofd.get(a) === hoofd.get(b);
      const bezoek = (id) => {
        stand.set(id, 1);
        for (const n of uit.get(id)) {
          if (!zelfde(id, n)) continue;
          if (stand.get(n) === 1) terug.add(`${id}>${n}`);
          else if (!stand.has(n)) bezoek(n);
        }
        stand.set(id, 2);
      };
      for (const w of [...volgorde.filter((id) => !inn.get(id).some((v) => zelfde(v, id))), ...volgorde]) if (!stand.has(w)) bezoek(w);
      const inGraad = new Map(ids.map((id) => [id, 0]));
      for (const id of ids) for (const n of uit.get(id)) if (zelfde(id, n) && !terug.has(`${id}>${n}`)) inGraad.set(n, inGraad.get(n) + 1);
      const rij = volgorde.filter((id) => inGraad.get(id) === 0);
      while (rij.length) {
        const id = rij.shift();
        for (const n of uit.get(id)) {
          if (!zelfde(id, n) || terug.has(`${id}>${n}`)) continue;
          sub.set(n, Math.max(sub.get(n), sub.get(id) + 1));
          inGraad.set(n, inGraad.get(n) - 1);
          if (inGraad.get(n) === 0) rij.push(n);
        }
      }
      const diepte = new Map();
      for (const id of ids) diepte.set(hoofd.get(id), Math.max(diepte.get(hoofd.get(id)) ?? 0, sub.get(id) + 1));
      const begin = new Map();
      let n = 0;
      for (const h of [...diepte.keys()].sort((a, b) => a - b)) { begin.set(h, n); n += diepte.get(h); }
      for (const id of ids) laag.set(id, begin.get(hoofd.get(id)) + sub.get(id));
    } else {
      // Cycli breken: DFS vanaf de beginpunten (start-typen, dan zonder inkomend), in vaste volgorde.
      const wortels = [...volgorde.filter((id) => start.has(perId.get(id)?.type)), ...volgorde.filter((id) => !inn.get(id).length)];
      const stand = new Map();
      const terug = new Set();
      const bezoek = (id) => {
        stand.set(id, 1);
        for (const n of uit.get(id)) {
          if (stand.get(n) === 1) terug.add(`${id}>${n}`);
          else if (!stand.has(n)) bezoek(n);
        }
        stand.set(id, 2);
      };
      for (const w of [...wortels, ...volgorde]) if (!stand.has(w)) bezoek(w);
      // Langste weg over de acyclische pijlen (topologisch).
      const inGraad = new Map(ids.map((id) => [id, 0]));
      for (const id of ids) for (const n of uit.get(id)) if (!terug.has(`${id}>${n}`)) inGraad.set(n, inGraad.get(n) + 1);
      const rij = volgorde.filter((id) => inGraad.get(id) === 0);
      for (const id of ids) laag.set(id, 0);
      while (rij.length) {
        const id = rij.shift();
        for (const n of uit.get(id)) {
          if (terug.has(`${id}>${n}`)) continue;
          laag.set(n, Math.max(laag.get(n), laag.get(id) + 1));
          inGraad.set(n, inGraad.get(n) - 1);
          if (inGraad.get(n) === 0) rij.push(n);
        }
      }
      // Een beginpunt staat vooraan, ook als er (in een cyclus) iets naar terug wijst.
      for (const id of ids) if (start.has(perId.get(id)?.type) && !inn.get(id).some((v) => !terug.has(`${v}>${id}`))) laag.set(id, 0);
      // Secundaire beginpunten achter hun buren (LayoutStijl.secundairAchteraan, use case: de
      // actor rechts van het kader). Secundair = elk van zijn buren heeft een sterker beginpunt
      // (meer verbindingen; bij gelijkspel wie eerder staat). Of een actor initieert, staat nog
      // niet in het model — dit is de terugval tot er zo'n eigenschap is.
      if (regels.secundairAchteraan || regels.secundairUit) {
        const isStart = (id) => start.has(perId.get(id)?.type);
        // Uit het model (Mark 18-10, Cockburn): een beginpunt zonder enige verbinding waarop de
        // eigenschap `secundairUit` (use case: "primair") aan staat, is secundair. Staat die
        // eigenschap nergens op het diagram, dan de vuistregel hieronder.
        const primairVlag = regels.secundairUit;
        const primairen = new Set();
        if (primairVlag) for (const v of verbindingen) if (v.data?.[primairVlag] === true) for (const x of [v.bron, v.doel]) if (isStart(x)) primairen.add(x);
        const graad = (id) => origBuren.get(id)?.length || 0;
        const plek = (id) => volgorde.indexOf(id);
        const sterker = (t, s) => graad(t) > graad(s) || (graad(t) === graad(s) && plek(t) >= 0 && plek(s) >= 0 && plek(t) < plek(s));
        for (const s of ids) {
          if (!isStart(s)) continue;
          const nb = origBuren.get(s) || [];
          if (!nb.length) continue;
          if (primairen.size ? primairen.has(s) : !nb.every((u) => (origBuren.get(u) || []).some((t) => t !== s && isStart(t) && sterker(t, s)))) continue;
          const lokaal = [...uit.get(s), ...inn.get(s)];
          if (lokaal.length) laag.set(s, Math.max(...lokaal.map((n) => laag.get(n))) + 1);
        }
      }
      const verbonden = ids.filter((id) => uit.get(id).length || inn.get(id).length);
      const maxVerbonden = verbonden.length ? Math.max(...verbonden.map((id) => laag.get(id))) : -1;
      // Eindpunten achteraan (als er meer is dan alleen het eindpunt).
      for (const id of ids) if (eind.has(perId.get(id)?.type) && inn.get(id).length) laag.set(id, Math.max(laag.get(id), maxVerbonden));
      // Losse elementen (geen verbinding op dit niveau): een laag erachter.
      for (const id of ids) if (!uit.get(id).length && !inn.get(id).length && verbonden.length) laag.set(id, maxVerbonden + 1);
    }
    // Volgorde binnen de lagen: huidige plek, dan barycentrum (4 rondes heen en terug).
    const aantal = Math.max(0, ...[...laag.values()]) + 1;
    const lagen = Array.from({ length: aantal }, () => []);
    for (const id of [...ids].sort((a, b) => hintDwars(perId.get(a)) - hintDwars(perId.get(b)) || a.localeCompare(b))) lagen[laag.get(id)].push(id);
    const plek = new Map();
    const nummer = () => lagen.forEach((l) => l.forEach((id, i) => plek.set(id, i)));
    nummer();
    for (let ronde = 0; ronde < 4; ronde++) {
      const omlaag = ronde % 2 === 0;
      const reeks = omlaag ? lagen.slice(1) : lagen.slice(0, -1).reverse();
      for (const l of reeks) {
        const buren = (id) => (omlaag ? inn.get(id) : uit.get(id)).filter((n) => plek.has(n) && laag.get(n) !== laag.get(id));
        const bc = new Map(l.map((id) => { const b = buren(id); return [id, b.length ? b.reduce((s, n) => s + plek.get(n), 0) / b.length : plek.get(id)]; }));
        l.sort((a, b) => bc.get(a) - bc.get(b) || plek.get(a) - plek.get(b) || a.localeCompare(b));
        l.forEach((id, i) => plek.set(id, i));
      }
    }
    // Een laag met meer dan `maxPerRij` elementen slaat om in meer rijen (volgorde blijft), zodat
    // een laag vol technologie geen strook van duizenden pixels wordt.
    const per = regels.maxPerRij > 0 ? regels.maxPerRij : Infinity;
    return lagen.filter((l) => l.length).flatMap((l) => (l.length <= per ? [l] : Array.from({ length: Math.ceil(l.length / per) }, (_, k) => l.slice(k * per, (k + 1) * per))));
  }

  /** Pijlen tussen directe kinderen van groep g. */
  function pijlenOpNiveau(g) {
    const gezien = new Set();
    const uit = [];
    for (const p of pijlen) {
      const a = directKind(p.van, g), b = directKind(p.naar, g);
      if (!a || !b || a === b) continue;
      const k = `${a}>${b}`;
      if (gezien.has(k)) continue;
      gezien.add(k);
      uit.push({ van: a, naar: b });
    }
    return uit;
  }

  /** Stel een rij lagen op; geeft de maat langs/dwars. `zet(id, langs, dwars)` schrijft de plek. */
  function plaatsLagen(lagen, zet, { dwarsStart = 0, dwarsBreedte = null } = {}) {
    let pos = 0;
    const breedtes = lagen.map((l) => l.reduce((s, id, i) => s + dwars(maat.get(id)) + (i ? AFSTAND.dwars : 0), 0));
    const totaalDwars = dwarsBreedte ?? Math.max(0, ...breedtes);
    lagen.forEach((l, i) => {
      const diepte = Math.max(...l.map((id) => lang(maat.get(id))));
      let d = dwarsStart + (totaalDwars - breedtes[i]) / 2;
      for (const id of l) {
        // Binnen de laag gecentreerd op de leesas.
        zet(id, pos + (diepte - lang(maat.get(id))) / 2, d);
        d += dwars(maat.get(id)) + AFSTAND.dwars;
      }
      pos += diepte + AFSTAND.laag;
    });
    return { langs: Math.max(0, pos - AFSTAND.laag), dwars: totaalDwars };
  }

  const xy = (langs, dw) => (lr ? { x: langs, y: dw } : { x: dw, y: langs });

  /** Stel groep g op (null = het diagram); geeft de maat van de inhoud. */
  function legGroep(g) {
    const kinderen = kinderenVan.get(g) || [];
    for (const k of kinderen) if (isContainer(k) && !isBaan(k)) zetContainer(k);
    const baanKinderen = kinderen.filter(isBaan);
    if (baanKinderen.length) return legBanen(g, kinderen, baanKinderen);
    let lagen = rangschik(kinderen, pijlenOpNiveau(g));
    // In een kader hoogstens `kaderKolommen` kolommen (use case: wat een actor heeft vooraan,
    // wat alleen via include/extend bereikt wordt erachter — staand i.p.v. een lange keten).
    if (g !== null && regels.kaderKolommen > 0 && lagen.length > regels.kaderKolommen) {
      const binnen = (n) => { for (let c = n; c; c = ouderVan(c)) if (c === g) return true; return false; };
      const metBuiten = (id) => [id, ...(kinderenVan.get(id) || [])].some((x) => (origBuren.get(x) || []).some((n) => !binnen(n)));
      const nieuw = Array.from({ length: regels.kaderKolommen }, () => []);
      lagen.forEach((l, i) => l.forEach((id) => nieuw[metBuiten(id) ? 0 : Math.min(i, regels.kaderKolommen - 1)].push(id)));
      lagen = nieuw.filter((l) => l.length);
    }
    if (g === null) topLagen = lagen;
    const m = plaatsLagen(lagen, (id, langs, dw) => rel.set(id, xy(langs, dw)));
    return lr ? { w: m.langs, h: m.dwars } : { w: m.dwars, h: m.langs };
  }

  /** Container: inhoud opstellen, dan de container om de inhoud heen. */
  function zetContainer(id) {
    const binnen = kinderenVan.get(id) || [];
    if (!binnen.length) return; // lege container: maat blijft
    const inhoud = legGroep(id);
    for (const k of binnen) {
      const p = rel.get(k);
      rel.set(k, { x: p.x + MARGE.rand, y: p.y + MARGE.kop });
    }
    const oud = maat.get(id);
    // Om de inhoud heen (ook kleiner dan eerst: opgeruimd), niet smaller dan de naam nodig heeft.
    const min = minVan(id);
    maat.set(id, { w: Math.max(Math.min(oud.w, 160), min.w, inhoud.w + 2 * MARGE.rand), h: Math.max(min.h, inhoud.h + MARGE.kop + MARGE.rand) });
  }

  /** Banen: lagen over alle banen samen, één strook per baan dwars op de leesrichting. */
  function legBanen(g, kinderen, baanKinderen) {
    // Wat in de banen ligt (en containers daarin) eerst opstellen.
    const inBaan = new Map();
    for (const b of baanKinderen) {
      const binnen = kinderenVan.get(b) || [];
      for (const k of binnen) if (isContainer(k)) zetContainer(k);
      for (const k of binnen) inBaan.set(k, b);
    }
    const leden = new Set(inBaan.keys());
    // Pijlen tussen elementen in (verschillende) banen, op het niveau van de baan-inhoud.
    const lokaal = [];
    const gezien = new Set();
    for (const p of pijlen) {
      const zoek = (id) => { let c = id; while (c && !leden.has(c)) c = ouderVan(c); return c; };
      const a = zoek(p.van), b = zoek(p.naar);
      if (!a || !b || a === b || gezien.has(`${a}>${b}`)) continue;
      gezien.add(`${a}>${b}`);
      lokaal.push({ van: a, naar: b });
    }
    const lagen = rangschik([...leden], lokaal);
    // Diepte per laag (langs), gedeeld door alle banen.
    const diepte = lagen.map((l) => Math.max(...l.map((id) => lang(maat.get(id)))));
    const begin = [];
    let pos = MARGE.kop; // ruimte voor de baannaam (bij LR links, bij TB boven)
    for (const d of diepte) { begin.push(pos); pos += d + AFSTAND.laag; }
    const lengte = Math.max(pos - AFSTAND.laag + MARGE.rand, ...baanKinderen.map((b) => lang(minVan(b))));
    const laagVan = new Map(lagen.flatMap((l, i) => l.map((id) => [id, i])));
    // Banen in hun huidige volgorde dwars op de leesrichting.
    const volgorde = [...baanKinderen].sort((a, b) => hintDwars(perId.get(a)) - hintDwars(perId.get(b)) || a.localeCompare(b));
    let dw = 0;
    for (const b of volgorde) {
      const binnen = (kinderenVan.get(b) || []).filter((k) => leden.has(k));
      // Per laag stapelen binnen de baan; de baan is zo breed als zijn drukste laag.
      const perLaag = new Map();
      for (const id of lagen.flat()) if (inBaan.get(id) === b) { const i = laagVan.get(id); if (!perLaag.has(i)) perLaag.set(i, []); perLaag.get(i).push(id); }
      let breedte = 0;
      for (const [, ids] of perLaag) breedte = Math.max(breedte, ids.reduce((s, id, j) => s + dwars(maat.get(id)) + (j ? AFSTAND.dwars : 0), 0));
      breedte += 2 * MARGE.rand;
      breedte = Math.max(breedte, dwars(minVan(b)));
      for (const [i, ids] of perLaag) {
        const totaal = ids.reduce((s, id, j) => s + dwars(maat.get(id)) + (j ? AFSTAND.dwars : 0), 0);
        let d = (breedte - totaal) / 2;
        for (const id of ids) {
          rel.set(id, xy(begin[i] + (diepte[i] - lang(maat.get(id))) / 2, d));
          d += dwars(maat.get(id)) + AFSTAND.dwars;
        }
      }
      if (!binnen.length) breedte = Math.max(breedte, dwars(maat.get(b)));
      rel.set(b, xy(0, dw));
      maat.set(b, lr ? { w: lengte, h: breedte } : { w: breedte, h: lengte });
      dw += breedte + AFSTAND.baan;
    }
    // Wat naast de banen in de groep ligt (bv. een los element in de pool): erachter.
    const overig = kinderen.filter((k) => !baanKinderen.includes(k));
    let extra = 0;
    for (const k of overig) { rel.set(k, xy(lengte + AFSTAND.laag + extra, 0)); extra += lang(maat.get(k)) + AFSTAND.dwars; }
    const totaalLang = lengte + (overig.length ? AFSTAND.laag + extra : 0);
    return lr ? { w: totaalLang, h: dw } : { w: dw, h: totaalLang };
  }

  // Bovenste niveau. Een baan zonder ouder (partities los op het diagram) telt als banen van het diagram.
  let topLagen = [];
  legGroep(null);

  // Absoluut maken, met de linkerbovenhoek waar het diagram nu begint.
  const top = kinderenVan.get(null) || [];
  const ox = Math.min(...top.map((id) => perId.get(id).x));
  const oy = Math.min(...top.map((id) => perId.get(id).y));
  const posities = {};
  const absoluut = (id, bx, by) => {
    const p = rel.get(id) || { x: 0, y: 0 };
    posities[id] = { x: Math.round(bx + p.x), y: Math.round(by + p.y) };
    for (const k of kinderenVan.get(id) || []) absoluut(k, posities[id].x, posities[id].y);
  };
  for (const id of top) absoluut(id, ox, oy);

  // Spiegelen voor BT/RL (binnen de totale omhullende).
  if (r === "BT" || r === "RL") {
    const ids = Object.keys(posities);
    const min = Math.min(...ids.map((id) => (r === "BT" ? posities[id].y : posities[id].x)));
    const max = Math.max(...ids.map((id) => (r === "BT" ? posities[id].y + maat.get(id).h : posities[id].x + maat.get(id).w)));
    for (const id of ids) {
      const m = maat.get(id);
      if (r === "BT") posities[id].y = Math.round(min + max - posities[id].y - m.h);
      else posities[id].x = Math.round(min + max - posities[id].x - m.w);
    }
  }

  const maten = {};
  for (const k of knopen) {
    const m = maat.get(k.id);
    if (isContainer(k.id) && (Math.round(m.w) !== Math.round(k.w) || Math.round(m.h) !== Math.round(k.h))) maten[k.id] = { width: Math.round(m.w), height: Math.round(m.h) };
  }
  return { posities, maten, topLagen };
}

const RICHTINGEN = [
  ["TB", "van boven naar beneden", "↓"],
  ["LR", "van links naar rechts", "→"],
  ["BT", "van onder naar boven", "↑"],
  ["RL", "van rechts naar links", "←"],
];

/**
 * Layout-strategieën voor een (uitgevlakt) DiagramType, uit zijn **LayoutStijlen** (M3, 18-10;
 * types/layoutStijl.js): per stijl vier richtingen, de richting van de stijl eerst. Zonder
 * `layoutStijlen` de generieke standaardstijl; `layoutStijlen: []` = geen automatische layout
 * (sequence, formulier). De regels komen uit `regelsVoorStijl` (aard en facetten van de typen),
 * de minimale maten uit ElementType.minBreedte/minHoogte, de afstanden uit de stijl.
 * `run` heeft dezelfde invoer als op het canvas ({flowNodes, selectieIds, elements, diagram}) en
 * geeft {posities, maten}.
 */
export function leesvolgordeLayouts(descriptor) {
  const stijlen = (descriptor?.layoutStijlen ?? [stijlVoor(descriptor)]).filter((st) => (st.renderer || "leesvolgorde") === "leesvolgorde");
  if (!stijlen.length) return [];
  const typen = new Map((descriptor?.elementTypes || []).map((t) => [t.id, t]));
  // Kleinste maat zoals de vorm hem tekent (bv. een BPMN-lane), zodat niets overloopt.
  const minimaal = Object.fromEntries(
    (descriptor?.elementTypes || []).filter((t) => !t.isConnector && (t.minBreedte || t.minHoogte)).map((t) => [t.id, [t.minBreedte || 0, t.minHoogte || 0]])
  );
  return stijlen.flatMap((stijl) => {
    const regels = {
      ...regelsVoorStijl(descriptor, stijl),
      minimaal,
      ...(stijl.secundairAchteraan ? { secundairAchteraan: true } : {}),
      ...(typeof stijl.secundairUit === "string" && stijl.secundairUit ? { secundairUit: stijl.secundairUit } : {}),
      ...(stijl.kaderKolommen > 0 ? { kaderKolommen: stijl.kaderKolommen } : {}),
      ...(stijl.maxPerRij > 0 ? { maxPerRij: stijl.maxPerRij } : {}),
    };
    const standaard = RICHTINGEN.some(([r]) => r === regels.richting) ? regels.richting : "TB";
    const naam = stijl.id === "standaard" ? "Leesvolgorde" : stijl.label || stijl.id;
    const volgorde = [...RICHTINGEN].sort((a, b) => (a[0] === standaard ? -1 : b[0] === standaard ? 1 : 0));
    return volgorde.map(([richting, tekst, kort]) => ({
      id: `${stijl.id === "standaard" ? "leesvolgorde" : stijl.id}-${richting.toLowerCase()}`,
      stijl: stijl.id,
      label: `${naam}, ${tekst}${richting === standaard ? " (standaard)" : ""}`,
      kort,
      run: ({ flowNodes, selectieIds, elements, diagram }) =>
        legLeesvolgordeUit({ ...invoerVanCanvas({ flowNodes, selectieIds, elements, diagram, typen }), regels, richting, afstanden: stijl.afstanden }),
    }));
  });
}

/**
 * Canvas-invoer → knopen en verbindingen. Rand-elementen (aangehecht, relatief aan hun gastheer)
 * en synthetische knopen doen niet mee; lidmaatschap komt uit de container-connector van het type
 * (`containerVoor`). Met een selectie: alleen die knopen (en wat erin ligt).
 */
export function invoerVanCanvas({ flowNodes = [], selectieIds = null, elements = {}, diagram = null, typen = new Map() }) {
  const nodeVanElement = new Map((diagram?.nodes || []).map((n) => [n.elementId, n.nodeId || n.elementId]));
  const doet = flowNodes.filter((n) => !n.hidden && !String(n.type || "").startsWith("__") && !typen.get(n.type)?.randElement && !typen.get(n.type)?.isConnector);
  const ids = new Set(doet.map((n) => n.id));
  const ouder = new Map();
  for (const c of Object.values(elements)) {
    if (!c?.source || !c?.target) continue;
    const bronType = typen.get(elements[c.source]?.elementType);
    if (!bronType?.containerVoor || bronType.containerVoor !== c.elementType) continue;
    const a = nodeVanElement.get(c.source) ?? c.source, b = nodeVanElement.get(c.target) ?? c.target;
    if (ids.has(a) && ids.has(b)) ouder.set(b, a);
  }
  let knopen = doet.map((n) => ({
    id: n.id,
    type: n.type,
    x: n.position?.x || 0,
    y: n.position?.y || 0,
    w: n.measured?.width || 160,
    h: n.measured?.height || 70,
    ouder: ouder.get(n.id) || null,
    container: !!typen.get(n.type)?.containerVoor,
  }));
  if (selectieIds?.length) {
    const sel = new Set(selectieIds);
    const binnen = (id) => { for (let c = id; c; c = ouder.get(c)) if (sel.has(c)) return true; return false; };
    knopen = knopen.filter((k) => binnen(k.id)).map((k) => (sel.has(k.id) && !sel.has(k.ouder) ? { ...k, ouder: null } : k));
  }
  const op = new Set(knopen.map((k) => k.id));
  const verbindingen = [];
  for (const c of Object.values(elements)) {
    if (!c?.source || !c?.target) continue;
    const a = nodeVanElement.get(c.source) ?? c.source, b = nodeVanElement.get(c.target) ?? c.target;
    if (op.has(a) && op.has(b) && ouder.get(b) !== a) verbindingen.push({ bron: a, doel: b, soort: c.elementType, ...(c.data ? { data: c.data } : {}) });
  }
  return { knopen, verbindingen };
}
