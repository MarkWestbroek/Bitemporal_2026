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
 * - *Profiel (M3) → Open het sidecar-project van de tool* opent alle profielen en regelsets als
 *   **eigen project** (`omnium-sidecar`). Is dat project al open, dan zet het elk profiel dat er nog
 *   niet staat erbij (zelfde id's); wat er al staat, blijft zoals het is. Nooit in een gewoon
 *   project (Mark 22-11);
 * - *Profiel (M3) → Haal de profielen uit dit project* ruimt op als ze toch in een gewoon project
 *   staan;
 * - *Profiel (M3) → Laad de profielen uit dit project in de tool* (PROF-1 stap d, opt-in): elk
 *   profiel-diagram wordt weer een profiel. Een profiel dat de tool kent, wordt op zijn plek
 *   vervangen; een onbekend profiel wordt een eigen profiel. Tot een herlaad.
 */
import { IconProfielOntwerp05 } from "../icons";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { maakGeneriekeMaakElement } from "./profielGereedschap.js";
import { ontwerpDescriptor, registreerProfielOntwerp, M3_PROFIEL_ID } from "./m3Profiel.js";
import { PROFIEL_ONTWERP_ID } from "./profielOntwerp.js";
import { registreerM3Editors } from "./m3Editors.jsx";
import ShapeSetPaneel from "./shapeSetPaneel.jsx";
import { activeerProfiel, bekijkBestaandProfiel, exporteerSidecarProject, sidecarDescriptors } from "./profielOntwerpActivity.jsx";
import { sidecarProject, SIDECAR_PROJECT_ID } from "../sidecarProject.js";
import { alleRegelsets } from "../../transformatie/regelsetCatalogus.js";
import { kernenUitProject, laadKernen } from "../profielenUitProject.js";
import { registreerProfielAlsActiviteit } from "./profielRegistratie.jsx";
import { getProfieltypen, registreerProfieltype } from "../profieltypeRegistry.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { toonMelding, vraagBevestiging } from "../naamDialog.jsx";
import { zetGeladen, SOORT_PROFIELEN } from "../projectGebruik.js";
import { bewaarStart, leesStart, wisStart } from "../startUitProject.js";

registreerM3Editors();
registreerProfielOntwerp();

/**
 * Elk profiel van de tool als diagram in dit project (de tegenhanger van Weergave → Laad de vormen
 * van de tool). Dezelfde opbouw en id's als het sidecar-project; een diagram dat er al is, blijft.
 */
export async function laadProfielenVanDeTool(useStore) {
  const { huidigProjectId, openAlsProject } = await import("./modellerenActivity.jsx");
  if (huidigProjectId() !== SIDECAR_PROJECT_ID) {
    const project = sidecarProject({
      descriptors: sidecarDescriptors(),
      vermeldingen: alleRegelsets(),
      taalDescriptors: { m3: getDiagramType(PROFIEL_ONTWERP_ID), transformatie: getDiagramType("transformatie") },
    });
    await openAlsProject({ ...project, geexporteerd: new Date().toISOString() });
    return;
  }
  // Per profiel apart opgebouwd, zodat we precies weten welke elementen bij welk diagram horen.
  const perProfiel = sidecarDescriptors().map((descriptor) => sidecarProject({ descriptors: [descriptor] }).profielen[M3_PROFIEL_ID]);
  const al = useStore.getState().diagrams;
  const nieuw = perProfiel.filter((m3) => !Object.keys(m3.diagrams).some((id) => al[id]));
  const bestaand = perProfiel.length - nieuw.length;
  if (!nieuw.length) {
    toonMelding({ tekst: `Alle ${bestaand} profielen staan al als diagram in dit project.` });
    return;
  }
  for (const m3 of nieuw) {
    for (const el of Object.values(m3.elements)) {
      if (!useStore.getState().elements[el.id]) useStore.getState().addElement(el);
    }
    for (const d of Object.values(m3.diagrams)) useStore.getState().addDiagram(d);
  }
  toonMelding({
    titel: "Profielen geladen",
    tekst: [
      `${nieuw.length} profiel(en) als diagram in dit project gezet.`,
      ...(bestaand ? [`${bestaand} stond(en) er al en bleven zoals ze waren.`] : []),
      "",
      "Wijzig een profiel en kies Profiel (M3) → Laad de profielen uit dit project in de tool om het uit te proberen.",
    ].join("\n"),
  });
}

/** De profielen (taal Profiel (M3)) uit dit project halen, als ze in een gewoon project terechtkwamen. */
async function haalProfielenWeg(useStore) {
  const st = useStore.getState();
  const els = Object.keys(st.elements);
  const dgs = Object.keys(st.diagrams);
  if (!els.length && !dgs.length) {
    toonMelding({ tekst: "Dit project heeft geen profielen in de taal Profiel (M3)." });
    return;
  }
  const ok = await vraagBevestiging({
    titel: "Profielen uit dit project halen",
    tekst: `${dgs.length} profiel-diagram(men) en ${els.length} element(en) in de taal Profiel (M3) uit dit project verwijderen? De tool zelf verandert niet.`,
    bevestig: "Verwijder",
    gevaar: true,
  });
  if (!ok) return;
  for (const id of dgs) useStore.getState().deleteDiagram(id);
  for (const id of els) if (useStore.getState().elements[id]) useStore.getState().deleteElement(id);
  toonMelding({ tekst: `${dgs.length} profiel-diagram(men) en ${els.length} element(en) verwijderd.` });
}

/**
 * De profiel-diagrammen uit een model in de tool zetten: bekende profielen op hun plek, onbekende als
 * eigen activiteit. Ook gebruikt bij het starten (startUitProject.js).
 * @returns {{vervangen: string[], nieuw: any[], fouten: string[]}}
 */
export function zetProfielenInDeTool({ elements, diagrams }) {
  const { vervangen, nieuw, fouten } = laadKernen(kernenUitProject({ elements, diagrams }));
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
  return { vervangen, nieuw, fouten };
}

/** Na het laden: ook bij het starten van de Studio gebruiken (startUitProject.js, plan §7 stap 6)? */
async function vraagStart(soort, kop, inhoud, wat) {
  const ja = await vraagBevestiging({
    titel: "Ook bij het starten?",
    tekst: `De Studio ook voortaan starten met de ${wat} uit "${kop.naam || kop.id}" (in deze browser)? Lukt dat bij het starten niet, dan gebruikt de tool de code. Terug naar de code kan met "Start weer uit de code".`,
    bevestig: "Bij het starten gebruiken",
    annuleer: "Alleen nu",
  });
  if (!ja) return;
  try {
    await bewaarStart(soort, { kop: { id: kop.id, naam: kop.naam, versie: kop.versie, concept: true }, inhoud });
    toonMelding({ tekst: `De Studio start voortaan met de ${wat} uit "${kop.naam || kop.id}".` });
  } catch (e) {
    toonMelding({ tekst: `Bewaren voor het starten lukte niet: ${e?.message || e}` });
  }
}

async function startUitDeCode(soort, wat) {
  const stand = await leesStart(soort);
  if (!stand) {
    toonMelding({ tekst: `De Studio start al met de ${wat} uit de code.` });
    return;
  }
  await wisStart(soort);
  toonMelding({ tekst: `Vanaf de volgende keer start de Studio weer met de ${wat} uit de code (was: "${stand.kop?.naam || stand.kop?.id}"). Herlaad de pagina om dat nu te doen.` });
}

/** Alle profiel-diagrammen van dit project als profielen in de tool zetten (profielenUitProject.js). */
export async function laadInDeTool(useStore) {
  const st = useStore.getState();
  const kernen = kernenUitProject({ elements: st.elements, diagrams: st.diagrams });
  if (!kernen.length) {
    toonMelding({
      titel: "Nog geen profielen in dit project",
      tekst: [
        "Deze actie laadt de profiel-diagrammen van het huidige project in de tool, en dit project heeft er nog geen.",
        "",
        "Zo komt er een profiel in:",
        "• Profiel (M3) → Open het sidecar-project van de tool (alle profielen, als eigen project), of",
        "• Profiel (M3) → Laad een profiel als diagram… (één profiel).",
        "",
        "Wijzig het profiel en laad het daarna met deze actie in de tool.",
      ].join("\n"),
    });
    return;
  }
  const ok = await vraagBevestiging({
    titel: "Profielen laden",
    tekst: `${kernen.length} profiel(en) uit dit project in de tool laden? Een profiel dat de tool al kent, wordt vervangen tot je de pagina herlaadt.`,
    bevestig: "Laad",
  });
  if (!ok) return;
  const { vervangen, nieuw, fouten } = zetProfielenInDeTool({ elements: st.elements, diagrams: st.diagrams });
  // De tool draait nu op dit project (projectGebruik.js): een concept tot het is uitgebracht (keuze A, Mark 22-11).
  const { huidigProjectKop } = await import("./modellerenActivity.jsx");
  const kop = huidigProjectKop();
  zetGeladen(SOORT_PROFIELEN, { id: kop.id, naam: kop.naam, versie: kop.versie, concept: true });
  await toonMelding({
    titel: "Profielen geladen",
    tekst: [`Vervangen: ${vervangen.length}`, `Nieuw: ${nieuw.length}`, ...(fouten.length ? ["", "Niet geladen:", ...fouten] : [])].join("\n"),
  });
  await vraagStart(SOORT_PROFIELEN, kop, { elements: st.elements, diagrams: st.diagrams }, "profielen");
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
  previewTekst: "Profiel (M3) — hiermee maak je een profiel (M2). De taal is het M3: elementtypen, compartimenten, veldtypen en verbindingsregels. Het M2 + transformaties-project bestaat uit modellen in deze taal en in Transformatie.",
  devHookNaam: "__m3Profiel05Store",
  browserAlleenActiefDiagram: true,
  onderPaneel: { id: "shapesets", label: "Shape-sets (vorm per elementtype)", Component: ShapeSetPaneel },
  startActies: [{ id: "laad-alle", label: "Open het sidecar-project van de tool", run: laadProfielenVanDeTool }],
  hoofdmenuExtra: [
    { id: "activeer", label: "Activeer profiel… (registreer/ververs)", run: activeerProfiel },
    { id: "laad-profiel", label: "Laad een profiel als diagram…", run: bekijkBestaandProfiel },
    { id: "laad-alle", label: "Open het sidecar-project van de tool", run: laadProfielenVanDeTool },
    { id: "laad-in-tool", label: "Laad de profielen uit dit project in de tool", run: laadInDeTool },
    { id: "sidecar", label: "Exporteer het sidecar-project (profielen en transformaties)", run: exporteerSidecarProject },
    { id: "haal-weg", label: "Haal de profielen uit dit project", run: haalProfielenWeg },
    { id: "start-code", label: "Start weer uit de code (profielen)", run: () => startUitDeCode(SOORT_PROFIELEN, "profielen") },
  ],
});
