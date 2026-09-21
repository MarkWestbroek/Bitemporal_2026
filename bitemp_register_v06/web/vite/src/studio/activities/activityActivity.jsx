/**
 * activityActivity — "Activity": UML 2 activity-diagrammen op de generieke
 * motor (acties, beslissing, fork/join, pins op de rand, aanroep met
 * doorklik, partities). Descriptor + fabriek, verder niets — zie
 * diagramprofielen/activity/.
 */
import { IconActivity } from "../icons";
import { registreerActivity, activityDiagramType, maakElement } from "../../diagramprofielen/activity/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerActivity();

export default maakDiagramActiviteit({
  id: "activity05",
  label: "Activity",
  icon: <IconActivity />,
  descriptor: activityDiagramType,
  maakElement,
  persistKey: "studio05-activity",
  taakbalkSleutel: "studio05-taakbalken-activity",
  menuPrefix: "act05",
  menuLabel: "Activity",
  kleur: "#f59e0b",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML activity — acties, beslissingen, fork/join, pins en partities (gedragsdiagram-verkenning).",
  devHookNaam: "__activity05Store",
});
