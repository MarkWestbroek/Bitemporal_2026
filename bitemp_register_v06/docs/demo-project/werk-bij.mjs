// werk-bij.mjs — een wijziging op het demo-project die op de stand van de SERVER werkt (de server is
// de bron; Mark bewerkt het project daar ook). Een bijwerkscript krijgt de huidige stand en geeft
// operaties terug; die worden eerst droog nagespeeld (voorbeeld-JSON om te tekenen) en gaan pas met
// `toepassen` naar de server.
//
//   node docs/demo-project/werk-bij.mjs <basis> <token-env> bijwerken/<script>.mjs [toepassen]
//
// Zonder `toepassen`: schrijft voorbeeld.studio-project.json (niet in git) en verstuurt niets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { maakApi } from "../../tools/omnium-mcp/api.mjs";
import { leesProject } from "../../tools/omnium-mcp/model.mjs";
import { maakStand, speelOpsNa, bouwWerkbestand } from "../../web/vite/src/diagramprofielen/ea/sidecarImport.js";
import { PROJECT_ID, PROJECT_NAAM, zoekIn } from "./bouw.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const [basis, tokenEnv, script, toep] = process.argv.slice(2);
const token = process.env[tokenEnv || ""] || "";
if (!basis || !token || !script) {
  console.error("gebruik: node werk-bij.mjs <basis> <token-env> bijwerken/<script>.mjs [toepassen]");
  process.exit(2);
}
const api = maakApi({ basis, token });
const lijst = (await api.get("/api/studio/projecten")) || [];
const p = lijst.find((x) => x.id === PROJECT_ID) || lijst.find((x) => x.naam === PROJECT_NAAM);
if (!p) throw new Error(`"${PROJECT_NAAM}" staat niet op ${basis}`);
const proj = await leesProject(api, p.id);
const maak = (await import(pathToFileURL(path.resolve(HIER, script)).href)).default;
const ops = await maak(proj, { zoek: zoekIn(proj) });
console.log(`${script}: ${ops.length} operaties op de stand t/m ${proj.laatste}`);
for (const o of ops) console.log(`  ${o.store} ${o.op} ${JSON.stringify(o.args).length} tekens`);

// Droog naspelen op de stand van de server.
const werk = {
  formaat: "studio-project",
  versie: 3,
  project: { id: p.id, naam: p.naam },
  structuur: { mappen: proj.mappen, plaatsing: proj.plaatsing, plaatsingVolgorde: Object.keys(proj.plaatsing) },
  kruisverbanden: proj.links || [],
  profielen: Object.fromEntries(Object.entries(proj.profielen).map(([pid, m]) => [pid, { diagramTypeId: pid, elements: m.elements, diagrams: m.diagrams, actiefDiagramId: null, meta: null }])),
};
const stand = maakStand(werk);
const uit = speelOpsNa(stand, ops.map((o, i) => ({ ...o, volgnummer: i + 1 })));
if (uit.problemen.length) {
  console.error("Problemen bij het naspelen:\n  " + uit.problemen.join("\n  "));
  process.exit(1);
}
const voorbeeld = path.join(HIER, "voorbeeld.studio-project.json");
fs.writeFileSync(voorbeeld, JSON.stringify(bouwWerkbestand(stand, { id: p.id, naam: p.naam }), null, 2));
console.log(`nagespeeld: ${uit.toegepast} toegepast → ${path.basename(voorbeeld)}`);

if (toep === "toepassen") {
  const nu = Date.now() * 10;
  const antwoord = await api.post(`/api/studio/projecten/${p.id}/ops`, { clientId: `demo-bijwerken-${process.pid}`, ops: ops.map((o, i) => ({ ...o, lokaalNr: nu + i })) });
  console.log("verstuurd:", JSON.stringify(antwoord).slice(0, 200));
} else console.log("niet verstuurd (voeg `toepassen` toe)");
