// teken.mjs — tekent elk diagram van het gebouwde werkbestand als SVG via de render-sidecar
// (render-svc, taal=studio; dezelfde tekenaar als de Studio), om de opstelling te controleren.
//
//   node docs/demo-project/teken.mjs <uitmap> [werkbestand.json] [http://127.0.0.1:8095]     (vanuit bitemp_register_v06/)
import fs from "node:fs";
import path from "node:path";
import { UIT } from "./bouw.mjs";

const [uitmap, bestand = UIT, basis = "http://127.0.0.1:8095"] = process.argv.slice(2);
if (!uitmap) throw new Error("gebruik: node teken.mjs <uitmap> [basis]");
fs.mkdirSync(uitmap, { recursive: true });
const project = JSON.parse(fs.readFileSync(bestand, "utf8"));
let fout = 0;
for (const [profiel, m] of Object.entries(project.profielen)) {
  for (const d of Object.values(m.diagrams)) {
    const res = await fetch(`${basis}/render/svg`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taal: "studio", model: project, profiel, diagram: d.naam }) });
    const tekst = await res.text();
    const naam = `${profiel}-${d.naam.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`;
    if (!res.ok) {
      fout += 1;
      console.log(`✗ ${profiel} / ${d.naam}: ${res.status} ${tekst.slice(0, 300)}`);
      continue;
    }
    fs.writeFileSync(path.join(uitmap, `${naam}.svg`), tekst);
    console.log(`✓ ${naam}.svg  ${/viewBox="([^"]+)"/.exec(tekst)?.[1]}`);
  }
}
process.exitCode = fout ? 1 : 0;
