// @ts-check
/**
 * kolommenLayout — eenvoudige automatische layout voor een geïmporteerd
 * diagram zonder coördinaten: knopen in kolommen (links → rechts), containers
 * als omhullende rechthoek om hun leden, genest waar nodig.
 *
 * Geen volwaardige graaf-layout (geen kruising-minimalisatie); bedoeld als
 * nette, voorspelbare startopstelling die je daarna met de hand bijschaaft.
 *
 *   - Staan er knopen binnen én buiten containers (use case: actoren buiten,
 *     use cases in het systeem), dan komen de buitenstaanders links en de
 *     containers rechts; de kolom volgt de afstand tot de andere kant, zodat
 *     wat direct met elkaar verbonden is naast elkaar komt.
 *   - Anders volgen de kolommen de pijlrichting: een knoop staat links van
 *     waar hij naar wijst.
 *
 * Puur en store-loos.
 */

const H_TUSSEN = 80;
const V_TUSSEN = 24;
const RAND = 28;
const KOP = 46;
const BLOK_TUSSEN = 26;

/**
 * @typedef {Object} LayoutKnoop
 * @property {string} id
 * @property {string|null} [groep]   - id van de omvattende container
 * @property {number} breedte        - bij een container: minimale breedte
 * @property {number} hoogte         - bij een container: minimale hoogte
 * @property {boolean} [container]
 */

/** Kolomnummer per blad. */
function bepaalKolommen(bladeren, verbindingen) {
  const ids = new Set(bladeren.map((b) => b.id));
  const randen = verbindingen.filter((v) => ids.has(v.bron) && ids.has(v.doel) && v.bron !== v.doel);
  const binnen = bladeren.filter((b) => b.groep != null);
  const buiten = bladeren.filter((b) => b.groep == null);
  const kolom = new Map();

  if (binnen.length && buiten.length) {
    const buren = new Map(bladeren.map((b) => [b.id, []]));
    for (const { bron, doel } of randen) {
      buren.get(bron).push(doel);
      buren.get(doel).push(bron);
    }
    const afstandTot = (bronnen) => {
      const afstand = new Map(bronnen.map((b) => [b.id, 0]));
      const rij = bronnen.map((b) => b.id);
      while (rij.length) {
        const id = rij.shift();
        for (const buur of buren.get(id)) {
          if (afstand.has(buur)) continue;
          afstand.set(buur, afstand.get(id) + 1);
          rij.push(buur);
        }
      }
      return afstand;
    };
    const totBuiten = afstandTot(buiten);
    const totBinnen = afstandTot(binnen);
    for (const b of binnen) kolom.set(b.id, Math.max(0, (totBuiten.get(b.id) ?? 1) - 1));
    const verst = Math.max(1, ...buiten.map((b) => totBinnen.get(b.id) ?? 0));
    for (const b of buiten) kolom.set(b.id, verst - (totBinnen.get(b.id) ?? verst));
    return kolom;
  }

  const uitgaand = new Map(bladeren.map((b) => [b.id, []]));
  for (const { bron, doel } of randen) uitgaand.get(bron).push(doel);
  const diepte = new Map();
  const bezig = new Set();
  const totEind = (id) => {
    if (diepte.has(id)) return diepte.get(id);
    if (bezig.has(id)) return 0; // kring: deze pijl telt niet mee
    bezig.add(id);
    let d = 0;
    for (const doel of uitgaand.get(id)) d = Math.max(d, totEind(doel) + 1);
    bezig.delete(id);
    diepte.set(id, d);
    return d;
  };
  const langst = Math.max(0, ...bladeren.map((b) => totEind(b.id)));
  for (const b of bladeren) kolom.set(b.id, langst - diepte.get(b.id));
  return kolom;
}

/** Bladeren van één blok in kolommen; posities relatief aan het blok. */
function kolommenBlok(leden, kolom, buren) {
  const posities = new Map();
  if (!leden.length) return { breedte: 0, hoogte: 0, posities };
  const waarden = [...new Set(leden.map((l) => kolom.get(l.id) ?? 0))].sort((a, b) => a - b);
  const kolommen = waarden.map((w) => leden.filter((l) => (kolom.get(l.id) ?? 0) === w));
  const breedtes = kolommen.map((k) => Math.max(...k.map((l) => l.breedte)));
  const xs = [];
  let x = 0;
  for (const breedte of breedtes) {
    xs.push(x);
    x += breedte + H_TUSSEN;
  }

  // De volste kolom is het anker; de andere schikken zich ernaar, zodat een
  // knoop ter hoogte van zijn buren in de al geplaatste kolommen komt.
  const stapel = (k) => k.reduce((som, l) => som + l.hoogte, 0) + V_TUSSEN * (k.length - 1);
  const anker = kolommen.reduce((beste, k, i) => (stapel(k) > stapel(kolommen[beste]) ? i : beste), 0);
  const volgorde = kolommen.map((_, i) => i).sort((a, b) => Math.abs(a - anker) - Math.abs(b - anker));
  const midden = new Map();
  for (const i of volgorde) {
    const geplaatst = [];
    let onder = null;
    for (const lid of kolommen[i]) {
      const ankers = (buren.get(lid.id) || []).filter((b) => midden.has(b)).map((b) => midden.get(b));
      const gewenst = ankers.length ? ankers.reduce((a, b) => a + b, 0) / ankers.length - lid.hoogte / 2 : null;
      const minimaal = onder == null ? null : onder + V_TUSSEN;
      const y = gewenst == null ? minimaal ?? 0 : minimaal == null ? gewenst : Math.max(gewenst, minimaal);
      geplaatst.push({ lid, y, gewenst });
      onder = y + lid.hoogte;
    }
    const metWens = geplaatst.filter((p) => p.gewenst != null);
    const schuif = metWens.length ? metWens.reduce((som, p) => som + (p.y - p.gewenst), 0) / metWens.length : 0;
    for (const { lid, y } of geplaatst) {
      posities.set(lid.id, { x: xs[i] + (breedtes[i] - lid.breedte) / 2, y: y - schuif });
      midden.set(lid.id, y - schuif + lid.hoogte / 2);
    }
  }

  const boven = Math.min(...[...posities.values()].map((p) => p.y));
  let hoogte = 0;
  for (const lid of leden) {
    const p = posities.get(lid.id);
    p.y -= boven;
    hoogte = Math.max(hoogte, p.y + lid.hoogte);
  }
  return { breedte: x - H_TUSSEN, hoogte, posities };
}

/**
 * @param {{knopen: LayoutKnoop[], verbindingen: {bron:string, doel:string}[], oorsprong?: {x:number, y:number}}} invoer
 * @returns {Map<string, {x:number, y:number, breedte:number, hoogte:number}>}
 */
export function legUit({ knopen, verbindingen, oorsprong = { x: 40, y: 40 } }) {
  const bladeren = knopen.filter((k) => !k.container);
  const containers = knopen.filter((k) => k.container);
  const kolom = bepaalKolommen(bladeren, verbindingen);
  const buren = new Map(bladeren.map((b) => [b.id, []]));
  for (const { bron, doel } of verbindingen) {
    if (!buren.has(bron) || !buren.has(doel) || bron === doel) continue;
    buren.get(bron).push(doel);
    buren.get(doel).push(bron);
  }
  const maat = new Map(knopen.map((k) => [k.id, { breedte: k.breedte, hoogte: k.hoogte }]));

  /** Inhoud van een container (of van het geheel, ouderId = null), relatief. */
  const inhoud = (ouderId) => {
    const blok = kolommenBlok(bladeren.filter((b) => (b.groep ?? null) === ouderId), kolom, buren);
    const subs = containers
      .filter((c) => (c.groep ?? null) === ouderId)
      .map((c) => {
        const binnen = inhoud(c.id);
        return { c, binnen, breedte: Math.max(c.breedte, binnen.breedte + 2 * RAND), hoogte: Math.max(c.hoogte, binnen.hoogte + KOP + RAND) };
      });
    const posities = new Map();
    const zet = (bron, dx, dy) => {
      for (const [id, p] of bron) posities.set(id, { x: p.x + dx, y: p.y + dy });
    };
    if (!subs.length) return { breedte: blok.breedte, hoogte: blok.hoogte, posities: blok.posities };

    const subBreedte = Math.max(...subs.map((s) => s.breedte));
    const stapelHoogte = subs.reduce((som, s) => som + s.hoogte, 0) + BLOK_TUSSEN * (subs.length - 1);
    // Op het hoogste niveau: losse knopen links, containers rechts ernaast.
    // Binnen een container: eigen leden boven, deelcontainers eronder.
    const naast = ouderId == null;
    const subX = naast && blok.breedte ? blok.breedte + H_TUSSEN : 0;
    const hoogte = naast ? Math.max(blok.hoogte, stapelHoogte) : blok.hoogte + (blok.hoogte ? BLOK_TUSSEN : 0) + stapelHoogte;
    zet(blok.posities, 0, naast ? (hoogte - blok.hoogte) / 2 : 0);
    let y = naast ? (hoogte - stapelHoogte) / 2 : hoogte - stapelHoogte;
    for (const s of subs) {
      posities.set(s.c.id, { x: subX, y });
      maat.set(s.c.id, { breedte: subBreedte, hoogte: s.hoogte });
      zet(s.binnen.posities, subX + RAND, y + KOP);
      y += s.hoogte + BLOK_TUSSEN;
    }
    return { breedte: naast ? subX + subBreedte : Math.max(blok.breedte, subBreedte), hoogte, posities };
  };

  const geheel = inhoud(null);
  const uit = new Map();
  for (const [id, p] of geheel.posities) {
    uit.set(id, { x: Math.round(p.x + oorsprong.x), y: Math.round(p.y + oorsprong.y), ...maat.get(id) });
  }
  return uit;
}
