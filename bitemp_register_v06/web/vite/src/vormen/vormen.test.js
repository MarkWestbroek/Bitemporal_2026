import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVOERSOORT, normaliseerVorm, vormPastBij, vormenVoor, invoersoortVanVeld,
  lijstVorm, standaardVorm, effectieveVorm, keuzesNaarRijen,
} from "./vormen.js";

const enumVeld = { naam: "schaal", type: "string", enum: ["1", "2", "3", "4"] };
const refVeld = { naam: "gemeente_id", type: "integer", ref: "Gemeente" };

test("invoersoort volgt uit het model, niet uit de vorm", () => {
  assert.equal(invoersoortVanVeld(enumVeld), INVOERSOORT.EEN_UIT_LIJST);
  assert.equal(invoersoortVanVeld(refVeld), INVOERSOORT.EEN_UIT_LIJST);
  assert.equal(invoersoortVanVeld(refVeld, { meervoudig: true }), INVOERSOORT.MEER_UIT_LIJST);
  assert.equal(invoersoortVanVeld({ type: "boolean" }), INVOERSOORT.JA_NEE);
  assert.equal(invoersoortVanVeld({ type: "string", format: "date" }), INVOERSOORT.DATUM);
  assert.equal(invoersoortVanVeld({ type: "number" }), INVOERSOORT.GETAL);
  assert.equal(invoersoortVanVeld({ type: "string" }), INVOERSOORT.TEKST);
  assert.equal(invoersoortVanVeld({ type: "string" }, { meervoudig: true }), null);
});

test("oude widget-namen worden vormen", () => {
  assert.equal(normaliseerVorm("radio"), "radio-group");
  assert.equal(normaliseerVorm("textarea"), "text-area");
  assert.equal(normaliseerVorm("image-map"), "image-map");
  assert.equal(normaliseerVorm(""), null);
  assert.equal(normaliseerVorm("color"), "color"); // datatype-hint, geen vorm: ongemoeid
});

test("image-map bedient één én meer uit een lijst; vinkjes alleen meer", () => {
  assert.ok(vormPastBij("image-map", INVOERSOORT.EEN_UIT_LIJST));
  assert.ok(vormPastBij("image-map", INVOERSOORT.MEER_UIT_LIJST));
  assert.ok(!vormPastBij("image-map", INVOERSOORT.TEKST));
  assert.ok(!vormPastBij("checkbox-group", INVOERSOORT.EEN_UIT_LIJST));
  assert.ok(vormPastBij("radio", INVOERSOORT.EEN_UIT_LIJST), "alias telt mee");
  const namen = vormenVoor(INVOERSOORT.MEER_UIT_LIJST).map((v) => v.naam);
  assert.deepEqual(namen.sort(), ["button-group", "checkbox-group", "combobox", "image-map"]);
});

test("rating-grid bedient alleen één-per-rij", () => {
  assert.ok(vormPastBij("rating-grid", INVOERSOORT.EEN_PER_RIJ));
  assert.ok(!vormPastBij("rating-grid", INVOERSOORT.MEER_UIT_LIJST));
  assert.deepEqual(vormenVoor(INVOERSOORT.EEN_PER_RIJ).map((v) => v.naam), ["rating-grid"]);
  assert.equal(lijstVorm({ type: "lijst", vorm: "rating-grid" }), "rating-grid");
});

test("lijstVorm: vorm wint van widget meerkeuze; zonder beide een rijen-lijst", () => {
  assert.equal(lijstVorm({ type: "lijst", bron: "X.y" }), null);
  assert.equal(lijstVorm({ type: "lijst", widget: "meerkeuze" }), "meerkeuze");
  assert.equal(lijstVorm({ type: "lijst", widget: "meerkeuze", vorm: "image-map" }), "image-map");
});

test("standaard- en effectieve vorm (huidig gedrag blijft)", () => {
  assert.equal(standaardVorm(INVOERSOORT.EEN_UIT_LIJST, enumVeld), "select");
  assert.equal(standaardVorm(INVOERSOORT.EEN_UIT_LIJST, refVeld), "combobox");
  assert.equal(standaardVorm(INVOERSOORT.MEER_UIT_LIJST, enumVeld), "checkbox-group");
  assert.equal(effectieveVorm({ widget: "radio" }, enumVeld), "radio-group");
  assert.equal(effectieveVorm({ vorm: "image-map", widget: "radio" }, enumVeld), "image-map");
  // Een vorm die niet bij de inhoud past, valt terug op de standaard.
  assert.equal(effectieveVorm({ vorm: "image-map" }, { type: "string" }), "text-input");
});

test("keuzesNaarRijen: dezelfde rijen, welke vorm ook kiest", () => {
  const vast = { rol: "Realiseert" };
  const alle = [
    { rol: "Realiseert", gemeente_id: "1" },
    { rol: "Maakt gebruik van", gemeente_id: "2" }, // andere lijst op dezelfde bron
    { rol: "Realiseert", gemeente_id: "3" },
  ];
  const eigenIdx = [0, 2];
  const uit = keuzesNaarRijen(alle, eigenIdx, "gemeente_id", vast, ["3", "4"]);
  assert.deepEqual(uit, [
    { rol: "Maakt gebruik van", gemeente_id: "2" },
    { rol: "Realiseert", gemeente_id: "3" },
    { rol: "Realiseert", gemeente_id: "4" },
  ]);
  assert.strictEqual(uit[1], alle[2], "een rij die gekozen blijft, blijft hetzelfde object");
  assert.deepEqual(keuzesNaarRijen(alle, eigenIdx, "gemeente_id", vast, []), [alle[1]]);
  assert.equal(keuzesNaarRijen([], [], "v", {}, ["a", "a", ""]).length, 1, "dubbel en leeg tellen niet");
});

test("lijst in één veld: invoersoort meer uit een lijst; splitsen en samenvoegen in enum-volgorde", async () => {
  const { splitsLijst, voegLijstSamen } = await import("./vormen.js");
  const lagen = { naam: "CG_laag", enum: ["Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur", "Utility"], lijstScheiding: ";" };
  assert.equal(invoersoortVanVeld(lagen), INVOERSOORT.MEER_UIT_LIJST);
  assert.equal(invoersoortVanVeld({ ...lagen, lijstScheiding: undefined }), INVOERSOORT.EEN_UIT_LIJST);
  assert.equal(effectieveVorm({ vorm: "image-map" }, lagen), "image-map");
  assert.equal(effectieveVorm({ widget: "radio" }, lagen), "checkbox-group", "radio past niet bij meer uit een lijst");
  assert.deepEqual(splitsLijst(" Laag 1; Laag 2;;Laag 1"), ["Laag 1", "Laag 2"]);
  assert.deepEqual(splitsLijst(""), []);
  assert.equal(voegLijstSamen(["Utility", "Laag 1", "Laag 2"], ";", lagen.enum), "Laag 2;Laag 1;Utility");
  assert.equal(voegLijstSamen([], ";", lagen.enum), "");
});
