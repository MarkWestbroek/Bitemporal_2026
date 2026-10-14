// @ts-check
/**
 * releaseNotities — de CHANGELOG lezen voor "Wat is er nieuw" en de melding "nieuwe versie"
 * (Mark, 14-10: Hugo kreeg de release pas na een F5). Zuiver, ook gebruikt in vite.config.js om
 * versie.json te schrijven.
 *
 * Vorm (web/vite/CHANGELOG.md):
 *   ## [studio/v0.20.0] — 2026-10-14
 *   Inleiding…
 *   ### Toegevoegd
 *   - **Titel** (14-10, Mark): tekst…
 */

/** @typedef {{titel: string, tekst: string}} Item */
/** @typedef {{versie: string, datum: string, inleiding: string, groepen: {kop: string, items: Item[]}[]}} Release */

/** Vergelijk "0.20.0" met "0.19.3": >0 als a nieuwer is. */
export function vergelijkVersie(a, b) {
  const pa = String(a || "0").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0").split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Haal markdown-opmaak weg voor een korte regel (vet, code, links). */
const kaal = (t) =>
  String(t)
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1$2") // *cursief*
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Lees de releases uit de CHANGELOG, nieuwste eerst; [Unreleased] telt niet mee.
 * @param {string} md
 * @returns {Release[]}
 */
export function leesChangelog(md) {
  /** @type {Release[]} */
  const uit = [];
  /** @type {Release|null} */
  let rel = null;
  let groep = null;
  let item = null;
  for (const regel of String(md || "").split(/\r?\n/)) {
    const kop = regel.match(/^## \[studio\/v(\d+\.\d+\.\d+)\]\s*[—–-]\s*(\S+)/);
    if (kop) {
      rel = { versie: kop[1], datum: kop[2], inleiding: "", groepen: [] };
      uit.push(rel);
      groep = null;
      item = null;
      continue;
    }
    if (/^## /.test(regel)) { rel = null; continue; } // [Unreleased] of iets anders
    if (!rel) continue;
    const sub = regel.match(/^### (.+)/);
    if (sub) {
      // Dezelfde kop twee keer in één release (bv. na merges): samenvoegen.
      const kop = sub[1].trim();
      groep = rel.groepen.find((g) => g.kop === kop) || null;
      if (!groep) {
        groep = { kop, items: [] };
        rel.groepen.push(groep);
      }
      item = null;
      continue;
    }
    const punt = regel.match(/^- (.*)$/);
    if (punt && groep) {
      const vet = punt[1].match(/^\*\*(.+?)\*\*\s*(.*)$/);
      item = vet ? { titel: kaal(vet[1]), tekst: vet[2] } : { titel: "", tekst: punt[1] };
      groep.items.push(item);
      continue;
    }
    if (item && /^\s{2,}\S/.test(regel)) {
      item.tekst += " " + regel.trim();
      continue;
    }
    if (!groep && regel.trim()) rel.inleiding += (rel.inleiding ? " " : "") + regel.trim();
  }
  for (const r of uit) {
    r.inleiding = kaal(r.inleiding);
    for (const g of r.groepen) {
      for (const i of g.items) {
        // "(14-10, Mark): " vooraan weg; tekst kaal.
        i.tekst = kaal(i.tekst.replace(/^\([^)]*\)\s*:?\s*/, "").replace(/^:\s*/, ""));
      }
    }
  }
  return uit;
}

/** De releases na `gezien` tot en met `huidig` (voor "sinds je laatste bezoek"), nieuwste eerst. */
export function releasesSinds(releases, gezien, huidig) {
  return releases.filter((r) => vergelijkVersie(r.versie, huidig) <= 0 && (!gezien || vergelijkVersie(r.versie, gezien) > 0));
}

/** Korte titels van één release (voor versie.json en de strook), max `n`. */
export function kopjes(release, n = 6) {
  if (!release) return [];
  const t = [];
  for (const g of release.groepen) {
    if (/^tests?$/i.test(g.kop)) continue;
    for (const i of g.items) if (i.titel) t.push(i.titel);
  }
  return t.slice(0, n);
}

/** De link naar de releaselog bij een versie (de tag op GitHub). */
export function releaselogUrl(versie) {
  const ref = versie && versie !== "dev" ? `studio/v${versie}` : "main";
  return `https://github.com/MarkWestbroek/Bitemporal_2026/blob/${ref}/bitemp_register_v06/web/vite/CHANGELOG.md`;
}
