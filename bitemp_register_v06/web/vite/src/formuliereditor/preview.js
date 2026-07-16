/**
 * preview — bouwt de `velden`-array die CustomFormulierRenderer nodig heeft,
 * uit de per-pad `veldInfo` in de editor-store.
 *
 * In de echte inhoud-editor komen velddefinities uit de GE's van een concrete
 * entiteit. In de editor-preview hebben we geen record; we synthetiseren de
 * velddefinities uit de FieldRefs die bij het slepen zijn onthouden. De
 * `naam` van elk preview-veld is het volle **pad**, zodat de renderer (die op
 * `veld.naam` matcht) het element terugvindt.
 */
import { kinderSleutel } from "./layoutModel";

export function bouwPreviewVelden(veldInfo) {
  return Object.entries(veldInfo || {}).map(([pad, info]) => ({
    naam: pad,
    type: info.type || "string",
    format: info.format || "",
    enum: Array.isArray(info.enum) ? info.enum : [],
    datatype: info.datatype || "",
    ref: info.ref || "",
    verplicht: false,
  }));
}

/**
 * previewLayout — kloon van de layout waarin elk veld zónder eigen `label` een
 * standaardlabel = de **korte veldnaam** krijgt (i.p.v. het volle pad dat het
 * preview-veld als `naam` draagt). Zo toont de preview "git_repo" i.p.v.
 * "Initiatief.producten.git_repo", terwijl de opgeslagen definitie geen
 * overbodig label bevat (leeg = veldnaam blijft gelden, model is de bron).
 */
export function previewLayout(root, veldInfo) {
  return mapEl(root, veldInfo || {}, null);
}

function mapEl(el, veldInfo, padContext) {
  const kopie = { ...el };
  if (el.type === "veld" && !el.label) {
    // Binnen een lijst is el.veld relatief; het volle pad = padContext + veld.
    const volPad = padContext ? `${padContext}.${el.veld}` : el.veld;
    const kort = veldInfo[volPad]?.veldnaam || veldInfo[el.veld]?.veldnaam;
    if (kort) kopie.label = kort;
  }
  const sleutel = kinderSleutel(el);
  if (sleutel && Array.isArray(el[sleutel])) {
    // Een lijst zet de pad-context voor zijn kinderen.
    const kindContext = el.type === "lijst" ? el.bron : padContext;
    kopie[sleutel] = el[sleutel].map((k) => mapEl(k, veldInfo, kindContext));
  }
  return kopie;
}
