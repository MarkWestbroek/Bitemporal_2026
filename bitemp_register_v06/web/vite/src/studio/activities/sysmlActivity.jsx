/**
 * sysmlActivity — "SysML": bdd + ibd-kern + requirements op de generieke
 * motor. Descriptor + fabriek, verder niets — zie diagramprofielen/sysml/.
 */
import { IconSysML05 } from "../icons";
import { registreerSysml, sysmlDiagramType, maakElement } from "../../diagramprofielen/sysml/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerSysml();

export default maakDiagramActiviteit({
  id: "sysml05",
  label: "SysML",
  icon: <IconSysML05 />,
  descriptor: sysmlDiagramType,
  maakElement,
  persistKey: "studio05-sysml",
  taakbalkSleutel: "studio05-taakbalken-sysml",
  menuPrefix: "sy05",
  menuLabel: "SysML",
  kleur: "#3b82f6",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "SysML — blokken (bdd), parts en poorten (ibd), requirements met traceerrelaties.",
  devHookNaam: "__sysml05Store",
});
