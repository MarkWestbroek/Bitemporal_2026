// odrlImport.test.js — de import "ODRL (ODRL-AP-NL, Turtle) → Toegangsspraak":
// lezer (turtleLezer) → graaflaag (rdfBrongraaf) → regelset → bouwer (odrlNaarBeleid),
// en de rondreis met de export (odrlExport.js).
// Run: node --import ./test/register-aliases.mjs --test src/toegangsspraak/odrlImport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { parseBeleid } from "./parser.js";
import { renderBeleid } from "./renderer.js";
import { VOORBEELD_BELEID } from "./voorbeeld.js";
import { VOORBEELDEN, GBO_BELEID, VOLLEDIG_BELEID } from "./fixtures/voorbeelden.js";
import { toegangsspraakNaarOdrl } from "./odrlExport.js";
import { odrlNaarToegangsspraak, odrlBrongraaf, importMeldingen, verliesrapport } from "./odrlImport.js";
import { ODRL_AP_NL_NAAR_TOEGANGSSPRAAK } from "./odrlNaarToegangsspraakRegels.js";
import { leesVoorwaardeZin, leesVerwijzing, leesBegripZin } from "./odrlNaarBeleid.js";
import { valideerRegelset, pasRegelsToe } from "../transformatie/regels.js";
import { leesTurtle } from "../transformatie/turtleLezer.js";

const OPTIES = { uitgegeven: "2026-10-05", modelNaam: "voorbeeld" };
const canoniek = (tekst) => renderBeleid(parseBeleid(tekst).beleid);
const naarOdrl = (tekst, opties = OPTIES) => toegangsspraakNaarOdrl(tekst, opties).turtle;
const verlies = (r) => r.trace.filter((s) => s.actie === "geen-regel" || s.actie === "overgeslagen");
const meldingen = (r) => r.diagnostics.filter((d) => d.severity !== "info").map((d) => d.code);

// Wat de structuur alleen via een zinsnede draagt: waarvan bij een begrip, "voor …" bij een
// bestaansvraag, een ontkende bestaansvraag, tussen, en een verbod vóór een toestemming.
const FIJN_BELEID = `Beleid "Fijn".
  Geldig vanaf 1 januari 2026 tot 1 januari 2027.

  Begrippen.
    Een behandelaar is: iemand met rol "behandelaar" en afdeling "Zorg".
    Het dossier is: alle gegevens van het dossier van een cliënt waarvan de status van de gegevens "open" is.

  Regel "niet afvoeren".
    Iedereen mag het dossier niet afvoeren.

  Regel "inzage".
    Een behandelaar mag het dossier bekijken
    als aan alle volgende voorwaarden is voldaan:
      - er is een behandelrelatie voor de betrokkene;
      - er is geen blokkade;
      - de leeftijd van de betrokkene ligt tussen 18 en 67;
      - aan precies één van de volgende voorwaarden is voldaan:
        - het kanaal van de aanvraag is "balie";
        - het kanaal van de aanvraag is "portaal";
    waarbij: elke raadpleging wordt vastgelegd in het logboek; de gegevens worden gepseudonimiseerd geleverd.
`;

test("regelset: geldig, en het spiegelbeeld van de export in naam", () => {
  assert.deepEqual(valideerRegelset(ODRL_AP_NL_NAAR_TOEGANGSSPRAAK), []);
  assert.equal(ODRL_AP_NL_NAAR_TOEGANGSSPRAAK.id, "odrl-ap-nl-naar-toegangsspraak");
  assert.equal(ODRL_AP_NL_NAAR_TOEGANGSSPRAAK.bron, "odrl-ap-nl");
  assert.equal(ODRL_AP_NL_NAAR_TOEGANGSSPRAAK.doel, "toegangsspraak");
});

test("rondreis: de eigen export komt letterlijk terug, zonder verlies", () => {
  for (const [naam, tekst] of Object.entries({ ...VOORBEELDEN, fijn: FIJN_BELEID })) {
    const r = odrlNaarToegangsspraak(naarOdrl(tekst));
    assert.ok(r.ok, naam);
    assert.equal(r.weg, "brontekst", `${naam}: de meegegeven klare taal zegt hetzelfde als de ODRL`);
    assert.equal(r.tekst, canoniek(tekst), `${naam}: dezelfde tekst na herformatteren`);
    assert.deepEqual(verlies(r), [], `${naam}: elk onderdeel van de ODRL heeft een regel`);
    assert.deepEqual(r.diagnostics, [], `${naam}: geen meldingen`);
    assert.deepEqual([r.verschil.structuur, r.verschil.woorden], [0, 0], naam);
  }
});

test("uit de structuur (zonder brontekst): hetzelfde beleid, en waar het kan dezelfde tekst", () => {
  for (const [naam, tekst] of Object.entries({ ...VOORBEELDEN, fijn: FIJN_BELEID })) {
    const r = odrlNaarToegangsspraak(naarOdrl(tekst), { negeerBrontekst: true });
    assert.equal(r.weg, "structuur", naam);
    assert.deepEqual(meldingen(r), [], naam);
    // Een nieuwe export van het resultaat regelt hetzelfde als het bestand: alleen woorden verschillen.
    assert.equal(r.verschil.structuur, 0, `${naam}: ${JSON.stringify([...r.verschil.ontbreekt, ...r.verschil.extra].filter((x) => !x.woorden))}`);
    assert.ok(parseBeleid(r.tekst).ok, `${naam}: het resultaat is geldige Toegangsspraak`);
  }
  // Geneste voorwaarden, lijst, datum, plicht, bestaansvraag, argument: letterlijk gelijk.
  for (const naam of ["gbo", "rijk"]) {
    assert.equal(odrlNaarToegangsspraak(naarOdrl(VOORBEELDEN[naam]), { negeerBrontekst: true }).tekst, canoniek(VOORBEELDEN[naam]), naam);
  }
});

test("uit de structuur: wat bij 'wie' en bij het beleid hoort staat niet nog eens in de regel", () => {
  const r = odrlNaarToegangsspraak(naarOdrl(VOORBEELD_BELEID), { negeerBrontekst: true });
  const regel = r.beleid.regels[0];
  // De rol is het begrip, de doelbinding de kopregel "Doel:"; over blijft de voorwaarde over de gegevens.
  assert.deepEqual(regel.wie, { soort: "begrip", lidwoord: "een", naam: "schuldhulpverlener" });
  assert.equal(r.beleid.doel, "schuldhulpverlening");
  assert.equal(regel.voorwaarden.soort, "voorwaarde");
  assert.match(r.tekst, /als de achternaam van de naam van de betrokkene met "A" begint\n {4}waarbij: elke raadpleging wordt vastgelegd in het logboek\./);
  assert.match(r.tekst, /Een schuldhulpverlener is: iemand met rol "schuldhulpverlener"\.\n {4}Inkomensgegevens zijn: alle gegevens van het inkomen van een natuurlijk persoon\./);
  assert.match(r.tekst, /Geldig vanaf 1 mei 2026\.\n {2}Grondslag: de Wet gemeentelijke schuldhulpverlening\.\n {2}Doel: "schuldhulpverlening"\./);
  assert.deepEqual(r.beleid.regels.map((x) => [x.naam, x.verbod, x.actie]), [["inzage bij lopend dossier", false, "bekijken"], ["geen export", true, "exporteren"]]);
});

test("uit de structuur: zinsneden uit de ODRL geven de woorden terug (waarvan, voor, tussen, geen)", () => {
  const r = odrlNaarToegangsspraak(naarOdrl(FIJN_BELEID), { negeerBrontekst: true });
  assert.equal(r.tekst, canoniek(FIJN_BELEID));
  // Het verbod stond vóór de toestemming: het volgnummer houdt de volgorde van de tekst.
  assert.deepEqual(r.beleid.regels.map((x) => x.naam), ["niet afvoeren", "inzage"]);
  // Het volgnummer gaat vóór de plek in het bestand (RDF kent geen volgorde); zonder volgnummer telt die plek.
  const omgenummerd = naarOdrl(FIJN_BELEID).replace("ts:volgorde 1 ;", "ts:volgorde 9 ;");
  assert.deepEqual(odrlNaarToegangsspraak(omgenummerd, { negeerBrontekst: true }).beleid.regels.map((x) => x.naam), ["inzage", "niet afvoeren"]);
  const zonder = naarOdrl(FIJN_BELEID).replace(/^ {4}ts:volgorde \d+ ;\n/gm, "");
  assert.ok(!zonder.includes("ts:volgorde"));
  assert.deepEqual(odrlNaarToegangsspraak(zonder, { negeerBrontekst: true }).beleid.regels.map((x) => x.naam), ["niet afvoeren", "inzage"]);
});

test("uit de structuur: superpolicy, waarvan, 'voor' en een verwijzing als rechterterm komen terug", () => {
  const ttl = naarOdrl(VOLLEDIG_BELEID);
  assert.equal(odrlNaarToegangsspraak(ttl).weg, "brontekst");
  // Zonder de brontekst, en zonder de zinsneden die de woorden zouden geven: alleen de structuur.
  const kaal = ttl
    .replace(/^ {4}rdfs:label "(er is een behandelrelatie|de afdeling van de betrokkene is)[^\n]*\n/gm, "")
    .replace(/^ {4}skos:definition "alle gegevens van het dossier[^\n]*\n/m, "");
  assert.ok(!kaal.includes('rdfs:label "er is een behandelrelatie') && !kaal.includes('skos:definition "alle gegevens van het dossier'));
  for (const bron of [ttl, kaal]) {
    const r = odrlNaarToegangsspraak(bron, { negeerBrontekst: true });
    assert.equal(r.weg, "structuur");
    assert.deepEqual(meldingen(r).filter((c) => c !== "ODRL-VERSCHIL"), []);
    assert.equal(r.beleid.standaard, "toestaan");
    assert.equal(r.beleid.conflict, "eerste-geldt");
    const dossier = r.beleid.begrippen.find((b) => b.soort === "wat");
    assert.equal(dossier.waarvan.operator, "eq");
    assert.deepEqual(dossier.waarvan.links.basis, { soort: "anker", lidwoord: "de", anker: "gegevens" });
    const [afdeling, relatie] = r.beleid.regels[0].voorwaarden.items;
    assert.equal(afdeling.rechts.soort, "verwijzing", "de rechterterm is een gegeven, geen tekst");
    assert.equal(afdeling.rechts.basis.anker, "aanvrager");
    assert.equal(relatie.existentie.voor.basis.anker, "betrokkene");
    assert.equal(r.tekst, canoniek(VOLLEDIG_BELEID), "dezelfde tekst, ook zonder de zinsneden");
  }
  // Met de zinsneden erbij regelt een nieuwe export precies hetzelfde.
  assert.equal(odrlNaarToegangsspraak(ttl, { negeerBrontekst: true }).verschil.structuur, 0);
});

test("bewerkte ODRL: de brontekst klopt niet meer, dus de structuur wint", () => {
  const bewerkt = naarOdrl(VOORBEELD_BELEID).replace('odrl:rightOperand "A" .', 'odrl:rightOperand "B" .');
  const r = odrlNaarToegangsspraak(bewerkt);
  assert.equal(r.weg, "structuur");
  assert.deepEqual(r.diagnostics.map((d) => [d.severity, d.code]), [["info", "ODRL-BRONTEKST"]]);
  // Het label zegt nog "A"; de structuur zegt "B" en die is leidend.
  assert.match(r.tekst, /als de achternaam van de naam van de betrokkene met "B" begint/);
  assert.equal(r.verschil.structuur, 0);
  assert.deepEqual(importMeldingen(r), ["De meegegeven klare taal (ts:brontekst) zegt niet hetzelfde als de ODRL; het beleid is uit de structuur opgebouwd."]);
  // Een schone rondreis geeft niets te melden.
  assert.deepEqual(importMeldingen(odrlNaarToegangsspraak(naarOdrl(VOORBEELD_BELEID))), []);
});

test("ODRL met een model erbij: zonder resolver uit de structuur, met resolver letterlijk", () => {
  const model = { Persoon: { Naam: ["naam"], Inkomen: ["jaar", "bedrag"] } };
  const metModel = {
    resolveerPad: (pad) => pad.replace(/\.inkomens?$/i, ".Inkomen"),
    kinderenVan: (pad) => {
      const [e, g] = pad.split(".");
      if (!model[e]) return [];
      return g ? (pad.split(".").length === 2 ? (model[e][g] || []).map((v) => `${pad}.${v}`) : []) : Object.keys(model[e]).map((x) => `${e}.${x}`);
    },
  };
  const ttl = naarOdrl(GBO_BELEID, { ...OPTIES, modelNaam: "gbo", ...metModel });
  const met = odrlNaarToegangsspraak(ttl, metModel);
  assert.equal(met.weg, "brontekst");
  assert.equal(met.tekst, canoniek(GBO_BELEID));
  // Zonder het model wijst "de inkomens van een persoon" een ander pad aan dan de ODRL.
  const zonder = odrlNaarToegangsspraak(ttl);
  assert.equal(zonder.weg, "structuur");
  assert.equal(zonder.verschil.structuur, 0);
  assert.deepEqual(meldingen(zonder), []);
  // De woorden volgen nu het pad in het model: "de inkomens" is daar het gegevenselement Inkomen.
  assert.match(zonder.tekst, /Regel "inkomens tot en met 2024"\.\n {4}Een afnemer mag alle gegevens van het inkomen van een persoon bekijken/);
});

test("ODRL met een aanvulling (realisatie) en met andere prefixen leest hetzelfde", () => {
  const metRealisatie = toegangsspraakNaarOdrl(GBO_BELEID, {
    ...OPTIES,
    aanvulling: (graaf) => ({
      // Zoals de voorbeelden voor de ODRL-viewer: een module, en per regel een anker dat als
      // verfijning aan de handeling hangt (een voorwaarde die Toegangsspraak niet kent).
      knopen: [{ id: "module-1", aard: "artefact", tekst: "Module" }, { id: "anker-1", aard: "anker", tekst: "het verzoek voldoet aan de module" }],
      verbindingen: [
        ...graaf.knopen.filter((k) => k.aard === "regel").map((k) => ({ id: `r:${k.id}`, aard: "realiseert", bron: "module-1", doel: k.id })),
        ...graaf.knopen.filter((k) => k.aard === "handeling").map((k) => ({ id: `a:${k.id}`, aard: "als", bron: k.id, doel: "anker-1" })),
      ],
    }),
    extraRegels: [
      { naam: "Artefact", bij: "knoop", als: { aard: "artefact" }, maak: { type: "apnl:RegoModule", data: { "dct:identifier": "module-1" } } },
      { naam: "Anker", bij: "knoop", als: { aard: "anker" }, maak: { type: "odrl:Constraint", data: { "odrl:leftOperand": { iri: "apnl:verwerkingsverzoek" }, "odrl:operator": { iri: "apnl:conformsToPolicy" } } } },
      { naam: "Realiseert", bij: "verbinding", als: { aard: "realiseert" }, maak: { type: "prov:wasDerivedFrom" } },
    ],
  }).turtle;
  const r = odrlNaarToegangsspraak(metRealisatie);
  assert.equal(r.weg, "brontekst", "wat de ODRL zegt over iets buiten het beleid telt niet als verschil");
  assert.equal(r.tekst, canoniek(GBO_BELEID));
  // De realisatie heeft geen regel: ze staat in het verliesrapport.
  assert.ok(verlies(r).some((s) => s.bronId === "b:module-1"));
  // Het anker naar de uitvoering is realisatie, geen norm: de regelset negeert het bewust.
  assert.ok(r.trace.some((s) => s.bronId === "b:anker-1" && s.actie === "genegeerd"));
  assert.deepEqual(importMeldingen(r), ["1 onderdeel van de ODRL is niet overgenomen: b:module-1."]);

  // Een ander bestand mag andere prefixen schrijven; de regelset denkt in die van de export.
  const anders = naarOdrl(VOORBEELD_BELEID).replace("@prefix odrl: ", "@prefix o: ").replace(/\bodrl:/g, "o:");
  assert.ok(anders.includes("a o:Permission"));
  const a = odrlNaarToegangsspraak(anders);
  assert.equal(a.weg, "brontekst");
  assert.equal(a.tekst, canoniek(VOORBEELD_BELEID));
});

test("graaflaag: klassen, getypeerde waarden en lijsten in volgorde", () => {
  const { graaf } = odrlBrongraaf(leesTurtle(naarOdrl(VOORBEELDEN.rijk)));
  const perId = Object.fromEntries(graaf.knopen.map((k) => [k.id, k]));
  assert.deepEqual(perId["b:regel-genest"].klassen, ["odrl:Permission"]);
  assert.equal(perId["b:regel-genest"].tekst, "genest");
  assert.equal(perId["b:regel-genest"].ts.volgorde, 1);
  assert.equal(perId["b:handeling-genest"]["rdf:value"], "odrl:modify");
  const lijst = graaf.knopen.find((k) => k["odrl:operator"] === "odrl:isAnyOf");
  assert.deepEqual(lijst.odrl.rightOperand, ["balie", "post"]);
  const datum = graaf.knopen.find((k) => k["odrl:operator"] === "odrl:lt");
  assert.deepEqual(datum.odrl.rightOperand, { datum: "2000-01-01" });
  assert.deepEqual(
    graaf.verbindingen.filter((v) => v.aard === "odrl:or").map((v) => [v.positie, v.doel]),
    [[0, "b:vw-de-geboortedatum-van-de-betrokkene-is-kleiner-dan-1-januari-2000"], [1, "b:vw-de-leeftijd-van-de-betrokkene-is-ten-minste-67"]],
  );
  // rdf:type is geen verbinding; een IRI zonder eigen triples (odrl:eq) geen knoop.
  assert.ok(!graaf.verbindingen.some((v) => v.aard === "rdf:type"));
  assert.ok(!perId["odrl:eq"]);
});

test("zinsneden lezen met de parser van de taal", () => {
  assert.equal(leesVoorwaardeZin('het doel van de aanvraag is "x"').operator, "eq");
  assert.equal(leesVoorwaardeZin("er is geen blokkade").existentie.ontkenning, true);
  assert.equal(leesVoorwaardeZin("dit is geen voorwaarde"), null);
  // Eén zinsnede is één voorwaarde: een tweede meesmokkelen lukt niet.
  assert.equal(leesVoorwaardeZin('het doel van de aanvraag is "x";\n      - er is geen blokkade'), null);
  assert.deepEqual(leesVerwijzing("de achternaam van de naam van de betrokkene").basis, { soort: "anker", lidwoord: "de", anker: "betrokkene" });
  assert.equal(leesBegripZin('Een beheerder is: iemand met rol "beheerder".').soort, "wie");
  assert.equal(leesBegripZin("geen begrip"), null);
});

// ── ODRL van anderen (regelset v2) ──────────────────────────────────────────
// De fixture is een verzonnen beleid in de stijl van ODRL-AP-NL zoals anderen het schrijven.
const ELDERS = fs.readFileSync(new URL("./fixtures/odrl-van-elders.ttl", import.meta.url), "utf8");
const codes = (r) => r.diagnostics.filter((d) => !d.code.startsWith("TRF-")).map((d) => d.code);

test("ODRL van elders: wat de taal kan zeggen komt over, als concept", () => {
  const r = odrlNaarToegangsspraak(ELDERS);
  assert.ok(r.ok);
  assert.equal(r.eigen, false);
  assert.equal(r.weg, "structuur");
  assert.equal(r.verschil, null, "een vergelijking met een nieuwe export zegt alleen iets bij eigen ODRL");
  // Twee beleiden in één bestand: het eerste mét regels is gelezen, het andere is te kiezen.
  assert.deepEqual(r.beleiden, [
    { sleutel: "b:set-stelsel", naam: "Stelselafspraken", regels: 0 },
    { sleutel: "b:set-parkeren", naam: "Parkeervergunningen: bevragen van voertuigen", regels: 5 },
  ]);
  assert.equal(r.gekozen, "b:set-parkeren");
  assert.deepEqual(r.telling, { regels: 5, overgenomen: 3, weggelaten: 2 });
  assert.ok(parseBeleid(r.tekst).ok, "het concept is geldige Toegangsspraak");

  // Nederlandse labels, de groep met haar kenmerk, het veld onder zijn verzameling, begrippen als
  // waarde, een operand van elders als kenmerk van de aanvraag; het anker naar de uitvoering valt weg.
  assert.match(r.tekst, /Een medewerkers Vergunningen is: iemand met afdeling "Vergunningen"\./);
  assert.match(
    r.tekst,
    / {2}Regel "Kenteken opzoeken"\.\n {4}Een medewerkers Vergunningen mag het kenteken van een voertuiggegevens bekijken\n {4}als aan alle volgende voorwaarden is voldaan:\n {6}- het doel van de aanvraag is "Parkeervergunning verlenen";\n {6}- het zoektype van de aanvraag is "zoeken op kenteken"\./,
  );
  assert.ok(!/verwerkingsverzoek|conformsToPolicy/.test(r.tekst));
  assert.ok(r.trace.some((s) => s.bronId === "b:anker" && s.actie === "genegeerd"));
});

test("ODRL van elders: het beleid wordt nooit ongemerkt ruimer dan de ODRL", () => {
  const r = odrlNaarToegangsspraak(ELDERS);
  const melding = (code, naam) => r.diagnostics.find((d) => d.code === code && d.message.includes(`"${naam}"`))?.message || "";
  // Een toestemming met iets onvertaalbaars valt weg: strenger, en gemeld met de reden.
  assert.ok(!r.tekst.includes("Voertuiggegevens inzien na opleiding"));
  assert.match(melding("ODRL-REGEL-WEG", "Voertuiggegevens inzien na opleiding"), /de vergelijking "niet ouder dan", die Toegangsspraak niet kent\. Zonder dat onderdeel zou de toestemming ruimer zijn/);
  // Een eigen handeling die onder odrl:distribute valt is een bijzondere vorm van "exporteren".
  assert.ok(!r.tekst.includes("Verstrekken aan de gemeente"));
  assert.match(melding("ODRL-REGEL-WEG", "Verstrekken aan de gemeente"), /"verstrekken op verzoek" is een bijzondere vorm van odrl:distribute/);
  // Een verbod blijft staan. Zonder de onvertaalbare voorwaarde geldt het vaker (strenger) …
  assert.match(r.tekst, / {2}Regel "Niet wissen"\.\n {4}Iedereen mag alle gegevens van een voertuiggegevens niet afvoeren\./);
  assert.match(melding("ODRL-STRENGER", "Niet wissen"), /is strenger dan in de ODRL/);
  // … en een verbod op elk gebruik (odrl:use) is uitgeschreven voor elke handeling die de taal kent.
  for (const woord of ["bekijken", "opvoeren", "veranderen", "corrigeren", "afvoeren", "registreren", "exporteren"]) {
    assert.ok(r.tekst.includes(`  Regel "Geen ander gebruik (${woord})".\n    Iedereen mag alle gegevens van een voertuiggegevens niet ${woord}.`), woord);
  }
  assert.equal(melding("ODRL-RUIMER", "Geen ander gebruik"), "", "uitgeschreven is het verbod niet ruimer");
  // Overerving kent de taal niet.
  assert.ok(codes(r).includes("ODRL-ERFT"));
  assert.equal(codes(r).at(-1), "ODRL-RUIMER-DAN-BRON", "de slotwaarschuwing");

  // Met "ruimer" blijven de toestemmingen staan, zonder het onvertaalbare en met een waarschuwing.
  const ruim = odrlNaarToegangsspraak(ELDERS, { bijOnvertaalbaar: "ruimer" });
  assert.deepEqual(ruim.telling, { regels: 5, overgenomen: 5, weggelaten: 0 });
  assert.match(ruim.tekst, /Een medewerkers Vergunningen mag alle gegevens van een voertuiggegevens bekijken\./);
  assert.match(ruim.tekst, /De Gemeente Waterstede is: iemand met organisatie "Gemeente Waterstede"\./);
  assert.match(ruim.tekst, /De Gemeente Waterstede mag alle gegevens van een voertuiggegevens exporteren\./);
  assert.equal(ruim.diagnostics.filter((d) => d.code === "ODRL-RUIMER").length, 2);
  assert.ok(parseBeleid(ruim.tekst).ok);
});

test("ODRL van elders: een ander beleid kiezen, en de samenvatting voor het scherm", () => {
  // Het stelselbeleid heeft alleen een plicht: geen regels, wel de melding dat ze niet overkomt.
  const stelsel = odrlNaarToegangsspraak(ELDERS, { beleid: "b:set-stelsel" });
  assert.equal(stelsel.gekozen, "b:set-stelsel");
  assert.equal(stelsel.tekst, 'Beleid "Stelselafspraken".\n');
  assert.ok(stelsel.diagnostics.some((d) => d.code === "ODRL-PLICHT-BELEID" && d.message.includes('"Bevraging vastleggen"')));
  assert.ok(odrlNaarToegangsspraak(ELDERS, { beleid: "b:bestaat-niet" }).diagnostics.some((d) => d.code === "ODRL-BELEID-ONBEKEND"));

  const m = importMeldingen(odrlNaarToegangsspraak(ELDERS));
  assert.equal(m[0], "ODRL van elders: 3 van de 5 regels overgenomen. Het resultaat is een concept; loop het na.");
  assert.ok(m.some((x) => x.startsWith('De ODRL bevat 2 beleiden; "Parkeervergunningen: bevragen van voertuigen" is gelezen.')));
  assert.ok(m.some((x) => x === 'De operand "zoektype" komt uit een ander vocabulaire; hij is gelezen als "het zoektype van de aanvraag".'));
  // Wat de regelset niet overnam, bij naam (weinig) of geteld per soort (veel); het anker telt niet mee.
  assert.equal(m.at(-1), "1 onderdeel van de ODRL is niet overgenomen: odrl:assigner:b:set-parkeren>b:GemeenteWaterstede.");
  assert.deepEqual(verliesrapport(odrlNaarToegangsspraak(ELDERS)).perSoort, [["odrl:assigner", 1]]);
});

test("ODRL van elders: kale handeling, partij op het beleid en meer handelingen per regel", () => {
  const ttl = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://example.org/beleid/> .

ex:overeenkomst a odrl:Agreement ;
    dct:title "Overeenkomst"@nl ;
    odrl:assignee ex:afnemer ;
    odrl:permission ex:lezen , ex:afdrukken , [ a odrl:Permission ; odrl:action odrl:read , odrl:distribute , odrl:print ; odrl:target ex:document ] .

ex:afnemer a odrl:Party ; rdfs:label "Afnemer (BV)"@nl .
ex:document a odrl:Asset ; rdfs:label "document"@nl .

ex:lezen a odrl:Permission ; dct:title "lezen"@nl ; odrl:action odrl:read ; odrl:target ex:document .
ex:afdrukken a odrl:Permission ; dct:title "afdrukken"@nl ; odrl:action odrl:print ; odrl:target ex:document .
`;
  const r = odrlNaarToegangsspraak(ttl);
  assert.ok(r.ok);
  // De partij van het beleid geldt voor elke regel; leestekens in haar naam vallen weg.
  assert.match(r.tekst, /De Afnemer BV is: iemand met organisatie "Afnemer \(BV\)"\./);
  assert.match(r.tekst, / {2}Regel "lezen"\.\n {4}De Afnemer BV mag alle gegevens van een document bekijken\./);
  // odrl:print kent de taal niet: die regel valt weg; in de regel met drie handelingen valt alleen die ene weg.
  assert.ok(r.diagnostics.some((d) => d.code === "ODRL-REGEL-WEG" && /"afdrukken" is niet overgenomen: de handeling "odrl:print" kent Toegangsspraak niet/.test(d.message)));
  assert.match(r.tekst, / {2}Regel "regel 3 \(bekijken\)"\.\n {4}De Afnemer BV mag alle gegevens van een document bekijken\./);
  assert.match(r.tekst, / {2}Regel "regel 3 \(exporteren\)"\.\n {4}De Afnemer BV mag alle gegevens van een document exporteren\./);
  assert.ok(r.diagnostics.some((d) => d.code === "ODRL-STRENGER" && /"regel 3" is strenger dan in de ODRL: de handeling "odrl:print" kent Toegangsspraak niet en is weggelaten/.test(d.message)));
  assert.ok(r.diagnostics.some((d) => d.code === "ODRL-INTERPRETATIE" && d.message === 'De handeling odrl:distribute is gelezen als "exporteren".'));
  assert.deepEqual(r.telling, { regels: 3, overgenomen: 2, weggelaten: 1 });
  assert.ok(!codes(r).includes("ODRL-RUIMER-DAN-BRON"), "alles wat wegviel maakt het beleid strenger");
  assert.ok(parseBeleid(r.tekst).ok);
});

test("ODRL van elders: geen stille verruiming (bevindingen uit de uitvoering)", () => {
  const kop = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix apnl: <https://standaarden.overheid.nl/odrl-ap-nl/> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex:   <https://example.org/beleid/> .
ex:personen a odrl:AssetCollection ; rdfs:label "personen"@nl .
`;
  const lees = (ttl, opties) => odrlNaarToegangsspraak(kop + ttl, opties);

  // 1. Een verfijning op de gegevens bakent de populatie af: een voorwaarde over de gegevens.
  const populatie = lees(`ex:b a odrl:Set ; dct:title "Populatie"@nl ; odrl:permission ex:r .
ex:r a odrl:Permission ; dct:title "wijk"@nl ; odrl:action odrl:read ;
    odrl:target [ a odrl:AssetCollection ; rdfs:label "personen"@nl ; odrl:refinement [ odrl:leftOperand ex:wijk ; odrl:operator odrl:eq ; odrl:rightOperand "Noord" ] ] .`);
  assert.match(populatie.tekst, /Iedereen mag alle gegevens van een personen bekijken\n {4}als de wijk van de gegevens "Noord" is\./);
  // Is die afbakening niet te vertalen, dan valt de toestemming weg in plaats van ruimer te worden.
  const onvertaalbaar = lees(`ex:b a odrl:Set ; dct:title "Populatie"@nl ; odrl:permission ex:r .
ex:r a odrl:Permission ; dct:title "wijk"@nl ; odrl:action odrl:read ;
    odrl:target [ a odrl:AssetCollection ; rdfs:label "personen"@nl ; odrl:refinement [ odrl:leftOperand ex:wijk ; odrl:operator ex:ligtIn ; odrl:rightOperand "Noord" ] ] .`);
  assert.deepEqual(onvertaalbaar.telling, { regels: 1, overgenomen: 0, weggelaten: 1 });

  // 2. Alleen "voldoet aan de uitvoering" is het anker; een andere voorwaarde op het verwerkingsverzoek blijft.
  const geenAnker = lees(`ex:b a odrl:Set ; dct:title "Verwerking"@nl ; odrl:permission ex:r .
ex:r a odrl:Permission ; dct:title "alleen bij parkeren"@nl ; odrl:target ex:personen ;
    odrl:action [ <http://www.w3.org/1999/02/22-rdf-syntax-ns#value> odrl:read ;
        odrl:refinement [ odrl:leftOperand apnl:verwerkingsverzoek ; odrl:operator odrl:eq ; odrl:rightOperand "parkeren" ] ] .`);
  assert.match(geenAnker.tekst, /als het verwerkingsverzoek van de aanvraag "parkeren" is\./);

  // 3. Een aanbod is geen geldend beleid.
  const aanbod = lees(`ex:b a odrl:Offer ; dct:title "Aanbod"@nl ; odrl:permission [ a odrl:Permission ; odrl:action odrl:read ; odrl:target ex:personen ] .`);
  assert.ok(aanbod.diagnostics.some((d) => d.code === "ODRL-GEEN-OVEREENKOMST" && /is een aanbod \(odrl:Offer\), geen geldend beleid/.test(d.message)));
  assert.equal(codes(aanbod).at(-1), "ODRL-RUIMER-DAN-BRON");

  // 4. Een begrip als waarde staat er met zijn naam: bij een verbod een waarschuwing, bij een toestemming een opmerking.
  const begrip = lees(`ex:doel a skos:Concept ; rdfs:label "Parkeren"@nl .
ex:b a odrl:Set ; dct:title "Doel"@nl ; odrl:permission ex:mag ; odrl:prohibition ex:magNiet .
ex:mag a odrl:Permission ; dct:title "mag"@nl ; odrl:action odrl:read ; odrl:target ex:personen ;
    odrl:constraint [ odrl:leftOperand odrl:purpose ; odrl:operator odrl:eq ; odrl:rightOperand ex:doel ] .
ex:magNiet a odrl:Prohibition ; dct:title "mag niet"@nl ; odrl:action odrl:delete ; odrl:target ex:personen ;
    odrl:constraint [ odrl:leftOperand odrl:purpose ; odrl:operator odrl:eq ; odrl:rightOperand ex:doel ] .`);
  const naam = begrip.diagnostics.filter((d) => d.code === "ODRL-WAARDE-NAAM");
  assert.deepEqual(naam.map((d) => d.severity), ["info", "warning"]);
  assert.match(naam[1].message, /Het verbod "mag niet" vergelijkt met "Parkeren": in de ODRL een begrip \(een IRI\), hier zijn naam\..*anders slaat het verbod niet aan/);
  assert.equal(codes(begrip).at(-1), "ODRL-RUIMER-DAN-BRON");
  // De eigen export schrijft de doelbinding ook als begrip; daar is de naam de waarde.
  assert.ok(!odrlNaarToegangsspraak(naarOdrl(VOORBEELD_BELEID), { negeerBrontekst: true }).diagnostics.some((d) => d.code === "ODRL-WAARDE-NAAM"));

  // 5. Gegevens, handeling en partij op het beleid gelden voor elke regel zonder eigen (ODRL 2.2 §2.7.1).
  const bovenaan = lees(`ex:b a odrl:Agreement ; dct:title "Bovenaan"@nl ; odrl:target ex:personen ; odrl:action odrl:read ; odrl:conflict odrl:perm ;
    odrl:permission [ a odrl:Permission ; dct:title "mag"@nl ] ; odrl:prohibition [ a odrl:Prohibition ; dct:title "mag niet"@nl ; odrl:action odrl:delete ] .`);
  assert.deepEqual(bovenaan.telling, { regels: 2, overgenomen: 2, weggelaten: 0 });
  assert.match(bovenaan.tekst, / {2}Regel "mag"\.\n {4}Iedereen mag alle gegevens van een personen bekijken\./);
  assert.match(bovenaan.tekst, / {2}Regel "mag niet"\.\n {4}Iedereen mag alle gegevens van een personen niet afvoeren\./);
  // De conflictregel van ODRL: odrl:perm is "toestemming gaat voor"; odrl:invalid kent de taal niet.
  assert.match(bovenaan.tekst, /^Beleid "Bovenaan"\.\n {2}Bij conflict: toestemming gaat voor\./);
  const ongeldig = lees(`ex:b a odrl:Set ; dct:title "Ongeldig"@nl ; odrl:conflict odrl:invalid ; odrl:permission [ a odrl:Permission ; odrl:action odrl:read ; odrl:target ex:personen ] .`);
  assert.ok(ongeldig.diagnostics.some((d) => d.code === "ODRL-CONFLICT"));

  // 6. De vergelijkingen van het NLGov-profiel (de JSON-LD-export) heten als die van de taal.
  const nlgov = lees(`@prefix nlgov: <https://standaarden.overheid.nl/odrl/terms/> .
ex:b a odrl:Set ; dct:title "NLGov"@nl ; odrl:permission [ a odrl:Permission ; odrl:action odrl:read ; odrl:target ex:personen ;
    odrl:constraint [ odrl:leftOperand ex:naam ; odrl:operator nlgov:begintMet ; odrl:rightOperand "A" ] ] .`);
  assert.match(nlgov.tekst, /als de naam van de aanvraag met "A" begint\./);

  for (const r of [populatie, geenAnker, aanbod, begrip, bovenaan, nlgov]) assert.ok(parseBeleid(r.tekst).ok);
});

test("randgevallen: een fout in de Turtle en ODRL zonder beleid komen als melding terug", () => {
  const kapot = odrlNaarToegangsspraak("@prefix odrl: <http://www.w3.org/ns/odrl/2/> .\nodrl:x a ;");
  assert.equal(kapot.ok, false);
  assert.equal(kapot.diagnostics[0].code, "TTL-SYNTAX");
  assert.match(kapot.diagnostics[0].path, /^regel \d+, kolom \d+$/);

  const leeg = odrlNaarToegangsspraak('@prefix ex: <https://example.org/> .\nex:a ex:b "c" .');
  assert.equal(leeg.ok, false);
  assert.equal(leeg.tekst, "");
  assert.ok(leeg.diagnostics.some((d) => d.code === "ODRL-GEEN-BELEID"));

  // De regelset meldt wat geen regel heeft, zoals bij de export.
  const { graaf } = odrlBrongraaf(leesTurtle('@prefix ex: <https://example.org/> .\nex:a a ex:Iets .'));
  assert.deepEqual(pasRegelsToe(graaf, ODRL_AP_NL_NAAR_TOEGANGSSPRAAK).diagnostics.map((d) => d.code), ["TRF-GEEN-REGEL"]);
});
