/**
 * transformatieProfielActivity — "Transformatie": het profiel (M2) waarin je een regelset
 * schrijft, op de generieke diagram-motor. Descriptor + fabriek; zie
 * diagramprofielen/transformatie/ en docs/TRANSFORMATIES.md §9.8.
 *
 * Een regelset is hier een element «transformatie» met zijn regels in volgorde, tussen een bron
 * en een doel («taal» voor een profiel, «formaat» voor een extern formaat). Omdat het een gewoon
 * modelleerprofiel is, bewaart, synchroniseert en vertakt de Studio een regelset als elk ander
 * model; in het sidecar-project staan ze naast de profielen waartussen ze afbeelden.
 *
 * - *Transformatie → Laad de ingebouwde regelsets* zet alle regelsets uit de catalogus op een
 *   nieuw diagram.
 * - *Transformatie → Meld de transformaties van dit diagram aan* geeft de getekende versie aan
 *   de catalogus (vindplaats "model"): de activiteit Transformaties toont en proefdraait haar
 *   dan. De transformaties zelf draaien nog op de regelset uit de code.
 */
import "./regelsetsIngebouwd.js";
import { IconTransformatie } from "../icons";
import { registreerTransformatieProfiel, transformatieDiagramType, maakElement, TRANSFORMATIE_TYPE } from "../../diagramprofielen/transformatie/index.js";
import { alleRegelsets, getRegelsetVermelding, registreerRegelset } from "../../transformatie/regelsetCatalogus.js";
import { modelNaarRegelset, regelsetsNaarModel } from "../../transformatie/regelsetModel.js";
import { alleDiagramTypes } from "../../diagramcore/types/typeRegistry.js";
import { toonMelding } from "../naamDialog.jsx";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerTransformatieProfiel();

/** Is deze naam het id van een geregistreerd profiel? Dan is de bron of het doel een «taal». */
const isProfiel = (naam) => alleDiagramTypes().some((dt) => dt.id === naam);

/** Alle regelsets uit de catalogus op een nieuw diagram. */
function laadIngebouwd(useStore) {
  // Elke keer nieuwe id's: het diagram kan vaker geladen worden naast een eerder exemplaar.
  const achtervoegsel = `_${Date.now()}`;
  const model = regelsetsNaarModel(alleRegelsets(), { isProfiel, achtervoegsel });
  useStore.getState().addDiagram({ id: `tr_ingebouwd${achtervoegsel}`, naam: "Ingebouwde regelsets", diagramType: transformatieDiagramType.id });
  const diagramId = useStore.getState().actiefDiagramId;
  for (const el of Object.values(model.elements)) useStore.getState().addElement(el);
  for (const n of model.nodes) useStore.getState().addElementToDiagram(diagramId, n.elementId, n.position);
}

/**
 * De transformaties op het actieve diagram aanmelden bij de catalogus. De proefbron en het schema
 * van de ingebouwde regelset met dezelfde code blijven staan. Geldt tot een herlaad.
 */
function meldAan(useStore) {
  const st = useStore.getState();
  const opDiagram = new Set((st.diagrams?.[st.actiefDiagramId]?.nodes || []).map((n) => n.elementId));
  const elementen = Object.values(st.elements).filter((el) => el.elementType === TRANSFORMATIE_TYPE && opDiagram.has(el.id));
  if (!elementen.length) {
    toonMelding({ tekst: "Op dit diagram staat geen transformatie." });
    return;
  }
  const fouten = [];
  let aantal = 0;
  for (const el of elementen) {
    const uit = modelNaarRegelset(el, st.elements);
    if (!uit.regelset) {
      fouten.push(...uit.fouten);
      continue;
    }
    const was = getRegelsetVermelding(uit.regelset.id);
    registreerRegelset(uit.regelset, {
      vindplaats: "model",
      bestand: null,
      proef: was?.proef || null,
      richting: uit.richting || was?.richting || "export",
      schema: was?.schema || null,
      schrijver: uit.schrijver || was?.schrijver || null,
    });
    aantal += 1;
  }
  toonMelding({ tekst: fouten.length ? `${aantal} aangemeld; niet gelukt: ${fouten.join(" ")}` : `${aantal} transformatie(s) aangemeld bij de catalogus (vindplaats: model).` });
}

export default maakDiagramActiviteit({
  id: "transformatie05",
  label: "Transformatie",
  icon: <IconTransformatie />,
  descriptor: transformatieDiagramType,
  maakElement,
  persistKey: "studio05-transformatie",
  taakbalkSleutel: "studio05-taakbalken-transformatie",
  menuPrefix: "tr05",
  menuLabel: "Transformatie",
  kleur: "#e11d48",
  standaardVerborgen: true, // via Modelleren + instellingen bereikbaar; de view Transformaties is de gewone ingang
  previewTekst: "Transformatie — een regelset als model: regels in volgorde, tussen een bron en een doel (taal of formaat).",
  devHookNaam: "__transformatie05Store",
  hoofdmenuExtra: [
    { id: "laad-ingebouwd", label: "Laad de ingebouwde regelsets", run: laadIngebouwd },
    { id: "meld-aan", label: "Meld de transformaties van dit diagram aan", run: meldAan },
  ],
  startActies: [{ id: "laad-ingebouwd", label: "Laad de ingebouwde regelsets", run: laadIngebouwd }],
});
