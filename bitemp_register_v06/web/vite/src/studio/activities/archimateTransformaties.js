import { getProfieltype } from "../profieltypeRegistry.js";
import { registreerArchimateImport } from "../../diagramprofielen/archimate/exchange/archimateImport.js";
import { useModellerenStore } from "./modellerenActivity.jsx";

registreerArchimateImport({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
});