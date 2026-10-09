// Wiring van de native BPMN 2.0- en DMN-XML-imports: het pure deel staat in
// diagramprofielen/bpmn/, diagramprofielen/dmn-drd/ en transformatie/, hier
// krijgen ze de echte stores. Zelfde opzet als usecaseTransformaties.js.
import { getProfieltype } from "../profieltypeRegistry.js";
import { registreerBpmnXmlImport } from "../../diagramprofielen/bpmn/bpmnXmlImport.js";
import { registreerDmnXmlImport } from "../../diagramprofielen/dmn-drd/dmnXmlImport.js";
import { useModellerenStore } from "./modellerenActivity.jsx";

const deps = {
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
};

registreerBpmnXmlImport(deps);
registreerDmnXmlImport(deps);
