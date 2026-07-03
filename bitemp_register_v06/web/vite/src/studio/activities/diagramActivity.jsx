/**
 * diagramActivity — "Diagrammen (0.5)": het canoniek-uml-profiel op de
 * generieke diagram-motor, als preview-activiteit naast de klassieke UML-IDE.
 *
 * Sinds fase 5 is dit een dunne aanroep van maakDiagramActiviteit: alle
 * activiteit-mechaniek (store, taakbalken, inspector, layout, menu's) zit in
 * de fabriek; hier staat alleen wat dit profiel uniek maakt — de descriptor
 * en de koppeling met het klassieke UML-model (spiegelen, terugschrijven,
 * V3-serialisatie en de API-dialogen; fase 4A/4B).
 */
import { IconDiagram } from "../icons";
import useModelStore from "../../store/useModelStore";
import {
  registreerCanoniekUml,
  canoniekUmlDiagramType,
  maakElement,
} from "../../diagramprofielen/canoniek-uml/index.js";
import { registreerCanoniekUmlImplementaties } from "../../diagramprofielen/canoniek-uml/implementaties.jsx";
import { vanCanoniekModel, naarCanoniekModel } from "../../diagramprofielen/canoniek-uml/adapter.js";
import { exporteerV3, importeerV3 } from "../../diagramprofielen/canoniek-uml/serialisatie.js";
import ApiDialogen from "./diagram05ApiDialogen.jsx";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerCanoniekUml();
registreerCanoniekUmlImplementaties();

export default maakDiagramActiviteit({
  id: "diagram05",
  label: "Diagrammen (0.5)",
  icon: <IconDiagram />,
  descriptor: canoniekUmlDiagramType,
  maakElement,
  persistKey: "studio05-canoniek-uml",
  taakbalkSleutel: "studio05-taakbalken-canoniek-uml",
  menuPrefix: "d05",
  menuLabel: "Diagram (0.5)",
  previewTekst: "Bewerkbare sandbox — wijzigingen blijven lokaal en raken het UML-model niet.",
  devHookNaam: "__diagram05Store",
  koppeling: {
    /** Fase 1: spiegel het klassieke UML-model in de sandbox. */
    herlaadUitModel: () => vanCanoniekModel(useModelStore.getState()),
    /** Fase 4B: de sandbox vervangt het model in de klassieke UML-activiteit. */
    zetTerugNaarModel: (coreState) => {
      const { overgeslagen, ...oudeStore } = naarCanoniekModel(coreState);
      useModelStore.getState().loadModel(oudeStore);
      return overgeslagen;
    },
    /** Fase 4A: V3-serialisatie (spiegel + delta). */
    exporteerV3,
    importeerV3,
    /** Fase 4B: laden vanaf / publiceren naar de Go-API. */
    DialogenComponent: ApiDialogen,
  },
});
