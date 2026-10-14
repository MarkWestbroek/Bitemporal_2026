import { test } from "node:test";
import assert from "node:assert/strict";
import { controleerMelding, bijlageProbleem, browserOmschrijving, normaliseerKader, plekVan, MAX_BIJLAGE } from "./meldingApi.js";
import { verzamelMeldContext, registreerMeldContext } from "../studio/meldContext.js";

test("controleerMelding: soort en titel verplicht", () => {
  assert.equal(controleerMelding({ soort: "bug", titel: "Knop" }), "");
  assert.match(controleerMelding({ soort: "klacht", titel: "x" }), /bug, wens, vraag of compliment/);
  assert.match(controleerMelding({ soort: "wens", titel: "  " }), /titel/);
  assert.match(controleerMelding({ soort: "vraag", titel: "x".repeat(256) }), /te lang/);
});

test("bijlageProbleem: maat en type", () => {
  assert.equal(bijlageProbleem({ name: "a.png", size: 10, type: "image/png" }), "");
  assert.match(bijlageProbleem({ name: "b.png", size: MAX_BIJLAGE + 1, type: "image/png" }), /10 MB/);
  assert.match(bijlageProbleem({ name: "c.exe", size: 10, type: "application/x-msdownload" }), /afbeeldingen/);
});

test("browserOmschrijving: naam, versie, systeem, maat", () => {
  const nav = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0" };
  assert.equal(browserOmschrijving(nav, { innerWidth: 1440, innerHeight: 900 }), "Edge 141, Windows, 1440×900");
  assert.equal(browserOmschrijving({ userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0" }, null), "Firefox 140, Linux");
});

test("normaliseerKader: van rechtsonder naar linksboven, binnen het venster", () => {
  assert.deepEqual(normaliseerKader({ x: 300, y: 200 }, { x: 100, y: 50 }, { w: 1000, h: 800 }), { x: 100, y: 50, w: 200, h: 150 });
  assert.deepEqual(normaliseerKader({ x: -20, y: 10 }, { x: 1200, y: 900 }, { w: 1000, h: 800 }), { x: 0, y: 10, w: 1000, h: 790 });
});

test("meldContext: leveranciers, extra wint, lege waarden weg, kapotte leverancier breekt niets", () => {
  const af1 = registreerMeldContext("a", () => ({ projectid: "p1", pad: "Map/X", leeg: "" }));
  const af2 = registreerMeldContext("kapot", () => { throw new Error("stuk"); });
  const ctx = verzamelMeldContext({ pad: "Map/Y" });
  assert.equal(ctx.projectid, "p1");
  assert.equal(ctx.pad, "Map/Y");
  assert.ok(!("leeg" in ctx));
  assert.match(ctx.studioversie, /^studio /);
  af1(); af2();
  assert.ok(!("projectid" in verzamelMeldContext()));
});

test("plekVan: leesbare namen, van buiten naar binnen", () => {
  const el = (attrs, ouder = null, tag = "DIV", tekst = "") => ({
    nodeType: 1, tagName: tag, textContent: tekst, parentElement: ouder, classList: { contains: () => false },
    getAttribute: (k) => attrs[k] ?? null,
  });
  const paneel = el({ "data-tour": "paneel-left" });
  const knop = el({}, paneel, "BUTTON", " Nieuwe map ");
  assert.equal(plekVan(knop), "linkerpaneel › knop Nieuwe map");
});
