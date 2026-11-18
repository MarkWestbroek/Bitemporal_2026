// 17-sequence-punten-ops.mjs — geeft berichten van sequence-diagrammen hun zend-/ontvangpunten op
// de levenslijnen, in de volgorde van de connectoren in een plan (y = volgorde).
// Een connector uit het plan die op app ontbreekt (de MCP vouwt gelijke paren samen) wordt
// alsnog gemaakt, met een eigen id.
//   node docs/architectuur/plannen/17-sequence-punten-ops.mjs <basis> <token-env> <plan.json> <stand.json> [toepassen]
//   (vanuit bitemp_register_v06/; <stand.json> = verse export via arch-driver.mjs; zonder "toepassen" alleen een voorstel)
import fs from "node:fs";
import { maakApi } from "../../../tools/omnium-mcp/api.mjs";
import { zoekProject } from "../../../tools/omnium-mcp/model.mjs";

const [basis, tokenEnv, planPad, standPad, toep] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planPad, "utf8"));
const stand = JSON.parse(fs.readFileSync(standPad, "utf8"));
const s = stand.profielen.sequence05;
const BERICHT = new Set(["synchroon", "asynchroon", "retour"]);
const Y0 = 84, STAP = 50;

const zetEl = {}, zetDia = {};
const gebruikt = new Set();
const verslag = [];
for (const d of plan.diagrammen) {
  const dia = Object.values(s.diagrams).find((g) => g.naam === d.naam);
  if (!dia) { verslag.push(`?? diagram niet gevonden: ${d.naam}`); continue; }
  if (dia.nodes.some((n) => s.elements[n.elementId]?.elementType === "punt")) { verslag.push(`-- ${dia.naam}: heeft al punten, overgeslagen`); continue; }
  const lijnen = new Map(); // plan-sleutel → app-id
  for (const e of plan.elementen) {
    if (e.diagram !== d.sleutel || e.type !== "levenslijn") continue;
    const n = dia.nodes.find((n) => s.elements[n.elementId]?.naam === e.naam);
    if (!n) verslag.push(`?? levenslijn niet gevonden: ${e.naam}`); else lijnen.set(e.sleutel, n.elementId);
  }
  const nodes = [...dia.nodes];
  let nieuw = 0;
  const berichten = plan.connectoren.filter((c) => lijnen.has(c.bron) && lijnen.has(c.doel));
  berichten.forEach((c, i) => {
    const bron = lijnen.get(c.bron), doel = lijnen.get(c.doel);
    let m = Object.values(s.elements).find((e) => !gebruikt.has(e.id) && BERICHT.has(e.elementType) && e.source === bron && e.target === doel && e.naam === c.naam);
    if (!m) {
      // Op app samengevouwen met een eerder bericht tussen hetzelfde paar: alsnog maken.
      let id = `mcp_${c.type}_${bron.slice(4)}_${doel.slice(4)}`.slice(0, 60);
      for (let k = 2; s.elements[id] || zetEl[id]; k++) id = `${id.replace(/_\d+$/, "")}_${k}`;
      m = { id, data: {}, naam: c.naam, source: bron, target: doel, elementType: c.type, compartimenten: [] };
      nieuw++;
      verslag.push(`+ nieuw bericht ${id}: ${c.naam}`);
    }
    gebruikt.add(m.id);
    const y = Y0 + i * STAP, zend = `${m.id}_zend`, ontvang = `${m.id}_ontvang`;
    zetEl[zend] = { id: zend, data: { randVan: bron }, naam: "", elementType: "punt", compartimenten: [] };
    zetEl[ontvang] = { id: ontvang, data: { randVan: doel }, naam: "", elementType: "punt", compartimenten: [] };
    zetEl[m.id] = { ...m, source: zend, target: ontvang, data: { ...(m.data || {}), sourceHandle: null, targetHandle: null } };
    nodes.push({ position: { x: 1, y }, elementId: zend }, { position: { x: 1, y }, elementId: ontvang });
  });
  zetDia[dia.id] = { ...dia, nodes };
  verslag.push(`~ ${dia.naam}: ${berichten.length} berichten (${nieuw} nieuw), ${nodes.length - dia.nodes.length} punten, hoogte tot y=${Y0 + (berichten.length - 1) * STAP}`);
}
console.log(verslag.join("\n"));
if (toep !== "toepassen") { console.log(`(voorstel) elementen: ${Object.keys(zetEl).length}, diagrammen: ${Object.keys(zetDia).length}`); process.exit(0); }
const api = maakApi({ basis, token: process.env[tokenEnv] });
const p = await zoekProject(api, stand.project.naam);
const ops = [
  { lokaalNr: 1, store: "model:sequence05", op: "patchElementen", args: [{ wis: [], zet: zetEl }] },
  { lokaalNr: 2, store: "model:sequence05", op: "patchDiagrammen", args: [{ wis: [], zet: zetDia }] },
];
const uit = await api.post(`/api/studio/projecten/${encodeURIComponent(p.id)}/ops`, { clientId: "arch-claude", ops });
console.log("toegepast:", JSON.stringify(uit));
