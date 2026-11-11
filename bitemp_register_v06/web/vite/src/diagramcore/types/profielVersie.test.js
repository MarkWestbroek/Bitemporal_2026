import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProfielVersie,
  vergelijkVersies,
  versieVan,
  noteerProfielVersies,
  beoordeelProfielVersies,
  profielVersieMelding,
  profielVingerafdruk,
} from "./profielVersie.js";
import { valideerDiagramType } from "./typeRegistry.js";

test("versies vergelijken", () => {
  assert.ok(isProfielVersie("1.2.3"));
  assert.ok(!isProfielVersie("1.2"));
  assert.ok(!isProfielVersie(1));
  assert.ok(vergelijkVersies("1.10.0", "1.9.9") > 0);
  assert.equal(vergelijkVersies("2.0.0", "2.0.0"), 0);
  assert.ok(vergelijkVersies("onzin", "0.0.1") < 0);
  assert.equal(versieVan({}), "1.0.0");
  assert.equal(versieVan({ versie: "2.1.0" }), "2.1.0");
});

test("noteren: de versie van deze Studio, maar een nieuwere notitie blijft staan", () => {
  const beschikbaar = { diagram05: "1.2.0", bpmnMotor05: "1.0.0", leeg05: "1.0.0" };
  assert.deepEqual(noteerProfielVersies(["diagram05", "bpmnMotor05"], beschikbaar), { bpmnMotor05: "1.0.0", diagram05: "1.2.0" });
  // Bewaard met een nieuwere Studio: hier bewaren maakt de inhoud niet ouder.
  assert.deepEqual(noteerProfielVersies(["diagram05"], beschikbaar, { diagram05: "1.3.0" }), { diagram05: "1.3.0" });
  // Ouder project: na bewaren staat het op de versie van deze Studio (de migratie heeft gedraaid).
  assert.deepEqual(noteerProfielVersies(["diagram05"], beschikbaar, { diagram05: "1.0.0" }), { diagram05: "1.2.0" });
  // Profiel dat deze Studio niet kent: de notitie reist ongewijzigd mee, net als de inhoud.
  assert.deepEqual(noteerProfielVersies(["ea05"], beschikbaar, { ea05: "2.0.0" }), { ea05: "2.0.0" });
  // Geen inhoud meer in het project: geen notitie.
  assert.deepEqual(noteerProfielVersies([], beschikbaar, { diagram05: "1.3.0" }), {});
});

test("beoordelen: alleen een project dat nieuwer is dan de Studio is een bevinding", () => {
  const beschikbaar = { a: "1.2.0", b: "1.2.0", c: "1.2.0", d: "1.2.0" };
  assert.deepEqual(beoordeelProfielVersies(undefined, beschikbaar), []);
  assert.deepEqual(
    beoordeelProfielVersies({ a: "2.0.0", b: "1.3.0", c: "1.2.9", d: "1.0.0", onbekend: "9.0.0" }, beschikbaar),
    [
      { profielId: "a", project: "2.0.0", studio: "1.2.0", ernst: "major" },
      { profielId: "b", project: "1.3.0", studio: "1.2.0", ernst: "minor" },
    ],
  );
  assert.equal(profielVersieMelding([]), "");
  const tekst = profielVersieMelding(beoordeelProfielVersies({ a: "2.0.0", b: "1.3.0" }, beschikbaar), (id) => id.toUpperCase());
  assert.match(tekst, /A: project 2\.0\.0, deze Studio 1\.2\.0/);
  assert.match(tekst, /B: project 1\.3\.0, deze Studio 1\.2\.0/);
});

test("vingerafdruk: structuur telt, weergave niet", () => {
  const basis = () => ({
    id: "t",
    label: "T",
    elementTypes: [
      { id: "ding", label: "Ding", kleur: "#fff", properties: [{ key: "naam", label: "Naam" }] },
      { id: "lijn", label: "Lijn", isConnector: true, bron: ["ding"], doel: ["ding"] },
    ],
  });
  const f0 = profielVingerafdruk(basis());
  assert.match(f0, /^[0-9a-f]{16}$/);
  // Weergave: label, kleur, volgorde van de typen, een hook.
  const w = basis();
  w.label = "Anders";
  w.elementTypes[0].kleur = "#000";
  w.elementTypes[0].properties[0].label = "De naam";
  w.elementTypes.reverse();
  w.hooks = { migreerModel: () => null };
  assert.equal(profielVingerafdruk(w), f0);
  // Structuur: een eigenschap erbij, een ander datatype, een ruimere verbindingsregel, een type erbij.
  const s1 = basis();
  s1.elementTypes[0].properties.push({ key: "code" });
  const s2 = basis();
  s2.elementTypes[0].properties[0].datatype = "tekst";
  const s3 = basis();
  s3.elementTypes[1].doel = ["ding", "lijn"];
  const s4 = basis();
  s4.elementTypes.push({ id: "extra", label: "Extra" });
  const alle = [f0, ...[s1, s2, s3, s4].map(profielVingerafdruk)];
  assert.equal(new Set(alle).size, alle.length);
});

test("valideerDiagramType: een versie moet er als 1.2.3 uitzien", () => {
  const dt = (versie) => ({ id: "v", label: "V", style: "s", versie, elementTypes: [{ id: "x", label: "X", shape: "class-box" }] });
  assert.ok(!valideerDiagramType(dt("1.0.0")).some((f) => /versie/.test(f)));
  assert.ok(!valideerDiagramType(dt(undefined)).some((f) => /versie/.test(f)));
  assert.ok(valideerDiagramType(dt("v2")).some((f) => /versie "v2"/.test(f)));
});
