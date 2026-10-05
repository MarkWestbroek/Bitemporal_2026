import test from "node:test";
import assert from "node:assert/strict";

import { legUit } from "./kolommenLayout.js";

const blad = (id, groep = null) => ({ id, groep, breedte: 100, hoogte: 40 });
const container = (id, groep = null) => ({ id, groep, breedte: 150, hoogte: 80, container: true });
const omvat = (buiten, binnen) =>
  binnen.x >= buiten.x && binnen.y >= buiten.y && binnen.x + binnen.breedte <= buiten.x + buiten.breedte && binnen.y + binnen.hoogte <= buiten.y + buiten.hoogte;
const overlapt = (a, b) => a.x < b.x + b.breedte && b.x < a.x + a.breedte && a.y < b.y + b.hoogte && b.y < a.y + a.hoogte;

test("zonder containers volgen de kolommen de pijlrichting", () => {
  const plek = legUit({
    knopen: [blad("kind1"), blad("kind2"), blad("ouder"), blad("kleinkind"), blad("los")],
    verbindingen: [
      { bron: "kind1", doel: "ouder" },
      { bron: "kind2", doel: "ouder" },
      { bron: "kleinkind", doel: "kind1" },
    ],
  });
  assert.ok(plek.get("kleinkind").x < plek.get("kind1").x);
  assert.ok(plek.get("kind1").x < plek.get("ouder").x);
  assert.equal(plek.get("kind1").x, plek.get("kind2").x);
  // De ouder staat ter hoogte van (het midden van) zijn kinderen.
  const midden = (id) => plek.get(id).y + plek.get(id).hoogte / 2;
  assert.equal(midden("ouder"), (midden("kind1") + midden("kind2")) / 2);
  const alle = [...plek.values()];
  for (const a of alle) for (const b of alle) if (a !== b) assert.equal(overlapt(a, b), false);
});

test("een kring in de pijlen breekt de layout niet", () => {
  const plek = legUit({ knopen: [blad("a"), blad("b")], verbindingen: [{ bron: "a", doel: "b" }, { bron: "b", doel: "a" }] });
  assert.equal(plek.size, 2);
});

test("buitenstaanders links, containers rechts; containers omvatten hun leden", () => {
  const plek = legUit({
    knopen: [
      blad("ver"), blad("actor"),
      container("systeem"), container("deel1", "systeem"), container("deel2", "systeem"),
      blad("uc1", "deel1"), blad("uc2", "deel1"), blad("uc3", "deel2"), blad("los", "systeem"),
    ],
    verbindingen: [
      { bron: "ver", doel: "actor" },
      { bron: "actor", doel: "uc1" },
      { bron: "uc2", doel: "uc1" },
      { bron: "actor", doel: "uc3" },
    ],
  });
  assert.ok(plek.get("ver").x < plek.get("actor").x);
  assert.ok(plek.get("actor").x + plek.get("actor").breedte < plek.get("systeem").x);
  // Direct verbonden met de actor = eerste kolom; een stap verder = tweede.
  assert.ok(plek.get("uc1").x < plek.get("uc2").x);
  for (const [lid, kader] of [["uc1", "deel1"], ["uc2", "deel1"], ["uc3", "deel2"], ["los", "systeem"], ["deel1", "systeem"], ["deel2", "systeem"]]) {
    assert.ok(omvat(plek.get(kader), plek.get(lid)), `${kader} omvat ${lid}`);
  }
  assert.equal(overlapt(plek.get("deel1"), plek.get("deel2")), false);
  assert.equal(plek.get("deel1").breedte, plek.get("deel2").breedte);
  // Een lege of kleine container houdt zijn minimale maat.
  assert.ok(plek.get("deel2").hoogte >= 80 && plek.get("deel2").breedte >= 150);
});
