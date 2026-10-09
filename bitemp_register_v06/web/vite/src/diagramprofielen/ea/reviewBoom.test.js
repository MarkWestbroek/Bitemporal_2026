// reviewBoom.test.js — review-boom van een EA-import: profiel → pakket → regels.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/reviewBoom.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { vergelijkMetStore } from "./vergelijkImport.js";
import { deelboomPakketten } from "./qeaHulp.js";
import { bouwReviewBoom, bladSleutels, telStatus } from "./reviewBoom.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "metametamodel.qea.json"), "utf8"));
const PAKKET = 2376;
const pakketIds = new Set(deelboomPakketten(bron.t_package, PAKKET));

test("eerste import: één profieltak, daaronder het pakket, met alle regels als bladeren (bevat niet)", () => {
  const leeg = { elements: {}, diagrams: {} };
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  const plan = vergelijkMetStore(model, leeg, { pakketIds });
  const boom = bouwReviewBoom([{ naam: "UML", model, plan, bestaand: leeg }], bron, pakketIds);
  assert.equal(boom.length, 1);
  assert.equal(boom[0].label, "UML");
  const pakketten = boom[0].kinderen.filter((k) => k.kinderen);
  assert.ok(pakketten.length >= 1, "pakkettak(ken) onder het profiel");
  const sleutels = bladSleutels(boom);
  const verwacht = plan.elementen.nieuw.filter((r) => r.elementType !== "bevat").length + plan.diagrammen.nieuw.length;
  assert.equal(sleutels.length, verwacht);
  assert.ok(sleutels.every((s) => s.startsWith("UML|")));
  assert.ok(sleutels.some((s) => s.startsWith("UML|di:")), "diagrammen zitten erin");
  const t = telStatus(boom[0]);
  assert.equal(t.nieuw, verwacht);
  assert.equal(t.gewijzigd + t.verdwenen, 0);
});

test("verdwenen regel komt onder het pakket van het bestaande element; standaard uit", () => {
  const model = qeaNaarPuurUml(bron, { packageId: PAKKET, schaal: 1 });
  // Bestaande store: alles, plus een element dat in EA niet meer bestaat.
  const bestaand = { elements: { ...model.elements }, diagrams: { ...model.diagrams } };
  const et = Object.values(model.elements).find((e) => e.naam === "ElementType");
  bestaand.elements["ea-weg"] = { ...et, id: "ea-weg", naam: "Weg", data: { ...et.data, eaGuid: "{00000000-0000-0000-0000-00000000dead}" } };
  const plan = vergelijkMetStore(model, bestaand, { pakketIds });
  const boom = bouwReviewBoom([{ naam: "UML", model, plan, bestaand }], bron, pakketIds);
  const weg = [];
  const loop = (k) => (k.kinderen ? k.kinderen.forEach(loop) : k.status === "verdwenen" && weg.push(k));
  boom.forEach(loop);
  assert.equal(weg.length, 1);
  assert.equal(weg[0].aan, false);
  assert.equal(weg[0].sleutel, "UML|weg:ea-weg");
});
