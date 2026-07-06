/**
 * mimActivity — "MIM (0.5)": MIM 1.2 (Metamodel voor Informatie Modellering,
 * Geonovum; "pas toe of leg uit") op de generieke diagram-motor. Vijfde
 * profiel: descriptor + fabriek — zie diagramprofielen/mim12/ en
 * docs/STUDIO-05-mim-verkenning.md.
 */
import { IconDiagram05 } from "../icons";
import { registreerMim12, mim12DiagramType, maakElement } from "../../diagramprofielen/mim12/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerMim12();

export default maakDiagramActiviteit({
  id: "mim05",
  label: "MIM (0.5)",
  icon: <IconDiagram05 />,
  descriptor: mim12DiagramType,
  maakElement,
  persistKey: "studio05-mim12",
  taakbalkSleutel: "studio05-taakbalken-mim12",
  menuPrefix: "mim05",
  menuLabel: "MIM (0.5)",
  previewTekst: "MIM 1.2-informatiemodellen (Geonovum, pas-toe-of-leg-uit) — vijfde profiel.",
  devHookNaam: "__mim05Store",
});
