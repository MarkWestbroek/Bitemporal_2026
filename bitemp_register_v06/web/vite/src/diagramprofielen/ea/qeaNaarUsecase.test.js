// qeaNaarUsecase.test.js — EA use case-diagram → use case-profiel, op de fixture
// UC.NPA.REG.0010 (use cases uit vier pakketten, klassen, kaders, includes met voorwaarde).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarUsecase.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarUsecase } from "./qeaNaarUsecase.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "uc-npa-reg-0010.qea.json"), "utf8"));
const model = qeaNaarUsecase(bron, { packageId: 1272, schaal: 1 });
const els = Object.values(model.elements);
const van = (type) => els.filter((e) => e.elementType === type);
const opNaam = (naam) => els.find((e) => e.naam === naam);

test("het use case-profiel kent de typen die de lezer gebruikt (drift-check op de tekst; index.js laadt shapes)", () => {
  const tekst = readFileSync(join(hier, "..", "usecase", "index.js"), "utf8");
  for (const id of ["collaboratie", "klasse", "realiseert", "dependency", "notitielijn", "include", "extend", "associatie", "generalisatie"]) {
    assert.ok(tekst.includes(`id: "${id}"`), id);
  }
});

test("één use case-diagram met 12 voorkomens; de andere twee diagrammen geteld", () => {
  assert.equal(model.verslag.diagrammen, 1);
  const d = Object.values(model.diagrams)[0];
  assert.equal(d.diagramType, "usecase");
  assert.equal(d.nodes.length, 12);
  assert.equal(model.verslag.overgeslagen["diagram Activity"], 1);
  assert.equal(model.verslag.overgeslagen["diagram Logical"], 1);
});

test("use cases uit vier pakketten, klassen en kaders komen mee", () => {
  assert.equal(van("usecase").length, 4);
  assert.equal(van("klasse").length, 5); // 4 klassen + 1 interface
  assert.equal(van("boundary").length, 3);
  const iface = opNaam("NatuurlijkPersoonRegistratiegebeurtenisService");
  assert.equal(iface.elementType, "klasse");
  assert.equal(iface.data.eaType, "Interface");
  const uc = opNaam("UC.NPA.REG.0010 Registreren Natuurlijk Persoon");
  assert.deepEqual(uc.data.stereotypen, ["registreren"]);
});

test("includes met voorwaarde uit PDATA4; «legt vast»-dependencies naar de registratieklassen", () => {
  const inc = van("include");
  assert.equal(inc.length, 3);
  const uc = opNaam("UC.NPA.REG.0010 Registreren Natuurlijk Persoon");
  const naarVastleggen = inc.find((i) => i.source === uc.id && model.elements[i.target].naam.startsWith("UC.NPA.NP.0030"));
  assert.equal(naarVastleggen.data.voorwaarde, "natuurlijk persoon niet vastgelegd");
  const deps = van("dependency");
  assert.equal(deps.filter((d) => d.naam === "«legt vast»").length, 4);
  const legtVast = deps.find((d) => d.source === uc.id && d.naam === "«legt vast»");
  assert.equal(model.elements[legtVast.target].naam, "NatuurlijkPersoonRegistratie");
});

test("klasse-relaties op het diagram worden associaties met hun stereotype als label", () => {
  const assocs = van("associatie");
  assert.ok(assocs.length >= 5);
  assert.ok(assocs.some((a) => a.naam === "«betreft»" && a.data.eaConnectorType === "Aggregation"));
  assert.ok(assocs.some((a) => a.naam === "«formeel»"));
});
