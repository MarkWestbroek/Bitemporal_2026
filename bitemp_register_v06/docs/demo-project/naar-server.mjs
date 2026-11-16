// naar-server.mjs — zet het gebouwde werkbestand als NIEUW project op een Omnium-server en regelt
// de toegang. Bestaat het project daar al, dan doet dit script niets: de server is de bron
// (Mark en Claude bewerken het daar); haal de stand dan op met `van-server` hieronder.
//
//   node docs/demo-project/naar-server.mjs <basis> <token-env> nieuw [naam]     nieuw project + toegang
//   node docs/demo-project/naar-server.mjs <basis> <token-env> van-server [naam] stand van de server → het JSON in deze map
//
// <token-env>: de naam van de omgevingsvariabele met een API-token (omt_…), nooit het token zelf.
// Met [naam] zet je een kopie onder een andere naam neer (bv. de speelplaats); die krijgt een eigen id.
import fs from "node:fs";
import crypto from "node:crypto";
import { maakApi } from "../../tools/omnium-mcp/api.mjs";
import { zoekProject, leesProject } from "../../tools/omnium-mcp/model.mjs";
import { UIT, PROJECT_ID, PROJECT_NAAM } from "./bouw.mjs";

const [basis, tokenEnv, opdracht, naamArg] = process.argv.slice(2);
const token = process.env[tokenEnv || ""] || "";
if (!basis || !token || !["nieuw", "van-server"].includes(opdracht)) {
  console.error("gebruik: node naar-server.mjs <basis> <token-env> nieuw|van-server [naam]");
  process.exit(2);
}
const api = maakApi({ basis, token });
const naam = naamArg || PROJECT_NAAM;
const lijst = (await api.get("/api/studio/projecten")) || [];
const bestaand = lijst.find((p) => p.naam === naam);

if (opdracht === "nieuw") {
  if (bestaand) {
    console.error(`"${naam}" bestaat al op ${basis} (id ${bestaand.id}); niets gedaan. De server is de bron.`);
    process.exit(1);
  }
  const inhoud = JSON.parse(fs.readFileSync(UIT, "utf8"));
  const id = naamArg ? crypto.randomUUID() : PROJECT_ID;
  inhoud.project = { id, naam };
  const meta = await api.post("/api/studio/projecten", { id, naam, inhoud });
  console.log("aangemaakt:", JSON.stringify(meta).slice(0, 300));
  // De demo: iedereen leest, Mark schrijft mee. Een kopie onder een andere naam (speelplaats): iedereen schrijft.
  const toegang = naamArg ? [{ subject: "*", recht: "schrijven" }] : [{ subject: "*", recht: "lezen" }, { subject: "mark", recht: "schrijven" }];
  await api.put(`/api/studio/projecten/${id}/toegang`, { toegang });
  console.log("toegang:", JSON.stringify(toegang));
} else {
  if (!bestaand) {
    console.error(`"${naam}" staat niet op ${basis}.`);
    process.exit(1);
  }
  const p = await zoekProject(api, bestaand.id);
  const proj = await leesProject(api, p.id);
  const profielen = {};
  for (const [pid, m] of Object.entries(proj.profielen)) {
    if (!Object.keys(m.elements).length && !Object.keys(m.diagrams).length) continue;
    profielen[pid] = { diagramTypeId: pid, elements: m.elements, diagrams: m.diagrams, actiefDiagramId: Object.keys(m.diagrams)[0] || null, meta: null };
  }
  const data = { formaat: "studio-project", versie: 3, project: { id: p.id, naam: p.naam }, structuur: { mappen: proj.mappen, plaatsing: proj.plaatsing, plaatsingVolgorde: Object.keys(proj.plaatsing) }, kruisverbanden: proj.links || [], profielen };
  fs.writeFileSync(UIT, JSON.stringify(data, null, 2) + "\n");
  console.log(`opgehaald: ${p.naam} → ${UIT} (t/m operatie ${proj.laatste})`);
}
