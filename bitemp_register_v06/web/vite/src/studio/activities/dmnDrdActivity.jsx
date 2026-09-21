/**
 * dmnDrdActivity — "DRD (0.5)": het DMN Decision Requirements Diagram op de
 * generieke diagram-motor. Vierde profiel: descriptor + fabriek, verder
 * niets — zie diagramprofielen/dmn-drd/. Gebruikt de DMN-ShapeTypes van de
 * vormgeving (dmn-input-data, dmn-bkm, dmn-knowledge-source) en de
 * pijl-dicht-/bol-markers.
 */
import { IconDMN } from "../icons";
import { registreerDmnDrd, dmnDrdDiagramType, maakElement } from "../../diagramprofielen/dmn-drd/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerDmnDrd();

export default maakDiagramActiviteit({
  id: "dmnDrd05",
  label: "DMN DRD",
  icon: <IconDMN />,
  descriptor: dmnDrdDiagramType,
  maakElement,
  persistKey: "studio05-dmn-drd",
  taakbalkSleutel: "studio05-taakbalken-dmn-drd",
  menuPrefix: "drd05",
  menuLabel: "DRD",
  kleur: "#a78bfa",
  // Eén DMN-ingang in de balk: de klassieke DMN-activiteit (DRD + Tabel).
  // Deze 0.5-DRD blijft bereikbaar via menu Ga naar.
  verborgenInBalk: true,
  previewTekst: "DMN Decision Requirements Diagram — vierde profiel op de generieke motor.",
  devHookNaam: "__dmnDrd05Store",
});
