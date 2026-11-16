// bouw.mjs — bouwt het demo-project "Omnium demo — gemeente Waterstede" offline op uit de plannen
// in plannen/, langs dezelfde weg als de MCP-tool model_wijzigen (plan → controle tegen de
// modeltalen → operaties), maar tegen een server in het geheugen. Uitvoer: het werkbestand
// (studio-project v3) dat je in de Studio importeert of als nieuw project naar een server stuurt.
//
//   node docs/demo-project/bouw.mjs [--tot NN] [--stil]      (vanuit bitemp_register_v06/)
//
// plannen/NN-naam.json     {map?: "<pad>", plan: {…}}  — een plan zoals model_wijzigen het krijgt
// plannen/NN-naam.ops.mjs  export default (proj, hulp) => ops[]  — rechtstreekse operaties, voor
//                          wat een plan niet kan (eigenschappen buiten de modeltaal, een beslistabel,
//                          elementen uit een andere map op een diagram)
//
// De bron van het project is de server (app); dit script is er om het project opnieuw te kunnen
// opbouwen en om de plannen te bewaren. Zie README.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { wijzigModel, wijzigingTekst, leesProject } from "../../tools/omnium-mcp/model.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ID = "0d3a5c1e-6f0b-4c7e-9a41-d7e2b3c4a501";
export const PROJECT_NAAM = "Omnium demo — gemeente Waterstede";
export const UIT = path.join(HIER, "omnium-demo-waterstede.studio-project.json");

/** Een server in het geheugen: precies de routes die model.mjs gebruikt. */
export function geheugenApi() {
  const inhoud = { formaat: "studio-project", versie: 3, project: { id: PROJECT_ID, naam: PROJECT_NAAM }, structuur: { mappen: {}, plaatsing: {}, plaatsingVolgorde: [] }, kruisverbanden: [], profielen: {} };
  const ops = [];
  const meta = { id: PROJECT_ID, naam: PROJECT_NAAM, recht: "beheren" };
  return {
    ops,
    async get(pad) {
      if (pad === "/api/studio/projecten") return [meta];
      if (pad.includes("/ops?")) {
        const vanaf = Number(/vanaf=(\d+)/.exec(pad)?.[1] || 0);
        return { ops: ops.filter((o) => o.volgnummer > vanaf), laatste: ops.length, meer: false };
      }
      return { ...meta, inhoud, tot_volgnummer: 0 };
    },
    async post(pad, body) {
      if (!pad.endsWith("/ops")) throw new Error(`geheugenApi: onbekende route ${pad}`);
      for (const o of body.ops || []) ops.push({ ...o, volgnummer: ops.length + 1 });
      return { laatste: ops.length };
    },
  };
}

/** Voert de plannen uit (t/m nummer `tot`) en geeft de api met het operatielog terug. */
export async function bouw({ tot = 99, stil = true } = {}) {
  const api = geheugenApi();
  const map = path.join(HIER, "plannen");
  const bestanden = fs.readdirSync(map).filter((b) => /^\d\d[a-z]?-.*\.(json|ops\.mjs)$/.test(b)).sort();
  const fouten = [];
  for (const b of bestanden) {
    if (Number(b.slice(0, 2)) > tot) break;
    if (b.endsWith(".json")) {
      const { map: doel = "", plan, na } = JSON.parse(fs.readFileSync(path.join(map, b), "utf8"));
      const uit = await wijzigModel(api, { project: PROJECT_ID, map: doel === "/" ? "" : doel, plan, toepassen: true });
      const tekst = wijzigingTekst(uit, true);
      if (!stil) console.log(`── ${b}\n${tekst}\n`);
      const i = tekst.search(/Weggelaten|NIET GEDAAN/);
      if (i >= 0) fouten.push(`${b}:\n${tekst.slice(i)}`);
      if (na) {
        const nieuw = naWerk(await leesProject(api, PROJECT_ID), na);
        await api.post(`/api/studio/projecten/${PROJECT_ID}/ops`, { clientId: "demo-bouw", ops: nieuw });
      }
    } else {
      const maak = (await import(pathToFileURL(path.join(map, b)).href)).default;
      const proj = await leesProject(api, PROJECT_ID);
      const nieuw = await maak(proj, { zoek: zoekIn(proj) });
      await api.post(`/api/studio/projecten/${PROJECT_ID}/ops`, { clientId: "demo-bouw", ops: nieuw });
      if (!stil) console.log(`── ${b}: ${nieuw.length} operaties`);
    }
  }
  return { api, fouten };
}

/**
 * Nawerk bij een plan (`na` in het planbestand): wat model_wijzigen niet kan, als operaties.
 *   velden: [{profiel, element, type?, compartiment, fieldType, velden: [{naam, type?, data?}]}]
 *           een tweede compartiment vullen (een plan vult er bij het aanmaken één)
 *   data:   [{profiel, element, type?, data: {…}}]   eigenschappen buiten de modeltaal-samenvatting
 *   nodes:  [{profiel, diagram, element, type?, x?, y?, w?, h?}]   plaats en maat op een diagram
 */
export function naWerk(proj, na) {
  const zoek = zoekIn(proj);
  const perProfiel = {};
  const bij = (pid) => (perProfiel[pid] ||= { elementen: {}, diagrammen: {} });
  const el = (pid, naam, type) => bij(pid).elementen[zoek(pid, naam, type).id] || zoek(pid, naam, type);
  for (const v of na.velden || []) {
    const e = el(v.profiel, v.element, v.type);
    const nieuw = v.velden.map((x) => ({ naam: x.naam, fieldType: v.fieldType, data: { ...(x.type ? { typeLabel: x.type } : {}), ...(x.data || {}) } }));
    const comps = (e.compartimenten || []).filter((c) => c.compartmentType !== v.compartiment);
    const oud = (e.compartimenten || []).find((c) => c.compartmentType === v.compartiment);
    bij(v.profiel).elementen[e.id] = { ...e, compartimenten: [...comps, { compartmentType: v.compartiment, velden: [...(oud?.velden || []), ...nieuw] }] };
  }
  for (const d of na.data || []) {
    const e = el(d.profiel, d.element, d.type);
    bij(d.profiel).elementen[e.id] = { ...e, data: { ...e.data, ...d.data } };
  }
  for (const n of na.nodes || []) {
    const m = proj.profielen[n.profiel];
    const dia = bij(n.profiel).diagrammen[Object.values(m.diagrams).find((d) => d.naam === n.diagram)?.id] || Object.values(m.diagrams).find((d) => d.naam === n.diagram);
    if (!dia) throw new Error(`${n.profiel}: diagram "${n.diagram}" bestaat niet`);
    const id = zoek(n.profiel, n.element, n.type).id;
    if (!dia.nodes.some((k) => k.elementId === id)) throw new Error(`${n.diagram}: "${n.element}" staat niet op dit diagram`);
    bij(n.profiel).diagrammen[dia.id] = {
      ...dia,
      nodes: dia.nodes.map((k) => (k.elementId !== id ? k : { ...k, position: { x: n.x ?? k.position.x, y: n.y ?? k.position.y }, ...(n.w || n.h ? { size: { width: n.w ?? k.size?.width, height: n.h ?? k.size?.height } } : {}) })),
    };
  }
  const ops = [];
  for (const [pid, p] of Object.entries(perProfiel)) {
    if (Object.keys(p.elementen).length) ops.push({ store: `model:${pid}`, op: "patchElementen", args: [{ zet: p.elementen, wis: [] }] });
    if (Object.keys(p.diagrammen).length) ops.push({ store: `model:${pid}`, op: "patchDiagrammen", args: [{ zet: p.diagrammen, wis: [] }] });
  }
  return ops;
}

/** Zoekt een element op naam (en eventueel type) in een profiel van het project. */
export const zoekIn = (proj) => (profiel, naam, type) => {
  const raak = Object.values(proj.profielen[profiel]?.elements || {}).filter((e) => e.naam === naam && (!type || e.elementType === type));
  if (raak.length !== 1) throw new Error(`${profiel}: "${naam}"${type ? ` (${type})` : ""} ${raak.length ? "is niet uniek" : "bestaat niet"}`);
  return raak[0];
};

/** Het werkbestand (v3) van de stand, zoals arch-driver export. */
export async function werkbestand(api) {
  const proj = await leesProject(api, PROJECT_ID);
  const profielen = {};
  for (const [pid, m] of Object.entries(proj.profielen)) {
    if (!Object.keys(m.elements).length && !Object.keys(m.diagrams).length) continue;
    profielen[pid] = { diagramTypeId: pid, elements: m.elements, diagrams: m.diagrams, actiefDiagramId: Object.keys(m.diagrams)[0] || null, meta: null };
  }
  return {
    formaat: "studio-project",
    versie: 3,
    project: { id: PROJECT_ID, naam: PROJECT_NAAM },
    structuur: { mappen: proj.mappen, plaatsing: proj.plaatsing, plaatsingVolgorde: Object.keys(proj.plaatsing) },
    kruisverbanden: proj.links || [],
    profielen,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2);
  const tot = arg.includes("--tot") ? Number(arg[arg.indexOf("--tot") + 1]) : 99;
  const { api, fouten } = await bouw({ tot, stil: arg.includes("--stil") });
  const data = await werkbestand(api);
  fs.writeFileSync(UIT, JSON.stringify(data, null, 2) + "\n");
  const n = Object.values(data.profielen).reduce((s, p) => s + Object.keys(p.diagrams).length, 0);
  console.log(`geschreven: ${path.basename(UIT)} — ${Object.keys(data.profielen).length} talen, ${n} diagrammen, ${api.ops.length} operaties`);
  if (fouten.length) {
    console.error(`\nLET OP, niet alles is gedaan:\n${fouten.join("\n\n")}`);
    process.exitCode = 1;
  }
}
