/**
 * componentDeploymentActivity — "Component & deployment": UML 2 component-
 * en deploymentdiagrammen op de generieke motor (component, interface,
 * poort, artifact, node/device/execution environment; realisatie, «use»,
 * assembly, «deploy», «manifest», communicatiepad). Descriptor + fabriek,
 * verder niets — zie diagramprofielen/component-deployment/.
 */
import { IconComponent05 } from "../icons";
import { registreerComponentDeployment, componentDeploymentDiagramType, maakElement } from "../../diagramprofielen/component-deployment/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerComponentDeployment();

export default maakDiagramActiviteit({
  id: "componentDeployment05",
  label: "Component & deployment",
  icon: <IconComponent05 />,
  descriptor: componentDeploymentDiagramType,
  maakElement,
  persistKey: "studio05-component-deployment",
  taakbalkSleutel: "studio05-taakbalken-component-deployment",
  menuPrefix: "cd05",
  menuLabel: "Component & deployment",
  kleur: "#2563eb",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML component- en deploymentdiagrammen — componenten met poorten en interfaces, artifacts op nodes.",
  devHookNaam: "__componentDeployment05Store",
});
