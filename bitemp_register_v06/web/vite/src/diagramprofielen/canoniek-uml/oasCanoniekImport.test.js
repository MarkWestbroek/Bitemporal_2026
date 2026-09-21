// oasCanoniekImport.test.js — het hele importpad OAS-bestand → canoniek model,
// met gestubde stores (zoals archimateImport.test.js).
// Run met: npm test  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import { wisTransformaties, getTransformaties, detecteerTransformatie } from "../../studio/activities/transformatieRegistry.js";
import { registreerOasCanoniekImport, lijktOpOas, parseOasTekst, prefixeerCoreModel } from "./oasCanoniekImport.js";

const OAS_YAML = `openapi: 3.1.0
info:
  title: Kleine API
components:
  schemas:
    Persoon:
      type: object
      properties:
        id:
          type: integer
        achternaam:
          type: string
        adres:
          $ref: '#/components/schemas/Adres'
      required:
        - id
        - achternaam
    Adres:
      type: object
      properties:
        straat:
          type: string
      required:
        - straat
`;

/** Minimale stubs: een profielstore met importeerModel en een modelleren-map. */
function maakStubs() {
  const store = { elements: {}, diagrams: {} };
  const geplaatst = [];
  const profiel = {
    useStore: {
      getState: () => ({
        importeerModel: (model) => {
          for (const id of Object.keys(model.elements)) {
            if (store.elements[id]) throw new Error(`id-botsing: ${id}`);
          }
          Object.assign(store.elements, model.elements);
          Object.assign(store.diagrams, model.diagrams);
        },
      }),
    },
  };
  return {
    store,
    geplaatst,
    deps: {
      getProfieltype: (id) => (id === "diagram05" ? profiel : null),
      getModellerenState: () => ({
        mappen: { map1: { id: "map1", naam: "Import" } },
        plaatsDiagram: (sleutel, mapId) => geplaatst.push([sleutel, mapId]),
      }),
    },
  };
}

function descriptor() {
  return getTransformaties("import").find((t) => t.id === "import-oas-canoniek");
}

test("herkenning: een OAS 3.x met schemas scoort, andere bestanden niet", () => {
  assert.equal(lijktOpOas({ tekst: OAS_YAML }), 1);
  assert.equal(lijktOpOas({ tekst: '{"swagger":"2.0"}' }), 0);
  assert.equal(lijktOpOas({ tekst: "<model xmlns='archimate'/>" }), 0);
});

test("parseOasTekst leest zowel JSON als YAML", () => {
  assert.equal(parseOasTekst(OAS_YAML).info.title, "Kleine API");
  assert.equal(parseOasTekst('{"info":{"title":"J"}}').info.title, "J");
});

test("prefixeerCoreModel hernoemt elementen, connectoren en diagram-verwijzingen", () => {
  const core = {
    elements: {
      a: { id: "a", naam: "A" },
      r: { id: "r", naam: "R", source: "a", target: "b" },
      b: { id: "b", naam: "B" },
    },
    diagrams: {
      d: { id: "d", nodes: [{ elementId: "a" }], edges: [{ id: "e", source: "a", target: "b" }] },
    },
    meta: { compositieEdges: [{ id: "c", source: "a", target: "b" }] },
  };
  const uit = prefixeerCoreModel(core, "p_");
  assert.deepEqual(Object.keys(uit.elements).sort(), ["p_a", "p_b", "p_r"]);
  assert.equal(uit.elements.p_r.source, "p_a");
  assert.equal(uit.elements.p_r.target, "p_b");
  assert.equal(uit.diagrams.p_d.nodes[0].elementId, "p_a");
  assert.equal(uit.diagrams.p_d.edges[0].source, "p_a");
  assert.equal(uit.meta.compositieEdges[0].target, "p_b");
});

test("de transformatie registreert zich en wordt gekozen voor een OAS-bestand", () => {
  wisTransformaties();
  registreerOasCanoniekImport(maakStubs().deps);
  const def = descriptor();
  assert.ok(def, "transformatie niet geregistreerd");
  assert.deepEqual(def.profielTypes, ["diagram05"]);
  const gekozen = detecteerTransformatie(getTransformaties("import"), { naam: "api.yaml", tekst: OAS_YAML });
  assert.equal(gekozen?.id, "import-oas-canoniek");
});

test("run importeert het model in het profiel en plaatst het in de doelmap", async () => {
  wisTransformaties();
  const { store, geplaatst, deps } = maakStubs();
  registreerOasCanoniekImport(deps);

  const resultaat = await descriptor().run({
    bron: { naam: "api.yaml", tekst: OAS_YAML },
    doelMap: "map1",
    opties: { domein: "demo", technischeVelden: false },
  });

  assert.equal(resultaat.status, "success");
  assert.match(resultaat.summary, /1 entiteiten/);
  const namen = Object.values(store.elements).map((el) => el.naam);
  assert.ok(namen.includes("Persoon"), `Persoon ontbreekt: ${namen.join(", ")}`);
  assert.ok(namen.includes("Adres"), "het geneste schema moet een gegevenselement zijn");
  assert.equal(geplaatst.length, 1);
  assert.match(geplaatst[0][0], /^diagram05::/);
  assert.equal(geplaatst[0][1], "map1");
});

test("twee imports van hetzelfde document botsen niet", async () => {
  wisTransformaties();
  const { deps } = maakStubs();
  registreerOasCanoniekImport(deps);
  const bron = { naam: "api.yaml", tekst: OAS_YAML };
  await descriptor().run({ bron, doelMap: "map1", opties: {} });
  await descriptor().run({ bron, doelMap: "map1", opties: {} });
});

test("run weigert netjes zonder bestand, zonder map of bij onleesbare inhoud", async () => {
  wisTransformaties();
  const { deps } = maakStubs();
  registreerOasCanoniekImport(deps);
  const def = descriptor();
  await assert.rejects(() => def.run({ bron: null, doelMap: "map1" }), /OpenAPI-bestand/);
  await assert.rejects(() => def.run({ bron: { tekst: OAS_YAML }, doelMap: "weg" }), /doelmap/);
  await assert.rejects(() => def.run({ bron: { tekst: "{ dit is: [geen" }, doelMap: "map1" }), /geldige JSON of YAML/);
});
