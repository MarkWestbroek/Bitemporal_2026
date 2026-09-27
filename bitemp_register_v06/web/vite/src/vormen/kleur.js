/** kleur.js — de rekenkant van de vorm `color` (datatype Kleur). Puur. */
export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** "#abc" → "#aabbcc", "#11223344" → "#112233"; ongeldig → null. */
export function naarNativeKleur(w) {
  const s = String(w ?? "").trim();
  if (!HEX.test(s)) return null;
  if (s.length === 4) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return s.slice(0, 7).toLowerCase();
}
