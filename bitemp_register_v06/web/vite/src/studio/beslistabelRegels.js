// @ts-check
/**
 * beslistabelRegels — pure regels rond de beslistabel van een DMN-beslissing in het project
 * (profiel dmn-drd, `data.beslistabel`; vorm van dmn/dmnModel.js). Los van React, zodat ze
 * onder node te testen zijn; de dialoog staat in BeslistabelEditor.jsx.
 */
import { nieuweBeslistabel } from "../dmn/dmnModel.js";

/**
 * De tabel zoals de editor hem nodig heeft. Een opgeslagen tabel (import, modeltools) hoeft
 * niet volledig te zijn: ontbrekende delen worden aangevuld, de rest blijft staan (ook
 * eigenschappen die de editor niet kent, zoals `expressie` op een kolom). Zonder tabel: een
 * lege, met één invoer, één uitvoer en één regel.
 * @param {any} opgeslagen
 * @param {string} [naam] - naam van de beslissing; die is leidend
 */
export function tabelVoorBewerken(opgeslagen, naam = "") {
  if (!opgeslagen || typeof opgeslagen !== "object") return nieuweBeslistabel(naam || "Nieuwe beslissing");
  const inputs = Array.isArray(opgeslagen.inputs) ? opgeslagen.inputs : [];
  const outputs = Array.isArray(opgeslagen.outputs) ? opgeslagen.outputs : [];
  const rules = (Array.isArray(opgeslagen.rules) ? opgeslagen.rules : []).map((r) => ({
    ...r,
    inputEntries: r.inputEntries || {},
    outputEntries: r.outputEntries || {},
  }));
  return { hitPolicy: "UNIQUE", ...opgeslagen, naam: naam || opgeslagen.naam || "", inputs, outputs, rules };
}

/** Korte tekst voor de inspector, bv. "2 in · 1 uit · 5 regels". */
export function tabelSamenvatting(tabel) {
  if (!tabel || typeof tabel !== "object") return "geen beslistabel";
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  const regels = n(tabel.rules);
  return `${n(tabel.inputs)} in · ${n(tabel.outputs)} uit · ${regels} ${regels === 1 ? "regel" : "regels"}`;
}
