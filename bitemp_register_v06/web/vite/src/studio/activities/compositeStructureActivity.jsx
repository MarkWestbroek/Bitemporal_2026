/**
 * compositeStructureActivity — "Composite structure": gestructureerde klassen
 * met parts, poorten op de rand en connectoren; collaboraties en collaboration
 * uses. Descriptor + fabriek, verder niets — zie
 * diagramprofielen/composite-structure/.
 */
import { IconCompositeStructure05 } from "../icons";
import { registreerCompositeStructure, compositeStructureDiagramType, maakElement } from "../../diagramprofielen/composite-structure/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerCompositeStructure();

export default maakDiagramActiviteit({
  id: "compositeStructure05",
  label: "Composite structure",
  icon: <IconCompositeStructure05 />,
  descriptor: compositeStructureDiagramType,
  maakElement,
  persistKey: "studio05-composite-structure",
  taakbalkSleutel: "studio05-taakbalken-composite-structure",
  menuPrefix: "cs05",
  menuLabel: "Composite structure",
  kleur: "#4f46e5",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML composite structure — parts, poorten en connectoren in een klasse; collaboraties en collaboration uses.",
  devHookNaam: "__compositeStructure05Store",
});
