import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { indexeerUitleggen, kiesTaal, uitlegVoor, layoutGebruiktUitleg } from "./uitleg.js";

const uitleg = (id, code, status, teksten, extra = {}) => ({
  id,
  uitleg_metas: [{ rel_id: 1, data: [{ code, naam: code, status }] }],
  uitleg_teksten: teksten.map(([taal, titel, tekst], i) => ({ rel_id: i + 1, data: [{ taal, titel, tekst }] })),
  ...extra,
});

describe("indexeerUitleggen", () => {
  it("indexeert actieve uitleg op code, per taal", () => {
    const idx = indexeerUitleggen([
      uitleg(1, "adres-postcode", "actief", [["nl", "Postcode", "Vier cijfers en twee letters."], ["en", "Postcode", "Four digits, two letters."]]),
      uitleg(2, "concept-tekst", "concept", [["nl", "", "Nog niet klaar."]]),
      uitleg(3, "weg", "actief", [["nl", "", "Afgevoerd."]], { afvoer: "2026-09-01T00:00:00Z" }),
      uitleg(4, "leeg", "actief", [["nl", "", "  "]]),
    ]);
    assert.deepEqual(Object.keys(idx), ["adres-postcode"]);
    assert.equal(idx["adres-postcode"].teksten.en.tekst, "Four digits, two letters.");
  });

  it("neemt de laatste versie en slaat afgevoerde hubs en versies over", () => {
    const u = uitleg(1, "x", "actief", []);
    u.uitleg_metas[0].data.push({ code: "x", status: "inactief" });
    assert.deepEqual(indexeerUitleggen([u]), {});
    const v = uitleg(2, "y", "actief", [["nl", "", "oud"]]);
    v.uitleg_teksten[0].data.push({ taal: "nl", titel: "", tekst: "nieuw" });
    v.uitleg_teksten.push({ rel_id: 9, afvoer: "2026-01-01", data: [{ taal: "en", tekst: "weg" }] });
    assert.deepEqual(indexeerUitleggen([v]).y.teksten, { nl: { titel: "", tekst: "nieuw" } });
  });
});

describe("kiesTaal", () => {
  const t = { nl: { tekst: "nl" }, en: { tekst: "en" } };
  it("gevraagde taal, anders nl, anders de eerste", () => {
    assert.equal(kiesTaal(t, "en").tekst, "en");
    assert.equal(kiesTaal(t, "fy").tekst, "nl");
    assert.equal(kiesTaal({ de: { tekst: "de" } }, "fy").tekst, "de");
    assert.equal(kiesTaal(undefined), null);
  });
});

describe("uitlegVoor", () => {
  const index = { "adres-postcode": { teksten: { nl: { titel: "Postcode", tekst: "Vier cijfers en twee letters." } } } };
  it("uit de lijst, met titel", () => {
    assert.deepEqual(uitlegVoor({ uitleg: "adres-postcode" }, { index }), { titel: "Postcode", tekst: "Vier cijfers en twee letters.", bediening: "", code: "adres-postcode" });
  });
  it("eigen tekst gaat voor de lijst", () => {
    assert.equal(uitlegVoor({ uitleg: "adres-postcode", uitlegTekst: "Van het bezoekadres." }, { index }).tekst, "Van het bezoekadres.");
  });
  it("alleen bediening van de vorm, tenzij uitgezet", () => {
    assert.deepEqual(uitlegVoor({}, { bediening: "Klik op een stip." }), { titel: "", tekst: "", bediening: "Klik op een stip.", code: "" });
    assert.equal(uitlegVoor({ vormUitleg: false }, { bediening: "Klik op een stip." }), null);
  });
  it("niets of een onbekende code: geen rondje", () => {
    assert.equal(uitlegVoor({}), null);
    assert.equal(uitlegVoor({ uitleg: "bestaat-niet" }, { index }), null);
  });
});

describe("layoutGebruiktUitleg", () => {
  it("vindt een verwijzing diep in de layout", () => {
    assert.equal(layoutGebruiktUitleg({ type: "formulier", elementen: [{ type: "groep", elementen: [{ type: "conditioneel", dan: [{ type: "veld", uitleg: "x" }] }] }] }), true);
    assert.equal(layoutGebruiktUitleg({ type: "formulier", elementen: [{ type: "veld", uitlegTekst: "alleen inline" }] }), false);
    assert.equal(layoutGebruiktUitleg({ type: "formulier", elementen: [{ type: "lijst", vorm: "nl-map" }] }), true);
    assert.equal(layoutGebruiktUitleg({ type: "formulier", elementen: [{ type: "lijst", vorm: "nl-map", vormUitleg: false }] }), false);
  });
});

describe("soort vorm", () => {
  const index = indexeerUitleggen([
    { id: 7, uitleg_metas: [{ data: [{ code: "vorm-nl-map", soort: "vorm", status: "actief" }] }], uitleg_teksten: [{ data: [{ taal: "nl", tekst: "Klik op een stip (uit de lijst)." }, ] }, { data: [{ taal: "en", tekst: "Click a dot." }] }] },
    { id: 8, uitleg_metas: [{ data: [{ code: "vorm-color", status: "actief" }] }], uitleg_teksten: [{ data: [{ taal: "nl", tekst: "Geen soort = inhoud." }] }] },
  ]);
  it("de lijst gaat voor het register, per taal; leeg soort = inhoud", () => {
    assert.equal(index["vorm-nl-map"].soort, "vorm");
    assert.equal(index["vorm-color"].soort, "inhoud");
    assert.equal(uitlegVoor({}, { index, vorm: "nl-map", bediening: "register" }).bediening, "Klik op een stip (uit de lijst).");
    assert.equal(uitlegVoor({}, { index, taal: "en", vorm: "nl-map", bediening: "register" }).bediening, "Click a dot.");
  });
  it("een inhoud-uitleg met een vorm-code telt niet als bediening; dan het register", () => {
    assert.equal(uitlegVoor({}, { index, vorm: "color", bediening: "register" }).bediening, "register");
  });
  it("vormUitleg: false zet ook de lijst-bediening uit", () => {
    assert.equal(uitlegVoor({ vormUitleg: false }, { index, vorm: "nl-map", bediening: "register" }), null);
  });
});
