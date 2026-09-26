/**
 * refMatch.js — een tekstwaarde (uit een externe bron, bv. PDOK: gemeentecode "0344" of land
 * "Nederland") → het id van een referentielijst-item. Puur (refMatch.test.js); het ophalen van
 * de opties doet de aanroeper (Omnium: /api/viz/reflijst/<type>/opties).
 *
 * Volgorde: exact id → code (ook met/zonder voorvoegsel, "0344" = "GM0344") → naam/label
 * (hoofdletterongevoelig). Geen treffer: null (de aanroeper laat het veld dan leeg).
 */
export function matchRefId(tekst, opties = []) {
  const t = String(tekst ?? "").trim();
  if (!t) return null;
  const laag = t.toLowerCase();
  const cijfers = t.replace(/^\D+/, "");
  const zonderNullen = (s) => String(s).replace(/^\D*0*/, "");
  for (const o of opties) if (String(o.id) === t) return o.id;
  for (const o of opties) {
    const code = String(o.velden?.code ?? "");
    if (code && (code.toLowerCase() === laag || (cijfers && zonderNullen(code) === zonderNullen(cijfers)))) return o.id;
  }
  for (const o of opties) {
    const namen = [o.label, o.velden?.naam].filter(Boolean).map((n) => String(n).toLowerCase());
    if (namen.includes(laag)) return o.id;
  }
  return null;
}
