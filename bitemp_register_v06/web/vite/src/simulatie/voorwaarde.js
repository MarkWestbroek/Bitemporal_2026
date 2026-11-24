/**
 * Voorwaarden in de verwachting van een scenario (ontwerp simulatie §12.5 punt 6, naar de run state
 * van EA: variabele, operator, waarde).
 *
 * Een verwachte waarde is óf een gewone waarde (dan moet de gevonden waarde precies gelijk zijn),
 * óf een **voorwaarde**: een object waarvan de sleutels operatoren zijn. Meer operatoren in één
 * voorwaarde gelden samen (en):
 *
 *   { "leges": 50 }                        gelijk (zoals altijd)
 *   { "leges": { ">": 100 } }              groter dan
 *   { "leges": { ">=": 50, "<=": 150 } }   tussen 50 en 150
 *   { "status": { "≠": "afgewezen" } }     ongelijk (ook "!=")
 *   { "status": { "in": ["a", "b"] } }     één van (ook "niet in")
 *   { "kenmerk": { "gevuld": true } }      heeft een waarde (false: is leeg)
 *   { "naam": { "bevat": "Jan" } }         tekst bevat, of lijst bevat
 *
 * Een object met andere sleutels is een gewone (samengestelde) waarde en wordt op gelijkheid getoetst.
 * Getallen vergelijken als getal, ook als een kant tekst is ("120" > 100); de rest als tekst, zodat
 * ISO-datums goed op volgorde staan.
 */

/** De operatoren met hun weergave (≤ en ≥ als teken, ≠ voor !=). */
export const OPERATOREN = {
  "=": "=",
  "≠": "≠",
  "!=": "≠",
  "<": "<",
  "<=": "≤",
  "≤": "≤",
  ">": ">",
  ">=": "≥",
  "≥": "≥",
  in: "in",
  "niet in": "niet in",
  gevuld: "gevuld",
  bevat: "bevat",
};

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Is deze verwachte waarde een voorwaarde (een object met alleen operatoren als sleutel)? */
export function isVoorwaarde(v) {
  return isObject(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k in OPERATOREN);
}

const tekst = (v) => (typeof v === "string" ? v : JSON.stringify(v));

/** Een voorwaarde (of gewone waarde) als leesbare tekst: `> 100`, `≥ 50 en ≤ 150`, `= "Jan"`. */
export function toonVoorwaarde(v) {
  if (!isVoorwaarde(v)) return `= ${tekst(v)}`;
  return Object.entries(v)
    .map(([op, w]) => {
      const teken = OPERATOREN[op];
      if (teken === "gevuld") return w === false ? "is leeg" : "is gevuld";
      if (teken === "in" || teken === "niet in") return `${teken} ${(Array.isArray(w) ? w : [w]).map(tekst).join(", ")}`;
      return `${teken} ${tekst(w)}`;
    })
    .join(" en ");
}

const leeg = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (getal(a) !== null && getal(a) === getal(b));
function getal(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}
/** -1, 0 of 1; null als de twee niet te vergelijken zijn (een kant ontbreekt of is een object). */
function vergelijk(a, b) {
  if (leeg(a) || leeg(b) || typeof a === "object" || typeof b === "object") return null;
  const x = getal(a);
  const y = getal(b);
  if (x !== null && y !== null) return Math.sign(x - y);
  const s = String(a);
  const t = String(b);
  return s < t ? -1 : s > t ? 1 : 0;
}

/**
 * Voldoet de gevonden waarde aan de verwachte waarde of voorwaarde?
 * @param {any} gevonden - undefined = niet gevonden
 * @param {any} verwacht
 * @returns {boolean}
 */
export function voldoet(gevonden, verwacht) {
  if (!isVoorwaarde(verwacht)) return gevonden !== undefined && JSON.stringify(gevonden) === JSON.stringify(verwacht);
  return Object.entries(verwacht).every(([op, w]) => {
    const teken = OPERATOREN[op];
    if (teken === "gevuld") return w === false ? leeg(gevonden) : !leeg(gevonden);
    if (teken === "=") return gevonden !== undefined && gelijk(gevonden, w);
    if (teken === "≠") return !gelijk(gevonden, w);
    if (teken === "in") return (Array.isArray(w) ? w : [w]).some((x) => gevonden !== undefined && gelijk(gevonden, x));
    if (teken === "niet in") return !(Array.isArray(w) ? w : [w]).some((x) => gelijk(gevonden, x));
    if (teken === "bevat") {
      if (Array.isArray(gevonden)) return gevonden.some((x) => gelijk(x, w));
      return typeof gevonden === "string" && gevonden.includes(String(w));
    }
    const c = vergelijk(gevonden, w);
    if (c === null) return false;
    return teken === "<" ? c < 0 : teken === "≤" ? c <= 0 : teken === ">" ? c > 0 : c >= 0;
  });
}
