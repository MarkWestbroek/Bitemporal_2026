// maak_voorbeelden.mjs — de voorbeelden voor de ODRL-viewer van de werkgroep FTV.
//
// Per beleid in beleid/*.toegangsspraak:
//   uit/<naam>.viewer.ttl    de export "Toegangsspraak → ODRL (ODRL-AP-NL)":
//                            graafbeeld → regelset → schrijver (docs/TRANSFORMATIES.md)
//   uit/<naam>.odrl.jsonld   wat de editor vandaag exporteert (odrl.js), ter vergelijking
//
// Dit script is alleen de runner: het leest de teksten, geeft het model mee
// waar we er een hebben, en hangt bij het GBO-beleid de uitvoering eraan (de
// uit dezelfde ODRL gegenereerde Rego-modules) als realisatie. De vertaling
// zelf staat in web/vite/src/toegangsspraak/.
//
// Gebruik: node scripts/maak_voorbeelden.mjs   (vanuit authz/odrl-viewer-voorbeelden)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseBeleid } from "../../../web/vite/src/toegangsspraak/parser.js";
import { naarOdrl } from "../../../web/vite/src/toegangsspraak/odrl.js";
import { toegangsspraakNaarOdrl } from "../../../web/vite/src/toegangsspraak/odrlExport.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.resolve(HIER, "..");
const GBO = path.resolve(MAP, "../gbo-voorbeeld");

// ── Model (V3): padresolutie en de veldenlaag, waar we een model hebben ──────
function modelHulp(v3Pad) {
  const ruw = JSON.parse(fs.readFileSync(v3Pad, "utf8"));
  const model = ruw.model || ruw;
  const entiteit = (naam) => model.entiteiten.find((e) => e.typenaam.toLowerCase() === naam.toLowerCase());
  return {
    /** "Persoon.inkomens" → "Persoon.Inkomen" */
    resolveerPad(pad) {
      const delen = pad.split(".");
      const ent = entiteit(delen[0]);
      if (!ent) return pad;
      const uit = [ent.typenaam];
      if (delen.length > 1) {
        const d = delen[1].toLowerCase();
        const ge = (ent.gegevenselementen || []).find((g) =>
          [g.naam, g.meervoud, g.runtime?.veldnaam, g.runtime?.padnaam].filter(Boolean).some((n) => n.toLowerCase() === d)
        );
        if (!ge) return pad;
        uit.push(ge.naam);
        if (delen.length > 2) {
          const veld = (ge.velden || []).find((v) => v.naam.toLowerCase() === delen[2].toLowerCase());
          if (!veld) return pad;
          uit.push(veld.naam);
        }
      }
      return uit.join(".");
    },
    /** De delen direct onder een pad: gegevenselementen van een entiteit, velden van een gegevenselement. */
    kinderenVan(pad) {
      const [e, g] = pad.split(".");
      const ent = entiteit(e);
      if (!ent) return [];
      if (!g) return (ent.gegevenselementen || []).map((x) => `${ent.typenaam}.${x.naam}`);
      const ge = (ent.gegevenselementen || []).find((x) => x.naam === g);
      return ge && pad.split(".").length === 2 ? (ge.velden || []).map((v) => `${ent.typenaam}.${ge.naam}.${v.naam}`) : [];
    },
  };
}

// ── Realisatie (Visualisation Note §7): de gegenereerde Rego per regel ───────
// Een tweede bron naast de beleidstekst: wat authz/gbo-voorbeeld/scripts/
// compiler.py uit dezelfde ODRL maakte. Per regel een artefact en een anker
// (de voorwaarde "het verzoek voldoet aan de module"); het anker realiseert de
// regel en de voorwaarden die de module echt toetst. De doelbinding van het
// beleid zit niet in de Rego en blijft dus zichtbaar als niet gerealiseerd.
const REALISATIE_REGELS = [
  {
    naam: "Rego-module",
    bij: "knoop",
    als: { aard: "artefact" },
    maak: {
      type: "apnl:RegoModule",
      data: {
        "rdf:type": { iri: "schema:SoftwareSourceCode" },
        "dct:identifier": "{identifier}",
        "schema:programmingLanguage": "Rego",
        "dct:format": "application/vnd.rego",
        "apnl:entrypoint": "{entrypoint}",
        "apnl:sha256": "{sha256}",
        "rdfs:comment": "{opmerking}",
      },
    },
  },
  {
    naam: "Anker naar de uitvoering",
    bij: "knoop",
    als: { aard: "anker" },
    maak: {
      type: "odrl:Constraint",
      data: { "rdf:type": { iri: "dpv:TechnicalMeasure" }, "odrl:leftOperand": { iri: "apnl:verwerkingsverzoek" }, "odrl:operator": { iri: "apnl:conformsToPolicy" } },
    },
  },
  { naam: "Het anker wijst de module aan", bij: "verbinding", als: { aard: "voldoet-aan" }, maak: { type: "odrl:rightOperand" } },
  { naam: "De uitvoering realiseert", bij: "verbinding", als: { aard: "realiseert" }, maak: { type: "prov:wasDerivedFrom" } },
];

function regoRealisatie(graaf) {
  const knopen = [];
  const verbindingen = [];
  for (const regel of graaf.knopen.filter((k) => k.aard === "regel")) {
    const rs = regel.id.replace(/^regel-/, "");
    const bestand = path.join(GBO, "bundel", "pj", "rules", `${rs}.rego`);
    if (!fs.existsSync(bestand)) continue;
    const handeling = `handeling-${rs}`;
    const artefact = `rego-${rs}`;
    const anker = `anker-${rs}`;
    knopen.push(
      {
        id: artefact,
        aard: "artefact",
        tekst: `Rego-module "${regel.tekst}" (gegenereerd uit dit beleid)`,
        identifier: `rules/${rs}.rego`,
        entrypoint: `data.rules["${rs}"].allow`,
        sha256: crypto.createHash("sha256").update(fs.readFileSync(bestand, "utf8").replace(/\r\n/g, "\n")).digest("hex"),
        opmerking:
          "Gegenereerd door authz/gbo-voorbeeld/scripts/compiler.py uit dezelfde ODRL; draait op het vaste ftv/graphql.rego van het FTV GraphQL-profiel. De doelbinding van het beleid zit er niet in: het voorbeeldverzoek draagt geen doel.",
      },
      { id: anker, aard: "anker", tekst: `het verzoek voldoet aan de Rego-module "${regel.tekst}"` }
    );
    const verbind = (aard, bron, doel) => verbindingen.push({ id: `${aard}:${bron}>${doel}`, aard, bron, doel, label: aard });
    verbind("als", handeling, anker);
    verbind("voldoet-aan", anker, artefact);
    verbind("realiseert", anker, regel.id);
    for (const v of graaf.verbindingen) {
      if (v.aard === "als" && (v.bron === regel.id || v.bron === handeling) && v.herkomst !== "beleid") verbind("realiseert", anker, v.doel);
    }
  }
  return { knopen, verbindingen };
}

// ── De voorbeelden ───────────────────────────────────────────────────────────
const VOORBEELDEN = [
  { naam: "schuldhulp", modelNaam: "voorbeeld" },
  { naam: "np-loc-demo", modelNaam: "np-loc" },
  {
    naam: "gbo-persoon",
    modelNaam: "gbo",
    ...modelHulp(path.join(GBO, "model", "gbo-persoon — v3-model.json")),
    aanvulling: regoRealisatie,
    extraRegels: REALISATIE_REGELS,
  },
];

fs.mkdirSync(path.join(MAP, "uit"), { recursive: true });
let fout = false;
for (const v of VOORBEELDEN) {
  const tekst = fs.readFileSync(path.join(MAP, "beleid", `${v.naam}.toegangsspraak`), "utf8").replace(/\r\n/g, "\n");
  const uit = toegangsspraakNaarOdrl(tekst, { ...v, uitgegeven: "2026-10-05", bron: `beleid/${v.naam}.toegangsspraak` });
  if (!uit.ok) {
    console.error(v.naam, uit.diagnostics);
    fout = true;
    continue;
  }
  fs.writeFileSync(path.join(MAP, "uit", `${v.naam}.viewer.ttl`), uit.turtle);
  fs.writeFileSync(path.join(MAP, "uit", `${v.naam}.odrl.jsonld`), JSON.stringify(naarOdrl(parseBeleid(tekst).beleid), null, 2) + "\n");
  const acties = {};
  for (const spoor of uit.trace) acties[spoor.actie] = (acties[spoor.actie] || 0) + 1;
  const verlies = uit.trace.filter((s) => s.actie === "geen-regel" || s.actie === "overgeslagen");
  console.log(`${v.naam}: ${Object.entries(acties).map(([a, n]) => `${n} ${a}`).join(", ")} → uit/${v.naam}.viewer.ttl (${uit.turtle.split("\n").length} regels)`);
  for (const s of verlies) console.log(`   ! ${s.actie}: ${s.soort} ${s.bronId}`);
  for (const d of uit.diagnostics.filter((x) => x.severity !== "info")) console.log(`   ${d.severity}: ${d.message}`);
  if (verlies.length) fout = true;
}
process.exit(fout ? 1 : 0);
