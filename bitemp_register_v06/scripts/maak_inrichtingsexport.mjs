#!/usr/bin/env node
// maak_inrichtingsexport.mjs — de exportstap "Inrichtingsartefacten" zonder
// Studio: alle artefacten van één e-dienst, de bronnen en OVERZICHT.md in een
// map, precies zoals de zip uit het transformatiepaneel
// (docs/TRANSFORMATIES.md §11.10, §11.14, §11.16). Registreren doet FUNDAMENT
// met die map (omnium-registreer-artefact.ps1 -Map).
//
// Het model komt bij voorkeur uit een **Studio-project** (besluit Mark 07-11:
// de Studio is de bron, V3 wordt afgeleid): de export van een project (het
// veld `inhoud` van GET /api/studio/projecten/<id>) plus de mappen of domeinen
// die bij de e-dienst horen. Alleen die stukken gaan mee (Mark 08-11): de
// elementen van die domeinen en wat ze nodig hebben, en alleen de diagrammen
// die daar staan; de bron `logisch-model` wordt dus niet het hele project.
//
// Het best rechtstreeks uit Omnium (Mark 08-11: "het best kijken ze in het
// model zelf, niet via een export"): --omnium <basis-URL> --project <id of
// naam>, met een persoonlijk API-token in de omgevingsvariabele OMNIUM_TOKEN
// (of de naam in --token-env; anders uit bitemp_register_v06/.env; Studio →
// Gebruikers → Mijn API-tokens). Het
// script leest de snapshot (`inhoud`, t/m `tot_volgnummer`) en de ops daarna
// (`…/ops?vanaf=…`, vanaf is exclusief, zolang `meer`), net als de MCP.
//
// Gebruik (vanuit bitemp_register_v06):
//   OMNIUM_TOKEN=omt_… node scripts/maak_inrichtingsexport.mjs --edienst <edienst.json> \
//     --omnium https://omnium.fundament.common-ground-lab.nl --project Inrichten \
//     --map Domeinen [--map Overig/org-geo] \
//     [--referentielijst <items.json>]… [--bpmn <BPMN- of DMN-model.json>]… \
//     [--peiltijdstip 2026-11-08T12:00:00Z] --uit <map>
// of met een projectexport op schijf: --project <studio-project.json> [--ops <ops.json>]…
// of met een V3-bestand in plaats van --project/--map:  --model <V3-model.json>
//
// --ops: de operaties ná de snapshot (`inhoud` is een snapshot tot
// `tot_volgnummer`; latere wijzigingen staan alleen in het ops-log, GET
// /api/studio/projecten/<id>/ops?vanaf=<tot_volgnummer>, exclusief). Het antwoord
// ({ops: […]}) of een lijst; ze worden nagespeeld zoals de MCP dat doet
// (ea/sidecarImport.js maakStand → speelOpsNa → bouwWerkbestand).
// --referentielijst: de bestandsnaam bevat de lijstnaam (zoals in de Studio);
// zonder bestand komen de items uit de eersteVulling van de e-dienst.
// --bpmn: de bestandsnaam is `bron.model` van het artefact.
// Uit een project komen de BPMN-processen bij voorkeur uit het project zelf
// (Mark 08-11): elk ander profiel dan het canonieke staat klaar als
// `project:<profiel>` (bv. `"bron": {"model": "project:bpmnMotor05", "diagram":
// "Aanvraag behandelen"}`); een --bpmn-bestand met dezelfde naam gaat voor.
// Exitcode 0 = alles gemaakt, 2 = een of meer artefacten mislukt, 1 = fout.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const VITE = path.resolve(HIER, "../web/vite");
// De exportstap leunt op de Studio-modules met Vite-aliases (@umleditor/…).
await import(pathToFileURL(path.join(VITE, "test/register-aliases.mjs")).href);
const laad = (rel) => import(pathToFileURL(path.join(VITE, "src", rel)).href);
const { voerInrichtingsExportUit } = await laad("transformatie/inrichtingsExport.js");
const { vindMap, profielUitMappen } = await laad("transformatie/studioProject.js");
const { exporteerV3 } = await laad("diagramprofielen/canoniek-uml/serialisatie.js");
const { maakStand, speelOpsNa, bouwWerkbestand } = await laad("diagramprofielen/ea/sidecarImport.js");
const { maakApi } = await import(pathToFileURL(path.resolve(HIER, "../tools/omnium-mcp/api.mjs")).href);

const CANONIEK = "diagram05";
const HERHAALBAAR = ["map", "referentielijst", "bpmn", "ops"];

function argumenten(argv) {
  const uit = Object.fromEntries(HERHAALBAAR.map((k) => [k, []]));
  for (let i = 0; i < argv.length; i += 2) {
    const sleutel = argv[i].replace(/^--/, "");
    const waarde = argv[i + 1];
    if (!argv[i].startsWith("--") || waarde === undefined) throw new Error(`Onverwacht argument: ${argv[i]}`);
    if (HERHAALBAAR.includes(sleutel)) uit[sleutel].push(waarde);
    else uit[sleutel] = waarde;
  }
  for (const verplicht of ["edienst", "uit"]) if (!uit[verplicht]) throw new Error(`--${verplicht} ontbreekt`);
  if (!uit.model && !uit.project) throw new Error("Geef --project (met --map) of --model");
  if (uit.project && !uit.map.length) throw new Error("--project vraagt minstens één --map");
  if (uit.omnium && !uit.project) throw new Error("--omnium vraagt --project <id of naam>");
  return uit;
}

const lees = (pad) => JSON.parse(fs.readFileSync(pad, "utf8"));
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

/**
 * Snapshot + ops rechtstreeks uit Omnium: {inhoud, ops, herkomst}; de ops
 * speelt de aanroeper na. Wordt het project tijdens het lezen gecompacteerd
 * (snapshotNodig), dan opnieuw (zoals tools/omnium-mcp/model.mjs leesProject).
 */
/**
 * Het token uit de omgeving, anders uit `.env` van de hoofdmap van de repo
 * (bitemp_register_v06/.env, niet in git); commentaar achter de waarde telt
 * niet mee. De worktree zoekt ook in de hoofd-checkout (`git rev-parse
 * --git-common-dir`). Het token wordt nooit gelogd.
 */
function leesToken(naam) {
  if (process.env[naam]) return process.env[naam].trim();
  const kandidaten = [path.resolve(HIER, "../.env")];
  try {
    const gemeen = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: HIER, encoding: "utf8" }).trim();
    kandidaten.push(path.join(path.dirname(gemeen), "bitemp_register_v06", ".env"));
  } catch {
    /* geen git: alleen de eigen .env */
  }
  for (const pad of kandidaten) {
    if (!fs.existsSync(pad)) continue;
    for (const regel of fs.readFileSync(pad, "utf8").split(/\r?\n/)) {
      const m = regel.match(new RegExp(`^\\s*(?:export\\s+)?${naam}\\s*=\\s*(.*)$`));
      if (!m) continue;
      let waarde = m[1].trim();
      const q = waarde[0];
      if (q === '"' || q === "'") waarde = waarde.slice(1, waarde.indexOf(q, 1) > 0 ? waarde.indexOf(q, 1) : undefined);
      else waarde = waarde.split(/[\s#]/)[0];
      if (waarde) return waarde;
    }
  }
  return "";
}

async function leesUitOmnium(basis, wie, tokenEnv) {
  const token = leesToken(tokenEnv);
  if (!token) throw new Error(`Geen API-token in ${tokenEnv} (omgeving of bitemp_register_v06/.env; Studio → Gebruikers → Mijn API-tokens)`);
  const api = maakApi({ basis, token });
  let id = wie;
  if (!/^[0-9a-f-]{36}$/i.test(wie)) {
    const lijst = (await api.get("/api/studio/projecten")) || [];
    const gevonden = lijst.filter((p) => String(p.naam).toLowerCase() === String(wie).toLowerCase());
    if (gevonden.length !== 1) throw new Error(`Project "${wie}": ${gevonden.length ? "meer dan één" : "niet gevonden"}; wel: ${lijst.map((p) => p.naam).join(", ")}`);
    id = gevonden[0].id;
  }
  for (let poging = 0; poging < 3; poging += 1) {
    const p = await api.get(`/api/studio/projecten/${encodeURIComponent(id)}`);
    const inhoud = typeof p.inhoud === "string" ? JSON.parse(p.inhoud) : p.inhoud || {};
    const ops = [];
    let vanaf = p.tot_volgnummer || 0;
    let opnieuw = false;
    for (;;) {
      const d = await api.get(`/api/studio/projecten/${encodeURIComponent(id)}/ops?vanaf=${vanaf}&limiet=1000`);
      if (d.snapshotNodig) {
        opnieuw = true;
        break;
      }
      ops.push(...(d.ops || []));
      vanaf = d.laatste ?? vanaf;
      if (!d.meer) break;
    }
    if (!opnieuw) return { inhoud, ops, herkomst: `${basis}, project ${p.naam || id}: snapshot t/m ${p.tot_volgnummer || 0}, ops t/m ${vanaf}` };
  }
  throw new Error("Het project werd tijdens het lezen steeds gecompacteerd; probeer het zo nog eens.");
}

async function main() {
  const a = argumenten(process.argv.slice(2));
  const edienst = lees(a.edienst);
  let modelBestand;
  let canoniekDeel = null;
  /** BPMN-modellen uit het project zelf: project:<profiel> → {model: {elements, diagrams}}. */
  const uitProject = {};
  if (a.project) {
    let inhoud;
    let ops = [];
    if (a.omnium) {
      const r = await leesUitOmnium(a.omnium, a.project, a["token-env"] || "OMNIUM_TOKEN");
      ({ inhoud, ops } = r);
      console.error(`Gelezen: ${r.herkomst}`);
    } else {
      const project = lees(a.project);
      inhoud = project.inhoud && !project.profielen ? project.inhoud : project; // ook het hele API-antwoord
      if (typeof inhoud === "string") inhoud = JSON.parse(inhoud);
      ops = a.ops.flatMap((pad) => {
        const d = lees(pad);
        return Array.isArray(d) ? d : d.ops || [];
      });
    }
    if (ops.length) {
      const stand = maakStand(inhoud);
      const r = speelOpsNa(stand, ops) || {};
      inhoud = bouwWerkbestand(stand);
      console.error(`Ops nagespeeld: ${ops.length}${r.toegepast !== undefined ? ` (${r.toegepast} toegepast, ${r.overgeslagen} overgeslagen)` : ""}`);
      for (const p of r.problemen || []) console.error(`warning OPS ${typeof p === "string" ? p : JSON.stringify(p)}`);
    }
    for (const [pid, prof] of Object.entries(inhoud.profielen || {})) {
      if (pid === CANONIEK || !prof?.elements) continue;
      uitProject[`project:${pid}`] = { model_naam: `Studio-project, profiel ${pid}`, model: { elements: prof.elements, diagrams: prof.diagrams || {} } };
    }
    const sleutels = a.map.map((m) => vindMap(inhoud, m));
    canoniekDeel = profielUitMappen(inhoud, sleutels, CANONIEK);
    if (!canoniekDeel) throw new Error(`Geen canoniek model in ${a.map.join(", ")}`);
    modelBestand = exporteerV3({ ...inhoud.profielen[CANONIEK], elements: canoniekDeel.elements, diagrams: canoniekDeel.diagrams }).v3;
    console.error(
      `Model uit ${a.map.join(" + ")}: ${Object.keys(canoniekDeel.elements).length} elementen, ` +
        `${(modelBestand.model || modelBestand).entiteiten.length} entiteiten; diagrammen: ${Object.values(canoniekDeel.diagrams).map((d) => d.naam).join(", ") || "geen"}`,
    );
  } else {
    modelBestand = lees(a.model);
  }
  const { datatypes } = lees(path.join(VITE, "src/transformatie/gegevenstypen.snapshot.json"));
  const uit = await voerInrichtingsExportUit({
    edienst,
    modelBestand,
    datatypen: datatypes,
    referentieBestanden: a.referentielijst.map((pad) => ({ naam: path.basename(pad), inhoud: lees(pad) })),
    bpmnModellen: { ...uitProject, ...Object.fromEntries(a.bpmn.map((pad) => [path.basename(pad), lees(pad)])) },
    canoniekDeel,
    peiltijdstip: a.peiltijdstip || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    sha256Hex,
  });
  fs.mkdirSync(a.uit, { recursive: true });
  for (const b of uit.bestanden) fs.writeFileSync(path.join(a.uit, b.naam), b.inhoud, "utf8");
  for (const d of uit.diagnostics) console.error(`${d.severity.padEnd(7)} ${d.code} ${d.sourceId ? `[${d.sourceId}] ` : ""}${d.message}`);
  console.log(`${uit.summary} → ${a.uit}`);
  return uit.rijen.some((r) => !r.artefact) ? 2 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`Fout: ${e?.message || e}`);
    process.exit(1);
  },
);
