/**
 * simulatiemodelActivity — "Simulatiemodel": het M2 van een simulatie op de generieke motor
 * (simulatie, subjecten, scenario's, instanties, stubs, verwachtingen). Descriptor + fabriek,
 * verder niets — zie diagramprofielen/simulatie/. De activiteit Simulatie leest en schrijft
 * dit model (simulatie/scenarioModel.js).
 */
import { IconSimulatiemodel05 } from "../icons";
import { registreerSimulatie, simulatieDiagramType, maakElement } from "../../diagramprofielen/simulatie/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerSimulatie();

export default maakDiagramActiviteit({
  id: "simulatiemodel05",
  label: "Simulatiemodel",
  icon: <IconSimulatiemodel05 />,
  descriptor: simulatieDiagramType,
  maakElement,
  persistKey: "studio05-simulatiemodel",
  taakbalkSleutel: "studio05-taakbalken-simulatiemodel",
  menuPrefix: "sm05",
  menuLabel: "Simulatiemodel",
  kleur: "#6366f1",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "Simulatiemodel — wat er gesimuleerd wordt (subjecten) en met welke scenario's, startgegevens en stubs.",
  devHookNaam: "__simulatiemodel05Store",
});
