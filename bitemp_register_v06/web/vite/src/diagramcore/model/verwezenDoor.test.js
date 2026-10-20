import { test } from "node:test";
import assert from "node:assert/strict";
import { verwezenDoor } from "./verwezenDoor.js";

test("verwezenDoor: verwijstNaar én gedragsverwijzing, over profielen heen; met de diagrammen van het element", () => {
  const profielen = [
    {
      profielId: "archimate05",
      elementTypes: [{ id: "app-component", label: "Applicatiecomponent" }, { id: "rel", isConnector: true }],
      elements: {
        s: { id: "s", naam: "Omnium Studio", elementType: "app-component", data: { verwijstNaar: { profielId: "archimate05", diagramId: "d_fe" } } },
        a: { id: "a", naam: "Go-API", elementType: "app-component", data: { verwijstNaar: { profielId: "sequence05", diagramId: "d_seq" } } },
        r: { id: "r", elementType: "rel", source: "s", target: "a", data: { verwijstNaar: { profielId: "archimate05", diagramId: "d_fe" } } },
      },
      diagrams: { d_comp: { id: "d_comp", naam: "Componenten", nodes: [{ elementId: "s" }, { elementId: "a" }] }, d_fe: { id: "d_fe", naam: "Frontend", nodes: [] } },
    },
    {
      profielId: "activity05",
      // Gedragsverwijzing: een property met betekenis "verwijzing"; kale id = dit profiel.
      elementTypes: [{ id: "aanroep", label: "Aanroep", properties: [{ key: "gedragDiagramId", datatype: "diagram-verwijzing", betekenis: "verwijzing" }] }],
      elements: { c: { id: "c", naam: "Roep aan", elementType: "aanroep", data: { gedragDiagramId: "d_sub" } } },
      diagrams: {},
    },
  ];
  const fe = verwezenDoor("archimate05", "d_fe", profielen);
  assert.deepEqual(fe.map((r) => [r.elementId, r.diagrammen.map((d) => d.id)]), [["s", ["d_comp"]]], "connectoren tellen niet mee");
  assert.deepEqual(verwezenDoor("sequence05", "d_seq", profielen).map((r) => r.naam), ["Go-API"]);
  assert.deepEqual(verwezenDoor("activity05", "d_sub", profielen).map((r) => r.naam), ["Roep aan"]);
  assert.deepEqual(verwezenDoor("archimate05", "d_comp", profielen), []);
});
