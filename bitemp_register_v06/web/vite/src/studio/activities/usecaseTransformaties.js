// Wiring van de transformaties van het use case-profiel: het pure deel staat
// in diagramprofielen/usecase/ en transformatie/, hier krijgen ze de echte
// stores. Zelfde opzet als archimateTransformaties.js.
import { getProfieltype } from "../profieltypeRegistry.js";
import { registreerMermaidUsecaseImport } from "../../diagramprofielen/usecase/mermaidImport.js";
import { registreerUsecaseMermaidExport } from "../../diagramprofielen/usecase/mermaidExport.js";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { collectMapModel } from "./transformaties.js";

registreerMermaidUsecaseImport({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
});

registreerUsecaseMermaidExport({ getProfieltype, collectMapModel });
