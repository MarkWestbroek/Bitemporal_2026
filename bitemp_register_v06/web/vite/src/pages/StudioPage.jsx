/**
 * StudioPage — instappunt voor de geïntegreerde werkbank (VS Code-stijl).
 *
 * Importeert de activiteit-registraties (side-effect) en de shell-styling, en rendert
 * de StudioShell. Alle losse functies (UML, DMN, BPMN, berichten, API's, …) leven
 * voortaan als *activiteit* binnen deze ene werkbank, maar blijven qua code netjes
 * gescheiden in hun eigen modules (zie src/studio/activities/).
 *
 * Route: /studio (zie App.jsx)
 */
import "../studio/studio.css";
import "../studio/activities"; // side-effect: registreert alle activiteiten
import StudioShell from "../studio/StudioShell";

export default function StudioPage() {
  return <StudioShell />;
}
