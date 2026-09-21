/**
 * woorden.js — kleine taalhulpen voor Toegangsspraak.
 *
 * De van-vorm ("de achternaam van een natuurlijk persoon") is de canonieke
 * leesvorm; het registerpad ("NatuurlijkPersoon.Naam.achternaam") de canonieke
 * interne vorm. Deze helpers vertalen deterministisch tussen beide; een latere
 * metamodel-resolutie (schema-API) kan labels en verkorte ketens verzorgen.
 */

/** "NatuurlijkPersoon" → ["natuurlijk", "persoon"] */
export function camelNaarWoorden(naam) {
  return String(naam)
    .replace(/[_-]+/g, " ")
    .replace(/([a-zà-ÿ0-9])([A-ZÀ-Þ])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** ["natuurlijk","persoon"] → "NatuurlijkPersoon" (typen: hoofdletter per woord) */
export function woordenNaarTypenaam(woorden) {
  return woorden.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

/** ["burgerlijke","staat"] → "burgerlijkeStaat" (velden: lowerCamel) */
export function woordenNaarVeldnaam(woorden) {
  return woorden
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

// Lidwoord-bepaling voor gegenereerde van-vormen (drag & drop, autocomplete).
// Bij geparste tekst bewaart de AST het lidwoord van de auteur, dus dit hoeft
// nooit perfect te zijn: een woordenlijst + achtervoegsel-heuristiek. De echte
// oplossing is lidwoord/geslacht als metadata in het metamodel (naast het
// meervoud dat er al is) — zie ontwerpdoc §12.
const HET_WOORDEN = new Set([
  "doel", "inkomen", "werkgebied", "tijdstip", "kanaal", "logboek",
  "nummer", "adres", "kenmerk", "besluit", "dossier", "overlijden",
  "huwelijk", "gezag", "verblijf", "document", "bedrag", "land", "geslacht",
]);

// Achtervoegsels die (vrijwel) altijd onzijdig zijn: verkleinwoorden en
// -isme/-ment/-sel/-um; al het andere valt terug op "de" (meervouden zijn
// sowieso "de", en "de" is bij twijfel het minst storend).
const HET_SUFFIX = /(?:je|isme|ment|sel|um)$/;

// Uitzonderingen op de achtervoegsel-regel ("de datum", ondanks -um).
const DE_WOORDEN = new Set(["datum", "kolom"]);

export function lidwoordVoor(woord) {
  const w = String(woord).toLowerCase();
  if (DE_WOORDEN.has(w)) return "de";
  if (HET_WOORDEN.has(w)) return "het";
  if (HET_SUFFIX.test(w)) return "het";
  return "de";
}

/** "Inzage inkomen bij schuldhulp" → "inzage-inkomen-bij-schuldhulp" */
export function slug(tekst) {
  return String(tekst)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

/** ("1","mei","2026") → "2026-05-01"; null als geen geldige datum. */
export function maakIsoDatum(dag, maandWoord, jaar) {
  const maand = MAANDEN.indexOf(String(maandWoord).toLowerCase());
  const d = Number(dag);
  const j = Number(jaar);
  if (maand < 0 || !Number.isInteger(d) || d < 1 || d > 31 || !Number.isInteger(j)) return null;
  return `${String(j).padStart(4, "0")}-${String(maand + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "2026-05-01" → "1 mei 2026" */
export function isoNaarNlDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} ${MAANDEN[Number(m[2]) - 1]} ${Number(m[1])}`;
}

export function isMaand(woord) {
  return MAANDEN.includes(String(woord).toLowerCase());
}
