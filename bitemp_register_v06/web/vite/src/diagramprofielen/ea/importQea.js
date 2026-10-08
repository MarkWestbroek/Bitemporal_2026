// @ts-check
/**
 * importQea — de Studio-kant van de EA-lezer: bestand → pakketkeuze → model.
 * Gebruikt door `koppeling.importBestand` van het puur-uml-profiel
 * (puurUmlActivity.jsx). Leest alleen; het bestand verlaat de browser niet.
 */
import { openQea, leesPakketten, leesBron } from "./qeaLezer.js";
import { qeaNaarPuurUml } from "./qeaNaarPuurUml.js";
import { pakketPad } from "./qeaHulp.js";
import { vraagKeuze, toonMelding } from "../../studio/naamDialog.jsx";

/**
 * @param {ArrayBuffer} bytes
 * @param {string} [bestandsnaam]
 * @returns {Promise<{diagramTypeId:string, elements:Record<string,any>, diagrams:Record<string,any>}|null>}
 */
export async function importeerQeaAlsPuurUml(bytes, bestandsnaam = "") {
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
    });
    if (!keuze) return null;
    const packageId = Number(keuze);
    const bron = leesBron(db, packageId);
    const model = qeaNaarPuurUml(bron, { packageId });
    const v = model.verslag;
    const overgeslagen = Object.entries(v.overgeslagen);
    if (overgeslagen.length) {
      await toonMelding({
        titel: "Import met weglatingen",
        tekst:
          `${v.elementen} elementen, ${v.connectoren} connectoren, ${v.diagrammen} diagrammen gelezen.\n` +
          `Niet in puur-uml, overgeslagen:\n` +
          overgeslagen.map(([soort, n]) => `  • ${soort}: ${n}`).join("\n"),
      });
    }
    return { diagramTypeId: model.diagramTypeId, elements: model.elements, diagrams: model.diagrams };
  } finally {
    db.close();
  }
}
