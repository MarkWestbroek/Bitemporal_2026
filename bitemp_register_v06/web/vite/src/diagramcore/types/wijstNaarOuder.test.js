// wijstNaarOuder.test.js — welke verbindingen wijzen van kind naar ouder (Mark, 07-11: "is
// overerving nu in UML ook oké voor de boomstijl? En bestaat overerving in ArchiMate?").
import test from "node:test";
import assert from "node:assert/strict";

import { wijstNaarOuder } from "./layoutStijl.js";
import { canoniekUmlDiagramType } from "../../diagramprofielen/canoniek-uml/index.js";
import { puurUmlDiagramType } from "../../diagramprofielen/puur-uml/index.js";
import { mim12DiagramType } from "../../diagramprofielen/mim12/index.js";

const type = (dt, id) => dt.elementTypes.find((et) => et.id === id);

test("overerving wijst naar de ouder in CM, UML en MIM", () => {
  assert.ok(wijstNaarOuder(type(canoniekUmlDiagramType, "generalisatie")), "canoniek");
  assert.ok(wijstNaarOuder(type(puurUmlDiagramType, "generalisatie")), "puur-uml");
  assert.ok(wijstNaarOuder(type(mim12DiagramType, "generalisatie")), "MIM");
});

test("aard specialisatie (use case generalisatie, ArchiMate specialisatie) en realisatie: naar de ouder", () => {
  // usecase/index.js: generalisatie met aard "specialisatie" (de layoutstijl negeert hem, de
  // betekenis blijft); archimate/index.js AARD_RELATIE: specialisatie → "specialisatie". Die
  // profielen laden .jsx en zijn hier niet direct te importeren.
  assert.ok(wijstNaarOuder({ id: "generalisatie", isConnector: true, aard: "specialisatie" }));
  assert.ok(wijstNaarOuder({ id: "specialisatie", isConnector: true, aard: "specialisatie" }));
  assert.ok(wijstNaarOuder({ id: "realisatie", isConnector: true, aard: "realisatie" }));
});

test("gewone relaties en composities niet", () => {
  assert.equal(wijstNaarOuder(type(canoniekUmlDiagramType, "relatie")), false);
  assert.equal(wijstNaarOuder(type(canoniekUmlDiagramType, "compositie")), false);
  assert.equal(wijstNaarOuder({ id: "compositie", isConnector: true, aard: "insluiting" }), false);
  assert.equal(wijstNaarOuder(type(canoniekUmlDiagramType, "entiteit")), false, "geen connector");
});
