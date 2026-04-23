/**
 * valideer.js — Hoofdmodule voor gegevenstype-validatie.
 *
 * Framework-onafhankelijk: puur JavaScript, geen React-dependencies.
 * Dit is de **publieke API** van de validatiebibliotheek.
 *
 * Herbruikbaar in:
 *   - De metamodel-editor (test-invoer paneel)
 *   - De bitemporele data-view-en-edit frontend (invoerformulieren)
 *   - Unit tests
 *
 * Gebruik:
 *   import { valideer } from "./validatie/valideer";
 *
 *   const datatype = { basistype: "string", format: "nl-postcode", validatie: {...}, normalisatie: "..." };
 *   const resultaat = valideer("1234 AB", datatype);
 *   // → { geldig: true, genormaliseerd: "1234 AB", fouten: [] }
 *
 * De validatie doorloopt de volgende stappen (in volgorde):
 *   1. **Normalisatie** — pas trim, uppercase, strip etc. toe
 *   2. **Type-check** — komt het basistype overeen? (string/integer/number/boolean)
 *   3. **Lengte / bereik** — minLength, maxLength, minimum, maximum, multipleOf
 *   4. **Pattern** — regex-match
 *   5. **Regels** — checksum, formula, function
 *
 * @module validatie/valideer
 */

import { normaliseer } from "./normaliseer.js";
import { voerRegelUit } from "./regels.js";

/**
 * @typedef {Object} ValidatieResultaat
 * @property {boolean}  geldig         - Of de waarde geldig is
 * @property {string}   genormaliseerd - De waarde na normalisatie
 * @property {string[]} fouten         - Lijst van foutmeldingen (leeg als geldig)
 */

/**
 * Valideer een waarde tegen een gegevenstype-definitie.
 *
 * @param {*}      waarde   - De ruwe invoerwaarde
 * @param {Object} datatype - Het gegevenstype-object (conform gegevenstypen.md)
 * @param {Object} [opties] - Extra opties
 * @param {boolean} [opties.verplicht=false] - Of het veld verplicht is (lege waarde = fout)
 * @returns {ValidatieResultaat}
 *
 * @example
 *   const dt = {
 *     basistype: "string",
 *     format: "nl-postcode",
 *     validatie: { pattern: "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$", minLength: 6, maxLength: 7 },
 *     normalisatie: "trim,uppercase_letters"
 *   };
 *   valideer("  1234 ab  ", dt);
 *   // → { geldig: true, genormaliseerd: "1234 AB", fouten: [] }
 *
 *   valideer("0000 XX", dt);
 *   // → { geldig: false, genormaliseerd: "0000 XX", fouten: ["Voldoet niet aan het patroon"] }
 */
export function valideer(waarde, datatype, opties = {}) {
  const fouten = [];
  const validatie = datatype.validatie || {};
  const verplicht = opties.verplicht || false;

  // --- Stap 0: lege waarde check ---
  const isLeeg = waarde === null || waarde === undefined || String(waarde).trim() === "";

  if (isLeeg) {
    if (verplicht) {
      return { geldig: false, genormaliseerd: "", fouten: ["Dit veld is verplicht"] };
    }
    return { geldig: true, genormaliseerd: "", fouten: [] };
  }

  // --- Stap 1: Normalisatie ---
  let genormaliseerd = String(waarde);
  if (datatype.normalisatie) {
    genormaliseerd = normaliseer(genormaliseerd, datatype.normalisatie);
  }

  // --- Stap 2: Type-check ---
  const basistype = datatype.basistype || "string";

  if (basistype === "integer") {
    if (!/^-?\d+$/.test(genormaliseerd)) {
      fouten.push("Moet een geheel getal zijn");
      return { geldig: false, genormaliseerd, fouten };
    }
  }

  if (basistype === "number") {
    if (isNaN(Number(genormaliseerd))) {
      fouten.push("Moet een getal zijn");
      return { geldig: false, genormaliseerd, fouten };
    }
  }

  if (basistype === "boolean") {
    const lower = genormaliseerd.toLowerCase();
    if (!["true", "false", "1", "0", "ja", "nee"].includes(lower)) {
      fouten.push('Moet een boolean zijn (true/false, ja/nee, 1/0)');
      return { geldig: false, genormaliseerd, fouten };
    }
  }

  // Numerieke waarde voor bereik-checks
  const numVal = (basistype === "integer" || basistype === "number")
    ? Number(genormaliseerd)
    : null;

  // --- Stap 3: Lengte / bereik ---
  if (basistype === "string") {
    if (validatie.minLength != null && genormaliseerd.length < validatie.minLength) {
      fouten.push(`Minimale lengte is ${validatie.minLength} (nu: ${genormaliseerd.length})`);
    }
    if (validatie.maxLength != null && genormaliseerd.length > validatie.maxLength) {
      fouten.push(`Maximale lengte is ${validatie.maxLength} (nu: ${genormaliseerd.length})`);
    }
  }

  if (numVal !== null) {
    if (validatie.minimum != null && numVal < validatie.minimum) {
      fouten.push(`Minimale waarde is ${validatie.minimum}`);
    }
    if (validatie.maximum != null && numVal > validatie.maximum) {
      fouten.push(`Maximale waarde is ${validatie.maximum}`);
    }
    if (validatie.multipleOf != null && validatie.multipleOf !== 0) {
      // Floating point-safe modulo: vergelijk met een kleine epsilon
      const rest = Math.abs(numVal % validatie.multipleOf);
      const epsilon = 1e-10;
      if (rest > epsilon && Math.abs(rest - validatie.multipleOf) > epsilon) {
        fouten.push(`Moet een veelvoud zijn van ${validatie.multipleOf}`);
      }
    }
  }

  // --- Stap 4: Pattern ---
  if (validatie.pattern) {
    try {
      const regex = new RegExp(validatie.pattern);
      if (!regex.test(genormaliseerd)) {
        fouten.push(validatie.foutmelding || "Voldoet niet aan het verwachte patroon");
      }
    } catch {
      fouten.push(`Ongeldige regex in datatype: ${validatie.pattern}`);
    }
  }

  // --- Stap 5: Regels (checksum, formula, function) ---
  const regels = validatie.regels || [];
  for (const regel of regels) {
    const result = voerRegelUit(genormaliseerd, regel);
    if (!result.geldig) {
      fouten.push(result.melding || `Regel "${regel.naam}" is niet geldig`);
    }
  }

  return {
    geldig: fouten.length === 0,
    genormaliseerd,
    fouten,
  };
}

/**
 * Zoek een gegevenstype op basis van format in een array van datatypes.
 *
 * Lookup-volgorde (conform gegevenstypen.md):
 *   1. Zoek in de datatypes-array naar een entry met matching format
 *   2. Zo gevonden: return het datatype
 *   3. Zo niet gevonden: return null
 *
 * @param {string} format     - Het format-veld van een attribuut (bijv. "nl-postcode")
 * @param {Array}  datatypes  - Array van gegevenstype-objecten
 * @returns {Object|null}
 */
export function zoekDatatype(format, datatypes = []) {
  if (!format) return null;
  return datatypes.find((dt) => dt.format === format || dt.naam === format) || null;
}

/**
 * Valideer een veldwaarde met automatische datatype-lookup.
 *
 * Combineert zoekDatatype + valideer in één aanroep. Handig voor
 * invoerformulieren waar je het format van het veld kent maar niet
 * per se het volledige datatype-object bij de hand hebt.
 *
 * @param {*}      waarde    - De ruwe invoerwaarde
 * @param {string} format    - Het format van het veld (bijv. "nl-postcode")
 * @param {Array}  datatypes - Array van gegevenstype-objecten
 * @param {Object} [opties]  - Extra opties (zie valideer())
 * @returns {ValidatieResultaat}
 */
export function valideerVeld(waarde, format, datatypes = [], opties = {}) {
  const datatype = zoekDatatype(format, datatypes);
  if (!datatype) {
    // Geen custom datatype gevonden — geen validatie (primitief type)
    return {
      geldig: true,
      genormaliseerd: String(waarde ?? ""),
      fouten: [],
    };
  }
  return valideer(waarde, datatype, opties);
}
