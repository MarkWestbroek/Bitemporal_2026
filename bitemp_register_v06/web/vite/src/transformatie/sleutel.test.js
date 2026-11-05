import test from "node:test";
import assert from "node:assert/strict";

import { kebab } from "./sleutel.js";
import { schrijfBpmn } from "./bpmnXmlSchrijver.js";
import { BPMN_NAAR_GZAC } from "../diagramprofielen/bpmn/bpmnGzacRegels.js";

test("kebab: een modelwaarde als sleutel met koppeltekens", () => {
  assert.equal(kebab("nietInBehandeling"), "niet-in-behandeling");
  assert.equal(kebab("inBehandeling"), "in-behandeling");
  assert.equal(kebab("afgehandeld"), "afgehandeld");
  assert.equal(kebab("niet-opgepakt"), "niet-opgepakt"); // een sleutel die al koppeltekens heeft blijft gelijk
  assert.equal(kebab("Niet opgepakt"), "niet-opgepakt");
  assert.equal(kebab(null), "");
});

test("de taak die een dossierstatus zet en de statuslijst maken dezelfde sleutel", () => {
  const model = {
    elements: { t: { id: "t", naam: "Status zetten", elementType: "taak", data: { taakSoort: "service", bpmnId: "status-zetten", dossierstatus: "nietInBehandeling" } } },
    diagrams: { d: { id: "d", naam: "Proces", nodes: [{ elementId: "t", position: { x: 0, y: 0 }, size: { width: 100, height: 80 } }], edges: [] } },
  };
  const { xml } = schrijfBpmn({ model, diagramId: "d", proces: { id: "p", naam: "Proces" }, engine: BPMN_NAAR_GZAC });
  assert.match(xml, new RegExp(`setInternalStatus\\(execution, '${kebab("nietInBehandeling")}'\\)`));
});
