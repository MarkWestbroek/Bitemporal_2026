// @ts-check
/**
 * projectSync — het Studio-project als geheel naar en van de server
 * (plan docs/plans/2026-10-07 Projectsync, stap 1).
 *
 * De server (`/api/studio/projecten`, Go) bewaart per project één JSONB-blob:
 * precies het project-werkbestand dat ook "Exporteer project…" oplevert
 * (formaat "studio-project" v2, met `project: {id, naam}`). Samenwerken is
 * hier "om de beurt": de versieteller van de server voorkomt dat je ongemerkt
 * andermans opslag overschrijft (409 → de Studio vraagt of je wilt overschrijven).
 *
 * Dit bestand bevat alleen zuivere helpers en de API-aanroepen; de koppeling
 * met de stores staat in modellerenActivity.jsx.
 */
import { apiBase } from "../../shared/apiBase.js";

export const PROJECT_FORMAAT = "studio-project";
export const PROJECT_FORMAAT_VERSIE = 2;
export const STANDAARD_PROJECTNAAM = "Naamloos project";

/** Nieuw project-id: UUID (de server accepteert 8–64 tekens uit [A-Za-z0-9_-]). */
export function nieuwProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback zonder Web Crypto (oude webviews): tijd + toeval, zelfde alfabet.
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** "studio-project-2026-10-07.json" → "studio-project-2026-10-07"; leeg → standaardnaam. */
export function projectNaamUitBestandsnaam(bestandsnaam) {
  const stam = String(bestandsnaam || "")
    .replace(/\.json$/i, "")
    .trim();
  return stam || STANDAARD_PROJECTNAAM;
}

/** Projectnaam → veilige bestandsstam voor de export ("Mijn project!" → "mijn-project"). */
export function bestandsstamVoor(naam) {
  const s = String(naam || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "studio-project";
}

/**
 * Controleer en normaliseer een werkbestand naar formaat v2.
 *
 * - v1 (zonder `project`): krijgt een nieuw id en een naam uit de
 *   bestandsnaam (of de standaardnaam);
 * - v2: `project.id`/`project.naam` worden aangevuld als ze ontbreken.
 *
 * @param {any} data
 * @param {{bestandsnaam?: string}} [opties]
 * @returns {{ok: true, data: any} | {ok: false, fout: string}}
 */
export function normaliseerProjectData(data, { bestandsnaam = "" } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, fout: "Dit is geen project-werkbestand (geen JSON-object)." };
  }
  if (data.formaat !== PROJECT_FORMAAT) {
    return { ok: false, fout: `Dit is geen project-werkbestand (formaat '${PROJECT_FORMAAT}' ontbreekt).` };
  }
  const versie = Number(data.versie || 1);
  if (versie > PROJECT_FORMAAT_VERSIE) {
    return { ok: false, fout: `Dit werkbestand is van een nieuwere Studio (formaatversie ${versie}); werk de Studio bij.` };
  }
  const project = data.project && typeof data.project === "object" ? data.project : {};
  const id = typeof project.id === "string" && project.id.trim() ? project.id.trim() : nieuwProjectId();
  const naam =
    typeof project.naam === "string" && project.naam.trim()
      ? project.naam.trim()
      : projectNaamUitBestandsnaam(bestandsnaam);
  return {
    ok: true,
    data: { ...data, versie: PROJECT_FORMAAT_VERSIE, project: { id, naam } },
  };
}

// ── API ───────────────────────────────────────────────────────────────

/** Fout met HTTP-status en (bij 409) de servermeta, zodat de UI kan kiezen. */
export class ProjectSyncFout extends Error {
  /** @param {string} bericht @param {number} status @param {any} [server] */
  constructor(bericht, status, server) {
    super(bericht);
    this.name = "ProjectSyncFout";
    this.status = status;
    this.server = server || null;
  }
}

async function roep(pad, { methode = "GET", body } = {}) {
  let resp;
  try {
    resp = await fetch(`${apiBase()}${pad}`, {
      method: methode,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ProjectSyncFout(`Geen verbinding met de server (${e?.message || e}).`, 0);
  }
  if (resp.status === 204) return null;
  let json = null;
  try {
    json = await resp.json();
  } catch {
    /* geen JSON-body */
  }
  if (!resp.ok) {
    const bericht =
      json?.error ||
      (resp.status === 401
        ? "Niet ingelogd — log eerst in (rechtsboven)."
        : resp.status === 403
          ? "Geen rechten voor deze actie."
          : `Serverfout ${resp.status}.`);
    throw new ProjectSyncFout(bericht, resp.status, json?.server);
  }
  return json;
}

/** @returns {Promise<Array<{id:string,naam:string,eigenaar:string,versie:number,bijgewerkt:string,bijgewerkt_door:string,grootte:number}>>} */
export const lijstProjecten = () => roep("/api/studio/projecten");

/** Volledig record, incl. `inhoud` (het werkbestand). */
export const haalProjectOp = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}`);

/** Aanmaken (versie 1). 409 als het id al bestaat. */
export const maakProjectAan = ({ id, naam, inhoud }) =>
  roep("/api/studio/projecten", { methode: "POST", body: { id, naam, inhoud } });

/** Opslaan met versiecontrole. 409 (met `server`-meta) als de server verder is; 404 als het daar niet (meer) staat. */
export const slaProjectOp = (id, { naam, inhoud, versie }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}`, { methode: "PUT", body: { naam, inhoud, versie } });

/** Verwijderen (eigenaar of admin). */
export const verwijderProject = (id) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}`, { methode: "DELETE" });
