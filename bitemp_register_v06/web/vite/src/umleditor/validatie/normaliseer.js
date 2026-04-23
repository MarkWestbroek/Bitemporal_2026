/**
 * normaliseer.js — Normalisatiefuncties voor gegevenstypen.
 *
 * Dit is een **framework-onafhankelijke** module: puur JavaScript, geen React.
 * Bedoeld voor hergebruik in zowel de metamodel-editor als de bitemporele
 * data-view-en-edit frontend, en als referentie voor de Go-backend.
 *
 * Normalisatie wordt toegepast:
 *   - Frontend: bij on-blur van het invoerveld (vóór validatie)
 *   - Backend:  bij opslag (vóórdat de waarde de database ingaat)
 *
 * Elke normalisatiefunctie accepteert een string en retourneert een string.
 * Meerdere normalisaties worden achter elkaar uitgevoerd in de opgegeven volgorde.
 *
 * @module validatie/normaliseer
 */

// === Individuele normalisatiefuncties ===

const NORMALISATIE_FNS = {
  /** Verwijder witruimte aan begin en eind */
  trim: (val) => val.trim(),

  /** Alle tekens naar kleine letters */
  lowercase: (val) => val.toLowerCase(),

  /** Alleen de letters naar hoofdletters (cijfers, spaties, etc. blijven) */
  uppercase_letters: (val) => val.replace(/[a-z]/g, (ch) => ch.toUpperCase()),

  /** Alle tekens naar hoofdletters */
  uppercase: (val) => val.toUpperCase(),

  /** Verwijder alle spaties */
  strip_spaces: (val) => val.replace(/\s/g, ""),

  /** Verwijder alle streepjes */
  strip_dashes: (val) => val.replace(/-/g, ""),
};

/**
 * Pas de normalisatie-string toe op een waarde.
 *
 * De normalisatie-string is komma-gescheiden, bijv. "trim,uppercase_letters".
 * Onbekende normalisatienamen worden genegeerd (met een console.warn).
 *
 * @param {string} waarde    - De ruwe invoerwaarde
 * @param {string} normSpec  - Komma-gescheiden normalisatienamen, bijv. "trim,uppercase_letters"
 * @returns {string} De genormaliseerde waarde
 *
 * @example
 *   normaliseer("  1234 ab  ", "trim,uppercase_letters")
 *   // → "1234 AB"
 */
export function normaliseer(waarde, normSpec) {
  if (!normSpec || typeof waarde !== "string") return waarde;

  const stappen = normSpec.split(",").map((s) => s.trim()).filter(Boolean);

  return stappen.reduce((val, stap) => {
    const fn = NORMALISATIE_FNS[stap];
    if (!fn) {
      console.warn(`[normaliseer] Onbekende normalisatie: "${stap}"`);
      return val;
    }
    return fn(val);
  }, waarde);
}

/**
 * Geeft de lijst van beschikbare normalisatienamen terug.
 * Handig voor de editor-UI (dropdown / checkboxes).
 *
 * @returns {string[]}
 */
export function beschikbareNormalisaties() {
  return Object.keys(NORMALISATIE_FNS);
}
