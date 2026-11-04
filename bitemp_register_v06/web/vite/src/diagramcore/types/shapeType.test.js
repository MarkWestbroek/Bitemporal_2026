import test from "node:test";
import assert from "node:assert/strict";
import {
  vorm, valideerVormBoom, valideerVak, valideerShapeType, valideerShapeRenderer, registreerShapeType,
  registreerRenderer, tekenbareVorm, losStijlOp, minMaatVan, inhoudsregelsVan, _resetVoorTests,
} from "./shapeType.js";
import { valideerDiagramType } from "./typeRegistry.js";

const rechthoek = {
  omtrek: ({ maat, stijl }) => vorm("rect", { width: maat.w, height: maat.h, fill: stijl.kleur || "var(--diagram-vlak, #fff)" }),
  inhoudsvak: ({ maat }) => ({ x: 0, y: 0, w: maat.w, h: maat.h, uitlijning: "boven" }),
};

test("VormBoom: een toegestane boom is geldig, ook de uitvoer van een renderer", () => {
  const boom = vorm("g", {},
    vorm("defs", {}, vorm("clipPath", { id: "d1-k" }, vorm("rect", { width: 4, height: 4 }))),
    rechthoek.omtrek({ maat: { w: 10, h: 5 }, stijl: {} }),
    vorm("text", { x: 1, y: 2 }, "A", vorm("tspan", {}, "B")),
    vorm("use", { href: "#d1-k" }),
  );
  assert.deepEqual(valideerVormBoom(boom, { idPrefix: "d1-" }), []);
});

test("VormBoom: HTML, foreignObject, style, scripts en externe verwijzingen worden geweigerd", () => {
  const fout = (boom, opties) => valideerVormBoom(boom, opties).join("\n");
  assert.match(fout(vorm("foreignObject")), /niet toegestaan/);
  assert.match(fout(vorm("div")), /niet toegestaan/);
  assert.match(fout(vorm("g", {}, vorm("style"))), /"style" is niet toegestaan/);
  assert.match(fout(vorm("rect", { style: "fill:red" })), /attribuut "style"/);
  assert.match(fout(vorm("rect", { onclick: "x()" })), /attribuut "onclick"/);
  assert.match(fout(vorm("use", { href: "https://x/y.svg#a" })), /binnen de tekening/);
  assert.match(fout(vorm("g", {}, "los")), /alleen in text of tspan/);
  assert.match(fout(vorm("clipPath", {})), /id ontbreekt/);
  assert.match(fout(vorm("clipPath", { id: "x" }), { idPrefix: "d1-" }), /begint niet met/);
  assert.match(fout(vorm("rect", { width: {} })), /geen tekst of getal/);
});

test("Vak: x/y/w/h verplicht; uitlijning en rotatie optioneel", () => {
  assert.deepEqual(valideerVak({ x: 0, y: 0, w: 1, h: 1, uitlijning: "midden", rotatie: -90 }), []);
  assert.match(valideerVak({ x: 0, y: 0, w: 1 }).join(), /h is geen getal/);
  assert.match(valideerVak({ x: 0, y: 0, w: 1, h: 1, uitlijning: "links" }).join(), /uitlijning/);
});

test("ShapeType is gegevens: geen functies in parameters, renderer verplicht", () => {
  assert.deepEqual(valideerShapeType({ id: "kaart", renderer: "afgerond", parameters: { hoekRadius: 8 }, minMaat: { w: 80, h: 40 }, ankers: "rand" }), []);
  assert.match(valideerShapeType({ id: "kaart" }).join(), /renderer/);
  assert.match(valideerShapeType({ id: "kaart", renderer: "r", parameters: { f: () => 1 } }).join(), /geen functies/);
  assert.match(valideerShapeType({ id: "kaart", renderer: "r", ankers: "overal" }).join(), /ankers/);
  assert.match(valideerShapeType({ id: "kaart", renderer: "r", minMaat: { w: 1 } }).join(), /minMaat/);
});

test("ShapeRenderer: omtrek en inhoudsvak verplicht", () => {
  assert.deepEqual(valideerShapeRenderer("r", rechthoek), []);
  assert.match(valideerShapeRenderer("r", { omtrek() {} }).join(), /inhoudsvak ontbreekt/);
  assert.match(valideerShapeRenderer("r", { ...rechthoek, rand: 1 }).join(), /rand is geen functie/);
});

test("Overgang: pas met ShapeType én renderer is er een nieuwe tekenroute", () => {
  _resetVoorTests();
  assert.equal(tekenbareVorm("kaart"), null);
  registreerShapeType({ id: "kaart", renderer: "rechthoek" });
  assert.equal(tekenbareVorm("kaart"), null, "nog geen renderer: de oude component tekent");
  registreerRenderer("rechthoek", rechthoek);
  assert.equal(tekenbareVorm("kaart").renderer, rechthoek);
  assert.throws(() => registreerRenderer("kapot", {}), /omtrek ontbreekt/);
  assert.throws(() => registreerShapeType({ id: "x" }), /renderer/);
  _resetVoorTests();
});

test("Stijl: element wint van type, type van thema; lege waarde telt niet", () => {
  const stijl = losStijlOp({ data: { kleur: "#111" } }, { kleur: "#222", randDikte: 3 }, { kleur: "#333", hoekRadius: 4, randDikte: 1 });
  assert.deepEqual(stijl, { kleur: "#111", randDikte: 3, hoekRadius: 4 });
  assert.deepEqual(losStijlOp({ data: { kleur: "" } }, { kleur: "#222" }), { kleur: "#222" });
  assert.deepEqual(losStijlOp({ data: { kleur: "" } }, undefined, {}), {});
});

test("Minimale maat: ElementType overschrijft het ShapeType per as", () => {
  assert.deepEqual(minMaatVan({ minMaat: { w: 80, h: 40 } }, { minBreedte: 120 }), { w: 120, h: 40 });
  assert.equal(minMaatVan({}, {}), null);
});

test("hooks.inhoudsregels: lege regels weg, een hook die gooit telt als geen inhoud", () => {
  const et = { hooks: { inhoudsregels: (el) => [{ delen: [{ tekst: el.data.tekst, soort: "tekst", veld: "tekst" }] }, { delen: [] }] } };
  assert.deepEqual(inhoudsregelsVan(et, { data: { tekst: "a" } }), [{ delen: [{ tekst: "a", soort: "tekst", veld: "tekst" }] }]);
  assert.deepEqual(inhoudsregelsVan({ hooks: { inhoudsregels: () => { throw new Error("x"); } } }, { data: {} }), []);
  assert.deepEqual(inhoudsregelsVan({}, { data: {} }), []);
});

test("DiagramType.shapeTypes wordt gevalideerd; dubbele ids geweigerd", () => {
  const dt = (shapeTypes) => ({ id: "p", label: "P", style: "s", elementTypes: [{ id: "a", label: "A", shape: "kaart" }], shapeTypes });
  assert.deepEqual(valideerDiagramType(dt([{ id: "kaart", renderer: "r" }])), []);
  assert.match(valideerDiagramType(dt([{ id: "kaart" }])).join(), /renderer/);
  assert.match(valideerDiagramType(dt([{ id: "k", renderer: "r" }, { id: "k", renderer: "r" }])).join(), /dubbel ShapeType/);
});
