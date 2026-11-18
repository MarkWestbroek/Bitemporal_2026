// simulatie-test.mjs — loopt de scenario's in scenarios/ door op het gebouwde werkbestand, met
// dezelfde kern als de activiteit Simulatie in de Studio (web/vite/src/simulatie/). Zo weten we
// dat de demo werkt voordat hij op een server staat. Staan de scenario's in het project (taal
// Simulatiemodel), dan loopt de test die versie en toetst hij dat ze gelijk zijn aan scenarios/.
//
//   node docs/demo-project/simulatie-test.mjs [--log] [werkbestand.json]      (vanuit bitemp_register_v06/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UIT } from "./bouw.mjs";
import { maakSimulatie } from "../../web/vite/src/simulatie/simulatie.js";
import { toetsLijnen } from "../../web/vite/src/simulatie/dataLijnen.js";
import { toetsStartobject } from "../../web/vite/src/simulatie/dataObjecten.js";
import { simulatiesIn, scenarioUitModel } from "../../web/vite/src/simulatie/scenarioModel.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const bestand = process.argv.slice(2).find((a) => !a.startsWith("--")) || UIT;
const project = JSON.parse(fs.readFileSync(bestand, "utf8"));
const model = (pid) => ({ elements: project.profielen[pid].elements, diagrams: project.profielen[pid].diagrams });
// Zoals simulatieRun.start(): het BPMN-model van het project, de beslissingen uit het project, geen e-dienstmodel.
const m1 = { proces: { model_naam: "BPMN-model van het project", model: model("bpmnMotor05") }, beslissingen: [{ model_naam: "DMN", model: model("dmnDrd05") }], edienst: null };

const toonLog = process.argv.includes("--log");
let fout = 0;
const map = path.join(HIER, "scenarios");
const uitBestanden = fs.readdirSync(map).filter((x) => x.endsWith(".json")).sort().map((b) => JSON.parse(fs.readFileSync(path.join(map, b), "utf8")));
// De scenario's in het project (simulatiemodel05), als ze er staan; anders de bestanden.
const simEl = project.profielen.simulatiemodel05?.elements || {};
const inProject = simulatiesIn(simEl).simulaties.flatMap((s) => s.scenarios).map((s) => scenarioUitModel(simEl, s.id));
// Uit het model komen de plekken als element-id terug (mcp_beoordeel_de_aanvraag), in de bestanden
// staan ze als bpmn-id (aanvraag-beoordelen); de simulatie kent beide.
const bpmnId = (k) => project.profielen.bpmnMotor05.elements[k]?.data?.bpmnId || k;
const opBpmnId = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [bpmnId(k), v]));
const kern = (s) => JSON.stringify({ naam: s.naam, start: s.start, vulwijze: { ...s.vulwijze, ...(s.vulwijze?.perGat ? { perGat: opBpmnId(s.vulwijze.perGat) } : {}) }, antwoorden: opBpmnId(s.antwoorden), zaadje: s.zaadje, verwacht: s.verwacht });
if (inProject.length) {
  console.log(`scenario's uit het project (${inProject.length})`);
  for (const f of uitBestanden) {
    const m = inProject.find((s) => s.naam === f.naam);
    if (!m) { console.log(`✗ "${f.naam}" staat niet in het project`); fout += 1; }
    else if (kern(m) !== kern(f)) { console.log(`✗ "${f.naam}" in het project wijkt af van scenarios/:
    project  ${kern(m)}
    bestand  ${kern(f)}`); fout += 1; }
  }
} else console.log("scenario's uit scenarios/ (niet in het project)");
for (const scenario of inProject.length ? inProject : uitBestanden) {
  const sim = maakSimulatie({ m1, scenario });
  let stand = sim.loop();
  const v = scenario.verwacht || {};
  const bezwaren = [];
  // Scenario 3 stopt bij een gat dat de gebruiker met de hand vult; hier vullen we het om het vervolg te toetsen.
  if (v.gat) {
    if (stand.soort !== "gat" || stand.gaten[0].naam !== v.gat) bezwaren.push(`verwacht een gat bij "${v.gat}", kreeg ${JSON.stringify(stand).slice(0, 200)}`);
    else {
      sim.vul(stand.gaten[0].id, { besluit: "verlenen" });
      stand = sim.loop();
    }
  }
  const t = sim.toestand();
  const object = t.objecten[scenario.start.id]?.data || {};
  const eindes = stand.soort === "uitkomst" ? stand.eindes.map((e) => e.einde) : [];
  if (stand.soort !== "uitkomst") bezwaren.push(`de run eindigt niet als uitkomst maar als ${JSON.stringify(stand).slice(0, 300)}`);
  if (v.einde && !eindes.includes(v.einde)) bezwaren.push(`einde "${v.einde}" niet bereikt (wel: ${eindes.join(", ")})`);
  if (v.status && object.status !== v.status) bezwaren.push(`status is "${object.status}", verwacht "${v.status}"`);
  if (v.leges !== undefined && t.variabelen.tarief?.leges !== v.leges) bezwaren.push(`leges is ${JSON.stringify(t.variabelen.tarief)}, verwacht ${v.leges}`);
  // De toetsen van het scherm: lijnen tegen objecten, en het startobject tegen het invoer-data-object.
  const elementenVan = (pid) => project.profielen[pid]?.elements || null;
  for (const l of toetsLijnen({ bpmnElementen: m1.proces.model.elements, diagrams: m1.proces.model.diagrams, elementenVan, log: sim.log }).bevindingen) bezwaren.push(`lijnen en objecten: ${l.soort} — ${l.reden}`);
  const hoofd = sim.processen.find((p) => p.id === scenario.start.proces);
  for (const s of toetsStartobject({ bpmnElementen: m1.proces.model.elements, diagram: m1.proces.model.diagrams[hoofd.diagramId], elementenVan, startType: scenario.start.type })) if (!s.past) bezwaren.push(`startobject: ${JSON.stringify(s)}`);
  console.log(`${bezwaren.length ? "✗" : "✓"} ${scenario.naam} — ${sim.log.length} stappen, eindes: ${eindes.join(" · ") || "-"}; risico ${JSON.stringify(t.variabelen.risico)}; tarief ${JSON.stringify(t.variabelen.tarief)}`);
  for (const x of bezwaren) console.log(`    ${x}`);
  if (toonLog) for (const r of sim.log) console.log(`    ${String(r.nr).padStart(3)} ${r.wat}${r.beslissing ? `  [${r.beslissing.tabel}: ${r.beslissing.regel}]` : ""}${r.conditie ? `  [${r.conditie}]` : ""}${r.signaal ? `  △ ${r.signaal.naam} → ${r.signaal.ontvangers.join(", ") || "niemand"}` : ""}`);
  fout += bezwaren.length;
}
process.exitCode = fout ? 1 : 0;
