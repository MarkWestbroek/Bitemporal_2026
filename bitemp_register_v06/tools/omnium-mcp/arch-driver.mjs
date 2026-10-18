// arch-driver.mjs — plannen (zoals model_wijzigen) op een Studio-project zetten
// met een cookie-login i.p.v. een API-token. Gebruikt dezelfde modules als de
// MCP-server (model.mjs: controleerPlan → maakWijziging → naarOps → POST …/ops).
//
//   node tools/omnium-mcp/arch-driver.mjs <basis> <gebruiker> <wachtwoord-env> <opdracht> [args]
//   (<wachtwoord-env> mag ook een env-var met een API-token "omt_…" zijn; <gebruiker> is dan vrij)
//   opdrachten:
//     maak <naam>                    project aanmaken (leeg werkbestand v3) → id
//     plan <project> <map> <plan.json> [toepassen]
//     boom <project>
//     export <project> <uit.json>    werkbestand (snapshot + operaties nagespeeld) als v3-JSON
//
// Het wachtwoord komt uit de omgevingsvariabele die je als derde argument noemt
// (bv. ADMIN_PASSWORD), nooit op de commandoregel.
import fs from "node:fs";
import { maakApi } from "./api.mjs";
import { wijzigModel, wijzigingTekst, zoekProject, leesProject, boomTekst } from "./model.mjs";
import { voerUit } from "./tools.mjs";

const [basis, gebruiker, wwEnv, opdracht, ...rest] = process.argv.slice(2);
const wachtwoord = process.env[wwEnv] || "";
if (!basis || !gebruiker || !wachtwoord || !opdracht) {
  console.error("gebruik: node arch-driver.mjs <basis> <gebruiker> <wachtwoord-env> <opdracht> …");
  process.exit(2);
}

// Twee manieren: een persoonlijk API-token (waarde begint met "omt_", bv. op app)
// of een cookie-login met gebruikersnaam en wachtwoord (lokaal).
let api;
if (wachtwoord.startsWith("omt_")) {
  api = maakApi({ basis, token: wachtwoord });
} else {
  const login = await fetch(`${basis}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gebruikersnaam: gebruiker, wachtwoord }),
  });
  if (!login.ok) {
    console.error("inloggen mislukt:", login.status, await login.text());
    process.exit(1);
  }
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  const fetchMetCookie = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.headers || {}), Cookie: cookie } });
  api = maakApi({ basis, fetchFn: fetchMetCookie });
}

if (opdracht === "maak") {
  const naam = rest[0];
  const id = crypto.randomUUID();
  const inhoud = { formaat: "studio-project", versie: 3, project: { id, naam }, structuur: { mappen: {}, plaatsing: {}, plaatsingVolgorde: [] }, kruisverbanden: [], profielen: {} };
  const meta = await api.post("/api/studio/projecten", { id, naam, inhoud });
  console.log(JSON.stringify(meta));
} else if (opdracht === "plan") {
  const [project, map, bestand, toep] = rest;
  const plan = JSON.parse(fs.readFileSync(bestand, "utf8"));
  const uit = await wijzigModel(api, { project, map: map === "/" ? "" : map, plan, toepassen: toep === "toepassen" });
  console.log(wijzigingTekst(uit, toep === "toepassen"));
} else if (opdracht === "boom") {
  const p = await zoekProject(api, rest[0]);
  const proj = await leesProject(api, p.id);
  console.log(boomTekst(proj));
} else if (opdracht === "bekijk") {
  // Zelfde uitvoer als de MCP-tool project_bekijken (met ids van elementen en relaties).
  const [project, map] = rest;
  const uit = await voerUit(api, "project_bekijken", { project, map: map || undefined });
  const regels = typeof uit === "string" ? uit : uit?.content?.map((c) => c.text).join(String.fromCharCode(10));
  console.log(regels || JSON.stringify(uit));
} else if (opdracht === "ops") {
  // Operaties uit het log (diagnose): ops <project> [vanaf] [limiet] [op-filter]
  const [project, vanaf = "0", limiet = "50", filter = ""] = rest;
  const p = await zoekProject(api, project);
  const d = await api.get(`/api/studio/projecten/${encodeURIComponent(p.id)}/ops?vanaf=${vanaf}&limiet=${limiet}`);
  for (const o of d.ops || []) {
    if (filter && o.op !== filter) continue;
    console.log(`${o.volgnummer} ${o.store} ${o.op} ${JSON.stringify(o.args).slice(0, 400)}`);
  }
  console.log(`laatste ${d.laatste} meer ${d.meer}`);
} else if (opdracht === "export") {
  const [project, uitBestand] = rest;
  const p = await zoekProject(api, project);
  const proj = await leesProject(api, p.id);
  // Werkbestand v3 opbouwen uit de nagespeelde stand (zelfde vorm als bouwProjectData in de Studio).
  const profielen = {};
  for (const [pid, m] of Object.entries(proj.profielen)) {
    if (!Object.keys(m.elements).length && !Object.keys(m.diagrams).length) continue;
    profielen[pid] = { diagramTypeId: pid, elements: m.elements, diagrams: m.diagrams, actiefDiagramId: Object.keys(m.diagrams)[0] || null, meta: null };
  }
  const data = {
    formaat: "studio-project",
    versie: 3,
    geexporteerd: new Date().toISOString(),
    project: { id: p.id, naam: p.naam },
    structuur: { mappen: proj.mappen, plaatsing: proj.plaatsing, plaatsingVolgorde: Object.keys(proj.plaatsing) },
    kruisverbanden: proj.links || [],
    profielen,
  };
  fs.writeFileSync(uitBestand, JSON.stringify(data, null, 2));
  console.log(`geschreven: ${uitBestand} (${Object.keys(profielen).length} profielen, ${Object.keys(proj.mappen).length} mappen)`);
} else {
  console.error("onbekende opdracht:", opdracht);
  process.exit(2);
}
