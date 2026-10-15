// model.mjs — modellen lezen en wijzigen via de MCP (AI-1 stap 2, 14-10-2026).
//
// Zelfde regelset en toepasser als de ✨ assistent in de Studio, alleen is hier de AI-client
// (Claude Code, …) de "lezer": hij levert een plan, deze module controleert het tegen de
// profielen (assistentKern.controleerPlan) en maakt er projectsync-operaties van
// (wijziging.maakWijziging + naarOps). Die gaan via POST /api/studio/projecten/:id/ops naar de
// server; elke open Studio past ze live toe. Eén set modeloperaties, twee ingangen.
//
// De stand van een project = snapshot (GET /api/studio/projecten/:id) + de operaties daarna,
// nagespeeld in Node-stores (sidecarImport.maakStand/speelOpsNa, ook gebruikt door de
// EA-import uit git). De profielen (M2) komen uit profielen.json, gegenereerd met
// web/vite/scripts/profielen-voor-mcp.mjs.
import { readFileSync } from "node:fs";

const SRC = new URL("../../web/vite/src/", import.meta.url);
const laad = (pad) => import(new URL(pad, SRC).href);

let _kern = null;
/** De gedeelde modules uit de Studio (lui: alleen nodig voor de modeltools). */
async function kern() {
  if (_kern) return _kern;
  try {
    const [k, w, s] = await Promise.all([laad("studio/assistent/assistentKern.js"), laad("studio/assistent/wijziging.js"), laad("diagramprofielen/ea/sidecarImport.js")]);
    _kern = { ...k, ...w, maakStand: s.maakStand, speelOpsNa: s.speelOpsNa };
    return _kern;
  } catch (e) {
    throw new Error(`De modeltools gebruiken de Studio-code uit web/vite; draai daar eerst 'npm install' (${e.message})`);
  }
}

let _profielen = null;
export function profielen() {
  if (!_profielen) _profielen = JSON.parse(readFileSync(new URL("./profielen.json", import.meta.url), "utf8")).profielen;
  return _profielen;
}
export const zetProfielen = (lijst) => { _profielen = lijst; }; // tests

/** Project op id of (deel van de) naam, uit de projecten waar de gebruiker bij mag. */
export async function zoekProject(api, project) {
  const lijst = (await api.get("/api/studio/projecten")) || [];
  const p = String(project || "").trim().toLowerCase();
  const gevonden = lijst.find((x) => x.id === project) || lijst.find((x) => x.naam?.toLowerCase() === p) || lijst.filter((x) => x.naam?.toLowerCase().includes(p));
  if (Array.isArray(gevonden)) {
    if (gevonden.length === 1) return gevonden[0];
    if (!gevonden.length) throw new Error(`Geen project "${project}" (of geen toegang). Projecten: ${lijst.map((x) => x.naam).join(", ") || "geen"}.`);
    throw new Error(`"${project}" past op meerdere projecten: ${gevonden.map((x) => x.naam).join(", ")}.`);
  }
  return gevonden;
}

/** Snapshot + operaties → {stand (Node-stores), structuur, profielen, laatste}. */
export async function leesProject(api, id) {
  const k = await kern();
  for (let poging = 0; poging < 3; poging++) {
    const p = await api.get(`/api/studio/projecten/${encodeURIComponent(id)}`);
    const inhoud = typeof p.inhoud === "string" ? JSON.parse(p.inhoud) : p.inhoud || {};
    const stand = k.maakStand(inhoud);
    let vanaf = p.tot_volgnummer || 0;
    let opnieuw = false;
    for (;;) {
      const d = await api.get(`/api/studio/projecten/${encodeURIComponent(id)}/ops?vanaf=${vanaf}&limiet=1000`);
      if (d.snapshotNodig) { opnieuw = true; break; }
      k.speelOpsNa(stand, d.ops || []);
      vanaf = d.laatste ?? vanaf;
      if (!d.meer) break;
    }
    if (opnieuw) continue;
    const s = stand.structuur.getState();
    const modellen = {};
    for (const [pid, st] of stand.modellen) modellen[pid] = { elements: st.getState().elements || {}, diagrams: st.getState().diagrams || {} };
    return { naam: p.naam, recht: p.recht, mappen: s.mappen || {}, plaatsing: s.plaatsing || {}, profielen: modellen, links: stand.kruis.links, laatste: vanaf };
  }
  throw new Error("Het project werd tijdens het lezen steeds gecompacteerd; probeer het zo nog eens.");
}

/** Map op pad ("Test/Uitwerking"), id of naam; "" of "/" = de hoofdmap. */
export function zoekMap(mappen, map) {
  const m = String(map ?? "").trim();
  if (!m || m === "/") return null;
  if (mappen[m]) return mappen[m];
  if (m.startsWith("el::")) return { id: m }; // uitwerking: een element als ouder
  const delen = m.split("/").map((x) => x.trim()).filter(Boolean);
  let ouder = null, gevonden = null;
  for (const deel of delen) {
    gevonden = Object.values(mappen).find((x) => (x.ouderId || null) === ouder && x.naam.toLowerCase() === deel.toLowerCase());
    if (!gevonden) break;
    ouder = gevonden.id;
  }
  if (gevonden) return gevonden;
  const opNaam = Object.values(mappen).filter((x) => x.naam.toLowerCase() === m.toLowerCase());
  if (opNaam.length === 1) return opNaam[0];
  throw new Error(opNaam.length ? `Map "${m}" is niet eenduidig; geef het pad (bv. Ouder/${m}).` : `Map "${m}" bestaat niet.`);
}

export function mapPad(proj, id) {
  const { mappen = {}, plaatsing = {}, profielen = {} } = proj;
  const naam = (x) => {
    if (mappen[x]) return mappen[x].naam;
    const [, pid, eid] = x.split("::"); // uitwerking: element als ouder
    return profielen[pid]?.elements?.[eid]?.naam || eid;
  };
  const delen = [];
  for (let x = id, i = 0; x && i < 50; x = mappen[x] ? mappen[x].ouderId : plaatsing[x], i++) delen.unshift(naam(x));
  return delen.join("/");
}

/** De boom als tekst: mappen met hun diagrammen (per taal). */
export function boomTekst(proj) {
  const taalNaam = new Map(profielen().map((p) => [p.id, p.naam]));
  const diagrammenIn = new Map();
  for (const [pid, p] of Object.entries(proj.profielen)) {
    for (const d of Object.values(p.diagrams)) {
      const map = proj.plaatsing[`${pid}::${d.id}`] || null;
      if (!diagrammenIn.has(map)) diagrammenIn.set(map, []);
      diagrammenIn.get(map).push(`${d.naam || d.id} [${taalNaam.get(pid) || pid}, ${d.id}]`);
    }
  }
  const regels = [];
  const kinderen = (ouder) => Object.values(proj.mappen).filter((m) => (m.ouderId || null) === ouder).sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
  // Uitwerking: elementen die zelf ouder zijn (M3 `uitwerking`), met hun diagrammen eronder.
  const elementOuders = [...new Set(Object.values(proj.plaatsing).filter((o) => typeof o === "string" && o.startsWith("el::")))];
  const naamVan = (key) => { const [, pid, eid] = key.split("::"); return proj.profielen[pid]?.elements?.[eid]?.naam || eid; };
  const loop = (ouder, diepte) => {
    for (const d of diagrammenIn.get(ouder) || []) regels.push(`${"  ".repeat(diepte)}◇ ${d}`);
    for (const ek of elementOuders) {
      if ((proj.plaatsing[ek] || null) !== ouder) continue;
      regels.push(`${"  ".repeat(diepte)}▹ ${naamVan(ek)} [uitwerking van ${ek}]`);
      loop(ek, diepte + 1);
    }
    for (const m of kinderen(ouder)) { regels.push(`${"  ".repeat(diepte)}▸ ${m.naam}`); loop(m.id, diepte + 1); }
  };
  loop(null, 0);
  return regels.join("\n") || "(leeg project)";
}

let lokaalNr = 0;
const CLIENT_ID = `mcp-${process.pid}`;

/**
 * Controleer een plan en maak de wijziging; met `toepassen` gaat ze naar de server.
 * @returns {Promise<{plan, wijziging, verstuurd: number}>}
 */
export async function wijzigModel(api, { project, map, plan, toepassen = false }) {
  const k = await kern();
  const p = await zoekProject(api, project);
  if (toepassen && p.recht && p.recht === "lezen") throw new Error(`Je hebt alleen leesrecht op "${p.naam}".`);
  const proj = await leesProject(api, p.id);
  const doel = zoekMap(proj.mappen, map);
  const mapId = doel?.id || null;
  const alle = profielen();
  const bestaand = k.bestaandInMap(proj, mapId, alle.map((x) => x.id));
  // Talen: wat het plan noemt + wat al in de map staat.
  const genoemd = new Set([...(plan?.diagrammen || []).map((d) => d.taal).filter(Boolean), ...bestaand.map((b) => b.profielId)]);
  const talen = alle.filter((x) => genoemd.has(x.id));
  const gecontroleerd = k.controleerPlan(plan, talen, bestaand);
  const stand = { mappen: proj.mappen, plaatsing: proj.plaatsing, profielen: Object.fromEntries(talen.map((t) => [t.id, proj.profielen[t.id] || { elements: {}, diagrams: {} }])) };
  const wijziging = k.maakWijziging(gecontroleerd, stand, { mapId, samenvattingen: talen, prefix: "mcp" });
  let verstuurd = 0;
  if (toepassen) {
    const ops = k.naarOps(wijziging);
    if (ops.length) {
      const basis = Date.now() * 10;
      await api.post(`/api/studio/projecten/${encodeURIComponent(p.id)}/ops`, {
        clientId: CLIENT_ID,
        ops: ops.map((o) => ({ ...o, lokaalNr: basis + (lokaalNr += 1) })),
      });
      verstuurd = ops.length;
    }
  }
  return { project: p, map: doel ? mapPad(proj, doel.id) : "(hoofdmap)", plan: gecontroleerd, wijziging, bestaand, verstuurd };
}

/** Een gecontroleerd plan + wijziging als leesbare tekst. */
export function wijzigingTekst({ project, map, plan, wijziging, bestaand, verstuurd }, toepassen) {
  // Naamloze elementen (begin, eind) heten naar hun type.
  const naamVanBestaand = new Map(bestaand.flatMap((b) => b.elementen.map((e) => [e.id, e.naam || `(${e.type})`])));
  const naamVanNieuw = new Map(plan.elementen.map((e) => [e.sleutel, e.naam || `(${e.type})`]));
  const naam = (r) => (r?.nieuw ? naamVanNieuw.get(r.nieuw) : naamVanBestaand.get(r?.id)) || "?";
  const r = [`${toepassen ? (verstuurd ? "Toegepast" : "Niets toe te passen") : "Voorstel (nog niet toegepast)"} in ${project.naam} / ${map}: ${wijziging.samenvatting}.`];
  for (const m of wijziging.mappen) r.push(`+ map ${m.naam}`);
  for (const d of plan.diagrammen) {
    r.push(`${d.bestaandId ? "~ diagram" : "+ diagram"} ${d.naam} [${d.profielId}]${d.map ? ` in ${d.map}` : ""}`);
    for (const e of plan.elementen.filter((x) => x.diagram === d.sleutel)) r.push(`    + ${e.type}${e.naam ? ` "${e.naam}"` : ""}${e.in ? " (in container)" : ""}`);
  }
  for (const c of plan.connectoren) r.push(`+ ${c.type}: ${naam(c.bron)} → ${naam(c.doel)}`);
  for (const h of plan.hernoemd) r.push(`~ hernoemd: ${h.oud} → ${h.naam}`);
  for (const l of plan.leden || []) r.push(`~ ${naam({ id: l.id })} in ${naam(l.in)}`);
  for (const o of plan.opstelling || []) r.push(`~ opstelling ${o.actie}${o.elementen.length ? `: ${o.elementen.map(naam).join(", ")}` : " (alles)"}`);
  for (const v of plan.verbanden) r.push(`+ verband: ${naam(v.van)} ${v.soort} ${naam(v.naar)}`);
  if (plan.opmerkingen.length) r.push("", "Bijgestuurd:", ...plan.opmerkingen.map((x) => `- ${x}`));
  if (plan.problemen.length) r.push("", "Weggelaten:", ...plan.problemen.map((x) => `- ${x}`));
  if (wijziging.zonderDiagram.length) r.push("", `${wijziging.zonderDiagram.length} relatie(s) staan op geen diagram.`);
  if (!toepassen) r.push("", "Roep model_wijzigen opnieuw aan met toepassen: true om dit door te voeren (open Studio's zien het live).");
  return r.join("\n");
}
