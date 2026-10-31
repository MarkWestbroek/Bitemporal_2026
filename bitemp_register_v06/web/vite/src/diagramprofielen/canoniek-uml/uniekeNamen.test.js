// uniekeNamen.test.js — naam/pad uniek per domein, altijd actief (31-10).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/uniekeNamen.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { naamBotsingen } from "./uniekeNamen.js";
import { importeerV3 } from "./serialisatie.js";
import { valideerElement } from "../../diagramcore/model/validatie.js";
import { registreerCanoniekUml } from "./index.js";

const CG_TEST = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/cg-test/omnium-model-cg-test-v3.json"), "utf8"));

const el = (id, elementType, naam, domein = "d", extra = {}) => ({ id, elementType, naam, compartimenten: [], data: { domein }, ...extra });

test("het cg-test-model heeft geen botsingen", () => {
  const { elements } = importeerV3(CG_TEST);
  const fouten = Object.values(elements).flatMap((e) => naamBotsingen(e, { elements }).map((m) => `${e.id}: ${m.tekst}`));
  assert.deepEqual(fouten, []);
});

test("zelfde naam in hetzelfde domein botst, ook tussen soorten; in een ander domein niet", () => {
  const elements = {
    a: el("a", "entiteit", "Status"),
    b: el("b", "enumeratie", "Status"),
    c: el("c", "entiteit", "Status", "ander"),
  };
  assert.equal(naamBotsingen(elements.a, { elements }).length, 1);
  assert.match(naamBotsingen(elements.b, { elements })[0].tekst, /domein d/);
  assert.equal(naamBotsingen(elements.c, { elements }).length, 0);
});

test("domein uit het package (bevat) wint van data.domein", () => {
  const elements = {
    pkg: el("pkg", "package", "inrichting", ""),
    a: el("a", "entiteit", "Product", "oud"),
    b: el("b", "entiteit", "Product", "inrichting"),
    bev: { id: "bev", elementType: "bevat", source: "pkg", target: "a", data: {} },
  };
  assert.equal(naamBotsingen(elements.a, { elements }).length, 1);
});

test("GE-pad uniek per entiteit; velden uniek per element", () => {
  const elements = {
    e: el("e", "entiteit", "Kaart"),
    g1: el("g1", "gegevenselement", "Naam"),
    g2: el("g2", "gegevenselement", "Naam", "d", {
      compartimenten: [{ compartmentType: "velden", velden: [{ naam: "tekst" }, { naam: "tekst" }] }],
    }),
    c1: { id: "c1", elementType: "compositie", source: "e", target: "g1", data: {} },
    c2: { id: "c2", elementType: "compositie", source: "e", target: "g2", data: {} },
  };
  const m = naamBotsingen(elements.g2, { elements }).map((x) => x.tekst);
  assert.ok(m.some((t) => /heeft al een gegevenselement "Naam"/.test(t)));
  assert.ok(m.some((t) => /veld "tekst" komt meer dan eens voor/.test(t)));
});

test("de hook draait via het profiel (entiteit erft van representatie), als fout", () => {
  const dt = registreerCanoniekUml();
  const entType = dt.elementTypes.find((t) => t.id === "entiteit");
  const elements = { a: el("a", "entiteit", "X"), b: el("b", "entiteit", "X") };
  const uit = valideerElement(entType, elements.a, { elements });
  assert.equal(uit.length, 1);
  assert.equal(uit[0].niveau, "fout");
});
