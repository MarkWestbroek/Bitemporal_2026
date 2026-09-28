import { test } from "node:test";
import assert from "node:assert/strict";
import { naarRichting, middelste, naarAlfabet, naarLetter, zoekOpKaart } from "./kaartNavigatie.js";

//        0 midden   1 rechts   2 links   3 boven   4 onder   5 rechtsboven, ver
const punten = [{ x: 50, y: 50 }, { x: 60, y: 51 }, { x: 40, y: 49 }, { x: 50, y: 40 }, { x: 51, y: 62 }, { x: 70, y: 20 }];

test("pijltjes lopen naar de buurman in die richting", () => {
  assert.equal(naarRichting(punten, 0, "ArrowRight"), 1);
  assert.equal(naarRichting(punten, 0, "ArrowLeft"), 2);
  assert.equal(naarRichting(punten, 0, "ArrowUp"), 3);
  assert.equal(naarRichting(punten, 0, "ArrowDown"), 4);
});

test("niets in die richting: blijven staan; onbekende toets of positie: niets", () => {
  assert.equal(naarRichting(punten, 2, "ArrowLeft"), 2);
  assert.equal(naarRichting(punten, 0, "Enter"), 0);
  assert.equal(naarRichting(punten, -1, "ArrowUp"), -1);
});

test("rechtdoor gaat voor schuin (afwijking telt dubbel)", () => {
  // Vanaf 1 omhoog: 3 ligt schuin-links, 5 verder weg maar ook schuin; 3 wint op afstand.
  assert.equal(naarRichting(punten, 1, "ArrowUp"), 3);
});

test("middelste: beginpunt dichtst bij het midden", () => {
  assert.equal(middelste(punten), 0);
  assert.equal(middelste([]), -1);
});

const labels = ["Hoorn", "Almere", "Urk", "Amsterdam", "Utrecht", "Harlingen", "Émmen", "'s-Gravenhage"];
test("Shift+←/→: vorige/volgende in het alfabet, rondlopend", () => {
  // alfabetisch: Almere, Amsterdam, Émmen, Harlingen, Hoorn, 's-Gravenhage, Urk, Utrecht
  assert.equal(labels[naarAlfabet(labels, 1, 1)], "Amsterdam");
  assert.equal(labels[naarAlfabet(labels, 4, 1)], "Almere"); // Utrecht is de laatste
  assert.equal(labels[naarAlfabet(labels, 0, 1)], "'s-Gravenhage"); // Hoorn → s
  assert.equal(labels[naarAlfabet(labels, 1, -1)], "Utrecht");
  assert.equal(labels[naarAlfabet(labels, -1, 1)], "Almere");
});

test("Shift+↑/↓: eerste gemeente van de vorige/volgende letter", () => {
  assert.equal(labels[naarLetter(labels, 3, 1)], "Émmen"); // A → É (zonder accent: E)
  assert.equal(labels[naarLetter(labels, 0, 1)], "'s-Gravenhage"); // H → S (de apostrof telt niet)
  assert.equal(labels[naarLetter(labels, 7, 1)], "Urk"); // S → U
  assert.equal(labels[naarLetter(labels, 2, 1)], "Almere"); // U → A (rond)
  assert.equal(labels[naarLetter(labels, 0, -1)], "Émmen"); // H → É
  assert.equal(labels[naarLetter(labels, -1, 1)], "Almere");
});

test("zoeken op gemeente en woonplaats, met accenten en hoofdletters", () => {
  const k = [
    { label: "Medemblik", woonplaatsen: ["Andijk", "Medemblik", "Wervershoof"] },
    { label: "Hoorn", woonplaatsen: ["Blokker", "Hoorn"] },
    { label: "Súdwest-Fryslân", woonplaatsen: ["Sneek", "Workum"] },
    { label: "Wervershoven (test)", woonplaatsen: [] },
  ];
  assert.deepEqual(zoekOpKaart(k, "wervers"), [{ index: 3, via: null }, { index: 0, via: "Wervershoof" }]);
  assert.deepEqual(zoekOpKaart(k, "sudwest"), [{ index: 2, via: null }]);
  assert.deepEqual(zoekOpKaart(k, "HOORN"), [{ index: 1, via: null }]);
  assert.deepEqual(zoekOpKaart(k, "orn"), [{ index: 1, via: null }]);
  assert.deepEqual(zoekOpKaart(k, "  "), []);
});
