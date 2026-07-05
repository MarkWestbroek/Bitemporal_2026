/**
 * profielOntwerpActivity — "Profiel-ontwerp (0.5)": trede 2 van de
 * meta-editor (plan §8.9), conform het metamodel: Elementtype ◆
 * Compartimenttype ◆ Veldtype, elk met eigen properties.
 *
 * - Start met een geseed voorbeeld-ontwerp (het e2e-scenario: Ster/Planeet).
 * - *Ontwerp → Bekijk bestaand profiel…* laadt een geregistreerd profiel
 *   (canoniek-uml, puur-uml, oas31, eigen profielen) als ontwerp-diagram.
 * - *Ontwerp → Activeer profiel…* (voorheen "Genereer & registreer" — dat
 *   botste met het register-genereren) vertaalt de tekening naar een
 *   descriptor-kern en registreert hem live; bestaat het profiel al, dan
 *   wordt het ververst. Zelfde kanaal als trede 1, dus daarna ook te
 *   bekijken/bijschaven in "Profiel (0.5)". Ook via rechtsklik op de canvas.
 * - Elk diagram stelt hier een profiel voor: menu's en dialogen zeggen
 *   daarom "profiel" (diagramTerm).
 */
import { IconProfielOntwerp05 } from "../icons";
import useStudioStore from "../useStudioStore";
import { vervangDiagramType, getDiagramType, alleDiagramTypes } from "../../diagramcore/types/typeRegistry.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { vertaalHooks, maakGeneriekeMaakElement } from "./profielGereedschap.js";
import {
  profielOntwerpKern,
  PROFIEL_ONTWERP_ID,
  bouwProfielUitOntwerp,
  ontwerpUitProfiel,
  voorbeeldOntwerpMetRegel,
  elementenVanDiagram,
} from "./profielOntwerp.js";
import { bewaarProfiel, registreerProfielAlsActiviteit } from "./profielRegistratie.jsx";

const descriptor = vertaalHooks(profielOntwerpKern);
vervangDiagramType(descriptor);

/**
 * Vertaal het áctieve diagram (= profiel) naar een descriptor en registreer
 * hem als activiteit; een bestaand profiel met dezelfde id wordt ververst.
 */
function activeerProfiel(useStore) {
  const id = window.prompt("Profiel-id (kleine letters en koppeltekens):", "mijn-profiel");
  if (!id) return;
  const label = window.prompt("Naam in de activity bar:", id) || id;
  try {
    // P01: activeer het áctieve diagram — de sandbox kan meerdere
    // profielen naast elkaar bevatten (één per diagram).
    const staat = useStore.getState();
    const kern = bouwProfielUitOntwerp(
      { elements: elementenVanDiagram(staat, staat.actiefDiagramId) },
      { id, label }
    );
    const activiteitId = registreerProfielAlsActiviteit(kern);
    bewaarProfiel(kern);
    useStudioStore.getState().setActief(activiteitId);
  } catch (e) {
    window.alert(`Activeren mislukt: ${e?.message || e}`);
  }
}

/** Laad een geregistreerd profiel als éxtra ontwerp-diagram in de sandbox. */
function bekijkBestaandProfiel(useStore) {
  const ids = alleDiagramTypes()
    .map((dt) => dt.id)
    .filter((dtId) => dtId !== PROFIEL_ONTWERP_ID);
  const keuze = window.prompt(`Welk profiel?\nBeschikbaar: ${ids.join(", ")}`, ids[0] || "");
  if (!keuze) return;
  const gekozen = getDiagramType(keuze.trim());
  if (!gekozen) {
    window.alert(`Onbekend profiel "${keuze}".`);
    return;
  }
  // P01: elk bekeken profiel wordt een éigen diagram in de sandbox,
  // naast wat er al staat — activeren werkt per diagram.
  const ontwerp = ontwerpUitProfiel(gekozen);
  useStore.getState().addDiagram({
    id: `ontw_${gekozen.id}_${Date.now()}`,
    naam: gekozen.label || gekozen.id,
    diagramType: PROFIEL_ONTWERP_ID,
  });
  const dId = useStore.getState().actiefDiagramId;
  for (const el of Object.values(ontwerp.elements)) {
    useStore.getState().addElement(el);
  }
  const nodes = Object.values(ontwerp.diagrams)[0]?.nodes || [];
  for (const n of nodes) {
    useStore.getState().addElementToDiagram(dId, n.elementId, n.position);
  }
}

export default maakDiagramActiviteit({
  id: "profielOntwerp05",
  label: "Profiel-ontwerp (0.5)",
  icon: <IconProfielOntwerp05 />,
  descriptor,
  maakElement: maakGeneriekeMaakElement(descriptor),
  persistKey: "studio05-profiel-ontwerp",
  taakbalkSleutel: "studio05-taakbalken-profiel-ontwerp",
  menuPrefix: "po05",
  menuLabel: "Ontwerp",
  // Elk diagram is hier een profiel — menu's en dialogen praten mee.
  diagramTerm: "profiel",
  previewTekst:
    "Teken Elementtypen ◆ Compartimenttypen ◆ Veldtypen + verbindingsregels; Ontwerp → Activeer profiel maakt er een activiteit van.",
  devHookNaam: "__profielOntwerpStore",
  koppeling: {
    /** Seed/reset: het voorbeeld-ontwerp (e2e-scenario) als startdiagram. */
    herlaadUitModel: () => voorbeeldOntwerpMetRegel(),
    herlaadLabel: "Laad voorbeeld-ontwerp…",
  },
  hoofdmenuExtra: [
    { id: "activeer", label: "Activeer profiel… (registreer/ververs)", run: activeerProfiel },
    { id: "bekijk-profiel", label: "Bekijk bestaand profiel als ontwerp…", run: bekijkBestaandProfiel },
  ],
  // Zelfde actie onder de rechtermuisknop op een leeg stuk canvas.
  canvasMenuExtra: [{ id: "activeer-ctx", label: "Activeer profiel…", run: activeerProfiel }],
});
