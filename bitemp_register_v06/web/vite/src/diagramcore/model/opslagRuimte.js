// @ts-check
/**
 * opslagRuimte — de werkkopie in de browser is **per project** (TAB-1, 11-11).
 *
 * Tot 11-11 had de browser één werkkopie: de modellen onder `studio05-<profiel>` (IndexedDB) en
 * de projectlaag onder `studio-modelleren` (localStorage), zonder project-id in de sleutel. Twee
 * tabs met twee projecten schreven dus naar dezelfde plek; na herladen kreeg een tab de naam van
 * het ene project met de inhoud van het andere, en een snapshot stuurde dat mengsel naar de
 * server (nagespeeld 11-11).
 *
 * Nu heeft elke bewaarde sleutel het project-id erachter (`<basis>::<projectId>`), en onthoudt
 * een tab zelf welk project hij open heeft:
 *
 *   - `sessionStorage["studio-tab-project"]`: het project van déze tab (overleeft herladen);
 *   - `localStorage["studio-laatste-project"]`: het laatst bewerkte project, voor een nieuwe tab;
 *   - de oude werkkopie (zonder project-id) hoort bij het project dat in `studio-modelleren`
 *     stond. Dat id wordt één keer vastgelegd (`studio-werkkopie-oud-project`); alleen dát
 *     project neemt de oude sleutels over (zie opslag.js `oudeNaam`).
 *
 * Dit bestand staat in diagramcore omdat createDiagramStore de ruimte nodig heeft op het moment
 * dat een store wordt gemaakt (bij het laden van de module, vóór de Studio iets kan instellen).
 * Buiten de browser (node-tests) is er geen ruimte: de sleutels blijven dan zoals ze waren.
 */

const SS_TAB = "studio-tab-project";
const LS_LAATSTE = "studio-laatste-project";
const LS_OUD = "studio-modelleren";
const LS_OUD_ID = "studio-werkkopie-oud-project";

/** @type {string|null|undefined} undefined = nog niet bepaald; null = geen ruimte (buiten de browser) */
let _ruimte;
/** @type {Set<(nieuw: string, oud: string|null) => void>} */
const _bijWissel = new Set();

const ss = () => {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
};
const ls = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

/** Een geldig project-id (zoals de server: 8–64 tekens uit [A-Za-z0-9_-]). @param {any} v */
const geldig = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/** Nieuw project-id: UUID, of tijd + toeval zonder Web Crypto. */
export function nieuwRuimteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Het project-id uit de oude werkkopie (`studio-modelleren`), of null. */
function leesOudProjectId() {
  try {
    const raw = ls()?.getItem(LS_OUD);
    const id = raw ? JSON.parse(raw)?.project?.id : null;
    return geldig(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Het project waar de oude werkkopie (sleutels zonder project-id) bij hoort, of null. Eén keer
 * vastgelegd, zodat het blijft kloppen nadat de tab van project is gewisseld.
 * @returns {string|null}
 */
export function oudeRuimte() {
  const l = ls();
  if (!l) return null;
  try {
    const vast = l.getItem(LS_OUD_ID);
    if (vast !== null) return geldig(vast) ? vast : null;
    const id = leesOudProjectId();
    l.setItem(LS_OUD_ID, id || "");
    return id;
  } catch {
    return null;
  }
}

/**
 * Het project van deze tab. Bepaald bij de eerste vraag: deze tab → het laatst bewerkte project
 * → de oude werkkopie → een nieuw id.
 * @returns {string|null} null buiten de browser
 */
export function opslagRuimte() {
  if (_ruimte !== undefined) return _ruimte;
  const s = ss();
  const l = ls();
  if (!s && !l) {
    _ruimte = null;
    return _ruimte;
  }
  const oud = oudeRuimte(); // legt het oude id vast vóór er iets verandert
  let id = null;
  try {
    id = s?.getItem(SS_TAB) || l?.getItem(LS_LAATSTE) || oud || null;
  } catch {
    id = null;
  }
  _ruimte = geldig(id) ? id : nieuwRuimteId();
  try {
    s?.setItem(SS_TAB, _ruimte);
  } catch {
    /* geen opslag */
  }
  return _ruimte;
}

/**
 * De bewaarsleutel van `basis` voor een project.
 * @param {string} basis @param {string|null} [ruimte]
 */
export function sleutelIn(basis, ruimte = opslagRuimte()) {
  return ruimte ? `${basis}::${ruimte}` : basis;
}

/** Hoort de oude sleutel (zonder project-id) bij dit project? @param {string|null} [ruimte] */
export function neemtOudeOver(ruimte = opslagRuimte()) {
  return !!ruimte && ruimte === oudeRuimte();
}

/**
 * Deze tab gaat naar een ander project. Alle bewaarde stores verhuizen mee (ze schrijven hun
 * huidige inhoud onder de nieuwe sleutel; de sleutel van het vorige project blijft staan).
 * @param {string} id
 */
export function zetOpslagRuimte(id) {
  const oud = opslagRuimte();
  if (!geldig(id) || oud === null) return;
  if (id !== oud) {
    _ruimte = id;
    try {
      ss()?.setItem(SS_TAB, id);
    } catch {
      /* geen opslag */
    }
    for (const fn of _bijWissel) {
      try {
        fn(id, oud);
      } catch (e) {
        console.warn("[opslagRuimte] verhuizen mislukt:", e);
      }
    }
  }
}

/** Markeer dit project als het laatst bewerkte (het project van een nieuwe tab). */
export function markeerLaatsteProject() {
  const id = opslagRuimte();
  if (!id) return;
  try {
    const l = ls();
    if (l && l.getItem(LS_LAATSTE) !== id) l.setItem(LS_LAATSTE, id);
  } catch {
    /* geen opslag */
  }
}

/** @param {(nieuw: string, oud: string|null) => void} fn @returns {() => void} afmelden */
export function bijRuimteWissel(fn) {
  _bijWissel.add(fn);
  return () => _bijWissel.delete(fn);
}

/** Alleen voor tests: vergeet de bepaalde ruimte en de abonnees. */
export function _resetOpslagRuimte() {
  _ruimte = undefined;
  _bijWissel.clear();
}
