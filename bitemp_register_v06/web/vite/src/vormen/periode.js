/**
 * periode.js — de rekenkant van de vorm `period` (begin + einde als balk op een tijdlijn). Puur.
 */
const DAG = 86400000;
const MAX_STREPEN = 8;
const naarDatum = (s) => { if (!s) return null; const d = new Date(`${String(s).slice(0, 10)}T00:00:00Z`); return Number.isNaN(d.getTime()) ? null : d; };

/**
 * Posities (0..1) van begin, einde en vandaag op een as met wat marge, plus de jaren als
 * maatstreepjes. Zonder einde loopt de balk "open" door tot de rand.
 */
export function periodeAs(begin, einde, vandaag = new Date()) {
  const b = naarDatum(begin), e = naarDatum(einde);
  const v = new Date(Date.UTC(vandaag.getUTCFullYear(), vandaag.getUTCMonth(), vandaag.getUTCDate()));
  const punten = [b, e, v].filter(Boolean).map((d) => d.getTime());
  if (!b && !e) return null;
  let lo = Math.min(...punten), hi = Math.max(...punten);
  const marge = Math.max(30 * DAG, (hi - lo) * 0.12);
  lo -= marge; hi += marge;
  const pos = (d) => (d ? (d.getTime() - lo) / (hi - lo) : null);
  // Maatstreepjes per jaar; over een lange periode (een levensloop) alleen elke 2, 5, 10, …
  // jaar, zodat er hooguit MAX_STREPEN zijn en de jaartallen niet over elkaar vallen.
  const van = new Date(lo).getUTCFullYear() + 1, tot = new Date(hi).getUTCFullYear();
  const stap = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => (tot - van + 1) / s <= MAX_STREPEN) || 100;
  const jaren = [];
  for (let j = Math.ceil(van / stap) * stap; j <= tot; j += stap) {
    jaren.push({ jaar: j, pos: (Date.UTC(j, 0, 1) - lo) / (hi - lo) });
  }
  return { begin: pos(b), einde: pos(e), vandaag: pos(v), open: Boolean(b && !e), omgekeerd: Boolean(b && e && e < b), jaren };
}

/** Duur in hele dagen/maanden, voor de tekst onder de balk ("≈ 7 maanden"). */
export function duurTekst(begin, einde) {
  const b = naarDatum(begin), e = naarDatum(einde);
  if (!b || !e || e < b) return "";
  const dagen = Math.round((e - b) / DAG);
  if (dagen < 45) return `${dagen} dag${dagen === 1 ? "" : "en"}`;
  const maanden = Math.round(dagen / 30.44);
  if (maanden < 24) return `≈ ${maanden} maanden`;
  return `≈ ${(dagen / 365.25).toFixed(1).replace(".", ",")} jaar`;
}

export function datumNL(s) {
  const d = naarDatum(s);
  return d ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
}
