/**
 * Tests voor het cd-node-ShapeType (plan 2026-11-04 Eén tekenaar, stap 4).
 * Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/component-deployment/vormen.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_DEPLOYMENT_SHAPETYPES } from "./vormen.js";
import { tekenbareVorm } from "../../diagramcore/types/shapeType.js";
import { bouwVoorkomen, tekenVoorkomen, basisVanPalet } from "../../diagramcore/tekenaar/voorkomen.js";
import { maakPalet } from "../../diagramsvg/thema.js";

const basis = basisVanPalet(maakPalet("light"));

test("node: kubus (voor-, boven- en zijvlak) met stereotype en naam op het voorvlak; leden in het voorvlak", () => {
  for (const st of COMPONENT_DEPLOYMENT_SHAPETYPES) assert.ok(tekenbareVorm(st.id), st.id);
  assert.ok(tekenbareVorm("sysml-poort"), "de poort komt mee uit sysml/vormen.js");
  const vormInfo = tekenbareVorm("cd-node");
  const et = { id: "node", shape: "cd-node", stereotype: "«node»", kleur: "#e2e8f0", containerVoor: "bevat", minBreedte: 160, minHoogte: 90 };
  const box = bouwVoorkomen({ element: { id: "n", naam: "Webserver", elementType: "node", data: {}, compartimenten: [] }, elementType: et, ...vormInfo, basis, idPrefix: "a" });
  const uit = tekenVoorkomen(box, { controleer: true });
  assert.deepEqual(uit.fouten, []);
  assert.deepEqual([box.w, box.h], [160, 90]);
  assert.equal(uit.omtrek.kinderen.length, 3);
  assert.equal(uit.omtrek.kinderen[0].attrs.fill, "#e2e8f0");
  assert.equal(uit.omtrek.kinderen[1].attrs.opacity, 0.85, "bovenvlak lichter");
  assert.deepEqual(box.renderer.kindervak(box.ctx), { x: 0, y: 10, w: 150, h: 80 });
  const teksten = uit.inhoud.kinderen.filter((k) => k.tag === "text").map((k) => k.kinderen[0]);
  assert.deepEqual(teksten, ["«node»", "Webserver"]);
  assert.ok(uit.inhoud.kinderen[0].attrs.y > 10, "inhoud begint onder het bovenvlak");
});
