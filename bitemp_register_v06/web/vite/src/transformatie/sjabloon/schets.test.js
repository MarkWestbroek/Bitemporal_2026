import test from "node:test";
import assert from "node:assert/strict";
import { schetsDiagramSvg } from "./schets.js";

test("schets: diagramverwijzing zonder naam toont het doeldiagram (verwijzingNaam van de host)", () => {
  const typen = [{ id: "diagramverwijzing", shape: "diagramverwijzing", properties: [] }];
  const svg = schetsDiagramSvg({
    diagram: { id: "d1", nodes: [{ elementId: "v", position: { x: 0, y: 0 } }] },
    elements: { v: { id: "v", elementType: "diagramverwijzing", naam: "", data: { verwijstNaar: { profielId: "p", diagramId: "d2" } } } },
    descriptor: { elementTypes: typen },
    verwijzingNaam: (v) => (v.diagramId === "d2" ? "Deelbeeld" : null),
  });
  assert.match(svg, /Deelbeeld/);
});
