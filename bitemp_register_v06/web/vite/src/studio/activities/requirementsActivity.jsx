/**
 * requirementsActivity — "Requirements": requirement, feature, issue en
 * change (EA-stijl) met realize/trace/derive/verify/refine en de aggregatie
 * "bevat". Descriptor + fabriek, verder niets — zie
 * diagramprofielen/requirements/.
 */
import { IconRequirements05 } from "../icons";
import { registreerRequirements, requirementsDiagramType, maakElement } from "../../diagramprofielen/requirements/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerRequirements();

export default maakDiagramActiviteit({
  id: "requirements05",
  label: "Requirements",
  icon: <IconRequirements05 />,
  descriptor: requirementsDiagramType,
  maakElement,
  persistKey: "studio05-requirements",
  taakbalkSleutel: "studio05-taakbalken-requirements",
  menuPrefix: "rq05",
  menuLabel: "Requirements",
  kleur: "#7c3aed",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "Requirements (EA-stijl) — eisen, features, issues en changes met traceerlijnen en decompositie.",
  devHookNaam: "__requirements05Store",
});
