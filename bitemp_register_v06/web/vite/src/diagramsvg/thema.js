/**
 * thema — kleuren van het diagram (niet van de elementen).
 *
 * Afspraak met Imprint (opdracht-omnium-render-api.md, aanvulling 29-09-2026):
 *   - `theme=auto`: elke diagramkleur is `var(--diagram-<token>, <licht>)`. Zet
 *     de pagina niets, dan is het diagram licht ("als een figuur"); koppelt de
 *     pagina de variabelen aan haar eigen tokens, dan volgt het de site.
 *   - `theme=light` / `theme=dark`: vaste waarden, geen variabelen.
 *   - Tekst óp een gekleurd element volgt het thema níet: die kiezen we per
 *     elementkleur op contrast (donker of wit), deterministisch.
 */

export const TOKENS = ["surface", "border", "text", "muted", "accent"];

const LICHT = {
  surface: "#ffffff",
  border: "#64748b",
  text: "#1e293b",
  muted: "#64748b",
  accent: "#7c3aed",
};

const DONKER = {
  surface: "#0f172a",
  border: "#94a3b8",
  text: "#e2e8f0",
  muted: "#94a3b8",
  accent: "#a78bfa",
};

export const THEMAS = ["auto", "light", "dark"];

/** Geef een functie token → kleurwaarde voor het gekozen thema. */
export function maakPalet(theme) {
  if (theme === "light") return (t) => LICHT[t];
  if (theme === "dark") return (t) => DONKER[t];
  return (t) => `var(--diagram-${t}, ${LICHT[t]})`;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Alleen #rgb/#rrggbb uit het model laten we door; anders de fallback. */
export function veiligeKleur(kleur, fallback) {
  return typeof kleur === "string" && HEX.test(kleur.trim()) ? kleur.trim().toLowerCase() : fallback;
}

function luminantie(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const kanaal = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanaal(0) + 0.7152 * kanaal(2) + 0.0722 * kanaal(4);
}

const DONKERE_TEKST = "#0f172a";
const LICHTE_TEKST = "#ffffff";

/** Tekstkleur met het meeste contrast (WCAG) op een #hex-achtergrond. */
export function tekstOp(achtergrond) {
  const l = luminantie(achtergrond);
  const opDonker = (l + 0.05) / (luminantie(DONKERE_TEKST) + 0.05);
  const opWit = 1.05 / (l + 0.05);
  return opDonker >= opWit ? DONKERE_TEKST : LICHTE_TEKST;
}
