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
import { registreerPropertyTypeEditor, getPropertyTypeEditor } from "../../diagramcore/inspector/propertyTypeEditors.jsx";
import BeslistabelEditor from "../BeslistabelEditor.jsx";
import { installeerTraceOmzetting } from "../traceNaarGegevenKoppeling.js";

registreerDmnDrd();
// Implementatie-deel: de editor van de beslistabel op een beslissing (16-11).
if (!getPropertyTypeEditor("beslistabel")) registreerPropertyTypeEditor("beslistabel", BeslistabelEditor);
// Een getekende «traceert naar» van een invoergegeven wordt zijn gegeven (traceNaarGegeven.js).
installeerTraceOmzetting();

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
