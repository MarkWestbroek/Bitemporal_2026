// Wiring van de transformatie "Mermaid flowchart → use case-model": het pure
// deel staat in diagramprofielen/usecase/ en transformatie/, hier krijgt het
// de echte stores. Zelfde opzet als archimateTransformaties.js.
import { getProfieltype } from "../profieltypeRegistry.js";
import { registreerMermaidUsecaseImport } from "../../diagramprofielen/usecase/mermaidImport.js";
import { useModellerenStore } from "./modellerenActivity.jsx";

registreerMermaidUsecaseImport({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
});
