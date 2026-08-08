/**
 * erdActivity — "ERD": entity-relationship-diagrammen met kraaienpoten
 * (Information Engineering) op de generieke motor. Descriptor + fabriek,
 * verder niets — zie diagramprofielen/erd/.
 */
import { IconERD05 } from "../icons";
import { registreerErd, erdDiagramType, maakElement } from "../../diagramprofielen/erd/index.js";
import { registreerErdIconen } from "../../diagramprofielen/erd/iconen.jsx";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerErd();
// De iconen staan hier en niet in registreerErd(): erd/index.js moet in node
// laadbaar blijven voor erd.test.js, en .jsx kan dat niet.
registreerErdIconen();

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
