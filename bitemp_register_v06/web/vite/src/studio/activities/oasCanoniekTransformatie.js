// Wiring van de transformatie "OpenAPI → canoniek model": het pure deel staat
// in diagramprofielen/canoniek-uml/, hier krijgt het de echte stores.
// Zelfde opzet als archimateTransformaties.js.
import { getProfieltype } from "../profieltypeRegistry.js";
import { registreerOasCanoniekImport } from "../../diagramprofielen/canoniek-uml/oasCanoniekImport.js";
import { useModellerenStore } from "./modellerenActivity.jsx";

registreerOasCanoniekImport({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
});
