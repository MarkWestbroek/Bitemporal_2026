/**
 * duur.js — de rekenkant van de vorm `duration`: een tijdsduur in ISO 8601 (datatype Duur,
 * bv. "P1Y2M", "PT30M", "P1DT2H", "P2W"). Puur.
 *
 * Eenheden (sleutels in vormConfig.units, en in de ontlede waarde):
 *   jaren (Y), maanden (M), weken (W), dagen (D) — vóór de T
 *   uren (H), minuten (M), seconden (S)          — na de T
 */

export const EENHEDEN = [
  { sleutel: "jaren", teken: "Y", tijd: false, enkel: "jaar", meer: "jaar" },
  { sleutel: "maanden", teken: "M", tijd: false, enkel: "maand", meer: "maanden" },
  { sleutel: "weken", teken: "W", tijd: false, enkel: "week", meer: "weken" },
  { sleutel: "dagen", teken: "D", tijd: false, enkel: "dag", meer: "dagen" },
  { sleutel: "uren", teken: "H", tijd: true, enkel: "uur", meer: "uur" },
  { sleutel: "minuten", teken: "M", tijd: true, enkel: "minuut", meer: "minuten" },
  { sleutel: "seconden", teken: "S", tijd: true, enkel: "seconde", meer: "seconden" },
];

const PATROON = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** "P1Y2MT30M" → { jaren: 1, maanden: 2, minuten: 30 } (alleen de aanwezige delen); ongeldig → null. */
export function leesDuur(waarde) {
  const s = String(waarde ?? "").trim().toUpperCase();
  if (!s) return {};
  const m = PATROON.exec(s);
  if (!m || s === "P" || s.endsWith("T")) return null;
  const uit = {};
  EENHEDEN.forEach((e, i) => {
    if (m[i + 1] != null) uit[e.sleutel] = Number(m[i + 1]);
  });
  return uit;
}

/** { jaren: 1, minuten: 30 } → "P1YT30M"; alles leeg of 0 → "". */
export function schrijfDuur(delen = {}) {
  const waarde = (e) => {
    const n = Number(delen[e.sleutel]);
    return Number.isFinite(n) && n > 0 ? `${n}${e.teken}` : "";
  };
  const datum = EENHEDEN.filter((e) => !e.tijd).map(waarde).join("");
  const tijd = EENHEDEN.filter((e) => e.tijd).map(waarde).join("");
  if (!datum && !tijd) return "";
  return `P${datum}${tijd ? `T${tijd}` : ""}`;
}

/** Leesbaar: "1 jaar, 2 maanden en 30 minuten"; "" bij leeg; de ruwe waarde bij ongeldig. */
export function duurTekstNL(waarde) {
  const d = leesDuur(waarde);
  if (d === null) return String(waarde);
  const delen = EENHEDEN.filter((e) => d[e.sleutel] > 0).map((e) => `${d[e.sleutel]} ${d[e.sleutel] === 1 ? e.enkel : e.meer}`);
  if (delen.length <= 1) return delen[0] || "";
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}
