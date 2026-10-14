// @ts-check
/**
 * meldContext — wat een melding uit de Studio meekrijgt (versie, activiteit, project,
 * browser). Activiteiten registreren hier een leverancier, zodat Help niet van Modelleren
 * afhangt: Modelleren levert het project en de selectie (pad, onderwerp-id).
 */
import { browserOmschrijving } from "../meldingen/meldingApi.js";

/** @type {Map<string, () => Record<string, string|undefined>>} */
const leveranciers = new Map();

/** Registreer een leverancier; geeft een afmeldfunctie. */
export function registreerMeldContext(naam, fn) {
  leveranciers.set(naam, fn);
  return () => leveranciers.delete(naam);
}

/** De context nu, met `extra` (bv. van een rechtsklik) erbovenop; lege waarden vallen weg. */
export function verzamelMeldContext(extra = {}) {
  const versie = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  /** @type {Record<string, string|undefined>} */
  let ctx = { studioversie: `studio ${versie}`, browser: browserOmschrijving() };
  for (const fn of leveranciers.values()) {
    try {
      ctx = { ...ctx, ...fn() };
    } catch {
      /* een leverancier mag het melden nooit breken */
    }
  }
  ctx = { ...ctx, ...extra };
  return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v]) => [k, String(v)]));
}
