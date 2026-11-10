// @ts-check
/**
 * formulierConditie — een korte, leesbare kop voor een conditie in een FormulierDefinitie
 * (10-11, Mark: "kortere kop is beter"). Gebruikt door het formulier-profiel (de naam van een
 * nieuw `conditioneel`-element) en de formuliereditor (de boom).
 *
 *   {veld: "Gpk.gpkaanvraag_kaarten.eerdereKaart", op: "==", waarde: true} → "als eerdereKaart = ja"
 *
 * Alleen het laatste stuk van het veldpad; "==" → "=", "!=" → "≠", leeg/nietleeg in woorden,
 * true/false → ja/nee.
 */

const OP = { "==": "=", "!=": "≠" };

/** @param {any} waarde */
function waardeTekst(waarde) {
  if (waarde === true || waarde === "true") return "ja";
  if (waarde === false || waarde === "false") return "nee";
  return String(waarde ?? "");
}

/**
 * @param {{veld?: string, op?: string, waarde?: any} | null | undefined} c
 * @returns {string} zonder "als" ervoor; leeg als er geen veld is
 */
export function korteConditie(c) {
  if (!c || typeof c !== "object" || !c.veld) return "";
  const veld = String(c.veld).split(".").pop();
  const op = c.op || "nietleeg";
  if (op === "nietleeg") return `${veld} is ingevuld`;
  if (op === "leeg") return `${veld} is leeg`;
  return `${veld} ${OP[op] || op} ${waardeTekst(c.waarde)}`.trim();
}
