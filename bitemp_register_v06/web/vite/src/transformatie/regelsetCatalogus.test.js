import { test } from "node:test";
import assert from "node:assert/strict";
import { alleRegelsets, getRegelsetVermelding, regelRijen, controleer, proefdraai, alsTekst, actieTekst, toetsTekst, heeftRegels } from "./regelsetCatalogus.js";
import "../studio/activities/regelsetsIngebouwd.js";
import { geenProefUitleg } from "../studio/activities/regelsetsIngebouwd.js";

test("de catalogus kent de tien ingebouwde regelsets, in twee vormen, alle geldig", () => {
  const alle = alleRegelsets();
  assert.equal(alle.length, 10);
  assert.deepEqual(alle.filter((v) => v.vorm === "instellingen").map((v) => v.regelset.id).sort(), ["bpmn-naar-gzac", "canoniek-naar-gzac-dossier", "canoniek-naar-zaaktype"]);
  for (const v of alle) {
    assert.equal(v.vindplaats, "ingebouwd");
    assert.ok(v.bestand, v.regelset.id);
    assert.deepEqual(controleer(v.regelset), [], v.regelset.id);
    if (!v.proef) assert.ok(geenProefUitleg(v));
  }
});

test("een regel in woorden: voorwaarden en actie", () => {
  assert.equal(toetsTekst(["actor", "usecase"]), "actor of usecase");
  assert.equal(toetsTekst({ niet: "notitie" }), "niet notitie");
  assert.equal(toetsTekst({ leeg: false }), "niet leeg");
  assert.deepEqual(alsTekst({ lijn: "gestippeld", bron: { type: "actor" }, doel: { type: { niet: "notitie" } } }), ["lijn: gestippeld", "bron.type: actor", "doel.type: niet notitie"]);
  assert.equal(actieTekst({ negeer: true }), "negeer");
  assert.equal(actieTekst({ maak: { type: "notitie", naam: "", data: { tekst: "{tekst}" } } }), "maak notitie, naam leeg (tekst = {tekst})");
  assert.equal(actieTekst({ zet: { op: "bron", data: { beschrijving: "{doel.romp}" }, vervalt: "doel" } }), "zet op bron (beschrijving = {doel.romp}); doel vervalt");
  const rijen = regelRijen(getRegelsetVermelding("mermaid-flowchart-naar-usecase").regelset);
  assert.equal(rijen[0].nr, 1);
  assert.equal(rijen.find((r) => r.naam === "Systeemkader").actie, "maak systeem");
});

test("proefdraaien op geplakte Mermaid: treffers per regel, regels zonder treffer, items zonder regel", () => {
  const v = getRegelsetVermelding("mermaid-flowchart-naar-usecase");
  const tekst = `${v.proef.voorbeeld}  vreemd{Ruit}\n  klant --> vreemd\n`;
  const uit = proefdraai(v.regelset, v.proef.lees(tekst));
  const treffers = Object.fromEntries(uit.perRegel.filter((r) => r.items.length).map((r) => [r.naam, r.items.length]));
  assert.deepEqual(treffers, { "Actor (cirkel)": 1, "Use case (stadion)": 2, Systeemkader: 1, Include: 1, Associatie: 1 });
  assert.equal(uit.perRegel.length, v.regelset.regels.length);
  // De ruit heeft geen regel, en de lijn ernaartoe dus ook niet (haar doel heeft geen type).
  assert.deepEqual(uit.zonderRegel.map((s) => [s.soort, s.actie, s.omschrijving]), [["knoop", "geen-regel", "Ruit"], ["verbinding", "geen-regel", "klant → vreemd"]]);
  assert.equal(uit.telling["geen-regel"], 2);
  assert.equal(uit.telling.gemaakt, 6);
  assert.equal(uit.diagnostics.filter((d) => d.code === "TRF-GEEN-REGEL").length, 2);
  assert.equal(uit.plannen[0].elementen.length, 4);
});

test("proefdraaien op een modelgraaf met een schrijver geeft de doeltekst", () => {
  const v = getRegelsetVermelding("usecase-naar-mermaid-flowchart");
  const graaf = {
    knopen: [{ id: "a", aard: "actor", tekst: "Klant", eigenschappen: {}, groep: null }, { id: "u", aard: "usecase", tekst: "Bestellen", eigenschappen: {}, groep: null }],
    groepen: [],
    verbindingen: [{ id: "c", aard: "associatie", bron: "a", doel: "u", label: "", eigenschappen: {} }],
  };
  const uit = proefdraai(v.regelset, [graaf]);
  assert.equal(uit.zonderRegel.length, 0);
  const tekst = v.proef.schrijf(uit.plannen[0], graaf);
  assert.match(tekst, /flowchart/);
  assert.match(tekst, /Klant/);
});

test("een instellingen-regelset is niet proef te draaien", () => {
  const v = getRegelsetVermelding("bpmn-naar-gzac");
  assert.equal(heeftRegels(v.regelset), false);
  assert.throws(() => proefdraai(v.regelset, []), /geen regels/);
});
