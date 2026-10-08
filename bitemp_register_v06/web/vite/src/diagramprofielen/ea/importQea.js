// @ts-check
/**
 * importQea — de Studio-kant van de EA-lezer: bestand → pakketkeuze → model.
 * Gebruikt door `koppeling.importBestand` van het puur-uml-profiel
 * (puurUmlActivity.jsx). Leest alleen; het bestand verlaat de browser niet.
 */
import { openQea, leesPakketten, leesBron } from "./qeaLezer.js";
import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { qeaNaarActivity } from "./qeaNaarActivity.js";
import { qeaNaarUsecase } from "./qeaNaarUsecase.js";
import { pakketPad } from "./qeaHulp.js";
import { vraagKeuze, toonMelding } from "../../studio/naamDialog.jsx";

/**
 * @param {ArrayBuffer} bytes
 * @param {string} [bestandsnaam]
 * @returns {Promise<{diagramTypeId:string, elements:Record<string,any>, diagrams:Record<string,any>}|null>}
 */
export function importeerQeaAlsPuurUml(bytes, bestandsnaam = "") {
  return importeerQea(bytes, bestandsnaam, qeaNaarPuurUml, "puur-uml");
}

/** Zelfde, maar alleen de activiteitendiagrammen → activity-profiel. */
export function importeerQeaAlsActivity(bytes, bestandsnaam = "") {
  return importeerQea(bytes, bestandsnaam, qeaNaarActivity, "activity");
}

/** Zelfde, maar alleen de use case-diagrammen → use case-profiel. */
export function importeerQeaAlsUsecase(bytes, bestandsnaam = "") {
  return importeerQea(bytes, bestandsnaam, qeaNaarUsecase, "use case");
}

/**
 * @param {ArrayBuffer} bytes
 * @param {string} bestandsnaam
 * @param {(bron: any, opties: {packageId: number}) => {diagramTypeId: string, elements: any, diagrams: any, verslag: any}} vertaal
 * @param {string} profielLabel
 */
async function importeerQea(bytes, bestandsnaam, vertaal, profielLabel) {
  const db = await openQea(bytes);
  try {
    const pakketten = leesPakketten(db);
    // Keuzelijst: pad per pakket, wortel(s) eerst; diep genest leest als "a / b / c".
    const opties = pakketten
      .map((p) => ({ waarde: String(p.Package_ID), label: pakketPad(pakketten, p.Package_ID) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const keuze = await vraagKeuze({
      titel: `EA-pakket importeren${bestandsnaam ? ` — ${bestandsnaam}` : ""}`,
      label: `Pakket (met deelpakketten) — ${pakketten.length} pakketten in het bestand`,
      opties,
      bevestig: "Importeer",
      zoekbaar: true,
    });
    if (!keuze) return null;
    const packageId = Number(keuze);
    const bron = leesBron(db, packageId);
    const model = vertaal(bron, { packageId });
    const v = model.verslag;
    const overgeslagen = Object.entries(v.overgeslagen);
    if (overgeslagen.length) {
      await toonMelding({
        titel: "Import met weglatingen",
        tekst:
          `${v.elementen} elementen, ${v.connectoren} connectoren, ${v.diagrammen} diagrammen gelezen.\n` +
          `Niet in ${profielLabel}, overgeslagen:\n` +
          overgeslagen.map(([soort, n]) => `  • ${soort}: ${n}`).join("\n"),
      });
    }
    return { diagramTypeId: model.diagramTypeId, elements: model.elements, diagrams: model.diagrams };
  } finally {
    db.close();
  }
}
