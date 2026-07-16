import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutNaarFormulierModel } from "./adapter.js";

const layout = {
  type: "formulier",
  elementen: [
    { type: "groep", label: "Product", elementen: [
      { type: "veld", veld: "Initiatief.producten.naam" },
      { type: "rij", elementen: [
        { type: "veld", veld: "Initiatief.producten.website", breedte: "50%" },
        { type: "veld", veld: "Initiatief.producten.git_repo", breedte: "50%" },
      ] },
      { type: "veld", veld: "Initiatief.producten.pitch", label: "Pitch!" },
    ] },
    { type: "lijst", bron: "Initiatief.bijdragen", label: "Bijdragen", elementen: [
      { type: "veld", veld: "toelichting" },
    ] },
    { type: "conditioneel", conditie: { veld: "Initiatief.producten.git_repo", op: "nietleeg" }, dan: [
      { type: "groep", label: "Repo aanwezig", elementen: [{ type: "veld", veld: "Initiatief.producten.git_repo", readonly: true }] },
    ] },
  ],
};
const meta = { naam: "Testformulier", doeltype: "Initiatief", status: "actief", isStandaard: true, definitieVersie: "1.0" };

function alle(model, type) {
  return Object.values(model.elements).filter((e) => e.elementType === type);
}

test("containers worden nodes; velden compartiment-regels", () => {
  const m = layoutNaarFormulierModel(layout, meta);
  assert.equal(alle(m, "formulier").length, 1);
  assert.equal(alle(m, "groep").length, 2);
  assert.equal(alle(m, "rij").length, 1);
  assert.equal(alle(m, "lijst").length, 1);
  assert.equal(alle(m, "conditioneel").length, 1);

  const groepProduct = alle(m, "groep").find((g) => g.naam === "Product");
  const velden = groepProduct.compartimenten[0].velden;
  assert.equal(velden.length, 2, "naam + pitch (rij is sub-container)");
  assert.equal(velden[0].data.veld, "Initiatief.producten.naam");
  assert.equal(velden[1].naam, "Pitch!", "label wint als weergavenaam");
  assert.equal(velden[1].data.volgorde, "2", "volgorde-index behouden");
});

test("nesting via bevat-connectoren met volgorde", () => {
  const m = layoutNaarFormulierModel(layout, meta);
  const bevat = alle(m, "bevat");
  // formulier→groep, formulier→lijst, formulier→conditioneel, groep→rij, conditioneel→groep
  assert.equal(bevat.length, 5);
  const vanFormulier = bevat.filter((c) => m.elements[c.source].elementType === "formulier");
  assert.deepEqual(vanFormulier.map((c) => c.data.volgorde), ["0", "1", "2"]);
  for (const c of bevat) {
    assert.ok(m.elements[c.source] && m.elements[c.target], "source/target bestaan");
  }
});

test("meta landt op het formulier-element + coreModel", () => {
  const m = layoutNaarFormulierModel(layout, meta);
  const frm = alle(m, "formulier")[0];
  assert.equal(frm.naam, "Testformulier");
  assert.equal(frm.data.doeltype, "Initiatief");
  assert.equal(frm.data.status, "actief");
  assert.equal(frm.data.isStandaard, true);
  assert.equal(m.meta.naam, "Testformulier");
});

test("conditie + lijst-bron als properties; diagram met posities", () => {
  const m = layoutNaarFormulierModel(layout, meta);
  const cond = alle(m, "conditioneel")[0];
  assert.equal(cond.data.conditieVeld, "Initiatief.producten.git_repo");
  const lijst = alle(m, "lijst")[0];
  assert.equal(lijst.data.bron, "Initiatief.bijdragen");
  const diag = Object.values(m.diagrams)[0];
  assert.equal(diag.nodes.length, 6, "elke container een node");
  assert.ok(diag.nodes.every((n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)));
});

test("string-als (legacy) wordt nietleeg-conditie; lege layout → leeg model", () => {
  const m1 = layoutNaarFormulierModel({ type: "formulier", elementen: [{ type: "conditioneel", als: "git_repo", dan: [] }] });
  const cond = Object.values(m1.elements).find((e) => e.elementType === "conditioneel");
  assert.equal(cond.data.conditieVeld, "git_repo");
  const m2 = layoutNaarFormulierModel(null);
  assert.equal(Object.keys(m2.elements).length, 0);
});
