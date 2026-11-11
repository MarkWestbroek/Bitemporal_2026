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
import { clientId } from "../sync/outbox.js";
import { nieuwRuimteId } from "../../diagramcore/model/opslagRuimte.js";

export const PROJECT_FORMAAT = "studio-project";
export const PROJECT_FORMAAT_VERSIE = 3; // v3: zonder tabs/actieveTab en zonder viewports (werkruimte-laag)
export const STANDAARD_PROJECTNAAM = "Naamloos project";

/** Nieuw project-id: UUID (de server accepteert 8–64 tekens uit [A-Za-z0-9_-]). */
export function nieuwProjectId() {
  return nieuwRuimteId();
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
 * Controleer en normaliseer een werkbestand naar het huidige formaat.
 *
 * - v1 (zonder `project`): krijgt een nieuw id en een naam uit de
 *   bestandsnaam (of de standaardnaam);
 * - v2: `project.id`/`project.naam` worden aangevuld als ze ontbreken; de
 *   tabs uit v1/v2 blijven in `data.tabs` staan en dienen als eerste
 *   werkruimte als die lokaal nog niet bestaat;
 * - v3 (2026-10-07): tabs, actieve tab en viewports zitten niet meer in het
 *   werkbestand — dat is werkruimte (per gebruiker), geen project.
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
  /**
   * @param {string} bericht @param {number} status @param {any} [server]
   * @param {{reden?: string, anderen?: Array<{clientId: string, actor?: string, bron?: string, laatst?: string}>}} [extra]
   *   bij 409: `reden` "versie_verouderd" of "project_in_gebruik" (api 0.20.0), en wie er bezig is
   */
  constructor(bericht, status, server, extra = {}) {
    super(bericht);
    this.name = "ProjectSyncFout";
    this.status = status;
    this.server = server || null;
    this.reden = extra.reden || null;
    this.anderen = Array.isArray(extra.anderen) ? extra.anderen : [];
    /** bij 409 branch_bestaat (afsplitsen): het id van de bestaande branch */
    this.projectId = extra.projectId || null;
  }
}

async function roep(pad, { methode = "GET", body, headers = {} } = {}) {
  let resp;
  try {
    resp = await fetch(`${apiBase()}${pad}`, {
      method: methode,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json", ...headers } : Object.keys(headers).length ? headers : undefined,
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
    throw new ProjectSyncFout(bericht, resp.status, json?.server, { reden: json?.reden, anderen: json?.anderen, projectId: json?.projectId });
  }
  return json;
}

/** @returns {Promise<Array<{id:string,naam:string,eigenaar:string,versie:number,bijgewerkt:string,bijgewerkt_door:string,grootte:number}>>} */
export const lijstProjecten = () => roep("/api/studio/projecten");

/**
 * Een branch afsplitsen (api 0.23.0): het hele project wordt gekopieerd, `mapId` is de context
 * (herkomst). → 201 meta van de branch. Een 409 `branch_bestaat` (met `projectId`) betekent dat er
 * al een niet-gearchiveerde branch voor die map is.
 */
export const afsplitsen = (id, { naam, mapId = null }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/afsplitsen`, { methode: "POST", body: { naam, ...(mapId ? { mapId } : {}) } });

/** Volledig record, incl. `inhoud` (het werkbestand) en `herkomst` (null, of de herkomst van een branch). */
export const haalProjectOp = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}`);

/**
 * Verschil van een afgeleid project (branch) met MAIN (09-11, branch stap 1). De API haalt basis,
 * branch en MAIN op en laat de render-sidecar vergelijken (POST /vergelijk). 404 = geen branch.
 * @returns {Promise<{verschillen: Array<any>, telling: Record<string, number>, scope: string[], meldingen: Array<any>,
 *                    main?: {laatsteVolgnummer: number}, tak?: {laatsteVolgnummer: number}}>}
 */
export const vergelijkMetMain = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}/vergelijk`);

/** Aanmaken (versie 1). 409 als het id al bestaat. */
export const maakProjectAan = ({ id, naam, inhoud }) =>
  roep("/api/studio/projecten", { methode: "POST", body: { id, naam, inhoud } });

/** Opslaan met versiecontrole. 409 (met `server`-meta) als de server verder is; 404 als het daar niet (meer) staat. */
export const slaProjectOp = (id, { naam, inhoud, versie, tot_volgnummer }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}`, {
    methode: "PUT",
    // tot_volgnummer = snapshot-grens (compactie): zonder dit veld bleef de grens 0 en
    // speelde een client na het ophalen álle operaties nogmaals af (gemeld 2026-10-08).
    // clientId (06-11, api 0.20.0): de server weigert een PUT zolang een ándere client in het
    // project bezig is (409 "project_in_gebruik", besluit Mark); zo telt deze tab niet mee. Een
    // oudere server negeert veld en header.
    body: { naam, inhoud, versie, clientId, ...(tot_volgnummer != null ? { tot_volgnummer } : {}) },
    headers: { "X-Omnium-Client": clientId },
  });

/** Verwijderen (eigenaar of beheerder). */
export const verwijderProject = (id) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}`, { methode: "DELETE" });

// ── Toegang per project ("alles dicht tenzij", plan 2026-10-12 §5) ────
// De lijst en het ophalen geven per project `recht`: lezen, schrijven of beheren.

/** → {project_id, eigenaar, toegang: [{subject, recht, aangemaakt, aangemaakt_door}]} (beheren). */
export const haalToegangOp = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}/toegang`);

/** Rijen schoonmaken voor de PUT: trimmen, lege weg, dubbele subjecten: de laatste telt. */
export function toegangVoorOpslaan(rijen) {
  const perSubject = new Map();
  for (const r of rijen || []) {
    const subject = String(r?.subject || "").trim();
    if (!subject) continue;
    perSubject.set(subject, { subject, recht: r.recht === "schrijven" ? "schrijven" : "lezen" });
  }
  return [...perSubject.values()];
}

/** Vervangt alle rijen: [{subject: gebruikersnaam | "*", recht: "lezen" | "schrijven"}] (beheren). */
export const zetToegang = (id, toegang) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/toegang`, { methode: "PUT", body: { toegang } });

// ── Operatielog (stap 2, onderdeel 3/4) ───────────────────────────────

/** Batch naar het operatielog. → {van, tot, laatsteLokaalNr}; 404 als het project er niet is. */
export const stuurOps = (id, { clientId, ops }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/ops`, { methode: "POST", body: { clientId, ops } });

/**
 * Operaties ná `vanaf`. → {ops: [{volgnummer, clientId, actor, namens?, store, op, args, …}], laatste, meer}
 * `namens` (api 0.24.0): voor wie de actor het deed (bv. de werkplaats namens een gebruiker);
 * een historie-weergave toont dan "actor namens X".
 */
export const haalOpsOp = (id, vanaf = 0, limiet = 1000) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/ops?vanaf=${Number(vanaf) || 0}&limiet=${limiet}`);

/** Studio-instellingen van de instantie (admin, via omgevingsvariabelen): {poll_ms}. */
export const haalStudioInstellingenOp = () => roep("/api/studio/instellingen");

/** URL van het SSE-kanaal (EventSource met withCredentials; Last-Event-ID regelt de browser). */
export const eventsUrl = (id, vanaf = 0, clientId = "") =>
  `${apiBase()}/api/studio/projecten/${encodeURIComponent(id)}/events?vanaf=${Number(vanaf) || 0}` +
  (clientId ? `&client=${encodeURIComponent(clientId)}` : "");

// ── EA-import via de server (onderzoeksdoc 2026-10-07 §7.6–7.8) ──────
// De server biedt repo's en bestanden aan; de Studio kiest alleen daaruit.
/** → {repos: [{naam, branch, commit, wijzigingen}], pull, ingericht}. */
export const eaImportRepos = () => roep("/api/studio/ea-import/repos");
/** → [{pad, grootte, gewijzigd}] — de .qea/.qeax in die repo, nieuwste eerst. */
export const eaImportBestanden = (repo) => roep(`/api/studio/ea-import/repos/${encodeURIComponent(repo)}/bestanden`);
/** → [{id, pad}] — de pakketten in dat EA-bestand. */
export const eaImportPakketten = (repo, bestand) =>
  roep(`/api/studio/ea-import/repos/${encodeURIComponent(repo)}/pakketten?bestand=${encodeURIComponent(bestand)}`);
/** Taak starten → {taak, status}; 409 als er al een loopt, 501 als het niet is ingericht. */
export const startEaImport = (id, { repo, bestand, pakket, map = "", pull = false, verdwenenVerwijderen = false, droog = false }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/ea-import`, { methode: "POST", body: { repo, bestand, pakket, map, pull, verdwenenVerwijderen, droog } });
/** Stand van een taak (zonder taak-id: de laatste van dit project) → {id, status, verslag?, fout?, log?, branch?, commit?}. */
export const eaImportTaak = (id, taak = "") =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/ea-import${taak ? `/${encodeURIComponent(taak)}` : ""}`);

// ── Werkruimte (tabs, open mappen) per gebruiker per project ──────────
/** → {inhoud, bijgewerkt}; 404 als er nog geen is. */
export const haalWerkruimteOp = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}/werkruimte`);
/** Laatste schrijver wint op `bijgewerkt` (ISO). → {bijgewerkt, overgenomen} */
export const slaWerkruimteOp = (id, { inhoud, bijgewerkt }) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/werkruimte`, { methode: "PUT", body: { inhoud, bijgewerkt } });

// Gedeelde plaatjes (handlers/studio_beeld_handler.go): een diagram als PNG op een onraadbaar
// adres voor Confluence en wiki's. Zie studio/gedeeldeBeelden.js.
/** @param {{profiel_id:string, diagram_id:string, diagram_naam?:string, soort:"momentopname"|"actueel", png:string, breedte?:number, hoogte?:number, alleen_bijwerken?:boolean}} invoer */
export const deelBeeld = (id, invoer) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/beelden`, { methode: "POST", body: invoer });
export const lijstBeelden = (id) => roep(`/api/studio/projecten/${encodeURIComponent(id)}/beelden`);
export const trekBeeldIn = (id, token) =>
  roep(`/api/studio/projecten/${encodeURIComponent(id)}/beelden/${encodeURIComponent(token)}`, { methode: "DELETE" });
