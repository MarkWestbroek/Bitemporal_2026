/**
 * mimActivity — "MIM (0.5)": MIM 1.2 (Metamodel voor Informatie Modellering,
 * Geonovum; "pas toe of leg uit") op de generieke diagram-motor. Vijfde
 * profiel — zie diagramprofielen/mim12/ en docs/STUDIO-05-mim-verkenning.md.
 *
 * Koppelingen (verkenning §4.5/§4.6):
 *  - ⟳ herlaad = transformatie van het canonieke model naar MIM (de keten
 *    vanCanoniekModel → vanCanoniekCoreNaarMim; layouts blijven staan).
 *  - Importeer MIM XMI… = een XMI-export met het MIM-UML-profiel (EA-vorm).
 */
import { IconMIM05 } from "../icons";
import useModelStore from "../../store/useModelStore";
import { registreerMim12, mim12DiagramType, maakElement } from "../../diagramprofielen/mim12/index.js";
import { vanCanoniekCoreNaarMim, vanMimXmi } from "../../diagramprofielen/mim12/adapter.js";
import { vanCanoniekModel } from "../../diagramprofielen/canoniek-uml/adapter.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerMim12();

export default maakDiagramActiviteit({
  id: "mim05",
  label: "MIM (0.5)",
  icon: <IconMIM05 />,
  descriptor: mim12DiagramType,
  maakElement,
  persistKey: "studio05-mim12",
  taakbalkSleutel: "studio05-taakbalken-mim12",
  menuPrefix: "mim05",
  menuLabel: "MIM (0.5)",
  previewTekst: "MIM 1.2-informatiemodellen (Geonovum, pas-toe-of-leg-uit) — vijfde profiel.",
  devHookNaam: "__mim05Store",
  koppeling: {
    /** Transformatie: canoniek model → MIM (PTOLU-mapping in actie). */
    herlaadUitModel: () => vanCanoniekCoreNaarMim(vanCanoniekModel(useModelStore.getState())),
    herlaadLabel: "Zet canoniek model om naar MIM…",
    /** XMI-import (MIM-UML-profiel, gangbare EA-vorm). */
    importBestand: {
      label: "Importeer MIM XMI/XML…",
      accept: ".xml,.xmi",
      verwerk: (tekst) => vanMimXmi(tekst),
    },
  },
});
