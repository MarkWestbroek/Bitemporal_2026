/**
 * uitleg.js — de uitleg bij een vraag in een formulier (het (i)-rondje). Puur, getest.
 *
 * Drie lagen, van verschillende eigenaren (docs/FORMULIERDEFINITIES.md §2.5):
 *  - inhoud, herbruikbaar: de entiteit Uitleg (configuratiedomein), met een code en per taal
 *    een titel en tekst. Code + taal is het adres. Een veld verwijst ernaar met `uitleg: "<code>"`.
 *  - inhoud, alleen hier: `uitlegTekst: "…"` op het veld zelf (een eenmalig zinnetje).
 *  - bediening: hoe je de VORM gebruikt ("klik op een stip"). Uit de lijst als uitleg van
 *    soort `vorm` met code `vorm-<naam>` (bv. vorm-nl-map; vertaalbaar en zonder codewijziging
 *    aan te passen), anders de standaardtekst uit het vormenregister (VORMEN[vorm].bediening).
 *
 * Bewust los van de beschrijving van het attribuut in het model: die is technischer; de
 * uitleg is de vertaling daarvan voor de invuller.
 */

/** Alleen actieve uitleg telt (concept en inactief niet). */
const ACTIEF = "actief";
/** Soort (enum UitlegSoort): inhoud (leeg = inhoud) of vorm. */
export const SOORT_VORM = "vorm";
/** De code van de bediening-uitleg van een vorm in de lijst. */
export const vormUitlegCode = (vorm) => `vorm-${vorm}`;
export const STANDAARD_TAAL = "nl";

const actueel = (hubs) => (Array.isArray(hubs) ? hubs.filter((h) => h && !h.afvoer) : []);
const laatsteData = (hub) => {
  const d = (Array.isArray(hub?.data) ? hub.data : []).filter((x) => x && !x.afvoer);
  return d.length ? d[d.length - 1] : null;
};

/**
 * Maakt van /full/uitleggen een index op code: { code: { soort, teksten: { taal: { titel, tekst } } } }.
 * Alleen actieve, niet-afgevoerde uitleg met een code. Bij een dubbele code wint de laatste.
 */
export function indexeerUitleggen(lijst) {
  const index = {};
  for (const u of Array.isArray(lijst) ? lijst : []) {
    if (!u || u.afvoer) continue;
    const metaHubs = actueel(u.uitleg_metas);
    const meta = laatsteData(metaHubs[metaHubs.length - 1]);
    const code = String(meta?.code || "").trim();
    if (!code || meta.status !== ACTIEF) continue;
    const teksten = {};
    for (const hub of actueel(u.uitleg_teksten)) {
      const t = laatsteData(hub);
      if (!t?.taal || !String(t.tekst || "").trim()) continue;
      teksten[t.taal] = { titel: String(t.titel || "").trim(), tekst: String(t.tekst).trim() };
    }
    if (Object.keys(teksten).length) index[code] = { id: u.id, soort: meta.soort || "inhoud", teksten };
  }
  return index;
}

/** De tekst in de gevraagde taal; anders Nederlands; anders de eerste die er is. */
export function kiesTaal(teksten, taal = STANDAARD_TAAL) {
  if (!teksten) return null;
  return teksten[taal] || teksten[STANDAARD_TAAL] || Object.values(teksten)[0] || null;
}

/**
 * Wat het (i)-rondje van een layout-element toont, of null (dan geen rondje).
 * @param {object} element   het layout-element (veld, groep of lijst)
 * @param {object} opties    { index: indexeerUitleggen(...), taal, vorm: naam van de vorm,
 *                            bediening: standaardtekst van de vorm (terugval) }
 * @returns {{ titel: string, tekst: string, bediening: string, code: string } | null}
 */
export function uitlegVoor(element, { index = {}, taal = STANDAARD_TAAL, vorm = "", bediening = "" } = {}) {
  const code = String(element?.uitleg || "").trim();
  const uitDeLijst = code ? kiesTaal(index[code]?.teksten, taal) : null;
  const eigen = String(element?.uitlegTekst || "").trim();
  // Eigen tekst gaat vóór de lijst: het formulier kan de algemene uitleg aanscherpen.
  const tekst = eigen || uitDeLijst?.tekst || "";
  const uitLijst = vorm && index[vormUitlegCode(vorm)]?.soort === SOORT_VORM ? kiesTaal(index[vormUitlegCode(vorm)].teksten, taal)?.tekst : "";
  const bed = element?.vormUitleg === false ? "" : String(uitLijst || bediening || "").trim();
  if (!tekst && !bed) return null;
  return { titel: (!eigen && uitDeLijst?.titel) || "", tekst, bediening: bed, code: uitDeLijst ? code : "" };
}

/**
 * Heeft de layout de uitleglijst nodig? Ja bij een verwijzing (`uitleg: "<code>"`) of bij een
 * vorm (de bediening kan uit de lijst komen, soort vorm). Anders niet ophalen.
 * Een vorm die alleen uit het datatype volgt (bv. masked) krijgt de standaardtekst.
 */
export function layoutGebruiktUitleg(layout) {
  let ja = false;
  const loop = (el) => {
    if (ja || !el || typeof el !== "object") return;
    if (typeof el.uitleg === "string" && el.uitleg.trim()) { ja = true; return; }
    if (typeof el.vorm === "string" && el.vorm.trim() && el.vormUitleg !== false) { ja = true; return; }
    for (const k of ["elementen", "dan"]) if (Array.isArray(el[k])) el[k].forEach(loop);
  };
  loop(layout);
  return ja;
}
