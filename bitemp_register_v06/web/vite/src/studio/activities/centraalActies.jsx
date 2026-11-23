/**
 * centraalActies — *Project → Breng versie uit…* en *Project → Centrale versies…* (plan
 * "Sidecar-project" §8, stap 5; besluiten Mark 22-11). De pure delen staan in `../centraal.js`, de
 * API in `projectSync.js`, de server in `handlers/studio_centraal.go`.
 *
 * - **Breng versie uit…** (alleen een profielen- of weergaveproject op de server; de server laat
 *   alleen de beheerder toe): eerst de outbox leeg, dan een versie kiezen (patch, minor of major na
 *   de laatst uitgebrachte), een notitie, en het werkbestand gaat als onveranderlijke versie naar de
 *   server, met de vorige versie als ouder. De projectkop krijgt het nummer.
 * - **Centrale versies…**: de uitgebrachte versies per soort (met ouders, wie, wanneer, en welke
 *   deze Studio vastpint). Een versie kun je in de tool laden (tot een herlaad) of als project
 *   openen om te bekijken.
 */
import { vraagKeuze, vraagNaam, vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { brengVersieUit, centraleVersies, haalCentraleVersie } from "./projectSync.js";
import { hoogsteVan, volgendeVersies, versieRegel, vastgepind, modelUitWerkbestand, vergelijkVersie } from "../centraal.js";
import { soortVan, SOORT_MODEL, SOORT_PROFIELEN, zetGeladen } from "../projectGebruik.js";

const fout = (titel, e) => toonMelding({ titel, tekst: e?.message || String(e) });

/**
 * @param {{huidig: () => any, verzend: () => Promise<any>, bouwInhoud: () => any, zetProject: (patch: any) => void}} deps
 *   `huidig` geeft de projectkop (na het verzenden opnieuw gelezen), `bouwInhoud` het werkbestand.
 */
export async function brengVersieUitActie({ huidig, verzend, bouwInhoud, zetProject }) {
  let project = huidig();
  const soort = soortVan(project);
  if (soort === SOORT_MODEL) {
    toonMelding({ titel: "Versie uitbrengen", tekst: "Alleen een profielen- of weergaveproject brengt versies uit." });
    return;
  }
  if (project.serverVersie == null) {
    toonMelding({ titel: "Versie uitbrengen", tekst: "Dit project staat nog niet op de server. Stuur het eerst naar de server (Project → Naar server sturen)." });
    return;
  }
  let lijst;
  try {
    await verzend();
    lijst = await centraleVersies();
  } catch (e) {
    fout("Versie uitbrengen", e);
    return;
  }
  if (lijst.centrale) {
    toonMelding({ titel: "Versie uitbrengen", tekst: `Deze instantie is een spiegel van ${lijst.centrale}. Versies worden op de centrale uitgebracht.` });
    return;
  }
  project = huidig();
  const hoogste = hoogsteVan(lijst.versies, soort);
  const v = volgendeVersies(hoogste);
  const opties = hoogste
    ? [
        { waarde: v.minor, label: `${v.minor} — minor: nieuwe elementtypen, eigenschappen of vormen` },
        { waarde: v.patch, label: `${v.patch} — patch: een correctie, niets nieuws` },
        { waarde: v.major, label: `${v.major} — major: iets wat bestaande modellen raakt` },
      ]
    : [
        { waarde: "1.0.0", label: "1.0.0 — de eerste versie (in gebruik; aanbevolen)" },
        { waarde: "0.1.0", label: "0.1.0 — de eerste versie, nog niet stabiel" },
      ];
  const versie = await vraagKeuze({
    titel: `Versie uitbrengen: ${project.naam}`,
    label: hoogste ? `Laatst uitgebracht: ${hoogste}. Nieuwe versie:` : "Nog niets uitgebracht. Eerste versie:",
    opties,
  });
  if (!versie) return;
  const notitie = await vraagNaam({ titel: `Versie ${versie}`, label: "Wat is er veranderd? (komt bij de versie te staan)", meerregelig: true, leegToegestaan: true, bevestig: "Volgende" });
  if (notitie == null) return;
  const ok = await vraagBevestiging({
    titel: `Versie ${versie} uitbrengen?`,
    tekst: [
      `De huidige stand van "${project.naam}" wordt versie ${versie} van de ${soort}${hoogste ? `, na ${hoogste}` : ""}.`,
      "Een uitgebrachte versie is onveranderlijk. Instanties nemen haar pas in gebruik met een release die haar vastpint (centraalVersies.js).",
    ].join("\n\n"),
    bevestig: "Breng uit",
  });
  if (!ok) return;
  try {
    const inhoud = bouwInhoud();
    inhoud.project = { ...inhoud.project, versie };
    const u = await brengVersieUit(project.id, { versie, inhoud, totVolgnummer: huidig().laatsteVolgnummer || 0, notitie });
    zetProject({ versie });
    const ouders = (u.ouders || []).map((o) => o.versie).join(" + ");
    toonMelding({ titel: "Versie uitgebracht", tekst: `${soort} ${versie} staat op de server${ouders ? ` (na ${ouders})` : " (de eerste)"}.\n\nPin haar in centraalVersies.js om er een release mee te maken.` });
  } catch (e) {
    if (e?.reden === "achterstand") {
      toonMelding({ titel: "Versie uitbrengen", tekst: "Op de server staan wijzigingen die hier nog niet zijn. Haal ze eerst binnen (Project → Nu verversen) en probeer het opnieuw." });
      return;
    }
    fout("Versie uitbrengen mislukt", e);
  }
}

/**
 * @param {{openAlsProject: (werkbestand: any) => Promise<boolean>}} deps
 */
export async function toonCentraleVersiesActie({ openAlsProject }) {
  let lijst;
  try {
    lijst = await centraleVersies();
  } catch (e) {
    fout("Centrale versies", e);
    return;
  }
  const pins = vastgepind();
  const bron = lijst.centrale ? `Spiegel van ${lijst.centrale}.` : "Deze instantie is de centrale.";
  const pinRegel = `Deze Studio start met: profielen ${pins.profielen || "uit de code"}, weergaven ${pins.weergaven || "uit de code"}.`;
  const versies = [...(lijst.versies || [])].sort((a, b) => (a.soort === b.soort ? vergelijkVersie(b.versie, a.versie) : a.soort.localeCompare(b.soort)));
  if (!versies.length) {
    toonMelding({ titel: "Centrale versies", tekst: [bron, lijst.fout || "", "Er is nog geen versie uitgebracht.", pinRegel].filter(Boolean).join("\n\n") });
    return;
  }
  const gekozen = await vraagKeuze({
    titel: "Centrale versies",
    label: [bron, lijst.fout || "", pinRegel, "Kies een versie om te laden of te openen (Annuleren = alleen bekijken):"].filter(Boolean).join("\n"),
    opties: versies.map((u) => ({ waarde: `${u.soort}@${u.versie}`, label: `${u.soort} ${versieRegel(u, pins[u.soort])}` })),
  });
  if (!gekozen) return;
  const [soort, versie] = gekozen.split("@");
  const actie = await vraagKeuze({
    titel: `${soort} ${versie}`,
    label: "Wat wil je doen?",
    opties: [
      { waarde: "laad", label: "In de tool laden (tot je de pagina herlaadt)" },
      { waarde: "open", label: "Als project openen (bekijken; vervangt het open project)" },
    ],
  });
  if (!actie) return;
  let rec;
  try {
    rec = await haalCentraleVersie(soort, versie);
  } catch (e) {
    fout(`${soort} ${versie} ophalen`, e);
    return;
  }
  if (actie === "open") {
    await openAlsProject(rec.inhoud);
    return;
  }
  try {
    const model = modelUitWerkbestand(soort, rec.inhoud);
    let fouten = [];
    if (soort === SOORT_PROFIELEN) {
      const { zetProfielenInDeTool } = await import("./m3ProfielActivity.jsx");
      fouten = zetProfielenInDeTool(model).fouten || [];
    } else {
      const { zetWeergavenInDeTool } = await import("./weergaveActivity.jsx");
      fouten = zetWeergavenInDeTool(model.elements)?.fouten || [];
    }
    zetGeladen(soort, { id: rec.projectId, naam: rec.projectNaam, versie, concept: false });
    toonMelding({ titel: `${soort} ${versie} geladen`, tekst: ["Tot je de pagina herlaadt.", ...(fouten.length ? ["", "Niet geladen:", ...fouten] : [])].join("\n") });
  } catch (e) {
    fout(`${soort} ${versie} laden`, e);
  }
}
