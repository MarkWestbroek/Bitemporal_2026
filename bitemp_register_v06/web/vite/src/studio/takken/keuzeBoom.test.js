import { test } from "node:test";
import assert from "node:assert/strict";
import { standaardKeuze, bouwKeuzeBoom, sleutelsVan, standVan, zetKnoop, keuzeTelling, schuifTeksten } from "./keuzeBoom.js";

const v = (soort, id, extra = {}) => ({
  soort, profielId: soort === "map" || soort === "kruisverband" ? null : "uml", id, naam: extra.naam || id,
  status: "gewijzigd", velden: [], inScope: true, mapId: null, ouderId: null,
  sleutel: `${soort}:${soort === "map" || soort === "kruisverband" ? "" : "uml"}:${id}`, ...extra,
});
const MAPPEN = {
  dienst: { id: "dienst", naam: "Dienst", ouderId: null },
  stappen: { id: "stappen", naam: "Stappen", ouderId: "dienst" },
  leeg: { id: "leeg", naam: "Leeg", ouderId: null },
};
const VERSCHILLEN = [
  v("element", "D", { mapId: "dienst" }),
  v("element", "H", { mapId: "stappen", status: "nieuw" }),
  v("element", "R", { mapId: "stappen", ouderId: "H", naam: "gebruikt" }),
  v("element", "E", { mapId: "dienst", status: "conflict" }),
  v("diagram", "D1", { mapId: "dienst" }),
  v("map", "stappen", { mapId: "dienst", naam: "Stappen" }),
  v("element", "X", { inScope: false }),
  v("kruisverband", "K2"),
  v("element", "G", { status: "main", kant: "main", mapId: "dienst" }),
];

test("standaardKeuze: aan, behalve conflict en buiten de map; MAIN-wijzigingen niet", () => {
  assert.deepEqual(standaardKeuze(VERSCHILLEN), {
    "element:uml:D": true, "element:uml:H": true, "element:uml:R": true, "element:uml:E": false,
    "diagram:uml:D1": true, "map::stappen": true, "element:uml:X": false, "kruisverband::K2": true,
  });
  assert.equal(standaardKeuze(VERSCHILLEN, { heeftMap: false })["element:uml:X"], true, "zonder map telt de scope niet");
});

test("bouwKeuzeBoom: map → submap → element → relatie; groepen achteraan; MAIN niet", () => {
  const boom = bouwKeuzeBoom(VERSCHILLEN, MAPPEN);
  assert.deepEqual(boom.map((k) => k.knoopId), ["map:dienst", "groep:zonder", "groep:kruis"]);
  const dienst = boom[0];
  assert.deepEqual(dienst.kinderen.map((k) => k.knoopId), ["map:stappen", "eenheid:diagram:uml:D1", "eenheid:element:uml:D", "eenheid:element:uml:E"]);
  const stappen = dienst.kinderen[0];
  assert.equal(stappen.verschil.sleutel, "map::stappen", "de map draagt zijn eigen wijziging");
  assert.deepEqual(stappen.kinderen.map((k) => k.knoopId), ["eenheid:element:uml:H"]);
  assert.deepEqual(stappen.kinderen[0].kinderen.map((k) => k.knoopId), ["eenheid:element:uml:R"], "relatie onder haar bron");
  assert.ok(!JSON.stringify(boom).includes("element:uml:G"));
  assert.ok(!boom.some((k) => k.knoopId === "map:leeg"), "een map zonder verschil komt niet in de boom");
});

test("schuifje: ouder zet kinderen, gemengd als ze verschillen", () => {
  const boom = bouwKeuzeBoom(VERSCHILLEN, MAPPEN);
  const dienst = boom[0];
  let keuze = standaardKeuze(VERSCHILLEN);
  assert.deepEqual(sleutelsVan(dienst).sort(), ["diagram:uml:D1", "element:uml:D", "element:uml:E", "element:uml:H", "element:uml:R", "map::stappen"]);
  assert.equal(standVan(dienst, keuze), "gemengd", "E (conflict) staat in het midden");
  keuze = zetKnoop(dienst, keuze, "rechts");
  assert.equal(standVan(dienst, keuze), "rechts");
  keuze = zetKnoop(dienst.kinderen[0], keuze, "midden");
  assert.equal(standVan(dienst.kinderen[0], keuze), "midden");
  assert.equal(keuze["element:uml:R"], false, "ook de relatie onder H");
  assert.equal(keuze["element:uml:X"], false, "buiten de knoop niets veranderd");
});

test("lussen in de ouders en mappen breken de boom niet", () => {
  const lus = [v("element", "A", { ouderId: "B", mapId: "m1" }), v("element", "B", { ouderId: "A", mapId: "m1" })];
  const boom = bouwKeuzeBoom(lus, { m1: { id: "m1", naam: "M1", ouderId: "m2" }, m2: { id: "m2", naam: "M2", ouderId: "m1" } });
  const alle = boom.flatMap((k) => sleutelsVan(k));
  assert.deepEqual(alle.sort(), ["element:uml:A", "element:uml:B"]);
});

test("keuzeTelling", () => {
  const keuze = { ...standaardKeuze(VERSCHILLEN), "element:uml:E": true, "element:uml:X": true, "element:uml:D": false };
  assert.deepEqual(keuzeTelling(VERSCHILLEN, keuze), { gekozen: 7, nietGekozen: 1, terug: 0, conflictTak: 1, conflictMain: 0, buitenGekozen: 1, vanMain: 1 });
  const metTerug = { ...keuze, "element:uml:D": "terug", "element:uml:E": "terug" };
  assert.deepEqual(keuzeTelling(VERSCHILLEN, metTerug), { gekozen: 6, nietGekozen: 0, terug: 2, conflictTak: 0, conflictMain: 0, buitenGekozen: 1, vanMain: 1 });
  const dienst = bouwKeuzeBoom(VERSCHILLEN, MAPPEN)[0];
  assert.equal(standVan(dienst, metTerug), "gemengd");
  assert.equal(standVan(dienst, zetKnoop(dienst, metTerug, "links")), "links");
  assert.equal(zetKnoop(dienst, metTerug, "links")["element:uml:D"], "terug");
});

test("schuifTeksten: links en rechts per status", () => {
  assert.equal(schuifTeksten({ status: "nieuw" }).rechts, "toevoegen aan MAIN");
  assert.equal(schuifTeksten({ status: "weg" }).rechts, "ook uit MAIN verwijderen");
  assert.equal(schuifTeksten({ status: "gewijzigd" }).links, "versie van MAIN terug");
  assert.deepEqual([schuifTeksten({ status: "conflict" }).rechts, schuifTeksten({ status: "conflict" }).rechtsWaarschuwing], ["MAIN overschrijven", true]);
  assert.equal(schuifTeksten(null).rechts, "alles naar MAIN");
});

test("per veld (stap 2b): een element met twee gewijzigde velden krijgt veldregels; de schuif van het element zet ze", async () => {
  const { kiesbareVelden, keuzeSleutelsVan } = await import("./keuzeBoom.js");
  const c = v("element", "C", { status: "conflict", mapId: "dienst", veldDetails: [
    { veld: "data.beschrijving", status: "main" }, { veld: "data.kleur", status: "conflict" }, { veld: "naam", status: "gewijzigd" },
  ] });
  const een = v("element", "D", { mapId: "dienst", veldDetails: [{ veld: "naam", status: "gewijzigd" }] });
  assert.deepEqual(kiesbareVelden(c).map((d) => d.veld), ["data.kleur", "naam"], "zonder het MAIN-veld");
  assert.deepEqual(kiesbareVelden(een), [], "één veld: het element is genoeg");
  assert.deepEqual(keuzeSleutelsVan(c), ["element:uml:C#data.kleur", "element:uml:C#naam"]);
  let keuze = standaardKeuze([c, een]);
  assert.deepEqual(keuze, { "element:uml:C": false, "element:uml:C#data.kleur": false, "element:uml:C#naam": true, "element:uml:D": true });
  const boom = bouwKeuzeBoom([c, een], MAPPEN);
  const cKnoop = boom[0].kinderen.find((k) => k.knoopId === "eenheid:element:uml:C");
  assert.deepEqual(cKnoop.kinderen.map((k) => k.knoopId), ["veld:element:uml:C#data.kleur", "veld:element:uml:C#naam"]);
  assert.equal(standVan(cKnoop, keuze), "gemengd");
  keuze = zetKnoop(cKnoop, keuze, "rechts");
  assert.equal(standVan(cKnoop, keuze), "rechts");
  assert.equal(keuze["element:uml:C"], true, "ook het element zelf");
  assert.equal(keuzeTelling([c, een], keuze).conflictTak, 1);
  keuze = zetKnoop(cKnoop.kinderen[1], keuze, "links");
  assert.deepEqual(keuzeTelling([c], keuze), { gekozen: 1, nietGekozen: 0, terug: 0, conflictTak: 1, conflictMain: 0, buitenGekozen: 0, vanMain: 0 }, "deels mee telt als gekozen");
});
