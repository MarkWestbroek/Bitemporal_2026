import { test } from "node:test";
import assert from "node:assert/strict";
import { padVan, bouwCustomVeldMapping, bouwCustomWijzigingen } from "./customFormMapping.js";

const coerce = (raw) => raw;

// Gedeelde GE-info voor de save-tests (Initiatief.producten → Initiatief_Product).
function productInfo(actueel = { rel_id: 1, initiatief_id: 38, naam: "Oud" }) {
  return {
    childMeta: { typenaam: "Initiatief_Product", veldnaam: "product", entiteitIDKolom: "initiatief_id", idKolom: "" },
    dataMeta: { velden: [{ naam: "naam" }, { naam: "pitch" }] },
    actueel,
    entTypenaam: "Initiatief",
    rol: "producten",
  };
}

test("padVan voegt niet-lege delen samen", () => {
  assert.equal(padVan("Initiatief", "producten", "naam"), "Initiatief.producten.naam");
  assert.equal(padVan("Initiatief", "", "naam"), "Initiatief.naam");
});

test("save: korte-naam edit (legacy) → juiste GE-wijziging", () => {
  const info = productInfo();
  const { wijzigingen, geenWijzigingen } = bouwCustomWijzigingen({
    customEditValues: { naam: "Nieuw" },
    customValues: { naam: "Oud" },
    veldNaarGE: { naam: info, "Initiatief.producten.naam": info },
    id: 38,
    coerce,
  });
  assert.equal(geenWijzigingen, false);
  assert.equal(wijzigingen.length, 1);
  assert.deepEqual(wijzigingen[0], { opvoer: { product: { initiatief_id: 38, rel_id: 1, naam: "Nieuw" } } });
});

test("save: full-path edit → zelfde GE-wijziging via padlookup", () => {
  const info = productInfo();
  const { wijzigingen } = bouwCustomWijzigingen({
    customEditValues: { "Initiatief.producten.naam": "Nieuw" },
    customValues: { "Initiatief.producten.naam": "Oud" },
    veldNaarGE: { naam: info, "Initiatief.producten.naam": info },
    id: 38,
    coerce,
  });
  assert.equal(wijzigingen.length, 1);
  assert.deepEqual(wijzigingen[0], { opvoer: { product: { initiatief_id: 38, rel_id: 1, naam: "Nieuw" } } });
});

test("save: geen echte wijziging → geenWijzigingen", () => {
  const info = productInfo();
  const r = bouwCustomWijzigingen({
    customEditValues: { naam: "Oud" },
    customValues: { naam: "Oud" },
    veldNaarGE: { naam: info },
    id: 38,
    coerce,
  });
  assert.equal(r.geenWijzigingen, true);
  assert.equal(r.wijzigingen.length, 0);
});

test("save: leeg verplicht veld → fout", () => {
  const info = {
    ...productInfo({ rel_id: 1, initiatief_id: 38, naam: "Oud" }),
    dataMeta: { velden: [{ naam: "naam", verplicht: true }] },
  };
  assert.throws(
    () => bouwCustomWijzigingen({
      customEditValues: { "Initiatief.producten.naam": "" },
      customValues: { "Initiatief.producten.naam": "Oud" },
      veldNaarGE: { "Initiatief.producten.naam": info },
      id: 38,
      coerce,
    }),
    /naam is verplicht/
  );
});

test("mapping: registreert korte naam én vol pad; collision → korte naam = eerste GE", () => {
  const platSla = (items) => items; // items zijn al 'plat' in de test
  const typeMetaByTypenaam = {
    Initiatief_Product: { typenaam: "Initiatief_Product", veldnaam: "product", entiteitIDKolom: "initiatief_id",
      onderliggende: [{ doeltype: "Initiatief_Product_Data" }] },
    Initiatief_Product_Data: { ge_subtype: "data", velden: [{ naam: "naam" }, { naam: "pitch" }] },
    Initiatief_Beoordeling: { typenaam: "Initiatief_Beoordeling", veldnaam: "beoordeling", entiteitIDKolom: "initiatief_id",
      onderliggende: [{ doeltype: "Initiatief_Beoordeling_Data" }] },
    Initiatief_Beoordeling_Data: { ge_subtype: "data", velden: [{ naam: "naam" }] }, // zelfde korte naam!
  };
  const entity = {
    producten: [{ naam: "Signalen", pitch: "p", opvoer: "t", initiatief_id: 38 }],
    beoordelingen: [{ naam: "Goud", opvoer: "t", initiatief_id: 38 }],
  };
  const onderliggende = [
    { doeltype: "Initiatief_Product", jsonRolnaam: "producten", rolnaam: "producten" },
    { doeltype: "Initiatief_Beoordeling", jsonRolnaam: "beoordelingen", rolnaam: "beoordelingen" },
  ];

  const { customValues, veldNaarGE } = bouwCustomVeldMapping({
    entity, typeMeta: { typenaam: "Initiatief" }, onderliggende, typeMetaByTypenaam, platSla,
  });

  // Volle paden uniek en correct gemapt
  assert.equal(customValues["Initiatief.producten.naam"], "Signalen");
  assert.equal(customValues["Initiatief.beoordelingen.naam"], "Goud");
  assert.equal(veldNaarGE["Initiatief.producten.naam"].childMeta.typenaam, "Initiatief_Product");
  assert.equal(veldNaarGE["Initiatief.beoordelingen.naam"].childMeta.typenaam, "Initiatief_Beoordeling");
  // Korte naam 'naam' = eerste GE (Product) — legacy-gedrag behouden
  assert.equal(veldNaarGE["naam"].childMeta.typenaam, "Initiatief_Product");
});
