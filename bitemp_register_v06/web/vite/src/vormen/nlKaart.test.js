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

// Op land is niet genoeg: na de eerste reparatie lag Urk op de Houtribdijk (die hoort bij het
// vlak van Flevoland) en Medemblik op een dijk. Gemeenten met veel water moeten dicht bij hun
// hoofdplaats liggen (lon/lat van het dorp of de stad; marge in km, voor gemeenten met meer kernen).
test("gemeenten met veel water liggen bij hun hoofdplaats, niet op een dijk", () => {
  const { lon0, lat0, latMid, schaal } = kaart.projectie;
  const proj = (lon, lat) => [(lon - lon0) * Math.cos((latMid * Math.PI) / 180) * schaal, (lat0 - lat) * schaal];
  const km = 111 / schaal; // 1 eenheid ≈ 1,1 km
  const hoofdplaats = {
    Urk: [5.604, 52.663, 3], Medemblik: [5.105, 52.771, 7], Hoorn: [5.06, 52.642, 3], Enkhuizen: [5.29, 52.703, 3],
    Harlingen: [5.42, 53.175, 3], Lelystad: [5.471, 52.518, 3], Vlissingen: [3.573, 51.443, 4], Waterland: [5.037, 52.456, 4],
    Terschelling: [5.28, 53.39, 6], Vlieland: [5.07, 53.3, 4], Ameland: [5.77, 53.45, 8], Schiermonnikoog: [6.2, 53.48, 4],
  };
  const te_ver = Object.entries(hoofdplaats).map(([naam, [lon, lat, marge]]) => {
    const g = Object.values(kaart.gemeenten).find((x) => x.naam === naam);
    const [x, y] = proj(lon, lat);
    const afstand = Math.hypot(g.x - x, g.y - y) * km;
    return afstand > marge ? `${naam} ${afstand.toFixed(1)} km` : null;
  }).filter(Boolean);
  assert.deepEqual(te_ver, []);
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
