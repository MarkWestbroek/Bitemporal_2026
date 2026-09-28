import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Bewaakt de kaartdata van de vorm nl-map (scripts/maak_nl_kaartdata.py): elke gemeentestip ligt
// op land (niet in zee of het IJsselmeer, zoals vóór 28-09 bij Urk, Hoorn en de Waddeneilanden),
// en Caribisch Nederland staat in zijn kaders.
const kaart = JSON.parse(readFileSync(new URL("./data/nl-kaart.json", import.meta.url), "utf8"));
const ringen = (pad) => pad.split("M").filter(Boolean).map((d) => d.replace("Z", "").split("L").map((p) => p.split(",").map(Number)));
const binnen = ([x, y], ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

test("elke gemeentestip ligt op land", () => {
  const land = kaart.provincies.flatMap((p) => ringen(p.pad));
  const inZee = Object.values(kaart.gemeenten).filter((g) => !g.kader && !land.some((r) => binnen([g.x, g.y], r))).map((g) => g.naam);
  assert.deepEqual(inZee, []);
});

test("Caribisch Nederland: drie eilanden, elk in zijn eigen kader", () => {
  for (const code of ["GM9001", "GM9002", "GM9003"]) {
    const g = kaart.gemeenten[code];
    assert.ok(g, code);
    const k = kaart.kaders.find((k) => k.titel === g.kader);
    assert.ok(k, `kader voor ${g.naam}`);
    const [x, y, b, h] = k.kader;
    assert.ok(g.x > x && g.x < x + b && g.y > y && g.y < y + h, `${g.naam} in zijn kader`);
    assert.ok(ringen(k.pad).some((r) => binnen([g.x, g.y], r)), `${g.naam} op het eiland`);
  }
});

test("de kaders liggen in zee (raken Nederland niet)", () => {
  const punten = kaart.provincies.flatMap((p) => ringen(p.pad)).flat();
  for (const { titel, kader: [x, y, b, h] } of kaart.kaders) {
    assert.equal(punten.filter(([px, py]) => px >= x && px <= x + b && py >= y && py <= y + h).length, 0, titel);
  }
});
