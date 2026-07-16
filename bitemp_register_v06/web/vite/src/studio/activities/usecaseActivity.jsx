/**
 * usecaseActivity — "Use case": UML use case-diagrammen op de generieke
 * motor (actor, use case, systeemkader; associatie, «include»/«extend»,
 * generalisatie). Descriptor + fabriek, verder niets — zie
 * diagramprofielen/usecase/.
 */
import { IconUseCase } from "../icons";
import { registreerUseCase, usecaseDiagramType, maakElement } from "../../diagramprofielen/usecase/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerUseCase();

export default maakDiagramActiviteit({
  id: "usecase05",
  label: "Use case",
  icon: <IconUseCase />,
  descriptor: usecaseDiagramType,
  maakElement,
  persistKey: "studio05-usecase",
  taakbalkSleutel: "studio05-taakbalken-usecase",
  menuPrefix: "uc05",
  menuLabel: "Use case",
  kleur: "#0ea5e9",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML use case — actoren, use cases en systeemkader (gedragsdiagram-verkenning).",
  devHookNaam: "__usecase05Store",
});
