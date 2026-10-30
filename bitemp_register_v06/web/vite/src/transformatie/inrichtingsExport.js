// @ts-check
/**
 * inrichtingsExport — de exportstap "Inrichtingsartefacten" zonder Studio:
 * e-dienst + model + referentielijsten → bundel → (optioneel) vergelijking met
 * het inrichting-register → bestanden voor de zip (docs/TRANSFORMATIES.md §11.10).
 *
 * De Studio-kant (studio/activities/inrichtingsExport.js) haalt alleen de
 * invoer op (map → V3, gekozen bestanden, fetch naar het register) en biedt
 * de zip aan. Puur en node-testbaar.
 */
import { maakInrichtingsBundel } from "./inrichtingsBundel.js";
import { leesRegisterStand, vergelijkMetRegister, leesReferentielijst } from "./inrichtingsRegister.js";

const lijstUit = (inhoud) => (Array.isArray(inhoud) ? inhoud : Array.isArray(inhoud?.items) ? inhoud.items : []);

/**
 * Items per referentielijst uit de e-dienst. Volgorde van bronnen: een
 * meegegeven bestand waarvan de naam de lijstnaam bevat (aanvraagtypen.json →
 * Aanvraagtype), dan het register (bron "register: /full/…"), dan de
 * eersteVulling in de e-dienst.
 *
 * @param {any} edienst
 * @param {Array<{naam: string, inhoud: any}>} bestanden
 * @param {((pad: string) => Promise<any>)|null} haalJson
 */
export async function verzamelReferentielijsten(edienst, bestanden = [], haalJson = null) {
  /** @type {Record<string, any[]>} */
  const lijsten = {};
  const diagnostics = [];
  for (const [naam, def] of Object.entries(edienst?.referentielijsten || {})) {
    const bestand = bestanden.find((b) => b.naam.toLowerCase().includes(naam.toLowerCase()));
    if (bestand) {
      lijsten[naam] = lijstUit(bestand.inhoud);
      diagnostics.push(info("INR-REFLIJST", `${naam}: ${lijsten[naam].length} items uit ${bestand.naam}`, naam));
      continue;
    }
    if (haalJson && /^register:/.test(String(def?.bron || ""))) {
      try {
        lijsten[naam] = await leesReferentielijst(haalJson, def.bron);
        diagnostics.push(info("INR-REFLIJST", `${naam}: ${lijsten[naam].length} items uit het register (${def.bron.replace(/^register:\s*/, "")})`, naam));
        continue;
      } catch (e) {
        diagnostics.push(waarschuwing("INR-REFLIJST", `${naam}: niet uit het register te lezen (${e?.message || e})`, naam));
      }
    }
    const eerste = lijstUit(def?.eersteVulling);
    if (eerste.length) {
      lijsten[naam] = eerste;
      diagnostics.push(info("INR-REFLIJST", `${naam}: ${eerste.length} items uit de eersteVulling van de e-dienst`, naam));
    } else {
      diagnostics.push(waarschuwing("INR-REFLIJST", `${naam}: geen items (geen bestand, register of eersteVulling); keuzelijsten blijven leeg`, naam));
    }
  }
  return { lijsten, diagnostics };
}

function info(code, message, sourceId = null) {
  return { severity: "info", code, message, sourceId, path: null };
}
function waarschuwing(code, message, sourceId = null) {
  return { severity: "warning", code, message, sourceId, path: null };
}

/** Markdown-overzicht in de zip: welke artefacten, hun hash en de stand in het register. */
export function bundelOverzicht({ edienst, peiltijdstip, rijen, registerGelezen }) {
  const e = edienst?.edienst || {};
  const regels = [
    `# Inrichtingsartefacten — ${e.naam || "(e-dienst)"} ${e.versienummer || ""}`.trim(),
    "",
    `Omgeving: ${e.omgeving || "—"} · peiltijdstip: ${peiltijdstip || "—"}`,
    "",
    registerGelezen ? "Vergeleken met het inrichting-register (zelfde e-dienstversie, soort en identifier)." : "Niet vergeleken met het register.",
    "",
    "| Bestand | Soort | Identifier | payloadHash | Register |",
    "|---|---|---|---|---|",
    ...rijen.map((r) => `| ${r.fout ? "—" : r.bestandsnaam} | ${r.soort} | ${r.identifier} | ${r.artefact ? r.artefact.artefactInhoud.payloadHash.slice(0, 12) + "…" : "—"} | ${r.fout ? `fout: ${r.fout}` : r.status || "—"} |`),
    "",
    "Registreren: het script van FUNDAMENT (omnium-registreer-artefact.ps1, per bestand of met -Map).",
    "",
  ];
  return regels.join("\n");
}

/**
 * @param {Object} invoer
 * @param {any} invoer.edienst
 * @param {any} invoer.modelBestand
 * @param {any[]} invoer.datatypen
 * @param {Array<{naam: string, inhoud: any}>} [invoer.referentieBestanden]
 * @param {string|null} [invoer.peiltijdstip]
 * @param {((pad: string) => Promise<any>)|null} [invoer.haalJson] - lezen uit het register; null = niet vergelijken
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 */
export async function voerInrichtingsExportUit({ edienst, modelBestand, datatypen, referentieBestanden = [], peiltijdstip = null, haalJson = null, sha256Hex }) {
  if (!Array.isArray(edienst?.artefacten) || !edienst.artefacten.length) throw new Error("Het e-dienstmodel heeft geen artefacten.");
  const { lijsten, diagnostics } = await verzamelReferentielijsten(edienst, referentieBestanden, haalJson);
  const bundel = await maakInrichtingsBundel({ modelBestand, edienst, datatypen, referentielijsten: lijsten, peiltijdstip, sha256Hex });

  let rijen = bundel.map((b) => ({ ...b, status: b.fout ? "fout" : null, register: null }));
  let registerGelezen = false;
  if (haalJson) {
    try {
      const stand = await leesRegisterStand(haalJson);
      rijen = vergelijkMetRegister(bundel, stand, edienst.edienst);
      registerGelezen = true;
    } catch (e) {
      diagnostics.push(waarschuwing("INR-REGISTER", `Register niet gelezen, geen vergelijking: ${e?.message || e}`));
    }
  }

  for (const r of rijen) {
    for (const d of r.diagnostics || []) diagnostics.push({ ...d, sourceId: d.sourceId || `${r.soort} ${r.identifier}` });
    if (r.fout) diagnostics.push({ severity: "error", code: "INR-ARTEFACT", message: r.fout, sourceId: `${r.soort} ${r.identifier}`, path: null });
  }

  const gelukt = rijen.filter((r) => r.artefact);
  const bestanden = [
    ...gelukt.map((r) => ({ naam: r.bestandsnaam, inhoud: `${JSON.stringify(r.artefact, null, 2)}\n` })),
    { naam: "OVERZICHT.md", inhoud: bundelOverzicht({ edienst, peiltijdstip, rijen, registerGelezen }) },
  ];
  const telling = (s) => rijen.filter((r) => r.status === s).length;
  const fouten = rijen.length - gelukt.length;
  const summary =
    `${gelukt.length} van ${rijen.length} artefacten gemaakt` +
    (registerGelezen ? ` — register: ${telling("nieuw")} nieuw, ${telling("gewijzigd")} gewijzigd, ${telling("ongewijzigd")} ongewijzigd` : "") +
    (fouten ? `, ${fouten} mislukt` : "") +
    ".";
  return { rijen, bestanden, diagnostics, summary, registerGelezen };
}
