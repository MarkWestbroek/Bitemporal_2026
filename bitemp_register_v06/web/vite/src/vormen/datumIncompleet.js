/**
 * datumIncompleet.js — de rekenkant van de vorm `partial-date`: een gedeeltelijk bekende
 * datum (datatype DatumIncompleet, MIM / BRP-GBA). Puur.
 *
 * Opslag volgens het datatype: "1975", "1975-06", "1975-06-15", of met nullen voor
 * onbekend: "1975-06-00", "1975-00-00". Een dag zonder maand bestaat niet.
 */

export const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** "1975-06-00" → { jaar: "1975", maand: "06", dag: "" } ("" = onbekend). */
export function leesDatumIncompleet(waarde) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(waarde ?? "").trim());
  if (!m) return { jaar: "", maand: "", dag: "" };
  const deel = (x) => (x && x !== "00" ? x : "");
  const maand = deel(m[2]);
  return { jaar: m[1], maand, dag: maand ? deel(m[3]) : "" };
}

/** Dagen in een maand (voor de dagkeuze); zonder jaar telt februari 29. */
export function dagenInMaand(jaar, maand) {
  if (!maand) return 31;
  const j = Number(jaar) || 2000;
  return new Date(Date.UTC(j, Number(maand), 0)).getUTCDate();
}

/**
 * { jaar, maand, dag } → opslag. `stijl` "kort" laat onbekende delen weg ("1975-06"),
 * "nullen" schrijft ze als 00 ("1975-06-00"). Geen (geldig) jaar = "".
 */
export function schrijfDatumIncompleet({ jaar, maand, dag } = {}, stijl = "kort") {
  if (!/^\d{4}$/.test(String(jaar ?? ""))) return "";
  const mm = maand ? String(maand).padStart(2, "0") : "";
  const dd = mm && dag ? String(Math.min(Number(dag), dagenInMaand(jaar, mm))).padStart(2, "0") : "";
  if (stijl === "nullen") return `${jaar}-${mm || "00"}-${dd || "00"}`;
  return [jaar, mm, dd].filter(Boolean).join("-");
}

/** Leesbaar: "15 juni 1975", "juni 1975", "1975", "" (onbekend). */
export function datumIncompleetTekst(waarde) {
  const { jaar, maand, dag } = leesDatumIncompleet(waarde);
  if (!jaar) return "";
  if (!maand) return jaar;
  const naam = MAANDEN[Number(maand) - 1];
  return dag ? `${Number(dag)} ${naam} ${jaar}` : `${naam} ${jaar}`;
}
