// odrlImport.test.js — de import "ODRL (ODRL-AP-NL, Turtle) → Toegangsspraak":
// lezer (turtleLezer) → graaflaag (rdfBrongraaf) → regelset → bouwer (odrlNaarBeleid),
// en de rondreis met de export (odrlExport.js).
// Run: node --import ./test/register-aliases.mjs --test src/toegangsspraak/odrlImport.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid } from "./parser.js";
import { renderBeleid } from "./renderer.js";
import { VOORBEELD_BELEID } from "./voorbeeld.js";
import { VOORBEELDEN, GBO_BELEID } from "./fixtures/voorbeelden.js";
import { toegangsspraakNaarOdrl } from "./odrlExport.js";
import { odrlNaarToegangsspraak, odrlBrongraaf, importMeldingen } from "./odrlImport.js";
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
  assert.ok(verlies(r).some((s) => s.bronId === "b:anker-1"));
  assert.match(importMeldingen(r).join(" "), /^2 onderdelen van de ODRL zijn niet overgenomen: b:anker-1, b:module-1.$/);

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

test("ODRL van elders: wat Toegangsspraak niet kent wordt gemeld, niet gegokt", () => {
  const vreemd = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix ex:   <https://example.org/beleid/> .

ex:beleid a odrl:Set ;
    dct:title "Van elders"@nl ;
    odrl:permission ex:afdrukken , ex:lezen ;
    odrl:obligation ex:betalen .

ex:afdrukken a odrl:Permission ;
    dct:title "afdrukken"@nl ;
    odrl:action odrl:print ;
    odrl:target ex:document .

ex:lezen a odrl:Permission ;
    dct:title "lezen"@nl ;
    odrl:action ex:lees ;
    odrl:target ex:document .

ex:lees a odrl:Action ;
    <http://www.w3.org/1999/02/22-rdf-syntax-ns#value> odrl:read .

ex:document a odrl:Asset ;
    dct:identifier "document" .

ex:betalen a odrl:Duty ;
    odrl:action odrl:compensate .
`;
  const r = odrlNaarToegangsspraak(vreemd);
  assert.ok(r.ok);
  assert.equal(r.weg, "structuur");
  // De regel met een handeling die de taal kent komt over; die met odrl:print niet.
  assert.deepEqual(r.beleid.regels.map((x) => x.naam), ["lezen"]);
  assert.match(r.tekst, /Regel "lezen"\.\n {4}Iedereen mag alle gegevens van een document bekijken\./);
  assert.ok(r.diagnostics.some((d) => d.code === "ODRL-HANDELING" && /afdrukken/.test(d.message)));
  // odrl:obligation heeft geen regel: verliesrapport.
  assert.ok(verlies(r).some((s) => s.bronId.startsWith("odrl:obligation:")));
  assert.ok(r.diagnostics.some((d) => d.code === "ODRL-VERSCHIL"), "het resultaat regelt minder dan de ODRL");
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
