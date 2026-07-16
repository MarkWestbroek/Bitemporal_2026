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

// ── Lijst (meervoudig) save ──
function bijdrageInfo() {
  return {
    childMeta: { typenaam: "Initiatief_Bijdrage", veldnaam: "bijdrage", entiteitIDKolom: "initiatief_id", idKolom: "" },
    dataMeta: { velden: [{ naam: "toelichting" }, { naam: "score" }] },
    entTypenaam: "Initiatief", rol: "bijdragen", isMeervoudig: true,
  };
}
const BRON = "Initiatief.bijdragen";
const origItems = [
  { rel_id: 1, initiatief_id: 38, toelichting: "A", score: "1", opvoer: "t" },
  { rel_id: 2, initiatief_id: 38, toelichting: "B", score: "2", opvoer: "t" },
];

test("lijst-save: gewijzigd bestaand item → opvoer met rel_id", () => {
  const { wijzigingen } = bouwCustomWijzigingen({
    customEditValues: { [BRON]: [ { rel_id: 1, initiatief_id: 38, toelichting: "A2", score: "1" }, { rel_id: 2, initiatief_id: 38, toelichting: "B", score: "2" } ] },
    customValues: { [BRON]: origItems },
    veldNaarGE: { [BRON]: bijdrageInfo() },
    id: 38, coerce,
  });
  assert.deepEqual(wijzigingen, [{ opvoer: { bijdrage: { initiatief_id: 38, rel_id: 1, toelichting: "A2", score: "1" } } }]);
});

test("lijst-save: nieuw item (geen rel_id) → opvoer zonder rel_id", () => {
  const { wijzigingen } = bouwCustomWijzigingen({
    customEditValues: { [BRON]: [ ...origItems, { toelichting: "C", score: "3" } ] },
    customValues: { [BRON]: origItems },
    veldNaarGE: { [BRON]: bijdrageInfo() },
    id: 38, coerce,
  });
  assert.deepEqual(wijzigingen, [{ opvoer: { bijdrage: { initiatief_id: 38, toelichting: "C", score: "3" } } }]);
});

test("lijst-save: verwijderd item → afvoer", () => {
  const { wijzigingen } = bouwCustomWijzigingen({
    customEditValues: { [BRON]: [ { rel_id: 1, initiatief_id: 38, toelichting: "A", score: "1" } ] },
    customValues: { [BRON]: origItems },
    veldNaarGE: { [BRON]: bijdrageInfo() },
    id: 38, coerce,
  });
  assert.deepEqual(wijzigingen, [{ afvoer: { bijdrage: { initiatief_id: 38, rel_id: 2 } } }]);
});

test("lijst-save: geen wijziging → geenWijzigingen", () => {
  const r = bouwCustomWijzigingen({
    customEditValues: { [BRON]: origItems.map((x) => ({ ...x })) },
    customValues: { [BRON]: origItems },
    veldNaarGE: { [BRON]: bijdrageInfo() },
    id: 38, coerce,
  });
  assert.equal(r.geenWijzigingen, true);
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

test("mapping: entiteit-id + afgeleide velden read-only op vol pad (F46)", () => {
  const { customValues, customVelden, veldNaarGE } = bouwCustomVeldMapping({
    entity: { id: 38, producten: [] },
    typeMeta: { typenaam: "Initiatief", idKolom: "id", afgeleideVelden: [{ naam: "weergavenaam", type: "string", afleidingsregelTaal: "cel", afleidingsregel: "x" }] },
    onderliggende: [],
    typeMetaByTypenaam: {},
    afgeleideWaarden: { weergavenaam: "Signalen" },
    platSla: (x) => x,
  });
  assert.equal(customValues["Initiatief.id"], 38, "id-waarde uit entity");
  assert.equal(customValues["Initiatief.weergavenaam"], "Signalen", "afgeleide waarde uit afgeleideWaarden");
  assert.ok(customVelden.find((v) => v.naam === "Initiatief.id" && v.readonly), "id is read-only velddef");
  assert.ok(customVelden.find((v) => v.naam === "Initiatief.weergavenaam" && v.readonly), "afgeleide is read-only velddef");
  // Geen veldNaarGE → worden nooit opgeslagen
  assert.equal(veldNaarGE["Initiatief.id"], undefined);
});

test("mapping: meervoudig GE → array onder bron + isMeervoudig", () => {
  const platSla = (items) => items;
  const typeMetaByTypenaam = {
    Initiatief_Bijdrage: { typenaam: "Initiatief_Bijdrage", veldnaam: "bijdrage", entiteitIDKolom: "initiatief_id",
      onderliggende: [{ doeltype: "Initiatief_Bijdrage_Data" }] },
    Initiatief_Bijdrage_Data: { ge_subtype: "data", velden: [{ naam: "toelichting" }, { naam: "score" }] },
  };
  const entity = {
    bijdragen: [
      { rel_id: 1, initiatief_id: 38, toelichting: "A", score: "1", opvoer: "t" },
      { rel_id: 2, initiatief_id: 38, toelichting: "B", score: "2", opvoer: "t" },
      { rel_id: 3, initiatief_id: 38, toelichting: "weg", opvoer: "t", afvoer: "t2" }, // afgevoerd → niet mee
    ],
  };
  const onderliggende = [{ doeltype: "Initiatief_Bijdrage", jsonRolnaam: "bijdragen", rolnaam: "bijdragen", momentvoorkomen: "meervoudig" }];
  const { customValues, veldNaarGE } = bouwCustomVeldMapping({
    entity, typeMeta: { typenaam: "Initiatief" }, onderliggende, typeMetaByTypenaam, platSla,
  });
  const arr = customValues["Initiatief.bijdragen"];
  assert.ok(Array.isArray(arr));
  assert.equal(arr.length, 2, "alleen actuele (niet-afgevoerde) items");
  assert.equal(arr[0].toelichting, "A");
  assert.equal(veldNaarGE["Initiatief.bijdragen"].isMeervoudig, true);
});
