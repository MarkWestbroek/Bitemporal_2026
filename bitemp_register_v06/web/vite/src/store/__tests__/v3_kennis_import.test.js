import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v3ModelNaarStore } from "../adapters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("v3ModelNaarStore — kennis2 V3 file: posities komen mee in overzicht-diagram", () => {
  const file = path.resolve(
    __dirname,
    "../../../../../docs/Model files (V3)/v0.1.2.4 kennis2 V3.json"
  );
  const v3 = JSON.parse(fs.readFileSync(file, "utf8"));
  const r = v3ModelNaarStore(v3);

  assert.ok(Object.keys(r.elements).length > 0, "elements aanwezig");
  assert.ok(r.diagrams.overzicht, "overzicht-diagram aanwezig");
  const ov = r.diagrams.overzicht;
  assert.ok(ov.nodes.length > 0, "overzicht heeft nodes");

  const ka = ov.nodes.find((n) => n.elementId === "Kennisartikel");
  assert.ok(ka, "Kennisartikel-node aanwezig");
  assert.equal(ka.position.x, 255, "Kennisartikel.x uit V3");
  assert.equal(ka.position.y, -45, "Kennisartikel.y uit V3");

  const kaTr = ov.nodes.find((n) => n.elementId === "KA_Tr");
  assert.ok(kaTr, "KA_Tr-relatie node aanwezig");
  assert.equal(kaTr.position.x, 495, "KA_Tr.x uit V3");
});
