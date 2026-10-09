// @ts-check
/**
 * importQeaProject — één EA-import voor het hele project (Modelleren):
 * bestand → pakketkeuze → élk diagram naar het profiel waar het hoort.
 *
 * De per-profiel-imports (UML, Activity, Use case, MIM) lezen alleen hun
 * eigen diagramsoort en melden de rest als "overgeslagen" — wie in de
 * UML-activiteit UC.NPA.REG.0010 importeert krijgt dus geen use case-model
 * (Mark, 09-10). Hier draaien alle lezers over hetzelfde pakket:
 *
 *   - klassediagrammen → puur-uml, of mim12 als het pakket MIM-/MIG-
 *     stereotypen draagt (dan is het een MIM-informatiemodel);
 *   - activiteitendiagrammen → activity;
 *   - use case-diagrammen → use case.
 *
 * Elke uitkomst gaat als "toevoegen" (één undo-stap per profiel) in de
 * store van dat profiel; de diagrammen verschijnen in Modelleren onder
 * "Niet ingedeeld" bij hun profiel, klaar om in een map te slepen.
 */
import { openQea, leesPakketten, leesBron } from "./qeaLezer.js";
import { pakketPad } from "./qeaHulp.js";
// Lezerslijst, profiel-ids en MIM-detectie: gedeeld met de node-sidecar (eaLezers.js).
import { eaLezersVoor, wortelPakket, telOvergeslagen, heeftMimStereotypen } from "./eaLezers.js";
import { vraagKeuze, toonMelding } from "../../studio/naamDialog.jsx";
import { getProfieltype } from "../../studio/profieltypeRegistry.js";
import { vergelijkMetStore, pasPlanToe, standaardKeuzes, herschrijfOpBestaandeIds } from "./vergelijkImport.js";
import { deelboomPakketten } from "./qeaHulp.js";
import { vraagReview } from "../../studio/naamDialog.jsx";
import { bouwReviewBoom, bladSleutels } from "./reviewBoom.js";
import { opslagFouten } from "../../diagramcore/model/opslag.js";

export { heeftMimStereotypen };

/**
 * Kies een .qea en importeer één pakket in alle passende profielen.
 * @param {{naImport?: (profielId: string, model: {elements: Record<string, any>, diagrams: Record<string, any>}, ctx: {bron: any, packageId: number, geheugen: Map<any, any>, doel: any}) => void,
 *          kiesDoel?: (pakketLabel: string) => Promise<any>}} [opties]
 *   `kiesDoel` wordt na de pakketkeuze aangeroepen (bv. "welke map?"); `undefined`
 *   terug = afbreken, anders komt de waarde als `ctx.doel` mee. `naImport` wordt
 *   per profiel aangeroepen ná een geslaagde import, met de definitieve
 *   (eventueel hernoemde) element-/diagram-ids — bv. om de EA-boom (pakketten,
 *   use case, activity) als mappen in het project te zetten.
 */
export function importeerQeaInProject(opties = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".qea,.qeax";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .arrayBuffer()
      .then((bytes) => importeerQeaBytesInProject(bytes, file.name, opties))
      .catch((e) => toonMelding({ titel: "Import mislukt", tekst: String(e?.message || e) }));
  };
  input.click();
}

/**
 * @param {ArrayBuffer} bytes
 * @param {string} [bestandsnaam]
 * @returns {Promise<null|{profielen: Record<string, {elementen:number, diagrammen:number}>, overgeslagen: Record<string, number>}>}
 */
export async function importeerQeaBytesInProject(bytes, bestandsnaam = "", opties = {}) {
  const db = await openQea(bytes);
  let bron;
  let pakketLabel = "";
  let packageId = 0;
  try {
    const pakketten = leesPakketten(db);
    const opties = pakketten
      .map((p) => ({ waarde: String(p.Package_ID), label: pakketPad(pakketten, p.Package_ID) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const keuze = await vraagKeuze({
      titel: `EA-pakket importeren in het project${bestandsnaam ? ` — ${bestandsnaam}` : ""}`,
      label: `Pakket (met deelpakketten) — ${pakketten.length} pakketten; elk diagram gaat naar zijn eigen profiel`,
      opties,
      bevestig: "Importeer",
      zoekbaar: true,
    });
    if (!keuze) return null;
    pakketLabel = opties.find((o) => o.waarde === keuze)?.label || keuze;
    packageId = Number(keuze);
    bron = leesBron(db, packageId);
  } finally {
    db.close();
  }
  return verdeelOverProfielen(bron, packageId, pakketLabel, opties);
}

/**
 * Verdeel één gelezen pakket over de profielen. Apart van de bestandskeuze,
 * zodat het ook zonder dialoog aan te roepen is.
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {number} packageId
 * @param {string} [pakketLabel]
 */
export async function verdeelOverProfielen(bron, packageId, pakketLabel = "", { naImport = null, kiesDoel = null } = {}) {
  if (!packageId) packageId = wortelPakket(bron);
  const lezers = eaLezersVoor(bron);
  /** @type {Record<string, {elementen:number, diagrammen:number}>} */
  const profielen = {};
  /** @type {Record<string, number>} */
  const overgeslagen = {};
  const meldingen = [];
  /** Run-context voor `naImport`: één geheugen voor alle profielen van deze import. */
  const ctx = { bron, packageId, geheugen: new Map(), doel: null };
  // Waar in het project (bv. welke map): de host kiest, vóór er iets wordt ingevoegd.
  if (kiesDoel) {
    const doel = await kiesDoel(pakketLabel);
    if (doel === undefined) return null; // afgebroken
    ctx.doel = doel;
  }
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));

  // ── Stap 1: lezen en vergelijken (nog niets veranderd) ─────────────────
  const stappen = [];
  for (const { profiel, vertaal, naam, isKlasseLezer } of lezers) {
    const model = vertaal(bron, { packageId });
    const aantalDiagrammen = Object.keys(model.diagrams).length;
    const aantalElementen = Object.keys(model.elements).length;
    // Alleen profielen waar ook echt een diagram voor is (de klasse-lezer
    // leest altijd elementen; zonder diagram laten we die niet los in een
    // ander profiel zwerven) — behalve het klasse-profiel zelf.
    if (!aantalElementen || (!aantalDiagrammen && !isKlasseLezer)) continue;
    const p = getProfieltype(profiel);
    if (!p?.useStore) {
      meldingen.push(`${naam}: profiel "${profiel}" is niet geregistreerd — overgeslagen.`);
      continue;
    }
    const plan = vergelijkMetStore(model, p.useStore.getState(), { pakketIds });
    stappen.push({ profiel, naam, model, p, plan });
  }

  // ── Stap 2: review — per regel aan of uit (de merge op GUID), als boom:
  // profiel → EA-pakket → diagrammen/elementen (zie reviewBoom.js) ─────────
  const boom = bouwReviewBoom(
    stappen.map(({ naam, model, plan, p }) => ({ naam, model, plan, bestaand: p.useStore.getState() })),
    bron,
    pakketIds
  );
  const totaal = bladSleutels(boom).length;
  let gekozen = null;
  if (totaal) {
    gekozen = await vraagReview({
      titel: "EA-import — wat gaat mee?",
      tekst: `${pakketLabel ? pakketLabel + "\n" : ""}Nieuw en gewijzigd staan aan; "verdwenen" (in EA weg) haal je alleen weg als je het aanvinkt. Ongewijzigd blijft zoals het is.`,
      boom,
      bevestig: "Importeer",
    });
    if (!gekozen) return null; // afgebroken
  }

  // ── Stap 3: toepassen per profiel ──────────────────────────────────────
  for (const { profiel, naam, model, p, plan } of stappen) {
    const aan = new Set();
    for (const k of gekozen || []) if (k.startsWith(`${naam}|`)) aan.add(k.slice(naam.length + 1));
    // Bevat-lijnen (package → lid) volgen hun lid stilzwijgend.
    for (const r of [...plan.elementen.nieuw, ...plan.elementen.gewijzigd]) if (r.elementType === "bevat") aan.add(`el:${r.id}`);
    const st = p.useStore.getState();
    let uitkomst;
    const opslagVoor = new Set(opslagFouten.keys());
    try {
      uitkomst = pasPlanToe(st, model, plan, { aan });
    } catch (e) {
      meldingen.push(`${naam}: import geweigerd — ${e?.message || e}`);
      continue;
    }
    profielen[naam] = {
      elementen: uitkomst.toegevoegd,
      bijgewerkt: uitkomst.bijgewerkt + uitkomst.diagrammenBijgewerkt,
      verwijderd: uitkomst.verwijderd,
      diagrammen: uitkomst.diagrammenToegevoegd,
      ongewijzigd: plan.elementen.ongewijzigd.length + plan.diagrammen.ongewijzigd.length,
    };
    // Bewaren mislukt (localStorage vol)? Het model staat wél in het geheugen.
    for (const [sleutel, fout] of opslagFouten) {
      if (opslagVoor.has(sleutel)) continue;
      meldingen.push(
        `${naam}: bewaren in de browser mislukte (${fout?.name || "fout"}: ${fout?.message || ""}): het model staat in het geheugen en werkt, ` +
          `maar na herladen kan het weg zijn. Bewaar het via projectsync of een export.`
      );
    }
    if (naImport) {
      try {
        // Plaatsing in de projectboom: op de definitieve (bestaande of nieuwe) ids.
        const her = herschrijfOpBestaandeIds(model, plan.idMap);
        naImport(profiel, { elements: her.elements, diagrams: her.diagrams }, ctx);
      } catch (e) {
        meldingen.push(`${naam}: in de projectboom zetten mislukte — ${e?.message || e}`);
      }
    }
    // Wat géén enkele lezer kent, telt in het verslag: diagramsoorten die
    // een lezer bewust aan een andere laat ("diagram Use Case" bij de
    // activity-lezer) en EA-typen die een ándere lezer wél kent, horen daar
    // niet bij.
    telOvergeslagen(overgeslagen, model);
  }
  const regels = Object.entries(profielen).map(([naam, t]) => {
    const delen = [];
    if (t.diagrammen || t.elementen) delen.push(`${t.diagrammen} diagram${t.diagrammen === 1 ? "" : "men"} en ${t.elementen} elementen nieuw`);
    if (t.bijgewerkt) delen.push(`${t.bijgewerkt} bijgewerkt`);
    if (t.verwijderd) delen.push(`${t.verwijderd} verwijderd`);
    if (t.ongewijzigd) delen.push(`${t.ongewijzigd} ongewijzigd`);
    return `  • ${naam}: ${delen.join(", ") || "niets"}`;
  });
  const rest = Object.entries(overgeslagen).filter(([soort]) => !/^connector/.test(soort));
  await toonMelding({
    titel: regels.length ? "EA-pakket geïmporteerd" : "Niets te importeren",
    tekst:
      (pakketLabel ? `${pakketLabel}\n\n` : "") +
      (regels.length
        ? `Verwerkt (Ctrl+Z per profiel maakt het ongedaan):\n${regels.join("\n")}\n\n` +
          (naImport ? "De EA-boom (pakketten, use cases, activities) staat als mappen in het project." : `De diagrammen staan onder "Niet ingedeeld" bij hun profiel.`)
        : "Geen diagrammen of elementen gevonden die een profiel kent.") +
      (rest.length ? `\n\nNiet in een profiel: ${rest.map(([s, n]) => `${s} (${n})`).join(", ")}` : "") +
      (meldingen.length ? `\n\n${meldingen.join("\n")}` : ""),
  });
  return { profielen, overgeslagen };
}

