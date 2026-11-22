import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { zetToolVersie, zetGeladen, wisGeladen, geladen, noteerGebruikt, vergelijkGebruikt, gebruiktMelding, soortVan, kopUitDeCode, beschrijf } from "./projectGebruik.js";
import { normaliseerProjectData, PROJECT_FORMAAT } from "./activities/projectSync.js";

beforeEach(() => {
  wisGeladen();
  zetToolVersie("0.47.0");
});

test("soorten en wat ze gebruiken: model beide, weergaven de profielen, profielen niets", () => {
  assert.equal(soortVan({}), "model");
  assert.equal(soortVan({ soort: "raar" }), "model");
  assert.deepEqual(Object.keys(noteerGebruikt("model")), ["profielen", "weergaven"]);
  assert.deepEqual(Object.keys(noteerGebruikt("weergaven")), ["profielen"]);
  assert.deepEqual(noteerGebruikt("profielen"), {});
  assert.deepEqual(geladen("weergaven"), { bron: "code", versie: "0.47.0" });
  assert.deepEqual(kopUitDeCode("weergaven"), { soort: "weergaven", versie: "0.47.0", gebruikt: { profielen: { bron: "code", versie: "0.47.0" } } });
});

test("waarschuwen bij een ander project of een andere versie; code tegenover code niet", () => {
  // Een andere Studio-versie met beide uit de code: geen waarschuwing (dat doen de profielversies).
  assert.deepEqual(vergelijkGebruikt({ gebruikt: { profielen: { bron: "code", versie: "0.40.0" }, weergaven: { bron: "code", versie: "0.40.0" } } }), []);
  // Gemaakt met een weergaveproject, nu de code.
  const project = { gebruikt: { weergaven: { bron: "project", id: "omnium-weergaven", naam: "Omnium weergaven", versie: "0.3.0", concept: false } } };
  const v = vergelijkGebruikt(project);
  assert.equal(v.length, 1);
  const tekst = gebruiktMelding(v);
  assert.match(tekst, /weergaven: gemaakt met 0\.3\.0 uit "Omnium weergaven", nu uit de code \(Studio 0\.47\.0\)/);
  // Hetzelfde project geladen: geen verschil; als concept: wel.
  zetGeladen("weergaven", { id: "omnium-weergaven", naam: "Omnium weergaven", versie: "0.3.0", concept: false });
  assert.deepEqual(vergelijkGebruikt(project), []);
  zetGeladen("weergaven", { id: "omnium-weergaven", versie: "0.3.0" });
  assert.equal(beschrijf(geladen("weergaven")), '0.3.0 + concept uit "omnium-weergaven"');
  assert.equal(vergelijkGebruikt(project).length, 1);
  // Zonder gebruikt (een ouder project): niets te melden.
  assert.deepEqual(vergelijkGebruikt({}), []);
  assert.equal(gebruiktMelding([]), null);
});

test("normaliseerProjectData laat soort, versie en gebruikt staan", () => {
  const uit = normaliseerProjectData({ formaat: PROJECT_FORMAAT, versie: 4, project: { id: "omnium-weergaven", naam: "W", soort: "weergaven", versie: "0.3.0", gebruikt: { profielen: { bron: "code", versie: "x" } }, raar: 1 }, profielen: {} });
  assert.ok(uit.ok);
  assert.deepEqual(uit.data.project, { id: "omnium-weergaven", naam: "W", soort: "weergaven", versie: "0.3.0", gebruikt: { profielen: { bron: "code", versie: "x" } } });
});
