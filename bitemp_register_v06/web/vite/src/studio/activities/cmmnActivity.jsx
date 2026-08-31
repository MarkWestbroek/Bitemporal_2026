/**
 * cmmnActivity — "CMMN": casusmodellen op de generieke motor (case plan,
 * stages, tasks, milestones, sentries op de rand). Descriptor + fabriek,
 * verder niets — zie diagramprofielen/cmmn/.
 */
import { IconCMMN05 } from "../icons";
import { registreerCmmn, cmmnDiagramType, maakElement } from "../../diagramprofielen/cmmn/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerCmmn();

export default maakDiagramActiviteit({
  id: "cmmn05",
  label: "CMMN",
  icon: <IconCMMN05 />,
  descriptor: cmmnDiagramType,
  maakElement,
  persistKey: "studio05-cmmn",
  taakbalkSleutel: "studio05-taakbalken-cmmn",
  menuPrefix: "cm05",
  menuLabel: "CMMN",
  kleur: "#8b5cf6",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "CMMN — casusmodel: stages, tasks, milestones en sentries op de rand.",
  devHookNaam: "__cmmn05Store",
});
