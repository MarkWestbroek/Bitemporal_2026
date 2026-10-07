// @ts-check
/**
 * werkruimte — de werkruimte (tabs, actieve tab, open/dicht mappen) van de
 * gebruiker per project naar en van de server (plan 2026-10-07 Projectsync,
 * "werkruimte los van project"). Laatste schrijver wint op `bijgewerkt`; geen
 * operaties, geen SSE: je werkruimte deelt niemand.
 *
 * modellerenActivity meldt elke lokale wijziging via `werkruimteGewijzigd`
 * (met debounce naar PUT) en vraagt bij het openen van een project via
 * `haalWerkruimteOp` of de server een nieuwere heeft.
 */
import { haalWerkruimteOp as haalApi, slaWerkruimteOp as slaApi } from "../activities/projectSync.js";

const DEBOUNCE_MS = 1500;

let cfg = {
  actief: () => false, // project op de server?
  haalWerkruimteOp: haalApi,
  slaWerkruimteOp: slaApi,
};
export function configureerWerkruimte(patch) {
  cfg = { ...cfg, ...patch };
}

let timer = null;
let laatstVerstuurd = null; // JSON-tekst, om identieke PUTs te sparen
let hangend = null;

/** Lokale wijziging: na een korte stilte naar de server (als het project daar staat). */
export function werkruimteGewijzigd(projectId, inhoud, bijgewerkt) {
  if (!projectId) return;
  hangend = { projectId, inhoud, bijgewerkt };
  clearTimeout(timer);
  timer = setTimeout(verstuur, DEBOUNCE_MS);
}

export async function verstuur() {
  clearTimeout(timer);
  timer = null;
  if (!hangend || !cfg.actief()) return false;
  const { projectId, inhoud, bijgewerkt } = hangend;
  const tekst = JSON.stringify(inhoud);
  if (tekst === laatstVerstuurd) return false;
  try {
    await cfg.slaWerkruimteOp(projectId, { inhoud, bijgewerkt });
    laatstVerstuurd = tekst;
    return true;
  } catch {
    return false; // offline of niet op de server: de volgende wijziging probeert opnieuw
  }
}

/**
 * Werkruimte van de server voor dit project, of null (geen, offline, niet op de server).
 * @returns {Promise<{inhoud: any, bijgewerkt: string} | null>}
 */
export async function haalWerkruimteOp(projectId) {
  if (!projectId || !cfg.actief()) return null;
  try {
    const uit = await cfg.haalWerkruimteOp(projectId);
    if (uit?.inhoud) laatstVerstuurd = JSON.stringify(uit.inhoud);
    return uit?.inhoud ? uit : null;
  } catch {
    return null;
  }
}

/** Welke van twee werkruimtes is de nieuwste? (ontbrekende tijd = oudste) */
export function nieuwste(lokaal, server) {
  const tl = Date.parse(lokaal?.bijgewerkt || "") || 0;
  const ts = Date.parse(server?.bijgewerkt || "") || 0;
  return ts > tl ? "server" : "lokaal";
}

/** Voor tests. */
export function _resetWerkruimteVoorTest() {
  clearTimeout(timer);
  timer = null;
  laatstVerstuurd = null;
  hangend = null;
}
