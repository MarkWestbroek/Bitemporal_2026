/**
 * m3ProfielActivity — "Profiel (M3)": een profiel (M2) als model in het M3, als gewone
 * modelleertaal in een project (PROF-1, het sidecar-project; Mark 19-11).
 *
 * Dezelfde taal als het Profiel-ontwerp (`m3Profiel.js`, `ontwerptaal.js`), maar in Modelleren:
 * de inhoud hoort bij het project en wordt bewaard, gesynchroniseerd en vertakt als elk ander
 * model. Het sidecar-project (Profiel-ontwerp → Exporteer het sidecar-project) zet hier per profiel
 * een diagram neer. Het Profiel-ontwerp zelf blijft het kladblok dat zich vult met alle
 * geregistreerde profielen.
 *
 * - *Profiel (M3) → Activeer profiel…* maakt van het actieve diagram een activiteit (zoals in het
 *   Profiel-ontwerp);
 * - *Profiel (M3) → Laad een profiel als diagram…* zet een geregistreerd profiel erbij;
 * - *Profiel (M3) → Laad de profielen uit dit project in de tool* (PROF-1 stap d, opt-in): elk
 *   profiel-diagram wordt weer een profiel. Een profiel dat de tool kent, wordt op zijn plek
 *   vervangen; een onbekend profiel wordt een eigen profiel. Tot een herlaad.
 */
import { IconProfielOntwerp05 } from "../icons";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { maakGeneriekeMaakElement } from "./profielGereedschap.js";
import { ontwerpDescriptor, registreerProfielOntwerp, M3_PROFIEL_ID } from "./m3Profiel.js";
import { registreerM3Editors } from "./m3Editors.jsx";
import ShapeSetPaneel from "./shapeSetPaneel.jsx";
import { activeerProfiel, bekijkBestaandProfiel, exporteerSidecarProject } from "./profielOntwerpActivity.jsx";
import { kernenUitProject, laadKernen } from "../profielenUitProject.js";
import { registreerProfielAlsActiviteit } from "./profielRegistratie.jsx";
import { getProfieltypen, registreerProfieltype } from "../profieltypeRegistry.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { toonMelding, vraagBevestiging } from "../naamDialog.jsx";

registreerM3Editors();
registreerProfielOntwerp();

/** Alle profiel-diagrammen van dit project als profielen in de tool zetten (profielenUitProject.js). */
async function laadInDeTool(useStore) {
  const st = useStore.getState();
  const kernen = kernenUitProject({ elements: st.elements, diagrams: st.diagrams });
  if (!kernen.length) {
    toonMelding({ tekst: "Dit project heeft nog geen profiel-diagrammen." });
    return;
  }
  const ok = await vraagBevestiging({
    titel: "Profielen laden",
    tekst: `${kernen.length} profiel(en) uit dit project in de tool laden? Een profiel dat de tool al kent, wordt vervangen tot je de pagina herlaadt.`,
    bevestig: "Laad",
  });
  if (!ok) return;
  const { vervangen, nieuw, fouten } = laadKernen(kernen);
  for (const kern of nieuw) {
    try {
      registreerProfielAlsActiviteit(kern);
    } catch (e) {
      fouten.push(`${kern.label || kern.id}: ${e?.message || e}`);
    }
  }
  // De activiteiten houden hun descriptor vast (op zijn plek vervangen); opnieuw aanmelden laat
  // Modelleren en de canvassen opnieuw tekenen.
  const geraakt = new Set(vervangen.map((id) => getDiagramType(id)));
  for (const p of getProfieltypen()) if (geraakt.has(p.descriptor)) registreerProfieltype(p);
  toonMelding({
    titel: "Profielen geladen",
    tekst: [`Vervangen: ${vervangen.length}`, `Nieuw: ${nieuw.length}`, ...(fouten.length ? ["", "Niet geladen:", ...fouten] : [])].join("\n"),
  });
}

export default maakDiagramActiviteit({
  id: M3_PROFIEL_ID,
  label: "Profiel (M3)",
  icon: <IconProfielOntwerp05 />,
  descriptor: ontwerpDescriptor,
  maakElement: maakGeneriekeMaakElement(ontwerpDescriptor),
  persistKey: "studio05-m3-profiel",
  taakbalkSleutel: "studio05-taakbalken-m3-profiel",
  menuPrefix: "m3p05",
  menuLabel: "Profiel (M3)",
  kleur: "#0ea5e9",
  standaardVerborgen: true, // via Modelleren en het sidecar-project; het Profiel-ontwerp blijft het kladblok
  diagramTerm: "profiel",
  previewTekst: "Profiel (M3) — een profiel (M2) als model in het M3: elementtypen, compartimenten, veldtypen en verbindingsregels, met alle M3-eigenschappen.",
  devHookNaam: "__m3Profiel05Store",
  browserAlleenActiefDiagram: true,
  onderPaneel: { id: "shapesets", label: "Shape-sets (vorm per elementtype)", Component: ShapeSetPaneel },
  hoofdmenuExtra: [
    { id: "activeer", label: "Activeer profiel… (registreer/ververs)", run: activeerProfiel },
    { id: "laad-profiel", label: "Laad een profiel als diagram…", run: bekijkBestaandProfiel },
    { id: "laad-in-tool", label: "Laad de profielen uit dit project in de tool", run: laadInDeTool },
    { id: "sidecar", label: "Exporteer het sidecar-project (profielen en transformaties)", run: exporteerSidecarProject },
  ],
});
