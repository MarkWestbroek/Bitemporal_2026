// @ts-check
/**
 * centraal — de Studio-kant van de centrale plek (plan "Sidecar-project" §8, stap 5; besluiten
 * Mark 22-11: de centrale is app, andere instanties lezen met een leestoken, een release pint de
 * versies exact vast; een klant-centrale is een spiegel).
 *
 * - **Vastgepind**: `centraalVersies.js` naast dit bestand noemt per soort de uitgebrachte
 *   versie waarmee deze build van de Studio start (`null` = de code). Een nieuwe versie van het
 *   profielen- of weergaveproject in gebruik nemen = dit bestand bijwerken = een (kleine) release.
 * - **Ophalen**: de Studio vraagt het aan zijn eigen API (`GET /api/studio/centraal/:soort/:versie`);
 *   is die instantie niet de centrale, dan haalt de API hem met haar leestoken bij de centrale en
 *   bewaart hem (handlers/studio_centraal.go). De Studio zelf kent geen token.
 * - **Uitbrengen** (de beheerder, op de centrale): *Project → Breng versie uit…*.
 *
 * Puur (geen stores, geen DOM).
 */
import { CENTRAAL_VERSIES as pins } from "./centraalVersies.js";
import { SOORT_PROFIELEN, SOORT_WEERGAVEN } from "./projectGebruik.js";

/** Het profiel (in Modelleren) dat de inhoud van een centraal project draagt, per soort. */
const DRAGER = { [SOORT_PROFIELEN]: "m3Profiel05", [SOORT_WEERGAVEN]: "weergave05" };

/** De vastgepinde versies van deze build: `{profielen: "0.3.0"|null, weergaven: …}`. */
export function vastgepind() {
  const uit = {};
  for (const soort of [SOORT_PROFIELEN, SOORT_WEERGAVEN]) {
    const v = /** @type {any} */ (pins)?.[soort];
    uit[soort] = typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v) ? v : null;
  }
  return uit;
}

/** "X.Y.Z" → [X, Y, Z], of null. */
export function parseVersie(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** <0, 0, >0 (numeriek; ongeldig telt als 0.0.0). */
export function vergelijkVersie(a, b) {
  const va = parseVersie(a) || [0, 0, 0];
  const vb = parseVersie(b) || [0, 0, 0];
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return va[i] - vb[i];
  return 0;
}

/**
 * De voorstellen voor de volgende versie na `hoogste` (de laatst uitgebrachte). Zonder eerdere
 * versie: 0.1.0 (Mark 21-11: een nieuw profiel start op 0.1.0).
 * @returns {{patch: string, minor: string, major: string}}
 */
export function volgendeVersies(hoogste) {
  const v = parseVersie(hoogste);
  if (!v) return { patch: "0.1.0", minor: "0.1.0", major: "1.0.0" };
  return { patch: `${v[0]}.${v[1]}.${v[2] + 1}`, minor: `${v[0]}.${v[1] + 1}.0`, major: `${v[0] + 1}.0.0` };
}

/** De hoogste versie van een soort in de lijst van GET /api/studio/centraal ("" = geen). */
export function hoogsteVan(versies, soort) {
  let h = "";
  for (const u of versies || []) if (u.soort === soort && (!h || vergelijkVersie(u.versie, h) > 0)) h = u.versie;
  return h;
}

/**
 * Het model (`{elements, diagrams}`) waarmee de tool start, uit een werkbestand van een centraal
 * project: de inhoud van het profiel dat de soort draagt.
 */
export function modelUitWerkbestand(soort, werkbestand) {
  const p = werkbestand?.profielen?.[DRAGER[soort]];
  if (!p?.elements) throw new Error(`het werkbestand heeft geen ${soort}`);
  return { elements: p.elements, diagrams: p.diagrams || {} };
}

/** Een regel per versie voor de lijst (Centrale versies…). */
export function versieRegel(u, pin) {
  const ouders = (Array.isArray(u.ouders) ? u.ouders : []).map((o) => o.versie).join(" + ");
  const datum = u.uitgebracht ? String(u.uitgebracht).slice(0, 10) : "";
  return [
    `${u.versie}${u.versie === pin ? "  ← deze Studio" : ""}`,
    ouders ? `na ${ouders}` : "eerste",
    [datum, u.uitgebrachtDoor].filter(Boolean).join(" door "),
    u.hier === false ? "(nog niet opgehaald)" : "",
    u.notitie ? `— ${u.notitie}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
