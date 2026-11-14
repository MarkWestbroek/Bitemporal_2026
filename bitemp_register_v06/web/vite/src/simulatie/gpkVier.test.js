// GPK in vier processen (Mark 13-11, ontwerp Simulatie §11.6): Aanvraag oppakken → signaal
// zaak-in-werkbak → Kies zaak om te behandelen → signaal medewerker-gekoppeld → Zaak behandelen,
// met Gehandicaptenparkeerkaart beoordelen als call activity. Dezelfde vijf scenario's als op de
// drie processen van Fundament (simulatie.test.js), plus de claim.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { maakSimulatie } from "./simulatie.js";
import { metProcessen } from "./procesmodel.js";
import { objectenVanType, PROCESINSTANTIE } from "./store.js";

const CG = new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam, basis = CG) => JSON.parse(fs.readFileSync(new URL(naam, basis), "utf8"));
const scenario = (nr) => lees(`./fixtures/gpk-scenario-${nr}.json`, import.meta.url);
const vier = lees("./fixtures/gpk-vier-processen.bpmn-model.json", import.meta.url);
const m1 = {
  proces: vier,
  beslissingen: [lees("gpk-beslissingen.dmn-model.json")],
  edienst: metProcessen(lees("gpk-edienst.json"), vier.processen),
};
const draai = (sc) => {
  const sim = maakSimulatie({ m1, scenario: sc });
  return { sim, stand: sim.loop(), t: sim.toestand() };
};
const einde = (stand, proces) => stand.eindes.filter((e) => e.proces === proces).map((e) => e.einde);

test("vier processen: het e-dienstmodel noemt vier process-id's", () => {
  const sim = maakSimulatie({ m1, scenario: scenario(4) });
  assert.deepEqual(sim.processen.map((p) => p.id).sort(), ["aanvraag-oppakken", "gehandicaptenparkeerkaart-beoordelen", "zaak-behandelen", "zaak-kiezen"]);
});

for (const nr of [1, 2, 3]) {
  test(`vier processen, scenario ${nr}: niet ontvankelijk, geen zaak, de werkbak hoort niets`, () => {
    const sc = scenario(nr);
    const { stand, sim } = draai(sc);
    assert.equal(stand.soort, "uitkomst");
    assert.deepEqual(stand.eindes, [{ proces: "aanvraag-oppakken", einde: sc.verwacht.einde }]);
    assert.ok(!sim.log.some((r) => r.signaal));
  });
}

test("vier processen, scenario 4: oppakken eindigt bij de werkbak; kiezen, behandelen en beoordelen volgen", () => {
  const { stand, t, sim } = draai(scenario(4));
  assert.equal(stand.soort, "uitkomst", JSON.stringify(stand));
  assert.deepEqual(einde(stand, "aanvraag-oppakken"), ["Zaak staat in de werkbak"]);
  assert.deepEqual(einde(stand, "zaak-kiezen"), ["Medewerker aan zaak gekoppeld"]);
  assert.deepEqual(einde(stand, "zaak-behandelen"), ["Beschikt"]);
  assert.deepEqual(einde(stand, "gehandicaptenparkeerkaart-beoordelen"), ["Beoordeling afgerond"]);
  // De medewerker uit de werkbak is behandelaar; de beoordeling kwam via de call activity terug.
  assert.equal(t.objecten["aanvraag-1"].data.behandelaar, "medewerker-gpk-1");
  assert.equal(t.variabelen.uitkomst, "toegekend");
  // Twee signalen, elk met één ontvanger; geen berichten meer.
  assert.deepEqual(
    sim.log.filter((r) => r.signaal).map((r) => [r.signaal.naam, r.signaal.ontvangers]),
    [
      ["zaak-in-werkbak", ["Kies zaak om te behandelen"]],
      ["medewerker-gekoppeld", ["Zaak behandelen"]],
    ],
  );
  assert.ok(!sim.log.some((r) => r.bericht));
  // Beoordelen is een kind van behandelen.
  const beoordelen = objectenVanType(t, PROCESINSTANTIE).find((i) => i.data.proces === "gehandicaptenparkeerkaart-beoordelen");
  assert.ok(beoordelen.data.ouderToken);
});

test("vier processen, scenario 5: aanvulling, twee keer beoordelen (twee kindinstanties), afgewezen", () => {
  const { stand, t } = draai(scenario(5));
  assert.equal(stand.soort, "uitkomst", JSON.stringify(stand));
  assert.deepEqual(einde(stand, "zaak-behandelen"), ["Beschikt"]);
  assert.equal(einde(stand, "gehandicaptenparkeerkaart-beoordelen").length, 2);
  assert.equal(t.variabelen.uitkomst, "afgewezen");
});

// De claim zelf (een andere kandidaat koppelt eerst) staat in simulatie.test.js; daar is een
// tweede luisteraar voor nodig, en die zit niet in de vier processen.
test("vier processen: met de hand staat de werkbaktaak open voor de kandidaatgroep", () => {
  const sc = { ...scenario(4), vulwijze: { ...scenario(4).vulwijze, perGat: { "zaak-kiezen": "hand" } } };
  const sim = maakSimulatie({ m1, scenario: sc });
  const stand = sim.loop();
  assert.equal(stand.soort, "gat");
  assert.equal(stand.gaten[0].naam, "Kies zaak om te behandelen");
  assert.equal(stand.gaten[0].kandidaatgroep, "behandelaars-gpk");
});

// ── De lading is de zaak; FUNSIM's scenario's 6 tot 8 (cg-stack-voor-simulatie.md §9.5) ──

test("vier processen: de zaak is een eigen object met het zaaktype uit het e-dienstmodel, en de lading van het signaal", () => {
  const { t } = draai(scenario(4));
  assert.equal(t.objecten.zaak.type, "Zaak");
  assert.equal(t.objecten.zaak.data.zaaktype, "GPK");
  assert.match(t.objecten.zaak.data.url, /^https:\/\/stub\.example\//);
  // Het filter kijkt naar de zaak: een veld van de aanvraag bestaat daar niet.
  const sc = scenario(4);
  const vierMetAanvraagFilter = structuredClone(vier);
  const start = Object.values(vierMetAanvraagFilter.model.elements).find((e) => e.data?.signaal === "zaak-in-werkbak" && e.elementType === "start-event");
  start.data.filter = "aanvraagtype.code == 'GPK'";
  const sim = maakSimulatie({ m1: { ...m1, proces: vierMetAanvraagFilter }, scenario: sc });
  sim.loop();
  const werkbak = sim.log.find((r) => r.signaal?.naam === "zaak-in-werkbak");
  assert.deepEqual(werkbak.signaal.ontvangers, []);
});

test("scenario 6: een zaak van een ander zaaktype start Kies zaak niet", () => {
  const anders = { ...m1.edienst, artefacten: m1.edienst.artefacten.map((a) => (a.soort === "zaaktype" ? { ...a, identifier: "ANDERS" } : a)) };
  const sim = maakSimulatie({ m1: { ...m1, edienst: anders }, scenario: scenario(4) });
  const stand = sim.loop();
  assert.equal(stand.soort, "uitkomst");
  assert.deepEqual(stand.eindes, [{ proces: "aanvraag-oppakken", einde: "Zaak staat in de werkbak" }]);
  assert.deepEqual(sim.log.find((r) => r.signaal).signaal, { naam: "zaak-in-werkbak", ontvangers: [] });
});

/** Het voorbeeld met een of meer routers erbij: elk luistert op de werkbak en koppelt meteen. */
function metRouters(aantal) {
  const v = structuredClone(vier);
  const processen = [...v.processen];
  for (let i = 1; i <= aantal; i++) {
    const p = `router${i}`;
    v.model.elements[`${p}_start`] = { id: `${p}_start`, naam: "Zaak staat in de werkbak", elementType: "start-event", compartimenten: [], data: { soort: "signaal", signaal: "zaak-in-werkbak", filter: "zaaktype == 'GPK'" } };
    v.model.elements[`${p}_wijs`] = { id: `${p}_wijs`, naam: "Wijs automatisch toe", elementType: "taak", compartimenten: [], data: { taakSoort: "service" } };
    v.model.elements[`${p}_einde`] = { id: `${p}_einde`, naam: "Gekoppeld door de router", elementType: "eind-event", compartimenten: [], data: { soort: "signaal", signaal: "medewerker-gekoppeld" } };
    v.model.elements[`${p}_f1`] = { id: `${p}_f1`, naam: "", elementType: "sequence-flow", source: `${p}_start`, target: `${p}_wijs`, compartimenten: [], data: {} };
    v.model.elements[`${p}_f2`] = { id: `${p}_f2`, naam: "", elementType: "sequence-flow", source: `${p}_wijs`, target: `${p}_einde`, compartimenten: [], data: {} };
    v.model.diagrams[p] = { id: p, naam: `Router ${i}`, diagramType: "bpmn-motor", nodes: ["start", "wijs", "einde"].map((x) => ({ elementId: `${p}_${x}` })), edges: [] };
    processen.push({ identifier: p, diagram: `Router ${i}` });
  }
  return { ...m1, proces: v, edienst: metProcessen(m1.edienst, processen) };
}

test("scenario 7: router en medewerker op één zaak; de router koppelt eerst, de taak van de medewerker stopt", () => {
  // De werkbaktaak met de hand: zo staat hij open als de router koppelt.
  const sc = { ...scenario(4), vulwijze: { ...scenario(4).vulwijze, perGat: { "zaak-kiezen": "hand" } } };
  const sim = maakSimulatie({ m1: metRouters(1), scenario: sc });
  const stand = sim.loop();
  assert.equal(stand.soort, "uitkomst", JSON.stringify(stand));
  assert.deepEqual(einde(stand, "zaak-kiezen"), ["Al toegewezen"]);
  assert.deepEqual(einde(stand, "router1"), ["Gekoppeld door de router"]);
  assert.deepEqual(einde(stand, "zaak-behandelen"), ["Beschikt"]);
  const werkbak = sim.log.find((r) => r.signaal?.naam === "zaak-in-werkbak");
  assert.deepEqual(werkbak.signaal.ontvangers, ["Kies zaak om te behandelen", "Router 1"]);
  const gekoppeld = sim.log.find((r) => r.signaal?.naam === "medewerker-gekoppeld");
  assert.deepEqual(gekoppeld.signaal.ontvangers, ["Medewerker aan zaak gekoppeld op Kies zaak om te behandelen", "Zaak behandelen"]);
  assert.ok(sim.log.flatMap((r) => r.wijzigingen).some((w) => w.soort === "gat" && w.vervallen), "het gat van de medewerker vervalt");
});

test("scenario 8: medewerker-gekoppeld twee keer; één Zaak behandelen, de tweede start wordt geweigerd", () => {
  const sc = { ...scenario(4), vulwijze: { ...scenario(4).vulwijze, perGat: { "zaak-kiezen": "hand" } } };
  const sim = maakSimulatie({ m1: metRouters(2), scenario: sc });
  const stand = sim.loop();
  assert.equal(stand.soort, "uitkomst", JSON.stringify(stand));
  assert.deepEqual(einde(stand, "zaak-behandelen"), ["Beschikt"]);
  const tweede = sim.log.filter((r) => r.signaal?.naam === "medewerker-gekoppeld")[1];
  assert.deepEqual(tweede.signaal.geweigerd, [{ waar: "Zaak behandelen", reden: "er loopt voor deze zaak al een instantie" }]);
});
