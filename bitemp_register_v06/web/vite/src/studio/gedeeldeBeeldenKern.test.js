import { test } from "node:test";
import assert from "node:assert/strict";
import { maakBeeldWachter } from "./gedeeldeBeeldenKern.js";

const svg = (t) => `<svg viewBox="0 0 100 50"><text>${t}</text></svg>`;

function opzet({ fout = null } = {}) {
  const tekening = { "p::d1": svg("a"), "p::d2": "" };
  let lijst = [
    { token: "T1", profiel_id: "p", diagram_id: "d1", diagram_naam: "Een", soort: "actueel" },
    { token: "T2", profiel_id: "p", diagram_id: "d2", diagram_naam: "Twee", soort: "actueel" },
  ];
  const verstuurd = [];
  const w = maakBeeldWachter({
    actueel: () => lijst,
    teken: (p, d) => tekening[`${p}::${d}`] || "",
    rasteriseer: async (s) => `data:image/png;base64,${s.length}`,
    stuur: async (invoer) => {
      if (fout) throw fout;
      verstuurd.push(invoer);
      return { token: "T1" };
    },
    vergeet: (token) => (lijst = lijst.filter((b) => b.token !== token)),
  });
  return { w, tekening, verstuurd, lijst: () => lijst };
}

test("ververs: stuurt alleen wat veranderd is, alleen bijwerken, met maat", async () => {
  const { w, tekening, verstuurd } = opzet();
  assert.equal(await w.ververs(), 1); // d2 is (nog) leeg: overgeslagen
  assert.deepEqual(
    { ...verstuurd[0], png: undefined },
    { profiel_id: "p", diagram_id: "d1", diagram_naam: "Een", soort: "actueel", png: undefined, breedte: 100, hoogte: 50, alleen_bijwerken: true }
  );
  assert.equal(await w.ververs(), 0); // niets veranderd
  tekening["p::d1"] = svg("b");
  assert.equal(await w.ververs(), 1);
});

test("onthoud: na zelf delen geen dubbele upload", async () => {
  const { w, verstuurd } = opzet();
  w.onthoud("p", "d1", svg("a"));
  assert.equal(await w.ververs(), 0);
  assert.equal(verstuurd.length, 0);
});

test("404 = ingetrokken: niet meer bijwerken; andere fout: later opnieuw", async () => {
  const weg = opzet({ fout: Object.assign(new Error("weg"), { status: 404 }) });
  await weg.w.ververs();
  assert.deepEqual(weg.lijst().map((b) => b.token), ["T2"]);
  const net = opzet({ fout: Object.assign(new Error("offline"), { status: 0 }) });
  await net.w.ververs();
  assert.equal(net.lijst().length, 2);
});
