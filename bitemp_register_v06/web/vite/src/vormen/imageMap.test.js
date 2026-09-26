import { test } from "node:test";
import assert from "node:assert/strict";
import { areaNaarSvg, itemsUitConfig } from "./imageMap.js";

test("HTML-area-vormen naar SVG in het vlak 0..1", () => {
  // x2 < x1 mag (zoals HTML): de rechthoek wordt genormaliseerd.
  assert.deepEqual(areaNaarSvg({ shape: "rect", coords: [0.5, 0.75, 0.25, 0.25] }), {
    tag: "rect", attrs: { x: 0.25, y: 0.25, width: 0.25, height: 0.5 },
  });
  assert.deepEqual(areaNaarSvg({ shape: "poly", coords: [0, 0, 1, 0, 1, 1] }), {
    tag: "polygon", attrs: { points: "0,0 1,0 1,1" },
  });
  assert.deepEqual(areaNaarSvg({ shape: "ellipse", coords: [0.5, 0.5, 0.2, 0.1] }).attrs, { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.1 });
});

test("cirkel in fracties blijft rond op een niet-vierkante afbeelding", () => {
  // Afbeelding 2:1 (aspect = h/w = 0.5): r = 0.1 van de breedte → ry = 0.2 van de hoogte.
  const { attrs } = areaNaarSvg({ shape: "circle", coords: [0.5, 0.5, 0.1] }, { aspect: 0.5 });
  assert.equal(attrs.rx, 0.1);
  assert.equal(attrs.ry, 0.2);
});

test("pixelcoördinaten (uitvoer van een image-map-generator) worden fracties", () => {
  const opts = { units: "px", width: 200, height: 100 };
  assert.deepEqual(areaNaarSvg({ shape: "rect", coords: [20, 10, 120, 60] }, opts).attrs, { x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
  assert.deepEqual(areaNaarSvg({ shape: "circle", coords: [100, 50, 20] }, opts).attrs, { cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.2 });
  assert.equal(areaNaarSvg({ shape: "rect", coords: [0, 0, 1, 1] }, { units: "px" }), null, "px zonder vlak");
});

test("ongeldige areas geven null", () => {
  assert.equal(areaNaarSvg({ shape: "star", coords: [1] }), null);
  assert.equal(areaNaarSvg({ shape: "rect", coords: [0, 0, 1] }), null);
  assert.equal(areaNaarSvg({ shape: "poly", coords: [0, 0, 1, 1] }), null);
  assert.equal(areaNaarSvg({ shape: "rect", coords: [0, "x", 1, 1] }), null);
});

test("items uit de config, gecontroleerd tegen de keuzebron", () => {
  const config = {
    image: "/plattegrond.svg",
    areas: [
      { value: "zaal-a", label: "Zaal A", shape: "rect", coords: [0, 0, 0.5, 0.5] },
      { value: "hal", shape: "circle", coords: [0.75, 0.75, 0.1] },
      { value: "kelder", shape: "rect", coords: [0, 0.5, 0.5, 1] },
      { value: "hal", shape: "rect", coords: [0, 0, 1, 1] },
      { shape: "rect", coords: [0, 0, 1, 1] },
    ],
  };
  const { items, fouten } = itemsUitConfig(config, ["zaal-a", "hal"]);
  assert.deepEqual(items.map((i) => [i.waarde, i.label]), [["zaal-a", "Zaal A"], ["hal", "hal"]]);
  assert.deepEqual(fouten, [
    "area-value hoort niet bij de keuzelijst: kelder",
    "dubbele area-value: hal",
    "area zonder `value`",
  ]);
});

test("referentielijst: labels uit de opties; zonder opties geen controle", () => {
  const config = { image: "/nl.svg", areas: [{ value: 7, shape: "rect", coords: [0, 0, 1, 1] }] };
  assert.equal(itemsUitConfig(config, [{ id: 7, label: "Utrecht" }]).items[0].label, "Utrecht");
  assert.equal(itemsUitConfig(config, undefined).items[0].waarde, "7");
  assert.deepEqual(itemsUitConfig({}, []).fouten, ["image-map zonder `image`", "image-map zonder `areas`"]);
});
