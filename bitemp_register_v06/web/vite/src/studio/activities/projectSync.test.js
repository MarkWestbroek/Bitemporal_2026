// projectSync.test.js — normalisatie van het project-werkbestand (v1 → v2).
// Run: node --import ./test/register-aliases.mjs --test src/studio/activities/projectSync.test.js

import test from "node:test";
import assert from "node:assert/strict";

import {
  normaliseerProjectData,
  projectNaamUitBestandsnaam,
  bestandsstamVoor,
  nieuwProjectId,
} from "./projectSync.js";

test("v1-bestand krijgt een id en een naam uit de bestandsnaam", () => {
  const uit = normaliseerProjectData(
    { formaat: "studio-project", versie: 1, profielen: {} },
    { bestandsnaam: "np-loc 2026.json" }
  );
  assert.equal(uit.ok, true);
  assert.equal(uit.data.versie, 3);
  assert.equal(uit.data.project.naam, "np-loc 2026");
  assert.match(uit.data.project.id, /^[A-Za-z0-9_-]{8,64}$/);
  assert.deepEqual(uit.data.profielen, {});
});

test("v2-bestand behoudt zijn id en naam", () => {
  const uit = normaliseerProjectData({
    formaat: "studio-project",
    versie: 2,
    project: { id: "abc-123-def-456", naam: "Mijn project" },
  });
  assert.equal(uit.ok, true);
  assert.deepEqual(uit.data.project, { id: "abc-123-def-456", naam: "Mijn project" });
});

test("verkeerd formaat, geen object en nieuwere versie worden geweigerd", () => {
  assert.equal(normaliseerProjectData({ formaat: "iets" }).ok, false);
  assert.equal(normaliseerProjectData([1, 2]).ok, false);
  assert.equal(normaliseerProjectData(null).ok, false);
  assert.equal(normaliseerProjectData({ formaat: "studio-project", versie: 99 }).ok, false);
});

test("naam uit bestandsnaam en bestandsstam uit naam", () => {
  assert.equal(projectNaamUitBestandsnaam("studio-project-2026-10-07.json"), "studio-project-2026-10-07");
  assert.equal(projectNaamUitBestandsnaam(""), "Naamloos project");
  assert.equal(bestandsstamVoor("Mijn Project — Éérste versie!"), "mijn-project-eerste-versie");
  assert.equal(bestandsstamVoor("   "), "studio-project");
});

test("nieuwe id's zijn uniek en server-geldig", () => {
  const a = nieuwProjectId();
  const b = nieuwProjectId();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/);
});
