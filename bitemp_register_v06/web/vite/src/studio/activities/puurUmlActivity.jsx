/**
 * puurUmlActivity — "UML (0.5)": het puur-UML-profiel (klassediagrammen) op
 * de generieke diagram-motor. Fase 5-lakmoesproef: dit bestand is bewust
 * niet meer dan een descriptor + een fabriek-aanroep — geen koppeling met
 * het canonieke model, geen serialisatie, geen eigen componenten.
 */
import { IconUML05 } from "../icons";
import { registreerPuurUml, puurUmlDiagramType, maakElement } from "../../diagramprofielen/puur-uml/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerPuurUml();

export default maakDiagramActiviteit({
  id: "puurUml05",
  label: "UML",
  icon: <IconUML05 />,
  descriptor: puurUmlDiagramType,
  maakElement,
  persistKey: "studio05-puur-uml",
  taakbalkSleutel: "studio05-taakbalken-puur-uml",
  menuPrefix: "u05",
  menuLabel: "UML",
  kleur: "#60a5fa",
  previewTekst: "Puur UML-klassediagram — tweede profiel (fase 5-lakmoesproef), lege sandbox.",
  devHookNaam: "__puurUml05Store",
});
