// @ts-check
/**
 * registerBouwen — "Register bouwen" vanuit de Studio (Mark 07-11: "het model is de bron voor het
 * genereren"). De server bouwt het register uit dít project: POST /admin/rebuild {project_id}
 * (BACKEND), die de V3 via de render-sidecar haalt (POST /export/v3, dezelfde terugreis als
 * "Exporteer V3").
 *
 * Alleen in een devloop-omgeving: op app bestaat de route niet (GET /admin/rebuild/status → 404),
 * dan blijft het menu-item weg. Rol admin plus het beheerwachtwoord (header X-Beheer-Wachtwoord).
 * Vooraf zet de Studio een snapshot (snapshotNu): de server bouwt uit de snapshot en weigert bij
 * achterstand (409). Het antwoord is synchroon; na een geslaagde bouw herstart de API, en wacht
 * de Studio tot /health weer antwoordt.
 *
 * Antwoord (RebuildResponse van BACKEND, snake_case): {status, reden?, stappen, build_output?,
 * error?, herstart_over?, bron?, meldingen?}. 409 reden bezig|achterstand; 422 reden
 * export|geen_profiel; 502 reden sidecar (onbereikbaar of zonder /export/v3).
 */
import { apiBase } from "../shared/apiBase.js";
import { snapshotNu } from "./sync/verzender.js";
import { vraagNaam, toonMelding } from "./naamDialog.jsx";
import { menuBus } from "./menuBus.js";

/** null = nog niet gevraagd; true/false = wel/niet beschikbaar (route bestaat). */
let _beschikbaar = null;
let _bezigMetVragen = false;

/** Is "Register bouwen" hier mogelijk? Synchroon (voor het menu); vraagt het eenmalig na. */
export function registerBouwenBeschikbaar() {
  if (_beschikbaar === null && !_bezigMetVragen) {
    _bezigMetVragen = true;
    fetch(`${apiBase()}/admin/rebuild/status`, { credentials: "include" })
      .then((r) => { _beschikbaar = r.status !== 404; })
      .catch(() => { _beschikbaar = false; })
      .finally(() => { _bezigMetVragen = false; menuBus.emit("menu:ververs"); });
  }
  return _beschikbaar === true;
}

/** Wacht tot /health weer 200 geeft (de API herstart na een bouw); hooguit `ms`. */
async function wachtOpApi(ms = 60000) {
  const tot = Date.now() + ms;
  await new Promise((r) => setTimeout(r, 2500));
  while (Date.now() < tot) {
    try {
      const r = await fetch(`${apiBase()}/health`, { credentials: "include" });
      if (r.ok) return true;
    } catch { /* nog niet terug */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const meldingTekst = (meldingen = []) =>
  meldingen.length ? `\n\nMeldingen:\n${meldingen.slice(0, 12).map((m) => `• ${m.regel ? `${m.regel}: ` : ""}${m.bericht}`).join("\n")}${meldingen.length > 12 ? `\n… en nog ${meldingen.length - 12}` : ""}` : "";

/**
 * Bouw het register uit het project op de server.
 * @param {{id: string, naam: string, serverVersie: number|null}} project
 */
export async function bouwRegister(project) {
  if (!project?.id || project.serverVersie == null) {
    toonMelding({ titel: "Register bouwen", tekst: "Zet het project eerst op de server (Project → Naar server sturen)." });
    return;
  }
  const wachtwoord = await vraagNaam({ titel: "Register bouwen", label: `Beheerwachtwoord voor het bouwen van het register uit "${project.naam}"`, bevestig: "Bouwen", geheim: true });
  if (wachtwoord == null) return;
  // De server bouwt uit de snapshot: zet die eerst bij (anders 409 "achterstand").
  if (!(await snapshotNu().catch(() => false))) {
    toonMelding({ titel: "Register bouwen", tekst: "De snapshot kon niet worden bijgewerkt (offline, of iemand anders is bezig). Probeer het zo nog eens." });
    return;
  }
  let resp, json = null;
  try {
    resp = await fetch(`${apiBase()}/admin/rebuild`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Beheer-Wachtwoord": wachtwoord },
      body: JSON.stringify({ project_id: project.id }),
    });
    json = await resp.json().catch(() => null);
  } catch (e) {
    toonMelding({ titel: "Register bouwen", tekst: `Geen verbinding met de server (${e?.message || e}).` });
    return;
  }
  if (resp.ok && json?.status === "succesvol") {
    const bron = json.bron ? `\nBron: project-versie ${json.bron.project_versie}, t/m wijziging ${json.bron.tot_volgnummer}.` : "";
    const terug = await wachtOpApi();
    toonMelding({
      titel: "Register gebouwd",
      tekst: `Het register is gebouwd uit "${project.naam}" (${(json.stappen || []).length} stappen).${bron}${terug ? "" : "\nDe API is nog niet terug na de herstart; ververs straks."}${meldingTekst(json.meldingen)}`,
    });
    return;
  }
  const status = resp.status;
  if (status === 403) return toonMelding({ titel: "Register bouwen", tekst: "Geen toegang: je moet beheerder zijn, met het juiste beheerwachtwoord." });
  if (status === 404) return toonMelding({ titel: "Register bouwen", tekst: "Het project staat niet op deze server, of je hebt er geen leesrecht op." });
  if (status === 409) return toonMelding({ titel: "Register bouwen", tekst: json?.reden === "bezig" ? "Er loopt al een bouw; wacht tot die klaar is." : json?.error || "Het project heeft nog wijzigingen na de laatste snapshot; probeer het zo nog eens." });
  if (status === 422) {
    const wat = json?.reden === "geen_profiel" ? "Het project heeft geen canoniek model (diagram05) om uit te bouwen." : `Het model kon niet naar V3: ${json?.error || json?.fout || "onbekende fout"}`;
    return toonMelding({ titel: "Register bouwen", tekst: `${wat}${meldingTekst(json?.meldingen)}` });
  }
  if (status === 502) return toonMelding({ titel: "Register bouwen", tekst: `De render-sidecar is niet bereikbaar, of te oud (zonder /export/v3).${json?.error ? `\n\n${json.error}` : ""}` });
  const stappen = (json?.stappen || []).slice(-6).join("\n• ");
  const uitvoer = String(json?.build_output || "").split("\n").slice(-12).join("\n");
  toonMelding({
    titel: "Register bouwen mislukt",
    tekst: `${json?.error || `De server gaf ${status}.`}${stappen ? `\n\nLaatste stappen:\n• ${stappen}` : ""}${uitvoer ? `\n\nUitvoer:\n${uitvoer}` : ""}${meldingTekst(json?.meldingen)}`,
  });
}
