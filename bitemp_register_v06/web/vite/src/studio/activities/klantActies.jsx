/**
 * klantActies — klantaanpassingen als delta (plan "Sidecar-project" §10, stap 8; besluit Mark
 * 22-11). De pure delen staan in `../takken/klantDelta.js`, de server in
 * `handlers/studio_klantaanpassing.go`.
 *
 * - **Project → Klantaanpassing vastleggen…**: in een geopende centrale versie (of een eerder
 *   gegenereerde klantversie) is de delta wat er anders is dan de basisversie in de projectkop.
 *   Alleen die delta gaat naar de server, als een nieuwe versie van de aanpassing van die klant.
 * - **Project → Klantaanpassingen…**: per klant de versies; een klantversie genereren (basis +
 *   delta) en openen of in de tool laden, of de delta **op een nieuwe basis zetten**: per wijziging
 *   past, botst of al opgenomen; bij een botsing kiest de beheerder klant of basis; de delta wordt
 *   kleiner of leeg.
 */
import { vraagKeuze, vraagNaam, vraagBevestiging, toonMelding } from "../naamDialog.jsx";
import { centraleVersies, haalCentraleVersie, legKlantAanpassingVast, klantAanpassingen, haalKlantAanpassing } from "./projectSync.js";
import { volgendeVersies, vergelijkVersie, hoogsteVan, modelUitWerkbestand } from "../centraal.js";
import { soortVan, SOORT_MODEL, SOORT_PROFIELEN } from "../projectGebruik.js";
import { maakDelta, pasDeltaToe, zetOpNieuweBasis, isLeeg, eenheidTekst } from "../takken/klantDelta.js";

const fout = (titel, e) => toonMelding({ titel, tekst: e?.message || String(e) });
const LAATSTE_KLANT = "omnium.studio.laatsteKlant";

/** De hoogste versie van de aanpassing van deze klant voor deze soort ("" = nog geen). */
function hoogsteVanKlant(lijst, klant, soort) {
  return hoogsteVan((lijst || []).filter((a) => a.klant === klant).map((a) => ({ soort: a.soort, versie: a.versie })), soort);
}

/** Telling per soort eenheid, als tekst ("3 element, 1 diagram"). */
function telTekst(eenheden) {
  const n = {};
  for (const e of eenheden || []) n[e.soort] = (n[e.soort] || 0) + 1;
  return Object.entries(n).map(([s, k]) => `${k} ${s}`).join(", ") || "niets";
}

/** De klantversie als werkbestand met een eigen kop (geen centrale versie: een generatie). */
function klantWerkbestand(basisInhoud, delta, { klant, soort, versie, basisVersie, naam }) {
  const wb = pasDeltaToe(basisInhoud, delta);
  wb.project = {
    ...(basisInhoud?.project || {}),
    id: `klant-${klant}-${soort}`,
    naam: `${naam || soort} ${basisVersie} + ${klant} ${versie}`,
    soort,
    versie: basisVersie,
    concept: false,
    klant: { naam: klant, versie },
  };
  return wb;
}

/**
 * @param {{huidig: () => any, bouwInhoud: () => any}} deps
 */
export async function legKlantAanpassingVastActie({ huidig, bouwInhoud }) {
  const project = huidig();
  const soort = soortVan(project);
  if (soort === SOORT_MODEL || !project.versie) {
    toonMelding({ titel: "Klantaanpassing", tekst: "Open eerst een centrale versie (Project → Centrale versies… → als project openen) of een klantversie, en pas die aan." });
    return;
  }
  const basisVersie = project.versie;
  let basis, lijst;
  try {
    basis = await haalCentraleVersie(soort, basisVersie);
    lijst = (await klantAanpassingen()).aanpassingen || [];
  } catch (e) {
    fout("Klantaanpassing", e);
    return;
  }
  const delta = maakDelta(basis.inhoud, bouwInhoud(), { soort, basisVersie });
  if (isLeeg(delta)) {
    toonMelding({ titel: "Klantaanpassing", tekst: `Er is niets anders dan ${soort} ${basisVersie}: geen aanpassing om vast te leggen.` });
    return;
  }
  let standaard = project.klant?.naam || "";
  try {
    standaard ||= localStorage.getItem(LAATSTE_KLANT) || "";
  } catch {
    /* geen opslag */
  }
  const klant = (await vraagNaam({ titel: "Klantaanpassing vastleggen", label: "Klant (kleine letters, cijfers en -, bv. gemeente-x):", waarde: standaard }))?.trim();
  if (!klant) return;
  const hoogste = hoogsteVanKlant(lijst, klant, soort);
  const v = volgendeVersies(hoogste);
  const versie = await vraagKeuze({
    titel: `Klantaanpassing ${klant}`,
    label: hoogste ? `Laatste versie van deze aanpassing: ${hoogste}. Nieuwe versie:` : "De eerste versie van deze aanpassing:",
    opties: hoogste
      ? [{ waarde: v.minor, label: `${v.minor} — minor` }, { waarde: v.patch, label: `${v.patch} — patch` }, { waarde: v.major, label: `${v.major} — major` }]
      : [{ waarde: "1.0.0", label: "1.0.0" }],
  });
  if (!versie) return;
  const notitie = await vraagNaam({ titel: `${klant} ${versie}`, label: "Wat past de klant aan?", meerregelig: true, leegToegestaan: true, bevestig: "Volgende" });
  if (notitie == null) return;
  const ok = await vraagBevestiging({
    titel: `Klantaanpassing ${klant} ${versie} vastleggen?`,
    tekst: [
      `Op ${soort} ${basisVersie}: ${delta.eenheden.length} wijziging(en) (${telTekst(delta.eenheden)}).`,
      "Alleen deze delta wordt bewaard; de klantversie is altijd de basis plus de delta.",
    ].join("\n\n"),
    bevestig: "Leg vast",
  });
  if (!ok) return;
  try {
    await legKlantAanpassingVast({ klant, soort, versie, basisVersie, delta, notitie });
    try {
      localStorage.setItem(LAATSTE_KLANT, klant);
    } catch {
      /* geen opslag */
    }
    toonMelding({ titel: "Klantaanpassing vastgelegd", tekst: `${klant} ${versie} op ${soort} ${basisVersie}: ${delta.eenheden.length} wijziging(en).` });
  } catch (e) {
    if (e?.reden === "versie_niet_hoger") {
      toonMelding({ titel: "Klantaanpassing", tekst: `Er is intussen een hogere versie van deze aanpassing. Probeer het opnieuw.` });
      return;
    }
    fout("Klantaanpassing vastleggen mislukt", e);
  }
}

/**
 * @param {{openAlsProject: (werkbestand: any) => Promise<boolean>}} deps
 */
export async function toonKlantAanpassingenActie({ openAlsProject }) {
  let lijst;
  try {
    lijst = (await klantAanpassingen()).aanpassingen || [];
  } catch (e) {
    fout("Klantaanpassingen", e);
    return;
  }
  if (!lijst.length) {
    toonMelding({ titel: "Klantaanpassingen", tekst: "Er is nog geen klantaanpassing vastgelegd. Open een centrale versie als project, pas haar aan en kies Project → Klantaanpassing vastleggen…." });
    return;
  }
  const gesorteerd = [...lijst].sort((a, b) => a.klant.localeCompare(b.klant) || a.soort.localeCompare(b.soort) || vergelijkVersie(b.versie, a.versie));
  const gekozen = await vraagKeuze({
    titel: "Klantaanpassingen",
    label: "Een versie van een klantaanpassing (een delta op een centrale versie):",
    opties: gesorteerd.map((a) => ({
      waarde: `${a.klant}|${a.soort}|${a.versie}`,
      label: `${a.klant} · ${a.soort} ${a.versie} · op ${a.basisVersie} · ${a.eenheden} wijziging(en)${a.notitie ? ` — ${a.notitie}` : ""}`,
    })),
  });
  if (!gekozen) return;
  const [klant, soort, versie] = gekozen.split("|");
  const actie = await vraagKeuze({
    titel: `${klant} ${soort} ${versie}`,
    label: "Wat wil je doen?",
    opties: [
      { waarde: "open", label: "De klantversie openen als project (basis + delta)" },
      { waarde: "laad", label: "De klantversie in de tool laden (tot je de pagina herlaadt)" },
      { waarde: "basis", label: "Op een nieuwe basisversie zetten…" },
    ],
  });
  if (!actie) return;
  let rij, basis;
  try {
    rij = await haalKlantAanpassing(klant, soort, versie);
    basis = await haalCentraleVersie(soort, rij.basisVersie);
  } catch (e) {
    fout("Klantaanpassing ophalen", e);
    return;
  }
  const kop = { klant, soort, versie, basisVersie: rij.basisVersie, naam: basis.projectNaam };
  if (actie === "open") {
    await openAlsProject(klantWerkbestand(basis.inhoud, rij.delta, kop));
    return;
  }
  if (actie === "laad") {
    try {
      const model = modelUitWerkbestand(soort, pasDeltaToe(basis.inhoud, rij.delta));
      let fouten = [];
      if (soort === SOORT_PROFIELEN) {
        const { zetProfielenInDeTool } = await import("./m3ProfielActivity.jsx");
        fouten = zetProfielenInDeTool(model).fouten || [];
      } else {
        const { zetWeergavenInDeTool } = await import("./weergaveActivity.jsx");
        fouten = zetWeergavenInDeTool(model.elements)?.fouten || [];
      }
      toonMelding({ titel: `${klant}: ${soort} ${rij.basisVersie} + ${versie} geladen`, tekst: ["Tot je de pagina herlaadt.", ...(fouten.length ? ["", "Niet geladen:", ...fouten] : [])].join("\n") });
    } catch (e) {
      fout("Klantversie laden", e);
    }
    return;
  }
  await zetOpNieuweBasisActie({ rij, basis, lijst });
}

/** Stap 8, het hart: de delta op een nieuwere centrale versie zetten en als nieuwe versie vastleggen. */
async function zetOpNieuweBasisActie({ rij, basis, lijst }) {
  const { klant, soort } = rij;
  let versies;
  try {
    versies = ((await centraleVersies()).versies || []).filter((u) => u.soort === soort && vergelijkVersie(u.versie, rij.basisVersie) > 0);
  } catch (e) {
    fout("Centrale versies", e);
    return;
  }
  if (!versies.length) {
    toonMelding({ titel: "Nieuwe basis", tekst: `Er is geen nieuwere versie van de ${soort} dan ${rij.basisVersie}.` });
    return;
  }
  versies.sort((a, b) => vergelijkVersie(b.versie, a.versie));
  const nieuweVersie = await vraagKeuze({
    titel: `${klant}: nieuwe basis`,
    label: `Nu op ${soort} ${rij.basisVersie}. Zet de aanpassing op:`,
    opties: versies.map((u) => ({ waarde: u.versie, label: `${u.versie}${u.notitie ? ` — ${u.notitie}` : ""}` })),
  });
  if (!nieuweVersie) return;
  let nieuw;
  try {
    nieuw = await haalCentraleVersie(soort, nieuweVersie);
  } catch (e) {
    fout(`${soort} ${nieuweVersie} ophalen`, e);
    return;
  }
  const invoer = { oudeBasis: basis.inhoud, nieuweBasis: nieuw.inhoud, delta: rij.delta, nieuweVersie };
  let r = zetOpNieuweBasis(invoer);
  const klantVersie = pasDeltaToe(basis.inhoud, rij.delta);
  const regels = (uitkomst) => r.uitkomsten.filter((u) => u.uitkomst === uitkomst).map((u) => `  • ${eenheidTekst(u, klantVersie)}`);
  const verslag = [
    `${rij.delta.eenheden.length} wijziging(en) van ${klant} op ${soort} ${rij.basisVersie} → ${nieuweVersie}:`,
    `past: ${r.telling.past} · botst: ${r.telling.botst} · al opgenomen: ${r.telling.opgenomen}`,
    ...(r.telling.opgenomen ? ["", "Al opgenomen in de basis (vallen uit de delta):", ...regels("opgenomen")] : []),
    ...(r.telling.botst ? ["", "Botst (de basis veranderde hetzelfde anders):", ...regels("botst")] : []),
  ].join("\n");
  if (r.telling.botst) {
    const keuze = await vraagKeuze({
      titel: `${klant}: botsingen`,
      label: `${verslag}\n\nBij een botsing:`,
      opties: [
        { waarde: "basis", label: "De nieuwe basis wint (de klant volgt de centrale wijziging)" },
        { waarde: "klant", label: "De klant houdt zijn versie" },
      ],
    });
    if (!keuze) return;
    r = zetOpNieuweBasis({ ...invoer, klantWint: keuze === "klant" });
  }
  const hoogste = hoogsteVanKlant(lijst, klant, soort);
  const versie = volgendeVersies(hoogste).minor;
  const leeg = isLeeg(r.delta);
  const ok = await vraagBevestiging({
    titel: `${klant} ${versie} op ${soort} ${nieuweVersie} vastleggen?`,
    tekst: [
      verslag,
      "",
      leeg
        ? "De delta is nu leeg: de klant kan de centrale versie zonder aanpassing gebruiken. Toch vastleggen (als lege aanpassing)?"
        : `De nieuwe delta: ${r.delta.eenheden.length} wijziging(en) (${telTekst(r.delta.eenheden)}).`,
    ].join("\n"),
    bevestig: "Leg vast",
  });
  if (!ok) return;
  try {
    await legKlantAanpassingVast({ klant, soort, versie, basisVersie: nieuweVersie, delta: r.delta, notitie: `Op ${nieuweVersie} gezet (was ${rij.basisVersie}, ${rij.versie}).` });
    toonMelding({ titel: "Klantaanpassing op nieuwe basis", tekst: `${klant} ${versie} op ${soort} ${nieuweVersie}: ${r.delta.eenheden.length} wijziging(en).` });
  } catch (e) {
    fout("Vastleggen mislukt", e);
  }
}
