import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOUR_STAPPEN, volgendeStap, ballonPositie } from "./tourStappen.js";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
function alleBronnen(map, uit = []) {
  for (const f of readdirSync(map)) {
    const p = join(map, f);
    if (statSync(p).isDirectory()) alleBronnen(p, uit);
    else if (/\.jsx?$/.test(f) && !/\.test\./.test(f)) uit.push(readFileSync(p, "utf8"));
  }
  return uit;
}
const bron = alleBronnen(src).join("\n");

test("elk anker bestaat echt in de code (data-tour of data-balk-id)", () => {
  for (const s of TOUR_STAPPEN.filter((x) => x.anker)) {
    if (s.anker.startsWith("[data-balk-id=")) {
      const id = s.anker.match(/"(.+)"/)[1];
      assert.ok(bron.includes(`${id}: {`) && bron.includes("data-balk-id="), `taakbalk ${id}`);
    } else {
      const statisch = bron.includes(`data-tour="${s.anker}"`);
      const dynamisch = /^(paneel|menu)-/.test(s.anker) && bron.includes(`data-tour={\`${s.anker.split("-")[0]}-\${`);
      assert.ok(statisch || dynamisch, `anker ${s.anker} niet gevonden`);
    }
  }
});

test("begint met welkom, eindigt bij Help", () => {
  assert.equal(TOUR_STAPPEN[0].anker, undefined);
  assert.equal(TOUR_STAPPEN.at(-1).anker, "menu-help");
});

test("volgendeStap slaat over wat niet van toepassing is", () => {
  const st = [{}, { overslaan: () => true }, {}];
  assert.equal(volgendeStap(st, 0, 1), 2);
  assert.equal(volgendeStap(st, 2, -1), 0);
  assert.equal(volgendeStap(st, 2, 1), -1);
  assert.equal(volgendeStap(st, -1, 1), 0);
});

test("ballon blijft in beeld: onder, boven, naast, midden", () => {
  const v = { w: 1000, h: 800 }, b = { w: 300, h: 150 };
  assert.deepEqual(ballonPositie({ left: 10, top: 10, right: 60, bottom: 40 }, b, v), { left: 12, top: 52 });
  assert.equal(ballonPositie({ left: 900, top: 700, right: 950, bottom: 760 }, b, v).top, 700 - 12 - 150);
  assert.equal(ballonPositie({ left: 0, top: 0, right: 300, bottom: 800 }, b, v).left, 312); // hoog paneel: rechts ernaast
  assert.deepEqual(ballonPositie(null, b, v), { left: 350, top: 325 });
});
