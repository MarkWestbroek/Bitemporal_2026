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
import ShapeSetPaneel from "./shapeSetPaneel.jsx";
import { vertaalHooks, maakGeneriekeMaakElement } from "./profielGereedschap.js";
import {
  profielOntwerpKern,
  PROFIEL_ONTWERP_ID,
  bouwProfielUitOntwerp,
  ontwerpUitProfiel,
  ontwerpUitAlleProfielen,
  pasStandaardLayoutToe,
  layoutSleutels,
  voorbeeldOntwerpMetRegel,
  elementenVanDiagram,
} from "./profielOntwerp.js";
import {
  bewaarProfiel,
  registreerProfielAlsActiviteit,
  leesProfielLayouts,
  bewaarProfielLayout,
} from "./profielRegistratie.jsx";

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
  // P05: eigen embleem in de activity bar (1-2 tekens); git-persistent via
  // de kern. Leeg = het standaard profiel-icoon.
  const embleem = (window.prompt("Embleem voor de activity bar (1-2 tekens, leeg = standaard):", "") || "")
    .trim()
    .slice(0, 2);
  try {
    // P01: activeer het áctieve diagram — de sandbox kan meerdere
    // profielen naast elkaar bevatten (één per diagram). Shape-sets en de
    // typering-standaard zijn Style-data op het diagram (P07) en gaan
    // pass-through mee.
    const staat = useStore.getState();
    const diag = staat.diagrams[staat.actiefDiagramId] || {};
    const kern = bouwProfielUitOntwerp(
      {
        elements: elementenVanDiagram(staat, staat.actiefDiagramId),
        shapeSets: diag.shapeSets,
        typeWeergave: diag.typeWeergave,
      },
      { id, label }
    );
    if (embleem) kern.embleem = embleem;
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
  // Een eerder bewaarde standaard-layout voor dit profiel wint van de
  // gegenereerde posities.
  const nodes = pasStandaardLayoutToe(
    ontwerp.elements,
    Object.values(ontwerp.diagrams)[0]?.nodes || [],
    leesProfielLayouts()[gekozen.id]
  );
  for (const n of nodes) {
    useStore.getState().addElementToDiagram(dId, n.elementId, n.position);
  }
}

/**
 * Bewaar de layout van het actieve ontwerp-diagram als standaard voor het
 * profiel: bij elk volgend laden (herlaad of "Bekijk bestaand…") komen de
 * nodes weer zo te staan. Sleutels zijn naam-gebaseerd (zie layoutSleutels),
 * want de gegenereerde element-ids verschillen per laadbeurt.
 */
function bewaarLayoutAlsStandaard(useStore) {
  const s = useStore.getState();
  const d = s.diagrams[s.actiefDiagramId];
  if (!d) return;
  const m = /^ontw_(.+?)(?:_\d{10,})?$/.exec(d.id);
  if (!m) {
    window.alert(
      "Dit ontwerp is niet uit een geregistreerd profiel geladen.\n" +
        "Activeer het eerst (dan krijgt het een profiel-id) en laad het opnieuw."
    );
    return;
  }
  const layout = {};
  for (const { node, sleutel } of layoutSleutels(s.elements, d.nodes)) {
    layout[sleutel] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
  }
  bewaarProfielLayout(m[1], layout);
  window.alert(`Layout bewaard als standaard voor profiel "${m[1]}".`);
}

/** Voorbeeld-ontwerp (Ster ◆ Planeet) laden — vervangt de sandbox. */
function laadVoorbeeld(useStore) {
  if (
    Object.keys(useStore.getState().elements).length &&
    !window.confirm("Voorbeeld-ontwerp laden? De huidige sandbox wordt vervangen.")
  ) {
    return;
  }
  useStore.getState().laadModel(voorbeeldOntwerpMetRegel());
  useStore.temporal.getState().clear();
}

export default maakDiagramActiviteit({
  id: "profielOntwerp05",
  label: "Profiel-ontwerp",
  icon: <IconProfielOntwerp05 />,
  // Gereedschap, geen modelleeractiviteit (zie profielActivity).
  groep: "beheer",
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
  // Eén profiel per diagram: de browser toont alleen het actieve profiel
  // (anders stapelen de verbindingsregels van alle profielen op).
  browserAlleenActiefDiagram: true,
  // P07: shape-set-matrix in een verstelbaar onder-dock (Style-domein,
  // alleen in de profiel-editor — een gewoon diagram heeft dit niet).
  onderPaneel: { id: "shapesets", label: "Shape-sets (vorm per elementtype)", Component: ShapeSetPaneel },
  koppeling: {
    /**
     * Herlaad = álle geregistreerde profielen als ontwerp-diagrammen naast
     * elkaar (met hun bewaarde standaard-layouts); zonder registraties valt
     * hij terug op het voorbeeld-ontwerp.
     */
    herlaadUitModel: () => {
      const dts = alleDiagramTypes().filter((dt) => dt.id !== PROFIEL_ONTWERP_ID);
      if (!dts.length) return voorbeeldOntwerpMetRegel();
      const layouts = leesProfielLayouts();
      return ontwerpUitAlleProfielen(dts, (pid) => layouts[pid]);
    },
    herlaadLabel: "Laad alle geregistreerde profielen…",
  },
  hoofdmenuExtra: [
    { id: "activeer", label: "Activeer profiel… (registreer/ververs)", run: activeerProfiel },
    { id: "bekijk-profiel", label: "Bekijk bestaand profiel als ontwerp…", run: bekijkBestaandProfiel },
    { id: "bewaar-layout", label: "Bewaar layout als standaard voor dit profiel", run: bewaarLayoutAlsStandaard },
    { id: "voorbeeld", label: "Laad voorbeeld-ontwerp (Ster ◆ Planeet)…", run: laadVoorbeeld },
  ],
  // Zelfde acties onder de rechtermuisknop op een leeg stuk canvas.
  canvasMenuExtra: [
    { id: "activeer-ctx", label: "Activeer profiel…", run: activeerProfiel },
    { id: "bewaar-layout-ctx", label: "Bewaar layout als standaard", run: bewaarLayoutAlsStandaard },
  ],
});
