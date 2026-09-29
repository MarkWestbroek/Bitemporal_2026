/**
 * svg — kleine, pure helpers om SVG als tekst op te bouwen.
 *
 * Alles is deterministisch: attributen in vaste volgorde, getallen afgerond op
 * één decimaal, geen tijdstempels of willekeurige id's.
 */

/** XML-escape voor tekstinhoud én attribuutwaarden. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Getal → korte, stabiele tekst (één decimaal, geen "-0"). */
export function num(v) {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
}

/**
 * Eén element. `attrs` wordt in invoegvolgorde geschreven; null/undefined/false
 * worden overgeslagen, getallen via num(). `inhoud` is al-geëscapete markup
 * (string of array); leeg → zelfsluitend.
 */
export function el(tag, attrs = {}, inhoud) {
  let s = `<${tag}`;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    s += ` ${k}="${typeof v === "number" ? num(v) : esc(v)}"`;
  }
  const kind = Array.isArray(inhoud) ? inhoud.join("") : inhoud;
  return kind === undefined || kind === "" ? `${s}/>` : `${s}>${kind}</${tag}>`;
}

/** Tekst-element; `tekst` wordt geëscapet. */
export function tekst(attrs, inhoud) {
  return el("text", attrs, esc(inhoud));
}

/** Maak van een willekeurige naam een veilig id-fragment. */
export function idDeel(naam) {
  return String(naam ?? "").replace(/[^A-Za-z0-9_.-]/g, "-") || "x";
}

/** FNV-1a (32 bit) als 8 hex-tekens; voor een stabiele standaard-idPrefix. */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
