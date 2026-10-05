// odrlExport.test.js — de export "Toegangsspraak → ODRL (ODRL-AP-NL)":
// graafbeeld (graaf.js) → regelset (odrlApNlRegels.js) → schrijver (Turtle).
// Run: node --import ./test/register-aliases.mjs --test src/toegangsspraak/odrlExport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { parseBeleid } from "./parser.js";
import { VOORBEELD_BELEID } from "./voorbeeld.js";
import { beleidNaarGraaf } from "./graaf.js";
import { TOEGANGSSPRAAK_NAAR_ODRL_AP_NL } from "./odrlApNlRegels.js";
import { toegangsspraakNaarOdrl } from "./odrlExport.js";
import { valideerRegelset, pasRegelsToe } from "../transformatie/regels.js";

// De FTV-demo (15 september 2026): relatieketen, eigen vergelijking, verbod.
const DEMO_BELEID = `Beleid "Persoonsgegevens np-loc demo".
  Geldig vanaf 15 september 2026.
  Grondslag: de Gemeentewet.
  Doel: "dienstverlening".

  Begrippen.
    Een medewerker is: iemand met rol "medewerker".
    Een medewerker West is: iemand met rol "medewerker" en afdeling "West".
    Een telefoonmedewerker is: iemand met rol "medewerker" en kanaal "telefoon".
    De persoonsgegevens zijn: alle gegevens van een natuurlijk persoon.

  Regel "inzage eigen stadsdeel".
    Een medewerker West mag de persoonsgegevens bekijken
    als de wijk van de woonlocatie van de betrokkene "Stadsdeel West" is.

  Regel "avonddienst gemeentebreed".
    Een medewerker mag de persoonsgegevens bekijken
    als de dienst van de aanvrager "avond" is.

  Regel "geen geslacht aan de telefoon".
    Een telefoonmedewerker mag het geslacht van een natuurlijk persoon niet bekijken.

  Regel "aanspreken zonder geslacht".
    Een telefoonmedewerker mag de aanspreektitel van de aanspraak van een natuurlijk persoon bekijken
    als de aanspreektitel van de aanspraak van de betrokkene bekend is.
`;

// Het GBO-voorbeeld: bestaansvraag, argument-voorwaarde, begrip voor gegevens.
const GBO_BELEID = `Beleid "GBO persoon".
  Doel: "inkomensverstrekking".

  Begrippen.
    Een afnemer is: iemand met rol "afnemer".
    Een geautoriseerde afnemer is: iemand met autorisatie "naam-en-adres".
    Inkomensgegevens zijn: alle gegevens van het inkomen van een persoon.

  Regel "persoon op bsn".
    Een afnemer mag alle gegevens van een persoon bekijken
    als er een toestemming voor de betrokkene is.

  Regel "inkomens tot en met 2024".
    Een afnemer mag de inkomens van een persoon bekijken
    als het jaar van de aanvraag ten hoogste 2024 is.

  Regel "inkomen velden".
    Een geautoriseerde afnemer mag de inkomensgegevens bekijken.
`;

// Geneste voorwaarden, lijst, datum, plicht, inline-wie.
const RIJK_BELEID = `Beleid "Rijk".

  Regel "genest".
    Iemand met rol "beheerder" mag de naam van een natuurlijk persoon veranderen
    als aan alle volgende voorwaarden is voldaan:
      - het kanaal van de aanvraag is een van ("balie", "post");
      - aan ten minste één van de volgende voorwaarden is voldaan:
        - de geboortedatum van de betrokkene is kleiner dan 1 januari 2000;
        - de leeftijd van de betrokkene is ten minste 67;
    waarbij: de reden van de wijziging wordt vastgelegd bij de registratie.
`;

const VOORBEELDEN = { schuldhulp: VOORBEELD_BELEID, demo: DEMO_BELEID, gbo: GBO_BELEID, rijk: RIJK_BELEID };
const OPTIES = { uitgegeven: "2026-10-05", modelNaam: "voorbeeld", bron: "beleid/schuldhulp.toegangsspraak" };
const GOUDEN = fileURLToPath(new URL("./fixtures/inzage-inkomen-bij-schuldhulp.odrl-ap-nl.ttl", import.meta.url));

const blok = (turtle, subject) => turtle.split("\n\n").find((b) => b.startsWith(`${subject} `)) || "";

test("regelset: geldig, met id en titel volgens de afspraak", () => {
  assert.deepEqual(valideerRegelset(TOEGANGSSPRAAK_NAAR_ODRL_AP_NL), []);
  assert.equal(TOEGANGSSPRAAK_NAAR_ODRL_AP_NL.id, "toegangsspraak-naar-odrl-ap-nl");
  assert.equal(TOEGANGSSPRAAK_NAAR_ODRL_AP_NL.bron, "toegangsspraak");
});

test("dekking: op alle voorbeelden krijgt elk onderdeel een regel en gaat niets verloren", () => {
  for (const [naam, tekst] of Object.entries(VOORBEELDEN)) {
    const uit = toegangsspraakNaarOdrl(tekst, OPTIES);
    assert.ok(uit.ok, `${naam} parseert`);
    const verlies = uit.trace.filter((s) => s.actie === "geen-regel" || s.actie === "overgeslagen");
    assert.deepEqual(verlies, [], `${naam}: niets zonder regel`);
    assert.deepEqual(uit.diagnostics.filter((d) => d.severity !== "info"), [], `${naam}: geen waarschuwingen`);
    // Alleen de termen die ODRL al kent vallen bewust weg.
    assert.ok(uit.trace.filter((s) => s.actie === "genegeerd").every((s) => s.regel === "Term die ODRL of ODRL-AP-NL al kent"), naam);
  }
});

test("gouden bestand: het voorbeeldbeleid geeft exact de vastgelegde Turtle", () => {
  const { turtle } = toegangsspraakNaarOdrl(VOORBEELD_BELEID, OPTIES);
  if (process.env.SCHRIJF_GOUDEN) fs.writeFileSync(GOUDEN, turtle);
  assert.equal(turtle, fs.readFileSync(GOUDEN, "utf8").replace(/\r\n/g, "\n"));
});

test("graafbeeld: een voorwaarde over het verzoek hangt aan de handeling, over de gegevens aan de regel", () => {
  const graaf = beleidNaarGraaf(parseBeleid(VOORBEELD_BELEID).beleid);
  const als = graaf.verbindingen.filter((v) => v.aard === "als").map((v) => `${v.bron} → ${v.doel} (${v.herkomst})`);
  assert.deepEqual(als, [
    "handeling-inzage-bij-lopend-dossier → vw-aanvrager-rol-schuldhulpverlener (begrip)",
    "handeling-inzage-bij-lopend-dossier → vw-doel-schuldhulpverlening (regel)",
    "regel-inzage-bij-lopend-dossier → vw-de-achternaam-van-de-naam-van-de-betrokkene-begint-met-a (regel)",
    "handeling-geen-export → vw-aanvrager-rol-schuldhulpverlener (begrip)",
  ]);
  // De doelbinding uit de regel en die van het beleid zijn dezelfde knoop; een
  // verbod krijgt hem niet (het geldt ongeacht het doel).
  assert.equal(graaf.knopen.filter((k) => k.id.startsWith("vw-doel-")).length, 1);
  const perId = Object.fromEntries(graaf.knopen.map((k) => [k.id, k]));
  assert.deepEqual(perId["vw-de-achternaam-van-de-naam-van-de-betrokkene-begint-met-a"].waarde, { letterlijk: "A" }, "getypeerde waarde, geen notatie");
  assert.equal(perId["vw-doel-schuldhulpverlening"].waarde, undefined, "een begrip als waarde is een verbinding");
  assert.ok(graaf.verbindingen.some((v) => v.aard === "waarde" && v.bron === "vw-doel-schuldhulpverlening" && v.doel === "doel-schuldhulpverlening"));
  assert.ok(graaf.knopen.every((k) => k.aard && typeof k.tekst === "string"), "elke knoop heeft een aard en een zinsnede");
});

test("ODRL: toestemming, verbod, plicht en de keuzes van ODRL-AP-NL", () => {
  const { turtle } = toegangsspraakNaarOdrl(VOORBEELD_BELEID, OPTIES);
  const regel = blok(turtle, "b:regel-inzage-bij-lopend-dossier");
  assert.match(regel, /a odrl:Permission ;\n {4}dct:title "inzage bij lopend dossier"@nl ;\n {4}odrl:uid b:regel-inzage-bij-lopend-dossier ;/);
  assert.match(regel, /dct:description "Een schuldhulpverlener mag de inkomensgegevens bekijken als /, "de oorspronkelijke zin reist mee");
  assert.match(regel, /odrl:constraint b:vw-de-achternaam-van-de-naam-van-de-betrokkene-begint-met-a ;/);
  assert.match(regel, /odrl:duty b:plicht-elke-raadpleging-wordt-vastgelegd-in-het-logboek \./);
  // bekijken = odrl:read; rol en doel zijn verfijningen op de handeling.
  assert.match(blok(turtle, "b:handeling-inzage-bij-lopend-dossier"), /rdf:value odrl:read ;\n {4}odrl:refinement b:vw-aanvrager-rol-schuldhulpverlener , b:vw-doel-schuldhulpverlening \./);
  assert.match(blok(turtle, "b:vw-aanvrager-rol-schuldhulpverlener"), /odrl:leftOperand apnl:rolAanvrager ;\n {4}odrl:operator odrl:eq ;\n {4}odrl:rightOperand "schuldhulpverlener" \./);
  assert.match(blok(turtle, "b:vw-doel-schuldhulpverlening"), /odrl:leftOperand odrl:purpose ;\n {4}odrl:operator odrl:eq ;\n {4}odrl:rightOperand b:doel-schuldhulpverlening \./);
  // Het verbod: eigen handeling als term, geen doelbinding.
  assert.match(blok(turtle, "b:handeling-geen-export"), /rdf:value ts:exporteren ;\n {4}odrl:refinement b:vw-aanvrager-rol-schuldhulpverlener \./);
  assert.match(blok(turtle, "ts:exporteren"), /a odrl:Action , skos:Concept ;\n {4}rdfs:label "exporteren"@nl ;\n {4}odrl:includedIn odrl:use \./);
  // Eigen vergelijking en operand krijgen het woord uit de klare taal als label.
  assert.match(blok(turtle, "ts:begintMet"), /rdfs:label "begint met"@nl/);
  assert.match(blok(turtle, "ts:betrokkene.naam.achternaam"), /rdfs:label "de achternaam van de naam van de betrokkene"@nl/);
  assert.ok(!turtle.includes("ts:bekijken") && !turtle.includes("ts:aanvrager.rol"), "wat ODRL al kent krijgt geen eigen term");
  // Beleid: geldigheid, grondslag, conflictregel.
  const set = blok(turtle, "b:beleid");
  assert.match(set, /schema:validFrom "2026-05-01"\^\^xsd:date/);
  assert.match(set, /dct:issued "2026-10-05"\^\^xsd:date/);
  assert.match(set, /odrl:profile apnl:profiel , ts:profiel/);
  assert.match(set, /dpv:hasLegalBasis b:grondslag ;\n {4}odrl:permission b:regel-inzage-bij-lopend-dossier ;\n {4}odrl:prohibition b:regel-geen-export \./);
  assert.ok(!set.includes("validThrough"), "geen einddatum, geen triple");
});

test("ODRL: groep door kenmerken, register als partOf-hiërarchie, bestaansvraag en argument", () => {
  const demo = toegangsspraakNaarOdrl(DEMO_BELEID, OPTIES).turtle;
  assert.match(blok(demo, "b:groep-medewerker-west"), /a odrl:PartyCollection ;[\s\S]*odrl:refinement b:vw-aanvrager-rol-medewerker , b:vw-aanvrager-afdeling-west \./);
  assert.match(blok(demo, "b:vw-aanvrager-kanaal-telefoon"), /rdfs:label "het kanaal van de aanvrager is \\"telefoon\\""@nl/, "het goede lidwoord");
  assert.match(blok(demo, "b:vw-de-aanspreektitel-van-de-aanspraak-van-de-betrokkene-is-bekend"), /odrl:operator ts:isBekend ;\n {4}odrl:rightOperand true \./);
  assert.match(blok(demo, "reg:NatuurlijkPersoon.geslacht"), /a odrl:Asset , ts:Gegevenselement ;[\s\S]*odrl:partOf reg:NatuurlijkPersoon \./);

  // Met een model erbij: het pad uit de tekst wordt het pad in het model, en de velden komen mee.
  const model = { Persoon: { Naam: ["naam"], Adres: ["straat", "plaats"], Inkomen: ["jaar", "bedrag"] } };
  const gbo = toegangsspraakNaarOdrl(GBO_BELEID, {
    ...OPTIES,
    modelNaam: "gbo",
    resolveerPad: (pad) => pad.replace(/\.inkomens?$/i, ".Inkomen"),
    kinderenVan: (pad) => {
      const [e, g] = pad.split(".");
      if (!model[e]) return [];
      return g ? (pad.split(".").length === 2 ? (model[e][g] || []).map((v) => `${pad}.${v}`) : []) : Object.keys(model[e]).map((x) => `${e}.${x}`);
    },
  }).turtle;
  assert.match(blok(gbo, "reg:Persoon.Inkomen.jaar"), /a odrl:Asset , ts:Veld ;[\s\S]*odrl:partOf reg:Persoon\.Inkomen \./);
  assert.match(blok(gbo, "reg:Persoon.Inkomen"), /odrl:partOf reg:Persoon , b:gegevens-inkomensgegevens \./, "het registerdeel hangt ook onder het begrip");
  assert.match(blok(gbo, "b:regel-inkomens-tot-en-met-2024"), /odrl:target reg:Persoon\.Inkomen/);
  assert.match(blok(gbo, "b:vw-het-jaar-van-de-aanvraag-is-ten-hoogste-2024"), /odrl:leftOperand ts:aanvraag\.jaar ;\n {4}odrl:operator odrl:lteq ;\n {4}odrl:rightOperand 2024 \./);
  // De bestaansvraag is geen kenmerk van het verzoek: voorwaarde op de regel.
  assert.match(blok(gbo, "b:regel-persoon-op-bsn"), /odrl:constraint b:vw-er-is-een-toestemming-voor-de-betrokkene \./);
  assert.match(blok(gbo, "b:vw-er-is-een-toestemming-voor-de-betrokkene"), /odrl:leftOperand ts:bestaat\.toestemming ;\n {4}odrl:operator ts:bestaat ;\n {4}odrl:rightOperand true \./);
});

test("ODRL: geneste voorwaarden worden een LogicalConstraint met een lijst in tekstvolgorde", () => {
  const { turtle, ok } = toegangsspraakNaarOdrl(RIJK_BELEID, OPTIES);
  assert.ok(ok);
  const groep = blok(turtle, "b:vw-genest-groep-1");
  assert.match(groep, /a odrl:LogicalConstraint ;\n {4}rdfs:label "ten minste één van de volgende voorwaarden"@nl ;\n {4}odrl:or \( b:vw-de-geboortedatum-van-de-betrokkene-is-kleiner-dan-1-januari-2000 b:vw-de-leeftijd-van-de-betrokkene-is-ten-minste-67 \) \./);
  assert.match(blok(turtle, "b:regel-genest"), /odrl:constraint b:vw-genest-groep-1 ;/);
  assert.match(blok(turtle, "b:vw-de-geboortedatum-van-de-betrokkene-is-kleiner-dan-1-januari-2000"), /odrl:rightOperand "2000-01-01"\^\^xsd:date \./);
  assert.match(blok(turtle, "b:vw-de-leeftijd-van-de-betrokkene-is-ten-minste-67"), /odrl:operator odrl:gteq ;\n {4}odrl:rightOperand 67 \./);
  assert.match(turtle, /odrl:operator odrl:isAnyOf ;\n {4}odrl:rightOperand "balie" , "post" \./);
  assert.match(blok(turtle, "b:handeling-genest"), /rdf:value odrl:modify/);
  assert.match(blok(turtle, "b:groep-rol-beheerder"), /skos:definition "iemand met rol \\"beheerder\\""@nl/);
});

test("aanvulling: een tweede bron kan knopen en regels toevoegen (realisatie)", () => {
  const uit = toegangsspraakNaarOdrl(GBO_BELEID, {
    ...OPTIES,
    aanvulling: (graaf) => ({
      knopen: [{ id: "module-1", aard: "artefact", tekst: "Module" }],
      verbindingen: graaf.knopen.filter((k) => k.aard === "regel").map((k) => ({ id: `r:${k.id}`, aard: "realiseert", bron: "module-1", doel: k.id })),
    }),
    extraRegels: [
      { naam: "Artefact", bij: "knoop", als: { aard: "artefact" }, maak: { type: "apnl:RegoModule" } },
      { naam: "Realiseert", bij: "verbinding", als: { aard: "realiseert" }, maak: { type: "prov:wasDerivedFrom" } },
    ],
  });
  assert.match(blok(uit.turtle, "b:module-1"), /a apnl:RegoModule ;[\s\S]*prov:wasDerivedFrom b:regel-persoon-op-bsn , b:regel-inkomens-tot-en-met-2024 , b:regel-inkomen-velden \./);
  assert.ok(uit.turtle.indexOf("# ── Realisatie") < uit.turtle.indexOf("b:module-1 a apnl:RegoModule"));
});

test("randgevallen: wat geen regel heeft wordt gemeld, en een parsefout komt als melding terug", () => {
  const graaf = beleidNaarGraaf(parseBeleid(VOORBEELD_BELEID).beleid);
  graaf.knopen.push({ id: "vreemd", aard: "iets-nieuws", tekst: "?" });
  graaf.verbindingen.push({ id: "x", aard: "onbekend", bron: "beleid", doel: "vreemd" });
  const plan = pasRegelsToe(graaf, TOEGANGSSPRAAK_NAAR_ODRL_AP_NL);
  assert.deepEqual(plan.diagnostics.map((d) => d.code), ["TRF-GEEN-REGEL", "TRF-GEEN-REGEL"]);
  assert.deepEqual(plan.trace.filter((s) => s.actie === "geen-regel").map((s) => s.bronId), ["vreemd", "x"]);

  const kapot = toegangsspraakNaarOdrl('Beleid "x".\n  Regel "y".\n    Een beheerder mag.\n');
  assert.equal(kapot.ok, false);
  assert.equal(kapot.turtle, "");
  assert.equal(kapot.diagnostics[0].code, "TS-SYNTAX");
  assert.match(kapot.diagnostics[0].path, /^regel \d+, kolom \d+$/);
});
