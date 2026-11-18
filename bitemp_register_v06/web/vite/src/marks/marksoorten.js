// @ts-check
/**
 * marksoorten — welke marks er bestaan. Een marksoort hoort bij de **transformatie** die hem
 * leest (besluit Mark 18-11: "een mark komt vanuit de vraag, het doel"), niet bij het profiel en
 * niet bij het M3. De transformatie (regelset) registreert haar soorten hier, met een naamruimte:
 * `register.zoeksleutel`, `gzac.…`, `formulier.…`.
 *
 * Een marksoort heeft de vorm van een M3-PropertyType (`datatype`, `opties`), zodat de inspector
 * hem met de bestaande editors kan bewerken, plus `doelen` (waar hij op mag).
 *
 * @typedef {Object} Marksoort
 * @property {string} id                 - `naamruimte.naam`
 * @property {string} [label]
 * @property {string} [uitleg]
 * @property {string} [datatype]         - "boolean" (standaard) | "string" | "tekst" | "getal" | "keuze"
 * @property {{waarde: string, label?: string}[]} [opties] - bij "keuze"
 * @property {("element"|"veld"|"relatie"|"map")[]} [doelen] - leeg = overal
 * @property {string[]} [profielen]      - descriptor-ids waar hij op mag (leeg = elke taal)
 * @property {string[]} [elementTypes]   - elementtypen waar hij op mag (leeg = elk type)
 */

/** @type {Map<string, Marksoort>} */
const _soorten = new Map();

/** Registreer de marksoorten van een transformatie. Idempotent (veilig bij HMR). */
export function registreerMarksoorten(soorten) {
  for (const s of soorten || []) {
    if (!/^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9-]*$/.test(s?.id || "")) throw new Error(`Marksoort "${s?.id}" heeft geen naamruimte (verwacht: naamruimte.naam).`);
    _soorten.set(s.id, { datatype: "boolean", ...s });
  }
}

/** @param {string} id */
export const getMarksoort = (id) => _soorten.get(id) || null;

export const alleMarksoorten = () => [..._soorten.values()].sort((a, b) => a.id.localeCompare(b.id));

/** De naamruimte van een marksoort: de transformatie waar hij bij hoort. */
export const naamruimteVan = (id) => String(id || "").split(".")[0];

/**
 * De marksoorten die op dit doel mogen.
 * @param {{soort: string}} doel
 * @param {{profiel?: string, elementType?: string}} [bij] - descriptor-id en elementtype van het doel
 */
export function marksoortenVoor(doel, { profiel, elementType } = {}) {
  return alleMarksoorten().filter(
    (s) =>
      (!s.doelen?.length || s.doelen.includes(/** @type {any} */ (doel?.soort))) &&
      (!s.profielen?.length || (!!profiel && s.profielen.includes(profiel))) &&
      (!s.elementTypes?.length || (!!elementType && s.elementTypes.includes(elementType)))
  );
}

const past = {
  boolean: (w) => typeof w === "boolean",
  string: (w) => typeof w === "string",
  tekst: (w) => typeof w === "string",
  getal: (w) => typeof w === "number" && Number.isFinite(w),
};

/**
 * Controleer een mark tegen zijn soort. `null` (uitgezet) mag altijd.
 * @param {{soort: string, doel: {soort: string}, waarde: any}} mark
 * @param {{profiel?: string, elementType?: string}} [bij]
 * @returns {string[]} meldingen; leeg = goed
 */
export function valideerMark(mark, bij = {}) {
  const soort = getMarksoort(mark.soort);
  if (!soort) return [`Onbekende marksoort "${mark.soort}": de transformatie die hem leest is niet geladen.`];
  const uit = [];
  if (!marksoortenVoor(mark.doel, bij).includes(soort)) uit.push(`"${soort.label || soort.id}" hoort niet op dit doel (${mark.doel?.soort}).`);
  if (mark.waarde === null) return uit;
  if (soort.datatype === "keuze") {
    if (!(soort.opties || []).some((o) => o.waarde === mark.waarde)) uit.push(`"${mark.waarde}" is geen keuze van "${soort.label || soort.id}".`);
  } else if (!(past[soort.datatype || "boolean"] || (() => true))(mark.waarde)) {
    uit.push(`De waarde van "${soort.label || soort.id}" moet ${soort.datatype} zijn.`);
  }
  return uit;
}

/**
 * De eerste set: fysieke afstemming van het register (indexen uit het model, BACKEND stap 4).
 * De codegen leest ze uit de bijlage `marks` van de V3-export.
 */
export const REGISTER_MARKSOORTEN = [
  { id: "register.zoeksleutel", label: "zoeksleutel", datatype: "boolean", doelen: ["veld"], profielen: ["canoniek-uml"], uitleg: "Op dit veld wordt gezocht; de codegen legt er een index voor aan." },
  { id: "register.sorteerbaar", label: "sorteerbaar", datatype: "boolean", doelen: ["veld"], profielen: ["canoniek-uml"], uitleg: "Lijsten worden op dit veld gesorteerd; de codegen houdt daar rekening mee." },
  // Gereserveerd (BACKEND 18-11): zoeken op een deel van een tekst vraagt een ander soort index
  // dan zoeksleutel. De codegen leest hem nog niet.
  { id: "register.tekstzoeken", label: "tekstzoeken", datatype: "boolean", doelen: ["veld"], profielen: ["canoniek-uml"], uitleg: "Zoeken op een deel van de tekst (nog niet gelezen door de codegen)." },
];
// Geen marks (BACKEND 18-11): `uniek` blijft een eigenschap van het veld (een regel van het model,
// geen afstemming), en de doelkant van een relatie krijgt altijd een index.
