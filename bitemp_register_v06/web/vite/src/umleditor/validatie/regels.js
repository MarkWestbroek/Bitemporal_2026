/**
 * regels.js — Implementaties van validatieregels voor gegevenstypen.
 *
 * Framework-onafhankelijk: puur JavaScript, geen React-dependencies.
 * Herbruikbaar in de metamodel-editor, de bitemporele data-frontend,
 * en als referentie-implementatie voor de Go-backend.
 *
 * Drie soorten regels (conform gegevenstypen.md):
 *
 *   1. **checksum** — Wiskundige proef over individuele cijfers.
 *      De expressie beschrijft de formule met d1..dN als individuele cijfers.
 *      Wordt hier generiek geëvalueerd.
 *
 *   2. **formula** — Wiskundige formule over de numerieke waarde.
 *      De expressie gebruikt `value` als variabele.
 *      Wordt hier generiek geëvalueerd.
 *
 *   3. **function** — Verwijzing naar een benoemde, hard-coded validatiefunctie.
 *      Elke benoemde functie bestaat in zowel de JS-frontend als de Go-backend.
 *      Nieuwe functies toevoegen = toevoegen in FUNCTION_REGISTRY hieronder
 *      + het Go-equivalent in de backend.
 *
 * @module validatie/regels
 */

// ============================================================================
// Benoemde validatiefuncties (function-type regels)
// ============================================================================

/**
 * BSN 11-proef: de gewogen som van de 9 cijfers, met factor -1 voor het
 * laatste cijfer, moet deelbaar zijn door 11.
 *
 * @param {string} waarde - De (genormaliseerde) BSN-string, bijv. "123456782"
 * @returns {boolean}
 */
function bsn_11proef(waarde) {
  if (!/^\d{9}$/.test(waarde)) return false;
  const d = waarde.split("").map(Number);
  // Gewichten: 9, 8, 7, 6, 5, 4, 3, 2, -1
  const som = 9*d[0] + 8*d[1] + 7*d[2] + 6*d[3] + 5*d[4]
            + 4*d[5] + 3*d[6] + 2*d[7] - 1*d[8];
  return som % 11 === 0 && som !== 0;
}

/**
 * IBAN mod-97 controle conform ISO 13616:
 *   1. Verplaats de eerste 4 tekens naar het einde
 *   2. Vervang letters door getallen (A=10, B=11, ..., Z=35)
 *   3. Bereken het resultaat modulo 97 — moet 1 zijn
 *
 * @param {string} waarde - De (genormaliseerde, zonder spaties) IBAN-string
 * @returns {boolean}
 */
function iban_mod97_check(waarde) {
  const clean = waarde.replace(/\s/g, "").toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false;

  // Verplaats eerste 4 tekens naar eind
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Vervang letters door getallen
  let numericStr = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericStr += (code - 55).toString(); // A=10, B=11, ...
    } else {
      numericStr += ch;
    }
  }

  // Modulo 97 via stapsgewijze berekening (string te lang voor Number)
  let rest = 0;
  for (const digit of numericStr) {
    rest = (rest * 10 + Number(digit)) % 97;
  }

  return rest === 1;
}

/**
 * Registry van benoemde validatiefuncties.
 *
 * Sleutel = de expressie-waarde uit het datatype-object (bijv. "iban_mod97_check").
 * Waarde  = de JavaScript-functie die de validatie uitvoert.
 *
 * Wanneer je een nieuwe function-type regel toevoegt:
 *   1. Voeg de functie hierboven toe
 *   2. Registreer hem hieronder
 *   3. Voeg het Go-equivalent toe in de backend
 */
/** Letters → cijfers (A=10 … Z=35) en de rest bij deling door 97 (ISO 7064), stapsgewijs. */
function mod97(tekens) {
  let rest = 0;
  for (const ch of tekens) {
    const code = ch.charCodeAt(0);
    const deel = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const c of deel) {
      if (c < "0" || c > "9") return -1;
      rest = (rest * 10 + Number(c)) % 97;
    }
  }
  return rest;
}

/** LEI (ISO 17442): 20 tekens, als geheel mod 97 == 1 (geen herschikking, anders dan IBAN). */
function lei_mod97(waarde) {
  const clean = String(waarde).trim().toUpperCase();
  return clean.length === 20 && mod97(clean) === 1;
}

/** ISBN-10: (10*d1 + 9*d2 + … + d10) % 11 == 0; het laatste teken mag X (=10) zijn. */
function isbn10_mod11(waarde) {
  const clean = String(waarde).trim().replace(/-/g, "").toUpperCase();
  if (!/^\d{9}[\dX]$/.test(clean)) return false;
  let som = 0;
  for (let i = 0; i < 9; i++) som += Number(clean[i]) * (10 - i);
  som += clean[9] === "X" ? 10 : Number(clean[9]);
  return som % 11 === 0;
}

/** "lat,lng" met lat in [-90, 90] en lng in [-180, 180]. */
function geo_range(waarde) {
  const delen = String(waarde).trim().split(",");
  if (delen.length !== 2) return false;
  const [lat, lng] = delen.map((d) => Number(d.trim()));
  return delen.every((d) => d.trim() !== "") && !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function leesGeoJson(waarde) {
  try { return JSON.parse(String(waarde).trim()); } catch { return null; }
}

/** GeoJSON LineString met minstens 2 coördinaten (RFC 7946). */
function geolijn_geojson(waarde) {
  const g = leesGeoJson(waarde);
  return Boolean(g && g.type === "LineString" && Array.isArray(g.coordinates) && g.coordinates.length >= 2);
}

/** GeoJSON Polygon: eerste ring minstens 4 punten en gesloten (eerste == laatste). */
function geovlak_geojson(waarde) {
  const g = leesGeoJson(waarde);
  const ring = g && g.type === "Polygon" && Array.isArray(g.coordinates) ? g.coordinates[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return false;
  const [a, z] = [ring[0], ring[ring.length - 1]];
  return Array.isArray(a) && Array.isArray(z) && a.length >= 2 && a[0] === z[0] && a[1] === z[1];
}

/**
 * Dezelfde namen als de Go-kant (model/regels_eval.go, validatieFuncties) en als het model
 * (V3Regel.expressie). Houd beide lijsten gelijk; regels.test.js controleert de namen.
 */
const FUNCTION_REGISTRY = {
  bsn_11proef,
  iban_mod97: iban_mod97_check,
  iban_mod97_check, // oude naam
  geo_range,
  isbn10_mod11,
  lei_mod97,
  geolijn_geojson,
  geovlak_geojson,
};

// ============================================================================
// Generieke regel-evaluatie
// ============================================================================

/**
 * Evalueer een checksum-expressie.
 *
 * De expressie bevat variabelen d1..dN die de individuele cijfers representeren.
 * Voorbeeld: "(9*d1 + 8*d2 + ... - 1*d9) % 11 == 0"
 *
 * Veiligheid: we bouwen een beperkte context met alleen d1..dN en evalueren
 * via Function(). Dit is veilig omdat de expressies uit het eigen metamodel
 * komen (niet van eindgebruikers) en alleen numerieke operaties bevatten.
 *
 * @param {string} waarde     - De invoerwaarde (string van cijfers)
 * @param {string} expressie  - De checksum-expressie
 * @returns {boolean}
 */
function evalueerChecksum(waarde, expressie) {
  const digits = waarde.replace(/\D/g, "");
  if (digits.length === 0) return false;

  // Bouw context object: d1, d2, ..., dN
  // Ook de cijfers die de expressie noemt maar de waarde niet heeft (te kort) bestaan, als NaN:
  // dan faalt de regel stil in plaats van met een ReferenceError.
  const hoogste = Math.max(digits.length, ...[...String(expressie).matchAll(/\bd(\d+)\b/g)].map((m) => Number(m[1])));
  const context = {};
  for (let i = 0; i < hoogste; i++) {
    context[`d${i + 1}`] = i < digits.length ? Number(digits[i]) : NaN;
  }

  try {
    // Bouw functie met alleen de digit-variabelen in scope
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);
    const fn = new Function(...paramNames, `return (${expressie});`);
    return Boolean(fn(...paramValues));
  } catch {
    console.warn(`[regels] Checksum-expressie evaluatie mislukt: "${expressie}"`);
    return false;
  }
}

/**
 * Evalueer een formula-expressie.
 *
 * De expressie bevat `value` als variabele.
 * Voorbeeld: "value >= 0 && value <= 100"
 *
 * @param {*} waarde      - De (numerieke) invoerwaarde
 * @param {string} expressie - De formula-expressie
 * @returns {boolean}
 */
function evalueerFormula(waarde, expressie) {
  try {
    // Zelfde variabelen als de Go-kant (evalueerFormula): value, en als de waarde een getal is
    // ook valueNum en valueInt. `value` is een getal als dat kan (achterwaarts compatibel).
    const tekst = String(waarde).trim();
    const num = tekst !== "" && !Number.isNaN(Number(tekst)) ? Number(tekst) : undefined;
    const int = num !== undefined && /^-?\d+$/.test(tekst) ? num : undefined;
    const fn = new Function("value", "valueNum", "valueInt", `return (${expressie});`);
    return Boolean(fn(num ?? tekst, num, int));
  } catch {
    console.warn(`[regels] Formula-expressie evaluatie mislukt: "${expressie}"`);
    return false;
  }
}

/**
 * Voer een enkele validatieregel uit.
 *
 * @param {*} waarde                - De (genormaliseerde) invoerwaarde
 * @param {{ naam, type, expressie, description? }} regel - De validatieregel
 * @returns {{ geldig: boolean, regel: string, melding: string }}
 */
export function voerRegelUit(waarde, regel) {
  const result = { geldig: true, regel: regel.naam, melding: "" };

  switch (regel.type) {
    case "checksum":
      result.geldig = evalueerChecksum(String(waarde), regel.expressie);
      break;

    case "formula":
      result.geldig = evalueerFormula(waarde, regel.expressie);
      break;

    case "function": {
      const fn = FUNCTION_REGISTRY[regel.expressie];
      if (!fn) {
        // Deze client kent de functie niet: niet afkeuren. De server (model/regels_eval.go)
        // controleert hem wel; een onterechte rode melding tijdens het invullen is erger.
        console.warn(`[regels] Onbekende validatiefunctie: "${regel.expressie}" — overgelaten aan de server`);
        result.onbekend = true;
        return result;
      }
      result.geldig = fn(String(waarde));
      break;
    }

    default:
      console.warn(`[regels] Onbekend regeltype: "${regel.type}"`);
      result.geldig = false;
      result.melding = `Onbekend regeltype: ${regel.type}`;
      return result;
  }

  if (!result.geldig) {
    result.melding = regel.description || `Regel "${regel.naam}" is niet geldig`;
  }
  return result;
}

/**
 * Geeft de namen van alle geregistreerde benoemde validatiefuncties.
 * Handig voor documentatie en debugging.
 *
 * @returns {string[]}
 */
export function beschikbareFuncties() {
  return Object.keys(FUNCTION_REGISTRY);
}
