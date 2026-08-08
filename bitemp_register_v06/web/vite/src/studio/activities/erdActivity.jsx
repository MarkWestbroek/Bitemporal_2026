/**
 * erdActivity — "ERD": entity-relationship-diagrammen met kraaienpoten
 * (Information Engineering) op de generieke motor. Descriptor + fabriek,
 * verder niets — zie diagramprofielen/erd/.
 */
import { IconERD05 } from "../icons";
import { registreerErd, erdDiagramType, maakElement } from "../../diagramprofielen/erd/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerErd();

export default maakDiagramActiviteit({
  id: "erd05",
  label: "ERD",
  icon: <IconERD05 />,
  descriptor: erdDiagramType,
  maakElement,
  persistKey: "studio05-erd",
  taakbalkSleutel: "studio05-taakbalken-erd",
  menuPrefix: "erd05",
  menuLabel: "ERD",
  kleur: "#f59e0b",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "ERD met kraaienpoten — entiteiten, sleutels en kardinaliteit per uiteinde.",
  devHookNaam: "__erd05Store",
});
