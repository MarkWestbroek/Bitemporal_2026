/**
 * weergaveActivity — "Weergave": het profiel (M2) van het weergaveproject, op de generieke
 * diagram-motor (plan docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het
 * project, §3; profiel in diagramprofielen/weergave/).
 *
 * - *Weergave → Laad de vormen van de tool* zet alle vormen van de tool in dit project, gegroepeerd
 *   per profiel (studio/weergaveProject.js).
 * - *Weergave → Laad de vormen uit dit project in de tool*: elke vorm in het project vervangt de
 *   vorm met dezelfde id, tot een herlaad. Zo is een concept uit te proberen (Mark 21-11).
 * - *Weergave → Exporteer het weergaveproject* geeft het project als werkbestand.
 */
import { IconWeergave } from "../icons";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { registreerWeergaveProfiel, weergaveDiagramType, maakElement, WEERGAVE_PROFIEL_ID } from "../../diagramprofielen/weergave/index.js";
import { registreerWeergaveEditors } from "./weergaveEditors.jsx";
import { registreerM3Editors } from "./m3Editors.jsx";
import { weergaveProject, vormenUitProject, laadVormen, WEERGAVE_ACTIVITEIT_ID } from "../weergaveProject.js";
import { alleShapeTypes } from "../../diagramcore/types/shapeType.js";
import { alleDiagramTypes, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { getProfieltypen, registreerProfieltype } from "../profieltypeRegistry.js";
import { downloadJson } from "../studioUtils.js";
import { toonMelding, vraagBevestiging } from "../naamDialog.jsx";

registreerWeergaveProfiel();
registreerM3Editors();
registreerWeergaveEditors();

const huidigProject = () => weergaveProject({ shapeTypes: alleShapeTypes(), descriptors: alleDiagramTypes(), taalDescriptor: getDiagramType(WEERGAVE_PROFIEL_ID) });

/** Alle vormen van de tool in dit project (elementen die er al zijn, worden bijgewerkt). */
async function laadVormenVanDeTool(useStore) {
  const st = useStore.getState();
  if (Object.keys(st.elements).length && !(await vraagBevestiging({ titel: "Vormen laden", tekst: "De vormen van de tool in dit model zetten? Bestaande vormen met dezelfde id worden bijgewerkt.", bevestig: "Laad" }))) return;
  const model = huidigProject().profielen[WEERGAVE_ACTIVITEIT_ID];
  const store = useStore.getState();
  for (const el of Object.values(model.elements)) {
    if (store.elements[el.id]) store.updateElement(el.id, { naam: el.naam, data: el.data });
    else store.addElement(el);
  }
  for (const d of Object.values(model.diagrams)) {
    if (useStore.getState().diagrams[d.id]) continue;
    useStore.getState().addDiagram({ id: d.id, naam: d.naam, diagramType: d.diagramType });
    for (const n of d.nodes) useStore.getState().addElementToDiagram(d.id, n.elementId, n.position);
  }
  toonMelding({ tekst: `${Object.keys(model.elements).length} vormen in ${Object.keys(model.diagrams).length} diagrammen.` });
}

/** De vormen van dit project in de tool zetten, tot een herlaad. */
async function laadInDeTool(useStore) {
  const { shapeTypes, fouten } = vormenUitProject({ elements: useStore.getState().elements });
  if (!shapeTypes.length && !fouten.length) {
    toonMelding({
      titel: "Nog geen vormen in dit project",
      tekst: "Deze actie laadt de vormen van het huidige project in de tool, en dit project heeft er nog geen.\n\nKies eerst Weergave → Laad de vormen van de tool, wijzig een vorm en laad hem daarna met deze actie in de tool.",
    });
    return;
  }
  if (!(await vraagBevestiging({ titel: "Vormen laden", tekst: `${shapeTypes.length} vorm(en) uit dit project in de tool laden? Een vorm die de tool al kent, wordt vervangen tot je de pagina herlaadt.`, bevestig: "Laad" }))) return;
  const uit = laadVormen(shapeTypes);
  // Opnieuw aanmelden laat de canvassen opnieuw tekenen.
  for (const p of getProfieltypen()) registreerProfieltype(p);
  const alle = [...fouten, ...uit.fouten];
  toonMelding({
    titel: "Vormen geladen",
    tekst: [`Vervangen: ${uit.vervangen.length}`, `Nieuw: ${uit.nieuw.length}`, ...(alle.length ? ["", "Niet geladen:", ...alle] : [])].join("\n"),
  });
}

function exporteer() {
  const project = huidigProject();
  downloadJson({ ...project, geexporteerd: new Date().toISOString() }, "omnium-weergaven.studio-project.json");
  toonMelding({ tekst: `Weergaveproject geëxporteerd: ${Object.keys(project.profielen[WEERGAVE_ACTIVITEIT_ID].elements).length} vormen. Openen kan met Project → Importeer project….` });
}

export default maakDiagramActiviteit({
  id: WEERGAVE_ACTIVITEIT_ID,
  label: "Weergave",
  icon: <IconWeergave />,
  descriptor: weergaveDiagramType,
  maakElement,
  persistKey: "studio05-weergave",
  taakbalkSleutel: "studio05-taakbalken-weergave",
  menuPrefix: "wg05",
  menuLabel: "Weergave",
  kleur: "#6366f1",
  standaardVerborgen: true, // via Modelleren en het weergaveproject; voor de ontwerper
  previewTekst: "Weergave — hiermee maak je weergaven: de vormen en iconen van de tool als model, per vorm de renderer en zijn parameters, per icoon de SVG. Het weergaveproject bestaat uit modellen in deze taal.",
  devHookNaam: "__weergave05Store",
  hoofdmenuExtra: [
    { id: "laad-vormen", label: "Laad de vormen van de tool", run: laadVormenVanDeTool },
    { id: "laad-in-tool", label: "Laad de vormen uit dit project in de tool", run: laadInDeTool },
    { id: "exporteer", label: "Exporteer het weergaveproject", run: () => exporteer() },
  ],
  startActies: [{ id: "laad-vormen", label: "Laad de vormen van de tool", run: laadVormenVanDeTool }],
});
