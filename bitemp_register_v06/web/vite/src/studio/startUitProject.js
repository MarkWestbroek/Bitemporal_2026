// @ts-check
/**
 * startUitProject — de Studio starten met de profielen en weergaven uit een project in plaats van
 * uit de code (plan docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het project,
 * §6 en §7 stap 6; het **lokale** deel).
 *
 * Besluit Mark 21-11: de tool start uit de centrale projecten, met **de laatst opgehaalde versie**
 * en daarna **de code** als reserve. De centrale plek (stap 5) is er nog niet; dit is de reserve
 * ervan: na *Laad … uit dit project in de tool* kun je kiezen het ook bij het starten te gebruiken.
 * Dan bewaren we het model hier in IndexedDB (de opslag van de profielstores, `opslag.js`), per
 * soort één stand: `{kop: {id, naam, versie, concept}, inhoud: {elements, diagrams}, bewaard}`.
 *
 * Bij het starten (`pasStartToe`): eerst de profielen, dan de weergaven (de koppeling noemt
 * elementtypen van de profielen). Elke soort apart: lukt het niet, dan blijft voor die soort de
 * code gelden en volgt een melding. Een gedeeltelijk toegepaste soort herstelt pas na een herlaad
 * met *Start weer uit de code*.
 *
 * Puur op de kv na (injecteerbaar voor tests); het toepassen zelf geeft de aanroeper mee.
 */
import { indexedDbKv, heeftIndexedDb } from "../diagramcore/model/opslag.js";
import { SOORT_PROFIELEN, SOORT_WEERGAVEN, zetGeladen } from "./projectGebruik.js";

const SLEUTEL = (soort) => `start-uit-project:${soort}`;
/** Volgorde bij het starten: de profielen eerst. */
export const START_VOLGORDE = [SOORT_PROFIELEN, SOORT_WEERGAVEN];

/** De kv: IndexedDB in de browser, anders niets. */
const standaardKv = () => (heeftIndexedDb() ? indexedDbKv : null);

/**
 * Bewaar een project om mee te starten.
 * @param {string} soort
 * @param {{kop: {id: string, naam?: string, versie?: string, concept?: boolean}, inhoud: {elements: any, diagrams?: any}}} stand
 */
export async function bewaarStart(soort, { kop, inhoud }, kv = standaardKv()) {
  if (!kv) throw new Error("Geen IndexedDB in deze browser");
  const waarde = { kop: { ...kop }, inhoud: JSON.parse(JSON.stringify({ elements: inhoud.elements || {}, diagrams: inhoud.diagrams || {} })), bewaard: new Date().toISOString() };
  await kv.put(SLEUTEL(soort), waarde);
  return waarde;
}

/** Wat er voor een soort bewaard is, of null. */
export async function leesStart(soort, kv = standaardKv()) {
  if (!kv) return null;
  try {
    return (await kv.get(SLEUTEL(soort))) || null;
  } catch {
    return null;
  }
}

/** Niet meer met dit project starten (vanaf de volgende keer weer de code). */
export async function wisStart(soort, kv = standaardKv()) {
  if (kv) await kv.del(SLEUTEL(soort));
}

const CENTRAAL_SLEUTEL = (soort) => `centraal:${soort}`;

/** De laatst opgehaalde centrale versie van een soort (de reserve als ophalen mislukt), of null. */
export async function leesCentraal(soort, kv = standaardKv()) {
  if (!kv) return null;
  try {
    return (await kv.get(CENTRAAL_SLEUTEL(soort))) || null;
  } catch {
    return null;
  }
}

/**
 * De stand waarmee een soort start, in volgorde (plan §6/§8, stap 5 en 6):
 *   1. een lokale keuze in deze browser (*Laad … in de tool* → ook bij het starten): een concept;
 *   2. de vastgepinde centrale versie: ophalen, en lokaal bewaren als reserve;
 *   3. lukt ophalen niet: de laatst opgehaalde, als dat dezelfde versie is;
 *   4. anders null: de code.
 * @param {{pins?: Record<string, string|null>, haal?: (soort: string, versie: string) => Promise<{kop: any, inhoud: any}>}|null} centraal
 * @returns {Promise<{stand: any, melding?: string}>}
 */
async function standVoor(soort, kv, centraal) {
  const lokaal = await leesStart(soort, kv);
  if (lokaal) return { stand: lokaal };
  const pin = centraal?.pins?.[soort];
  if (!pin || !centraal?.haal) return { stand: null };
  try {
    const { kop, inhoud } = await centraal.haal(soort, pin);
    const stand = { kop: { ...kop, versie: pin, concept: false }, inhoud: { elements: inhoud.elements || {}, diagrams: inhoud.diagrams || {} }, bewaard: new Date().toISOString() };
    if (kv) {
      try {
        await kv.put(CENTRAAL_SLEUTEL(soort), stand);
      } catch {
        /* geen reserve; het starten zelf gaat door */
      }
    }
    return { stand };
  } catch (e) {
    const reserve = await leesCentraal(soort, kv);
    if (reserve?.kop?.versie === pin) return { stand: reserve, melding: `${soort}: versie ${pin} ophalen mislukte (${e?.message || e}); de laatst opgehaalde kopie wordt gebruikt` };
    return { stand: null, melding: `${soort}: versie ${pin} ophalen mislukte (${e?.message || e}); de tool gebruikt de code` };
  }
}

/**
 * Bij het starten: per soort de stand toepassen (een lokale keuze, anders de vastgepinde centrale
 * versie, anders de code; zie `standVoor`).
 * @param {Record<string, (inhoud: any) => {fouten?: string[]}|Promise<{fouten?: string[]}>>} toepassers - per soort
 * @param {any} [kv]
 * @param {{pins?: Record<string, string|null>, haal?: (soort: string, versie: string) => Promise<{kop: any, inhoud: any}>}|null} [centraal]
 * @returns {Promise<{toegepast: string[], fouten: string[]}>}
 */
export async function pasStartToe(toepassers, kv = standaardKv(), centraal = null) {
  const toegepast = [];
  const fouten = [];
  for (const soort of START_VOLGORDE) {
    if (!toepassers[soort]) continue;
    const { stand, melding } = await standVoor(soort, kv, centraal);
    if (melding) fouten.push(melding);
    if (!stand) continue;
    try {
      const uit = (await toepassers[soort](stand.inhoud)) || {};
      zetGeladen(soort, stand.kop);
      toegepast.push(soort);
      for (const f of uit.fouten || []) fouten.push(`${soort}: ${f}`);
    } catch (e) {
      fouten.push(`${soort}: starten uit "${stand.kop?.naam || stand.kop?.id}" mislukt (${e?.message || e}); de tool gebruikt de code`);
    }
  }
  return { toegepast, fouten };
}
