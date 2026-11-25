/**
 * cedarTransformatie — Cedar in het transformatiepaneel: import (tekst, JSON, Open FTV-lijst) en
 * de vier exports. De aansluiting zelf staat in diagramprofielen/cedar/cedarRegistry.js.
 */
import { registreerCedarTransformaties } from "../../diagramprofielen/cedar/cedarRegistry.js";
import { getProfieltype } from "../profieltypeRegistry";
import { useModellerenStore } from "./modellerenActivity.jsx";
import { collectMapModel } from "./transformaties.js";

registreerCedarTransformaties({
  getProfieltype,
  getModellerenState: () => useModellerenStore.getState(),
  collectMapModel,
  download: (naam, tekst) => {
    const type = naam.endsWith(".json") ? "application/json" : "text/plain";
    const url = URL.createObjectURL(new Blob([tekst], { type: `${type};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = naam;
    a.click();
    URL.revokeObjectURL(url);
  },
});
