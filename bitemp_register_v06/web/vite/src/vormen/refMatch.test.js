import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRefId } from "./refMatch.js";

const gemeenten = [{ id: 344, label: "Utrecht", velden: { code: "GM0344", naam: "Utrecht" } }, { id: 14, label: "Groningen", velden: { code: "GM0014", naam: "Groningen" } }];
const landen = [{ id: 6030, label: "Nederland", velden: { naam: "Nederland" } }];

test("CBS-code met en zonder voorvoegsel en voorloopnullen", () => {
  assert.equal(matchRefId("0344", gemeenten), 344);
  assert.equal(matchRefId("GM0014", gemeenten), 14);
  assert.equal(matchRefId("14", gemeenten), 14, "als id");
});

test("naam, hoofdletterongevoelig; geen treffer = null", () => {
  assert.equal(matchRefId("nederland", landen), 6030);
  assert.equal(matchRefId("Belgie", landen), null);
  assert.equal(matchRefId("", landen), null);
});
