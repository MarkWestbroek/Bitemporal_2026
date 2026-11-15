#!/usr/bin/env node
// projecten-uuids-aanvullen.mjs — projectformaat 4 op een server (Mark 15-11): vul in alle
// Studio-projecten de ontbrekende uuid's van modelelementen en velden aan (canoniek-uml).
//
// Dezelfde afgeleide uuid's (v5) als de Studio zelf bij het openen geeft
// (web/vite/src/studio/uuidAanvulling.js), dus een project dat iemand intussen opent, komt op
// precies dezelfde uuid's uit. De aanvulling gaat als gewone projectsync-operatie
// (`updateElementen` op `model:diagram05`) naar de server: open Studio's passen haar live toe,
// en `verwachtLaatsteVolgnummer` zorgt dat er niets tussendoor is gekomen (anders: overgeslagen,
// draai opnieuw).
//
// Gebruik (standaard alleen kijken; --toepassen schrijft):
//   OMNIUM_TOKEN=omt_… node scripts/projecten-uuids-aanvullen.mjs --omnium https://<host> [--toepassen] [--project <id>]
// Het token is van een beheerder (die ziet alle projecten). Zonder OMNIUM_TOKEN in de omgeving
// zoekt het script in bitemp_register_v06/.env. Vooraf: `npm install` in web/vite (de stand
// wordt nagespeeld met de Studio-code). Het token wordt nooit gelogd.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maakApi } from "../tools/omnium-mcp/api.mjs";
import { leesProject } from "../tools/omnium-mcp/model.mjs";
import { ontbrekendeUuids, afgeleideUuidMaker } from "../web/vite/src/diagramprofielen/canoniek-uml/uuids.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
/** Profielen waarvan de Studio de uuid's aanvult (koppeling.vulUuids). */
const PROFIELEN = ["diagram05"];

function args() {
  const a = { toepassen: false, omnium: "http://localhost:8082", project: null };
  const r = process.argv.slice(2);
  for (let i = 0; i < r.length; i++) {
    if (r[i] === "--toepassen") a.toepassen = true;
    else if (r[i] === "--omnium") a.omnium = r[++i];
    else if (r[i] === "--project") a.project = r[++i];
    else if (r[i] === "--help" || r[i] === "-h") {
      console.log("node scripts/projecten-uuids-aanvullen.mjs --omnium <url> [--toepassen] [--project <id>]");
      process.exit(0);
    } else throw new Error(`Onbekend argument: ${r[i]}`);
  }
  return a;
}

function leesToken() {
  if (process.env.OMNIUM_TOKEN) return process.env.OMNIUM_TOKEN.trim();
  const pad = path.resolve(HIER, "../.env");
  if (!fs.existsSync(pad)) return "";
  for (const regel of fs.readFileSync(pad, "utf8").split(/\r?\n/)) {
    const m = regel.match(/^\s*(?:export\s+)?OMNIUM_TOKEN\s*=\s*["']?([^"'\s#]+)/);
    if (m) return m[1];
  }
  return "";
}

async function main() {
  const a = args();
  const api = maakApi({ basis: a.omnium, token: leesToken() });
  const lijst = ((await api.get("/api/studio/projecten")) || []).filter((p) => !a.project || p.id === a.project);
  console.log(`${lijst.length} project(en) op ${api.basis}${a.toepassen ? "" : " — alleen kijken (zet --toepassen om te schrijven)"}`);
  const totaal = { bijgewerkt: 0, elementen: 0, overgeslagen: 0 };
  for (const meta of lijst) {
    const label = `${meta.naam} (${meta.id})`;
    try {
      if (meta.recht === "lezen") {
        console.log(`- ${label}: alleen leesrecht, overgeslagen`);
        totaal.overgeslagen++;
        continue;
      }
      const rec = await api.get(`/api/studio/projecten/${encodeURIComponent(meta.id)}`);
      const stam = rec.herkomst?.ouderProject || meta.id;
      const proj = await leesProject(api, meta.id);
      const ops = [];
      let n = 0;
      for (const pid of PROFIELEN) {
        const elements = proj.profielen[pid]?.elements;
        if (!elements) continue;
        const patches = ontbrekendeUuids({ elements }, afgeleideUuidMaker(stam));
        const k = Object.keys(patches).length;
        if (!k) continue;
        n += k;
        ops.push({ store: `model:${pid}`, op: "updateElementen", args: [patches] });
      }
      if (!ops.length) {
        console.log(`- ${label}: al compleet`);
        continue;
      }
      console.log(`- ${label}: ${n} element(en) zonder (volledige) uuid's${stam !== meta.id ? ` (branch, stam ${stam})` : ""}`);
      totaal.elementen += n;
      if (!a.toepassen) continue;
      const basis = Date.now() * 10;
      await api.post(`/api/studio/projecten/${encodeURIComponent(meta.id)}/ops`, {
        clientId: `uuid-aanvulling-${process.pid}`,
        verwachtLaatsteVolgnummer: proj.laatste,
        ops: ops.map((o, i) => ({ ...o, lokaalNr: basis + i + 1 })),
      });
      totaal.bijgewerkt++;
      console.log("  ✓ aangevuld");
    } catch (e) {
      totaal.overgeslagen++;
      console.log(`- ${label}: overgeslagen — ${e.message}`);
    }
  }
  console.log(`Klaar: ${totaal.elementen} element(en) in ${a.toepassen ? `${totaal.bijgewerkt} bijgewerkt(e)` : "te werken"} project(en); ${totaal.overgeslagen} overgeslagen.`);
  if (totaal.overgeslagen) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
