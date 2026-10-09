/**
 * businessActivity — "Business (Eriksson-Penker)": bedrijfsprocessen met
 * doelen, resources, gebeurtenissen en bedrijfsobjecten; «input»/«output»/
 * «control»/«supply». Descriptor + fabriek, verder niets — zie
 * diagramprofielen/business/.
 */
import { IconBusiness05 } from "../icons";
import { registreerBusiness, businessDiagramType, maakElement } from "../../diagramprofielen/business/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerBusiness();

export default maakDiagramActiviteit({
  id: "business05",
  label: "Business (EP)",
  icon: <IconBusiness05 />,
  descriptor: businessDiagramType,
  maakElement,
  persistKey: "studio05-business",
  taakbalkSleutel: "studio05-taakbalken-business",
  menuPrefix: "ep05",
  menuLabel: "Business (EP)",
  kleur: "#0891b2",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "Business Modeling (Eriksson-Penker) — processen, doelen, resources, gebeurtenissen; input/output/control/supply.",
  devHookNaam: "__business05Store",
});
