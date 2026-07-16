import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVeldpad, bouwVeldInfoUitLayout } from "./schemaResolve.js";

const typeMeta = {
  Initiatief: {
    typenaam: "Initiatief",
    velden: [{ naam: "id", type: "integer" }],
    onderliggende: [
      { doeltype: "Initiatief_Product", jsonRolnaam: "producten", momentvoorkomen: "enkelvoudig" },
      { doeltype: "Initiatief_Bijdrage", jsonRolnaam: "bijdragen", momentvoorkomen: "meervoudig" },
    ],
  },
  Initiatief_Product: { typenaam: "Initiatief_Product", onderliggende: [{ doeltype: "Initiatief_Product_Data" }] },
  Initiatief_Product_Data: { ge_subtype: "data", velden: [{ naam: "naam", type: "string" }, { naam: "cg_laag", type: "string", enum: ["Laag 1", "Laag 5"] }] },
  Initiatief_Bijdrage: { typenaam: "Initiatief_Bijdrage", onderliggende: [{ doeltype: "Initiatief_Bijdrage_Data" }] },
  Initiatief_Bijdrage_Data: { ge_subtype: "data", velden: [{ naam: "toelichting", type: "string" }] },
};

test("resolveVeldpad: GE-veld → velddef + momentvoorkomen", () => {
  const info = resolveVeldpad("Initiatief.producten.naam", typeMeta);
  assert.equal(info.veldnaam, "naam");
  assert.equal(info.momentvoorkomen, "enkelvoudig");
});

test("resolveVeldpad: enum wordt meegenomen", () => {
  const info = resolveVeldpad("Initiatief.producten.cg_laag", typeMeta);
  assert.deepEqual(info.enum, ["Laag 1", "Laag 5"]);
});

test("resolveVeldpad: korte naam (geen pad) → null (geen legacy-resolver)", () => {
  assert.equal(resolveVeldpad("naam", typeMeta), null);
});

test("resolveVeldpad: onbekend pad → null", () => {
  assert.equal(resolveVeldpad("Initiatief.bestaatniet.x", typeMeta), null);
});

test("bouwVeldInfoUitLayout: full-path velden + relatieve lijst-velden", () => {
  const layout = {
    type: "formulier",
    elementen: [
      { type: "groep", label: "Product", elementen: [{ type: "veld", veld: "Initiatief.producten.naam" }] },
      { type: "lijst", bron: "Initiatief.bijdragen", elementen: [{ type: "veld", veld: "toelichting" }] },
    ],
  };
  const info = bouwVeldInfoUitLayout(layout, typeMeta);
  assert.ok(info["Initiatief.producten.naam"], "full-path veld opgelost");
  assert.ok(info["Initiatief.bijdragen.toelichting"], "relatief lijst-veld opgelost naar vol pad");
  assert.equal(info["Initiatief.bijdragen.toelichting"].momentvoorkomen, "meervoudig");
});
