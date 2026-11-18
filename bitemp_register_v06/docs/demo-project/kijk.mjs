// kijk.mjs — hulpje bij het bouwen: toont van het gebouwde werkbestand per diagram de maat, en
// op verzoek een element als JSON.
//   node docs/demo-project/kijk.mjs                 overzicht (taal, diagram, aantal, omhullende)
//   node docs/demo-project/kijk.mjs <profiel> <naam>  het element met die naam
import fs from "node:fs";
import { UIT } from "./bouw.mjs";

const p = JSON.parse(fs.readFileSync(UIT, "utf8"));
const [profiel, naam] = process.argv.slice(2);
if (profiel) {
  const raak = Object.values(p.profielen[profiel]?.elements || {}).filter((e) => (naam ? e.naam === naam || e.elementType === naam : true));
  for (const e of raak.slice(0, 3)) console.log(JSON.stringify(e, null, 1));
} else {
  for (const [pid, m] of Object.entries(p.profielen)) {
    for (const d of Object.values(m.diagrams)) {
      const xs = d.nodes.map((n) => n.position.x);
      const ys = d.nodes.map((n) => n.position.y);
      const x2 = d.nodes.map((n) => n.position.x + (n.size?.width || 150));
      const y2 = d.nodes.map((n) => n.position.y + (n.size?.height || 60));
      console.log(`${pid.padEnd(22)} ${d.naam.padEnd(48)} ${String(d.nodes.length).padStart(3)} nodes  ${Math.round(Math.max(...x2) - Math.min(...xs))} × ${Math.round(Math.max(...y2) - Math.min(...ys))}`);
    }
  }
  console.log(`${p.kruisverbanden.length} kruisverbanden, ${Object.keys(p.structuur.mappen).length} mappen`);
}
