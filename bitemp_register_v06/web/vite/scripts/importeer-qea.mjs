#!/usr/bin/env node
// importeer-qea.mjs — de node-sidecar: een Sparx EA-pakket (.qea) rechtstreeks in
// een serverproject zetten, zonder browser (plan: onderzoeksdoc 2026-10-07 §7.6).
//
// Dezelfde lezers als de Studio (eaLezers.js), dezelfde merge op EA-GUID
// (vergelijkImport.js) en dezelfde projectboom (eaProjectboom.js). De stand
// van het project komt van de server: snapshot (werkbestand) + operaties
// erna, nagespeeld in node-stores. Het verschil gaat als operaties naar het
// operatielog; open Studio's krijgen het via SSE/poll binnen.
//
// Gebruik (vanuit web/vite):
//   npm run importeer-qea -- --qea <pad.qea> --pakket <id|"Model / Zandbak MW"> --project <id>
//        [--api http://localhost:8080] [--gebruiker u --wachtwoord w | --token <jwt>]
//        [--map "Import / GGM"] [--verdwenen-verwijderen] [--droog] [--verslag uit.json]
//   npm run importeer-qea -- --qea <pad.qea> --lijst-pakketten [--json]
//   npm run importeer-qea -- --alleen-snapshot --project <id>   (alleen compacteren: stand naar een snapshot)
//   (--bron <fixture.qea.json> i.p.v. --qea: de al gelezen bron, voor tests)
// Na een import met operaties maakt de sidecar zelf een snapshot (stand t/m het laatste
// volgnummer), zodat wie later laadt een werkbestand krijgt i.p.v. alle operaties na te
// spelen (Mark, 10-10: de Zandbak bevroor de Studio). --geen-snapshot slaat dat over.
// Omgevingsvariabelen: OMNIUM_API, OMNIUM_GEBRUIKER, OMNIUM_WACHTWOORD, OMNIUM_TOKEN.
// Exitcode 0 = klaar (ook als er niets te doen was), 1 = fout.

import { readFileSync, writeFileSync } from "node:fs";
import { openQea, leesPakketten, leesBron } from "../src/diagramprofielen/ea/qeaLezer.js";
import { pakketPad } from "../src/diagramprofielen/ea/qeaHulp.js";
import { maakStand, speelOpsNa, importeerInStand, bouwBatches, bouwWerkbestand, SIDECAR_CLIENT_ID } from "../src/diagramprofielen/ea/sidecarImport.js";

function leesArgs(argv) {
  const uit = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { uit._.push(a); continue; }
    const naam = a.slice(2);
    const volgende = argv[i + 1];
    if (volgende === undefined || volgende.startsWith("--")) uit[naam] = true;
    else { uit[naam] = volgende; i++; }
  }
  return uit;
}

const args = leesArgs(process.argv.slice(2));
const env = process.env;
const api = String(args.api || env.OMNIUM_API || "http://localhost:8080").replace(/\/+$/, "");
const droog = !!args.droog;

function fout(bericht, code = 1) {
  console.error(`FOUT: ${bericht}`);
  process.exit(code);
}

// ── HTTP-client met cookie-auth (de api zet het JWT in een httpOnly cookie) ──
let cookie = "";
async function roep(pad, { methode = "GET", body } = {}) {
  const resp = await fetch(`${api}${pad}`, {
    method: methode,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const tekst = await resp.text();
  let json = null;
  try { json = tekst ? JSON.parse(tekst) : null; } catch { /* geen JSON */ }
  if (!resp.ok) throw new Error(`${methode} ${pad} → ${resp.status}${json?.error ? `: ${json.error}` : ""}`);
  return { json, resp };
}

async function login() {
  const token = args.token || env.OMNIUM_TOKEN;
  if (token) { cookie = `bitemp_token=${token}`; return "token"; }
  const gebruiker = args.gebruiker || env.OMNIUM_GEBRUIKER;
  const wachtwoord = args.wachtwoord || env.OMNIUM_WACHTWOORD;
  if (!gebruiker) return "geen"; // AUTH_ENABLED=false lokaal
  const { resp } = await roep("/api/auth/login", { methode: "POST", body: { gebruikersnaam: gebruiker, wachtwoord } });
  const setCookie = resp.headers.getSetCookie?.() || [resp.headers.get("set-cookie") || ""];
  const m = setCookie.map((c) => c.match(/bitemp_token=([^;]+)/)).find(Boolean);
  if (!m) throw new Error("Login gaf geen bitemp_token-cookie.");
  cookie = `bitemp_token=${m[1]}`;
  return gebruiker;
}

// ── Bron: .qea (sql.js) of een al gelezen bron (fixture) ──
async function leesBronEnPakket() {
  if (args.bron) {
    const bron = JSON.parse(readFileSync(String(args.bron), "utf8"));
    const pakketten = bron.t_package || [];
    if (args["lijst-pakketten"]) lijstPakketten(pakketten);
    const packageId = kiesPakket(pakketten, args.pakket);
    return { bron, packageId, pakketLabel: pakketPad(pakketten, packageId) };
  }
  if (!args.qea) fout("Geef --qea <bestand.qea> (of --bron <fixture.qea.json>).");
  const db = await openQea(readFileSync(String(args.qea)));
  try {
    const pakketten = leesPakketten(db);
    if (args["lijst-pakketten"]) lijstPakketten(pakketten);
    const packageId = kiesPakket(pakketten, args.pakket);
    return { bron: leesBron(db, packageId), packageId, pakketLabel: pakketPad(pakketten, packageId) };
  } finally {
    db.close();
  }
}

/** `--lijst-pakketten`: alle pakketten op pad; `--json` geeft [{id, pad}] (voor de api). Stopt het proces. */
function lijstPakketten(pakketten) {
  const gesorteerd = [...pakketten].sort((a, b) => pakketPad(pakketten, a.Package_ID).localeCompare(pakketPad(pakketten, b.Package_ID)));
  if (args.json) {
    console.log(JSON.stringify(gesorteerd.map((p) => ({ id: p.Package_ID, pad: pakketPad(pakketten, p.Package_ID) }))));
  } else {
    for (const p of gesorteerd) console.log(`${String(p.Package_ID).padStart(6)}  ${pakketPad(pakketten, p.Package_ID)}`);
  }
  process.exit(0);
}

/** `--pakket`: een Package_ID, of (het einde van) een pad "Model / Zandbak MW". */
function kiesPakket(pakketten, keuze) {
  if (keuze === undefined || keuze === true) fout("Geef --pakket <Package_ID of pad> (zie --lijst-pakketten).");
  const s = String(keuze).trim();
  if (/^\d+$/.test(s)) {
    if (!pakketten.some((p) => p.Package_ID === Number(s))) fout(`Pakket ${s} bestaat niet in dit bestand.`);
    return Number(s);
  }
  const laag = s.toLowerCase();
  const kandidaten = pakketten.filter((p) => {
    const pad = pakketPad(pakketten, p.Package_ID).toLowerCase();
    return pad === laag || pad.endsWith(` / ${laag}`) || pad.endsWith(laag);
  });
  if (kandidaten.length === 1) return kandidaten[0].Package_ID;
  if (!kandidaten.length) fout(`Geen pakket met pad "${s}" (zie --lijst-pakketten).`);
  fout(`Pad "${s}" is niet eenduidig: ${kandidaten.map((p) => `${p.Package_ID} = ${pakketPad(pakketten, p.Package_ID)}`).join("; ")}`);
}

// ── Serverstand: snapshot + operaties erna ──
async function haalStand(projectId) {
  const { json: project } = await roep(`/api/studio/projecten/${encodeURIComponent(projectId)}`);
  const stand = maakStand(project.inhoud || {});
  const r = await speelNaVanaf(stand, projectId, Number(project.tot_volgnummer || 0));
  return { stand, project, nagespeeld: r.nagespeeld, problemen: r.problemen, laatsteVolgnummer: r.laatste };
}

/** Operaties na `vanaf` ophalen en naspelen (optioneel eigen operaties overslaan). */
async function speelNaVanaf(stand, projectId, vanaf, { behalveClient = null } = {}) {
  let meer = true;
  let nagespeeld = 0;
  const problemen = [];
  while (meer) {
    const { json } = await roep(`/api/studio/projecten/${encodeURIComponent(projectId)}/ops?vanaf=${vanaf}&limiet=5000`);
    const ops = json?.ops || [];
    const r = speelOpsNa(stand, behalveClient ? ops.filter((o) => o.clientId !== behalveClient) : ops);
    nagespeeld += r.toegepast;
    problemen.push(...r.problemen);
    vanaf = json?.laatste ?? vanaf;
    meer = !!json?.meer && ops.length > 0;
  }
  return { nagespeeld, problemen, laatste: vanaf };
}

/**
 * Snapshot: het werkbestand van de stand t/m `tot` naar de server (PUT met
 * versiecontrole en tot_volgnummer; de server ruimt het log t/m die grens op).
 */
async function maakSnapshot(projectId, stand, project, tot) {
  const inhoud = bouwWerkbestand(stand, { id: project.id, naam: project.naam });
  const tekst = JSON.stringify(inhoud);
  if (tekst.length > 100 * 1024 * 1024) {
    return { gemaakt: false, reden: `werkbestand ${(tekst.length / 1e6).toFixed(1)} MB > 100 MB (servergrens studioProjectInhoudMax)`, bytes: tekst.length };
  }
  try {
    const { json } = await roep(`/api/studio/projecten/${encodeURIComponent(projectId)}`, {
      methode: "PUT",
      body: { naam: project.naam, inhoud, versie: project.versie, tot_volgnummer: tot },
    });
    return { gemaakt: true, versie: json?.versie, totVolgnummer: json?.tot_volgnummer, bytes: tekst.length };
  } catch (e) {
    return { gemaakt: false, reden: e?.message || String(e), bytes: tekst.length };
  }
}

(async () => {
  const projectId = args.project || env.OMNIUM_PROJECT;
  if (!projectId && !args["lijst-pakketten"]) fout("Geef --project <id> (het serverproject).");
  if (args["alleen-snapshot"]) {
    await login();
    for (let poging = 1; poging <= 3; poging++) {
      const { stand, project, nagespeeld, problemen, laatsteVolgnummer } = await haalStand(String(projectId));
      const snap = await maakSnapshot(String(projectId), stand, project, laatsteVolgnummer);
      if (snap.gemaakt || !/409/.test(snap.reden || "") || poging === 3) {
        console.log(JSON.stringify({ project: project.id, nagespeeld, problemen, laatsteVolgnummer, snapshot: snap }, null, 2));
        // Geen process.exit(): op Windows breekt dat open fetch-verbindingen hard af (libuv-assert).
        process.exitCode = snap.gemaakt ? 0 : 1;
        return;
      }
    }
  }
  const { bron, packageId, pakketLabel } = await leesBronEnPakket();

  const wie = await login();
  const { stand, project, nagespeeld, problemen, laatsteVolgnummer } = await haalStand(String(projectId));
  const { ops, verslag } = importeerInStand(stand, bron, {
    packageId,
    doelPad: args.map ? String(args.map) : "",
    verdwenenVerwijderen: !!args["verdwenen-verwijderen"],
  });
  const batches = bouwBatches(ops);
  const uit = {
    project: { id: project.id, naam: project.naam, versie: project.versie, snapshotTot: project.tot_volgnummer || 0, nagespeeld, laatsteVolgnummer },
    pakket: { id: packageId, pad: pakketLabel },
    ingelogd: wie,
    ...verslag,
    operaties: ops.length,
    batches: batches.length,
    bytes: batches.reduce((n, b) => n + b.bytes, 0),
    problemenBijNaspelen: problemen,
    droog,
  };
  if (!droog && ops.length) {
    const toegekend = [];
    for (const b of batches) {
      const { json } = await roep(`/api/studio/projecten/${encodeURIComponent(String(projectId))}/ops`, {
        methode: "POST",
        body: { clientId: SIDECAR_CLIENT_ID, ops: b.ops },
      });
      toegekend.push([json?.van, json?.tot]);
    }
    uit.volgnummers = toegekend;
    if (!args["geen-snapshot"]) {
      // Wat anderen intussen deden er nog bij (onze eigen operaties zitten al in de stand),
      // dan een snapshot t/m het laatste nummer. 409 = een ander was eerder: stand opnieuw.
      let snap = null;
      let p = project;
      let st = stand;
      let vanaf = laatsteVolgnummer;
      for (let poging = 1; poging <= 3; poging++) {
        const r = await speelNaVanaf(st, String(projectId), vanaf, { behalveClient: SIDECAR_CLIENT_ID });
        snap = await maakSnapshot(String(projectId), st, p, r.laatste);
        if (snap.gemaakt || !/409/.test(snap.reden || "")) break;
        const vers = await haalStand(String(projectId));
        p = vers.project;
        st = vers.stand;
        vanaf = vers.laatsteVolgnummer;
      }
      uit.snapshot = snap;
    }
  }
  if (args.verslag) writeFileSync(String(args.verslag), JSON.stringify(uit, null, 2));
  console.log(JSON.stringify(uit, null, 2));
  if (droog) console.error(`(droog: ${ops.length} operaties in ${batches.length} batches niet verstuurd)`);
})().catch((e) => fout(e?.stack || e?.message || String(e)));
