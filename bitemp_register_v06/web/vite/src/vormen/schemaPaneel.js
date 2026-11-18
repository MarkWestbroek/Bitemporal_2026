/**
 * schemaPaneel.js — een JSON Schema plus een waarde → de **boom van een instellingenpaneel**.
 *
 * Aanleiding (Mark 18-11): de instellingen van een schrijver (BPMN voor GZAC) zijn een motor met
 * parameters, zoals een module in MusicBrain. Eén beschrijving (het schema), de waarden apart, en
 * de vorm in een eigen laag. Zelfde opzet als de vormConfig van een vorm (configSchemas.js); dit
 * paneel is ook bedoeld voor de formuliereditor (VormEditor: "later een formulier uit het
 * configSchema").
 *
 * Inhoud en vorm zijn gescheiden: het schema zegt de **soort** (ja/nee, keuze, getal, tekst,
 * sjabloon, groep, lijst, tabel), `x-vorm` kiest hooguit een andere bediening. Eigen sleutels:
 *   x-titel        label (anders de sleutel)
 *   x-omschrijving uitleg
 *   x-groep        naam van de groep op het paneel (alleen op het hoogste niveau gebruikt)
 *   x-vorm         bediening: "switch", "button-group", "rotary", "code"; op een lijst van
 *                  objecten "tabel": één regel per object, een kolom per eigenschap
 *   x-placeholders namen die in een sjabloonwaarde mogen staan (`{naam}` of `{naam|filter}`)
 *
 * Wat het schema niet noemt, wordt uit de waarde afgeleid en gemerkt (`onbeschreven`): zo is een
 * instelling die in de code is bijgekomen zichtbaar, en zie je dat de beschrijving achterloopt.
 *
 * Puur en getest; de tekenaar staat in SchemaPaneel.jsx.
 */

/** `{naam}` en `{naam|filter}`, maar niet `${…}` (een expressie voor de engine). */
const PLACEHOLDER = /(?<!\$)\{([A-Za-z_][\w.]*)(?:\|([\w-]+))?\}/g;

/** De placeholders in een sjabloonwaarde: [{ naam, filter }]. */
export function placeholdersIn(tekst) {
  if (typeof tekst !== "string") return [];
  return [...tekst.matchAll(PLACEHOLDER)].map((m) => ({ naam: m[1], filter: m[2] || null }));
}

/** Een sjabloon in stukken: [{ tekst }] en [{ placeholder, naam, filter }], om te kleuren. */
export function sjabloonDelen(tekst) {
  const delen = [];
  let vanaf = 0;
  for (const m of String(tekst ?? "").matchAll(PLACEHOLDER)) {
    if (m.index > vanaf) delen.push({ tekst: tekst.slice(vanaf, m.index) });
    delen.push({ placeholder: m[0], naam: m[1], filter: m[2] || null });
    vanaf = m.index + m[0].length;
  }
  if (vanaf < String(tekst ?? "").length) delen.push({ tekst: String(tekst).slice(vanaf) });
  return delen;
}

const isObject = (w) => !!w && typeof w === "object" && !Array.isArray(w);
const eersteType = (schema) => (Array.isArray(schema?.type) ? schema.type[0] : schema?.type);

/** De soort van een waarde: uit het schema, anders uit de waarde zelf. */
export function soortVan(schema, waarde) {
  const type = eersteType(schema);
  if (schema?.enum) return "keuze";
  if (type === "boolean" || (!type && typeof waarde === "boolean")) return "ja_nee";
  if (type === "number" || type === "integer" || (!type && typeof waarde === "number")) return "getal";
  if (type === "array" || (!type && Array.isArray(waarde))) return "lijst";
  if (type === "object" || (!type && isObject(waarde))) {
    // Alleen vrije sleutels met een enkelvoudige waarde = een tabel sleutel → waarde.
    const vrij = isObject(schema?.additionalProperties) && !schema?.properties;
    const plat = isObject(waarde) && Object.values(waarde).every((w) => !isObject(w) && !Array.isArray(w));
    if (vrij ? ["string", "number", "boolean", "integer"].includes(eersteType(schema.additionalProperties)) || (!eersteType(schema.additionalProperties) && plat) : false) return "tabel";
    return "groep";
  }
  if (schema?.["x-placeholders"] || placeholdersIn(waarde).length) return "sjabloon";
  return "tekst";
}

const STANDAARD_VORM = { ja_nee: "switch", keuze: "button-group", getal: "number", tekst: "text", sjabloon: "sjabloon" };

/**
 * Eén knoop van het paneel.
 * @typedef {Object} Knoop
 * @property {string} pad            - "taken.serviceTask.asyncAfter"
 * @property {string} sleutel
 * @property {string} titel
 * @property {string} soort          - ja_nee | keuze | getal | tekst | sjabloon | groep | lijst | tabel
 * @property {string|null} vorm      - de bediening voor een enkelvoudige waarde
 * @property {string} omschrijving
 * @property {any} waarde
 * @property {any} standaard         - schema.default, als die er is
 * @property {boolean} afwijkend     - de waarde wijkt af van de standaard
 * @property {boolean} onbeschreven  - niet in het schema; afgeleid uit de waarde
 * @property {string[]} [keuzes]
 * @property {{naam: string, filter: string|null, bekend: boolean}[]} [placeholders]
 * @property {Knoop[]} [kinderen]    - bij groep en lijst
 * @property {{sleutel: string, waarde: any, placeholders: any[]}[]} [rijen] - bij tabel
 */

/** @returns {Knoop} */
export function knoopVoor(schema, waarde, pad = "", sleutel = "", onbeschreven = false) {
  const s = schema || {};
  const soort = soortVan(s, waarde);
  /** @type {any} */
  const knoop = {
    pad,
    sleutel,
    titel: s["x-titel"] || sleutel,
    soort,
    vorm: s["x-vorm"] || STANDAARD_VORM[soort] || null,
    omschrijving: s["x-omschrijving"] || "",
    waarde,
    standaard: s.default,
    afwijkend: "default" in s && JSON.stringify(s.default) !== JSON.stringify(waarde),
    onbeschreven,
  };
  const metBekend = (tekst) => {
    const bekend = s["x-placeholders"];
    return placeholdersIn(tekst).map((p) => ({ ...p, bekend: !bekend || bekend.includes(p.naam) }));
  };

  if (soort === "keuze") knoop.keuzes = s.enum || [];
  if (soort === "sjabloon") knoop.placeholders = metBekend(waarde);
  if (soort === "tabel") {
    knoop.rijen = Object.entries(waarde || {}).map(([k, w]) => ({ sleutel: k, waarde: w, placeholders: metBekend(w) }));
  }
  if (soort === "groep") {
    const props = s.properties || {};
    const vrij = isObject(s.additionalProperties) ? s.additionalProperties : schema && Object.keys(schema).length === 0 ? {} : null;
    const sleutels = [...Object.keys(props), ...Object.keys(waarde || {}).filter((k) => !(k in props))];
    knoop.kinderen = sleutels
      .filter((k) => waarde?.[k] !== undefined)
      .map((k) => knoopVoor(props[k] || vrij, waarde[k], pad ? `${pad}.${k}` : k, k, !props[k] && !vrij));
  }
  if (soort === "lijst") {
    // Een vrij schema ({}: alles mag) beschrijft ook wat eronder hangt; dat is niet "onbeschreven".
    const vrijeLijst = !!schema && Object.keys(schema).length === 0;
    knoop.kinderen = (Array.isArray(waarde) ? waarde : []).map((w, i) => knoopVoor(s.items || (vrijeLijst ? {} : undefined), w, `${pad}[${i}]`, String(i + 1), !s.items && !vrijeLijst));
  }
  return knoop;
}

/**
 * Het paneel: de knopen van het hoogste niveau, ingedeeld in groepen (`x-groep`, in de volgorde
 * waarin ze in het schema voorkomen). Wat geen groep noemt komt onder "Overig".
 *
 * @returns {{groepen: {naam: string, knopen: Knoop[]}[], onbeschreven: string[]}}
 */
export function paneelBoom(schema, waarde) {
  const wortel = knoopVoor({ type: "object", ...schema }, waarde || {});
  const groepen = [];
  const vind = (naam) => groepen.find((g) => g.naam === naam) || (groepen.push({ naam, knopen: [] }), groepen[groepen.length - 1]);
  for (const kind of wortel.kinderen || []) vind(schema?.properties?.[kind.sleutel]?.["x-groep"] || "Overig").knopen.push(kind);
  const onbeschreven = [];
  const loop = (k) => {
    if (k.onbeschreven) onbeschreven.push(k.pad);
    else (k.kinderen || []).forEach(loop);
  };
  (wortel.kinderen || []).forEach(loop);
  return { groepen, onbeschreven };
}

/** Een onbekende placeholder in een sjabloonwaarde is een fout in de instelling: [{pad, naam}]. */
export function onbekendePlaceholders(schema, waarde) {
  const uit = [];
  const loop = (k) => {
    for (const p of k.placeholders || []) if (!p.bekend) uit.push({ pad: k.pad, naam: p.naam });
    for (const rij of k.rijen || []) for (const p of rij.placeholders) if (!p.bekend) uit.push({ pad: `${k.pad}.${rij.sleutel}`, naam: p.naam });
    (k.kinderen || []).forEach(loop);
  };
  paneelBoom(schema, waarde).groepen.forEach((g) => g.knopen.forEach(loop));
  return uit;
}

const enkelvoudig = (k) => !["groep", "lijst", "tabel"].includes(k.soort);

/** Een lijst van alleen enkelvoudige waarden (formats, toegestane weergaven): te tonen als rij blokjes. */
export function isWaardenlijst(knoop) {
  return knoop?.soort === "lijst" && (knoop.kinderen || []).length > 0 && knoop.kinderen.every(enkelvoudig);
}

/** Korte tekst van een waarde voor een cel: ja/nee, tekst, of compacte JSON. */
export function celTekst(waarde) {
  if (waarde === undefined) return "";
  if (waarde === true) return "ja";
  if (waarde === false) return "nee";
  if (typeof waarde === "string") return waarde;
  if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) {
    const paren = Object.entries(waarde);
    if (!paren.length) return "altijd";
    return paren.map(([k, w]) => `${k}: ${Array.isArray(w) ? w.join(" of ") : celTekst(w)}`).join("; ");
  }
  return JSON.stringify(waarde);
}

/**
 * Een lijst van objecten als tabel (`x-vorm: "tabel"`): de kolommen zijn de eigenschappen in de
 * volgorde van het schema, daarna wat alleen in de waarden voorkomt.
 *
 * @returns {{kolommen: {sleutel: string, titel: string, omschrijving: string}[], rijen: {tekst: string, placeholders: any[]}[][]}|null}
 */
export function lijstAlsTabel(knoop) {
  if (knoop?.soort !== "lijst" || knoop.vorm !== "tabel") return null;
  const rijen = knoop.kinderen || [];
  if (!rijen.length || !rijen.every((r) => r.soort === "groep")) return null;
  const kolommen = [];
  for (const rij of rijen) {
    for (const cel of rij.kinderen || []) {
      if (!kolommen.some((k) => k.sleutel === cel.sleutel)) kolommen.push({ sleutel: cel.sleutel, titel: cel.titel, omschrijving: cel.omschrijving });
    }
  }
  return {
    kolommen,
    rijen: rijen.map((rij) =>
      kolommen.map((kolom) => {
        const cel = (rij.kinderen || []).find((k) => k.sleutel === kolom.sleutel);
        return { tekst: cel ? celTekst(cel.waarde) : "", placeholders: cel?.placeholders || [] };
      })
    ),
  };
}
