// @ts-check
/**
 * naarOdrl — Cedar-model → ODRL (ODRL-AP-NL), via Toegangsspraak (fase 3 van "2026-11-25 Cedar als
 * M2"; TRANSFORMATIES.md §8.3).
 *
 * Geen eigen afbeelding: de keten is Cedar → Toegangsspraak (naarToegangsspraak.js, fase 2) en dan
 * de bestaande export Toegangsspraak → ODRL-AP-NL (toegangsspraak/odrlExport.js, §8). Wat de
 * Toegangsspraak niet kon zeggen staat al in de meldingen van de eerste stap; de trace van de
 * tweede stap moet leeg zijn (niets verloren).
 *
 * De handelingen uit de actielijst zijn voor ODRL eigen woorden (`ts:<woord>`, een odrl:Action die
 * in odrl:use valt); de rol wordt `apnl:rolAanvrager` in een verfijning op de handeling, een
 * kenmerk van de gegevens een voorwaarde op de regel.
 */
import { toegangsspraakNaarOdrl } from "../../toegangsspraak/odrlExport.js";
import { cedarNaarToegangsspraak } from "./naarToegangsspraak.js";

/** @typedef {{niveau: "fout"|"waarschuwing"|"info", bericht: string, elementId?: string}} Melding */

const NIVEAU = { error: "fout", warning: "waarschuwing", info: "info" };

/**
 * @param {{elements?: Record<string, any>}} staat
 * @param {{naam?: string, modelNaam?: string}} [opties]
 * @returns {{turtle: string, jsonld: any, toegangsspraak: string, meldingen: Melding[], verloren: any[], ok: boolean}}
 */
export function cedarNaarOdrl(staat, { naam = "Cedar", modelNaam } = {}) {
  const ts = cedarNaarToegangsspraak(staat, { naam });
  /** @type {Melding[]} */
  const meldingen = [...ts.meldingen];
  if (!ts.beleid.regels.length) {
    meldingen.push({ niveau: "fout", bericht: "Geen enkele policy is in Toegangsspraak te zeggen; er is geen ODRL gemaakt." });
    return { turtle: "", jsonld: null, toegangsspraak: ts.tekst, meldingen, verloren: [], ok: false };
  }
  const odrl = toegangsspraakNaarOdrl(ts.tekst, { modelNaam: modelNaam || naam });
  for (const d of odrl.diagnostics || []) meldingen.push({ niveau: NIVEAU[d.severity] || "info", bericht: `ODRL: ${d.message}` });
  const verloren = (odrl.trace || []).filter((t) => t.actie === "geen-regel" || t.actie === "overgeslagen");
  if (verloren.length) meldingen.push({ niveau: "waarschuwing", bericht: `ODRL: ${verloren.length} onderdeel/onderdelen van de Toegangsspraak niet in de ODRL.` });
  return { turtle: odrl.turtle, jsonld: odrl.jsonld, toegangsspraak: ts.tekst, meldingen, verloren, ok: Boolean(odrl.ok) && !verloren.length };
}
