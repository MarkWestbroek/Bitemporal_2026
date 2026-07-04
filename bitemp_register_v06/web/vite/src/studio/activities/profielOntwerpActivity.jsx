/**
 * profielOntwerpActivity — "Profiel-ontwerp (0.5)": trede 2 van de
 * meta-editor (plan §8.9), conform het metamodel: Elementtype ◆
 * Compartimenttype ◆ Veldtype, elk met eigen properties.
 *
 * - Start met een geseed voorbeeld-ontwerp (het e2e-scenario: Ster/Planeet).
 * - *Ontwerp → Bekijk bestaand profiel…* laadt een geregistreerd profiel
 *   (canoniek-uml, puur-uml, oas31, eigen profielen) als ontwerp-diagram.
 * - *Ontwerp → Genereer & registreer profiel…* vertaalt de tekening naar een
 *   descriptor-kern en registreert hem live — zelfde kanaal als trede 1,
 *   dus daarna ook zichtbaar/bij te schaven in "Profiel (0.5)".
 */
import { IconDiagram } from "../icons";
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

export default maakDiagramActiviteit({
  id: "profielOntwerp05",
  label: "Profiel-ontwerp (0.5)",
  icon: <IconDiagram />,
  descriptor,
  maakElement: maakGeneriekeMaakElement(descriptor),
  persistKey: "studio05-profiel-ontwerp",
  taakbalkSleutel: "studio05-taakbalken-profiel-ontwerp",
  menuPrefix: "po05",
  menuLabel: "Ontwerp",
  previewTekst:
    "Teken Elementtypen ◆ Compartimenttypen ◆ Veldtypen + verbindingsregels; Ontwerp → Genereer maakt er een activiteit van.",
  devHookNaam: "__profielOntwerpStore",
  koppeling: {
    /** Seed/reset: het voorbeeld-ontwerp (e2e-scenario) als startdiagram. */
    herlaadUitModel: () => voorbeeldOntwerpMetRegel(),
    herlaadLabel: "Laad voorbeeld-ontwerp…",
  },
  hoofdmenuExtra: [
    {
      id: "genereer",
      label: "Genereer & registreer profiel…",
      run: (useStore) => {
        const id = window.prompt("Profiel-id (kleine letters en koppeltekens):", "mijn-profiel");
        if (!id) return;
        const label = window.prompt("Naam in de activity bar:", id) || id;
        try {
          // P01: genereer uit het áctieve diagram — de sandbox kan meerdere
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
          window.alert(`Genereren mislukt: ${e?.message || e}`);
        }
      },
    },
    {
      id: "bekijk-profiel",
      label: "Bekijk bestaand profiel als ontwerp…",
      run: (useStore) => {
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
        // naast wat er al staat — genereren werkt per diagram.
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
      },
    },
  ],
});
