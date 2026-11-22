/**
 * weergaveActivity — "Weergave": het profiel (M2) van het weergaveproject, op de generieke
 * diagram-motor (plan docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het
 * project, §3; profiel in diagramprofielen/weergave/).
 *
 * - *Weergave → Open het weergaveproject van de tool* opent alle vormen, iconen en koppelingen van de
 *   tool als **eigen project** (`omnium-weergaven`), gegroepeerd per profiel
 *   (studio/weergaveProject.js). Is dat project al open, dan werkt het de inhoud bij. Nooit in een
 *   gewoon project (Mark 22-11).
 * - *Weergave → Haal de weergaven uit dit project* ruimt op als ze toch in een gewoon project staan. De ingebouwde iconen komen als SVG-tekst
 *   uit `diagramcore/shapes/ingebouwdeIconen.js` (gegenereerd uit de JSX, die de reserve blijft);
 *   eigen data-iconen (Studio-instellingen) gaan mee.
 * - *Weergave → Laad de weergaven uit dit project in de tool*: elke vorm en elk icoon in het project
 *   vervangt die met dezelfde id, en elke koppeling wordt op haar profiel gezet, tot een herlaad. Zo is een concept uit te proberen (Mark 21-11).
 *   Een icoon wordt een data-icoon (geschoonde SVG); `vorm:<shape>` vervangt het standaardicoon.
 * - *Weergave → Exporteer het weergaveproject* geeft het project als werkbestand.
 */
import { IconWeergave } from "../icons";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { registreerWeergaveProfiel, weergaveDiagramType, maakElement, WEERGAVE_PROFIEL_ID } from "../../diagramprofielen/weergave/index.js";
import { registreerWeergaveEditors } from "./weergaveEditors.jsx";
import { registreerM3Editors } from "./m3Editors.jsx";
import { weergaveProject, vormenUitProject, laadVormen, iconenUitProject, koppelingenUitProject, laadKoppelingen, WEERGAVE_ACTIVITEIT_ID, WEERGAVE_PROJECT_ID } from "../weergaveProject.js";
import { INGEBOUWDE_ICONEN } from "../../diagramcore/shapes/ingebouwdeIconen.js";
import { registreerDataIcoon } from "../../diagramcore/shapes/dataIcoon.jsx";
import { getTypeIcoon, STANDAARD_ICOON_PREFIX } from "../../diagramcore/shapes/typeIconen.jsx";
import { leesIconen } from "./iconenRegistratie.js";
import { alleShapeTypes } from "../../diagramcore/types/shapeType.js";
import { alleDiagramTypes, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { getProfieltypen, registreerProfieltype } from "../profieltypeRegistry.js";
import { downloadJson } from "../studioUtils.js";
import { toonMelding, vraagBevestiging } from "../naamDialog.jsx";
import { zetGeladen, SOORT_WEERGAVEN } from "../projectGebruik.js";

registreerWeergaveProfiel();
registreerM3Editors();
registreerWeergaveEditors();

/** De iconen van de tool: de ingebouwde (SVG-tekst) en de eigen data-iconen. */
const iconenVanDeTool = () => ({ ...INGEBOUWDE_ICONEN, ...leesIconen() });

const huidigProject = () =>
  weergaveProject({ shapeTypes: alleShapeTypes(), iconen: iconenVanDeTool(), descriptors: alleDiagramTypes(), taalDescriptor: getDiagramType(WEERGAVE_PROFIEL_ID) });

/** Iconen in de tool zetten als data-iconen; een bekende id wordt vervangen. */
function laadIconen(iconen) {
  const vervangen = [];
  const nieuw = [];
  for (const def of iconen) {
    const bestond = !!getTypeIcoon(def.id) || def.id.startsWith(STANDAARD_ICOON_PREFIX);
    registreerDataIcoon(def);
    (bestond ? vervangen : nieuw).push(def.id);
  }
  return { vervangen, nieuw };
}

/**
 * Het weergaveproject van de tool: als eigen project openen, of (als het al open is) bijwerken met
 * wat de tool nu heeft (elementen die er al zijn, worden bijgewerkt).
 */
async function laadVormenVanDeTool(useStore) {
  const { huidigProjectId, openAlsProject } = await import("./modellerenActivity.jsx");
  if (huidigProjectId() !== WEERGAVE_PROJECT_ID) {
    await openAlsProject({ ...huidigProject(), geexporteerd: new Date().toISOString() });
    return;
  }
  const st = useStore.getState();
  if (Object.keys(st.elements).length && !(await vraagBevestiging({ titel: "Weergaven bijwerken", tekst: "Het weergaveproject bijwerken met de vormen, iconen en koppelingen van de tool? Bestaande met dezelfde id worden bijgewerkt.", bevestig: "Bijwerken" }))) return;
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
  const els = Object.values(model.elements);
  const aantal = (type) => els.filter((e) => e.elementType === type).length;
  toonMelding({ tekst: `${aantal("vorm")} vormen, ${aantal("icoon")} iconen en ${aantal("koppeling")} koppelingen in ${Object.keys(model.diagrams).length} diagrammen.` });
}

/** Alle weergaven uit dit project halen (als ze in een gewoon project terechtkwamen). */
async function haalWeergavenWeg(useStore) {
  const st = useStore.getState();
  const els = Object.keys(st.elements);
  const dgs = Object.keys(st.diagrams);
  if (!els.length && !dgs.length) {
    toonMelding({ tekst: "Dit project heeft geen weergaven." });
    return;
  }
  const ok = await vraagBevestiging({
    titel: "Weergaven uit dit project halen",
    tekst: `${els.length} weergave(n) en ${dgs.length} diagram(men) in de taal Weergave uit dit project verwijderen? De tool zelf verandert niet.`,
    bevestig: "Verwijder",
    gevaar: true,
  });
  if (!ok) return;
  for (const id of dgs) useStore.getState().deleteDiagram(id);
  for (const id of els) if (useStore.getState().elements[id]) useStore.getState().deleteElement(id);
  toonMelding({ tekst: `${els.length} weergave(n) en ${dgs.length} diagram(men) verwijderd.` });
}

/** De vormen en iconen van dit project in de tool zetten, tot een herlaad. */
async function laadInDeTool(useStore) {
  const elements = useStore.getState().elements;
  const { shapeTypes, fouten } = vormenUitProject({ elements });
  const ic = iconenUitProject({ elements });
  const kp = koppelingenUitProject({ elements });
  if (!shapeTypes.length && !ic.iconen.length && !kp.koppelingen.length && !fouten.length && !ic.fouten.length && !kp.fouten.length) {
    toonMelding({
      titel: "Nog geen weergaven in dit project",
      tekst: "Deze actie laadt de vormen en iconen van het huidige project in de tool, en dit project heeft er geen.\n\nKies eerst Weergave → Open het weergaveproject van de tool, wijzig daar een vorm of icoon en laad die met deze actie in de tool.",
    });
    return;
  }
  if (
    !(await vraagBevestiging({
      titel: "Weergaven laden",
      tekst: `${shapeTypes.length} vorm(en), ${ic.iconen.length} icoon/iconen en ${kp.koppelingen.length} koppeling(en) uit dit project in de tool laden? Wat de tool al kent, wordt vervangen tot je de pagina herlaadt.`,
      bevestig: "Laad",
    }))
  )
    return;
  const uit = laadVormen(shapeTypes);
  const uitIc = laadIconen(ic.iconen);
  // Koppelingen op de geregistreerde profielen, op hun plek (na de vormen en iconen die ze noemen).
  const uitKp = laadKoppelingen(kp.koppelingen, (pid) => getDiagramType(pid));
  // De tool draait nu op dit project (projectGebruik.js): een concept tot het is uitgebracht (keuze A, Mark 22-11).
  {
    const { huidigProjectKop } = await import("./modellerenActivity.jsx");
    const kop = huidigProjectKop();
    zetGeladen(SOORT_WEERGAVEN, { id: kop.id, naam: kop.naam, versie: kop.versie, concept: true });
  }
  // Opnieuw aanmelden laat de canvassen en taakbalken opnieuw tekenen.
  for (const p of getProfieltypen()) registreerProfieltype(p);
  const alle = [...fouten, ...uit.fouten, ...ic.fouten, ...kp.fouten, ...uitKp.fouten];
  toonMelding({
    titel: "Weergaven geladen",
    tekst: [
      `Vormen — vervangen: ${uit.vervangen.length}, nieuw: ${uit.nieuw.length}`,
      `Iconen — vervangen: ${uitIc.vervangen.length}, nieuw: ${uitIc.nieuw.length}`,
      `Koppelingen — toegepast: ${uitKp.toegepast.length}`,
      ...(alle.length ? ["", "Niet geladen:", ...alle] : []),
    ].join("\n"),
  });
}

function exporteer() {
  const project = huidigProject();
  downloadJson({ ...project, geexporteerd: new Date().toISOString() }, "omnium-weergaven.studio-project.json");
  toonMelding({ tekst: `Weergaveproject geëxporteerd: ${Object.keys(project.profielen[WEERGAVE_ACTIVITEIT_ID].elements).length} vormen en iconen. Openen kan met Project → Importeer project….` });
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
    { id: "laad-vormen", label: "Open het weergaveproject van de tool", run: laadVormenVanDeTool },
    { id: "laad-in-tool", label: "Laad de weergaven uit dit project in de tool", run: laadInDeTool },
    { id: "exporteer", label: "Exporteer het weergaveproject", run: () => exporteer() },
    { id: "haal-weg", label: "Haal de weergaven uit dit project", run: haalWeergavenWeg },
  ],
  startActies: [{ id: "laad-vormen", label: "Open het weergaveproject van de tool", run: laadVormenVanDeTool }],
});
