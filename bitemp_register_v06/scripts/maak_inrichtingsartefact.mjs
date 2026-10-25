#!/usr/bin/env node
// maak_inrichtingsartefact.mjs — runner voor de inrichting van e-diensten:
// genereert één artefact uit het canonieke model + het e-dienst-
// inrichtingsmodel, in de vorm die het inrichting-register op Fundament
// verwacht (docs/TRANSFORMATIES.md §11). Registreren en uitrollen doet
// FUNDAMENT met het bestand dat hier ontstaat.
//
// De vertaling zelf staat in web/vite/src/ (v3Graaf → regelset → schrijver);
// dit script leest alleen bestanden, roept de transformatie aan en schrijft.
//
// Gebruik (vanuit bitemp_register_v06):
//   node scripts/maak_inrichtingsartefact.mjs \
//     --model <V3-model.json> --edienst <edienst.json> --artefact aanvraag \
//     [--peiltijdstip 2026-10-25T06:51:13Z] [--referentielijst Aanvraagtype=<items.json>] \
//     [--doel <handgemaakt artefact.json>] [--uit <artefact.json>]
//
// Met --doel vergelijkt het de payload met een bestaand (handgemaakt)
// artefact: gelijke hash = "ongewijzigd" bij de uitrol; anders een lijst met
// de verschillen (JSON-Pointer-paden). Exitcode 0 bij gelijk of zonder --doel,
// 2 bij verschillen, 1 bij een fout.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { maakObjecttypeArtefact, verschillen } from "../web/vite/src/diagramprofielen/canoniek-uml/objecttypeArtefact.js";
import { jcsHash } from "../web/vite/src/transformatie/jcs.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DATATYPEN = path.resolve(HIER, "../testdata/gegevenstypen.json");

function argumenten(argv) {
  const uit = { referentielijst: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const sleutel = argv[i].replace(/^--/, "");
    const waarde = argv[i + 1];
    if (!argv[i].startsWith("--") || waarde === undefined) throw new Error(`Onverwacht argument: ${argv[i]}`);
    if (sleutel === "referentielijst") uit.referentielijst.push(waarde);
    else uit[sleutel] = waarde;
    i += 1;
  }
  for (const verplicht of ["model", "edienst", "artefact"]) if (!uit[verplicht]) throw new Error(`--${verplicht} ontbreekt`);
  return uit;
}

const lees = (pad) => JSON.parse(fs.readFileSync(pad, "utf8"));
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

async function main() {
  const a = argumenten(process.argv.slice(2));
  const referentielijsten = {};
  for (const spec of a.referentielijst) {
    const [naam, bestand] = spec.split("=");
    const inhoud = lees(bestand);
    referentielijsten[naam] = Array.isArray(inhoud) ? inhoud : inhoud.items || [];
  }
  const { artefact, diagnostics } = await maakObjecttypeArtefact({
    modelBestand: lees(a.model),
    edienst: lees(a.edienst),
    identifier: a.artefact,
    datatypen: lees(DATATYPEN).datatypes,
    referentielijsten,
    peiltijdstip: a.peiltijdstip || null,
    sha256Hex,
  });

  const uitPad = a.uit || path.resolve(process.cwd(), `${a.artefact}.artefact.json`);
  fs.mkdirSync(path.dirname(uitPad), { recursive: true });
  fs.writeFileSync(uitPad, `${JSON.stringify(artefact, null, 2)}\n`, "utf8");
  console.log(`Artefact geschreven: ${uitPad}`);
  console.log(`  payloadHash  ${artefact.artefactInhoud.payloadHash}`);
  console.log(`  bronmodel    ${artefact.artefactHerkomst.bronmodelHash}`);
  for (const d of diagnostics) console.log(`  ${d.severity} ${d.code}: ${d.message}`);

  if (!a.doel) return 0;
  const doel = lees(a.doel);
  const doelHash = jcsHash(doel, sha256Hex);
  if (doelHash === artefact.artefactInhoud.payloadHash) {
    console.log(`Gelijk aan ${a.doel} (sha256 over JCS ${doelHash}): de uitrol geeft "ongewijzigd".`);
    return 0;
  }
  const lijst = verschillen(artefact.artefactInhoud.payload, doel);
  console.log(`Verschilt van ${a.doel} (doel ${doelHash}), ${lijst.length} verschil(len):`);
  for (const v of lijst) {
    const waarden = v.soort === "anders" ? `${JSON.stringify(v.gegenereerd)} ≠ ${JSON.stringify(v.doel)}` : JSON.stringify(v.gegenereerd ?? v.doel);
    console.log(`  ${v.soort.padEnd(19)} ${v.pad}  ${waarden}`);
  }
  return 2;
}

main().then(
  (code) => process.exit(code),
  (fout) => {
    console.error(`Fout: ${fout.message}`);
    for (const d of fout.diagnostics || []) console.error(`  ${d.severity} ${d.code}: ${d.message}`);
    process.exit(1);
  }
);
