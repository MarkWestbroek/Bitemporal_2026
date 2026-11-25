// @ts-check
/**
 * toegangsspraakRegels — de **regelsets** "Cedar → Toegangsspraak" en "Toegangsspraak → Cedar"
 * (fase 2 van "2026-11-25 Cedar als M2"; TRANSFORMATIES.md §8.3).
 *
 * Data, geen code: wat elk onderdeel aan de andere kant wordt. De toepasser is
 * `transformatie/regels.js`; de bouwers (`naarToegangsspraak.js`, `vanToegangsspraak.js`) zetten
 * het plan om in een beleid (AST) respectievelijk in Cedar-policies (EST).
 *
 * De keuzes (Mark 25-11 en het plan):
 *
 *   - permit ↔ toestemming ("mag"), forbid ↔ verbod ("mag niet"); Cedar weigert standaard en het
 *     verbod wint, zoals een beleid zonder `Standaard:` en `Bij conflict:`;
 *   - een attribuut van de principal ↔ een kenmerk van de aanvrager, van de resource ↔ van de
 *     gegevens, van de context ↔ van de aanvraag (`ANKER_VOOR_VAR`);
 *   - `principal.<rollen>.contains("x")` ↔ `Iemand met rol "x"`: "is" op een meerwaardig kenmerk
 *     betekent "één van de waarden is";
 *   - een handeling is een actie uit de eigen actielijst van het profiel (woordenschat.js);
 *   - `resource is T` ↔ "alle gegevens van een T"; `resource == T::"x"` ↔ ook "de id van de
 *     gegevens is "x"".
 *
 * Wat de andere kant niet kan zeggen wordt een element van type `onvertaalbaar` met een reden; de
 * bouwer laat dan een toestemming weg (strenger) of een verbod zonder die voorwaarde gelden (ook
 * strenger), en meldt het. Nooit ongemerkt ruimer.
 */

/** Cedar-variabele ↔ anker in Toegangsspraak. */
export const ANKER_VOOR_VAR = { principal: "aanvrager", resource: "gegevens", context: "aanvraag" };
export const VAR_VOOR_ANKER = { aanvrager: "principal", gegevens: "resource", aanvraag: "context" };

/** Cedar-vorm (zie cedarGraaf.js) → vergelijking in Toegangsspraak (canoniek, operatoren.js). */
export const CEDAR_NAAR_OPERATOR = {
  "==": "eq",
  "!=": "neq",
  "<": "lt",
  "<=": "lteq",
  ">": "gt",
  ">=": "gteq",
  contains: "eq", // op een meerwaardig attribuut: "is" = één van de waarden is
  containsAny: "isAnyOf",
  eenVan: "isAnyOf",
  has: "isBekend",
  "!has": "isOnbekend",
  "like:begin": "begintMet",
  "like:eind": "eindigtOp",
  "like:in": "bevat",
};

/**
 * Vergelijking in Toegangsspraak → Cedar. `enkel` op een attribuut met één waarde, `meer` op een
 * meerwaardig attribuut (Set). Ontbreekt een vorm, dan is de vergelijking daar niet te zeggen.
 */
export const OPERATOR_NAAR_CEDAR = {
  eq: { enkel: "==", meer: "contains" },
  neq: { enkel: "!=", meer: "!contains" },
  lt: { enkel: "<" },
  lteq: { enkel: "<=" },
  gt: { enkel: ">" },
  gteq: { enkel: ">=" },
  isAnyOf: { enkel: "eenVan", meer: "containsAny" },
  isBekend: { enkel: "has", meer: "has" },
  isOnbekend: { enkel: "!has", meer: "!has" },
  begintMet: { enkel: "like:begin" },
  eindigtOp: { enkel: "like:eind" },
  bevat: { enkel: "like:in" },
  tussen: { enkel: "tussen" },
};

const VERBINDINGEN = (aarden) => aarden.map((aard) => ({ naam: `Verbinding: ${aard}`, bij: "verbinding", als: { aard }, maak: { type: aard, data: { logica: "{logica}" } } }));

const onvertaalbaar = (naam, als, reden) => ({ naam, bij: "knoop", als, maak: { type: "onvertaalbaar", data: { reden, tekst: "{tekst}" } } });

/** Cedar-vorm → voorwaarde in Toegangsspraak (het anker volgt uit `var`, zie ANKER_VOOR_VAR). */
const voorwaarde = (vorm, operator, extra = {}) => ({
  naam: `Conditie ${vorm} → ${operator}`,
  bij: "knoop",
  als: { aard: "conditie", vorm, ...extra },
  maak: { type: "voorwaarde", data: { operator, var: "{var}", attr: "{attr}", woorden: "{woorden}", waarde: "{waarde}", rechts: "{rechts}" } },
});

export const CEDAR_NAAR_TOEGANGSSPRAAK = {
  id: "cedar-naar-toegangsspraak",
  versie: 1,
  titel: "Cedar → Toegangsspraak",
  bron: "cedar",
  doel: "toegangsspraak",
  regels: [
    { naam: "Beleid", bij: "knoop", als: { aard: "beleid" }, maak: { type: "beleid" } },

    // ── Policies ────────────────────────────────────────────────────────────
    { naam: "Policy die nooit geldt", bij: "knoop", als: { aard: "policy", nooit: true }, maak: { type: "vervalt", data: { reden: "geldt nooit (when { false }); zonder deze policy betekent het beleid hetzelfde" } } },
    { naam: "Permit", bij: "knoop", als: { aard: "policy", effect: "permit" }, maak: { type: "regel", data: { modaliteit: "mag", volgorde: "{volgorde}" } } },
    { naam: "Forbid", bij: "knoop", als: { aard: "policy", effect: "forbid" }, maak: { type: "regel", data: { modaliteit: "mag-niet", volgorde: "{volgorde}" } } },

    // ── Scope: principal ────────────────────────────────────────────────────
    { naam: "Elke principal", bij: "knoop", als: { aard: "scope", rol: "principal", op: "All" }, maak: { type: "wie", data: { soort: "iedereen" } } },
    { naam: "Principal van een type", bij: "knoop", als: { aard: "scope", rol: "principal", op: "is", inEntiteit: { leeg: true } }, maak: { type: "wie", data: { soort: "type", type: "{cedarType}" } } },
    { naam: "Eén principal", bij: "knoop", als: { aard: "scope", rol: "principal", op: "==" }, maak: { type: "kenmerk", data: { kenmerk: "id", waarde: "{entiteit.id}", type: "{entiteit.type}" } } },
    { naam: "Principal in een groep", bij: "knoop", als: { aard: "scope", rol: "principal", op: "in" }, maak: { type: "kenmerk", data: { kenmerk: "{typeTekst}", waarde: "{entiteit.id}", type: "{entiteit.type}", groep: true } } },
    onvertaalbaar("Principal van een type in een groep", { aard: "scope", rol: "principal" }, "principal is … in …: een type én een groep in één scope kent Toegangsspraak niet"),

    // ── Scope: resource ─────────────────────────────────────────────────────
    { naam: "Elke resource", bij: "knoop", als: { aard: "scope", rol: "resource", op: "All" }, maak: { type: "wat", data: { soort: "alle-typen" } } },
    { naam: "Resource van een type", bij: "knoop", als: { aard: "scope", rol: "resource", op: "is", inEntiteit: { leeg: true } }, maak: { type: "wat", data: { soort: "type", type: "{cedarType}", woorden: "{typeWoorden}" } } },
    { naam: "Eén resource", bij: "knoop", als: { aard: "scope", rol: "resource", op: "==" }, maak: { type: "wat", data: { soort: "entiteit", type: "{entiteit.type}", woorden: "{typeWoorden}", id: "{entiteit.id}" } } },
    { naam: "Resource in een registerpad", bij: "knoop", als: { aard: "scope", rol: "resource", op: "in", cedarType: "Pad" }, maak: { type: "wat", data: { soort: "pad", pad: "{entiteit.id}" } } },
    onvertaalbaar("Resource in een entiteit", { aard: "scope", rol: "resource" }, "resource in een entiteit: Toegangsspraak kent een hiërarchie alleen als registerpad (Pad::\"…\")"),

    // ── Acties ──────────────────────────────────────────────────────────────
    { naam: "Alle acties", bij: "knoop", als: { aard: "actie", alle: true }, maak: { type: "handeling", data: { alle: true } } },
    { naam: "Een actiegroep", bij: "knoop", als: { aard: "actie", groep: true }, maak: { type: "handeling", data: { groep: "{uid}" } } },
    { naam: "Actie uit de actielijst", bij: "knoop", als: { aard: "actie" }, maak: { type: "handeling", data: { woord: "{woord}", uid: "{uid}", bekend: "{bekend}" } } },

    // ── Condities ───────────────────────────────────────────────────────────
    // Een tekstwaarde op de principal (`contains` of `==`) bepaalt wie: een kenmerk van de groep.
    { naam: "Kenmerk van de aanvrager", bij: "knoop", als: { aard: "conditie", var: "principal", vorm: ["contains", "=="], waardeSoort: "tekst", diep: false }, maak: { type: "kenmerk", data: { kenmerk: "{woordenTekst}", waarde: "{waarde.letterlijk}", attr: "{attr}" } } },
    onvertaalbaar("Unless", { aard: "conditie", vorm: "unless" }, "unless { … }: een uitzondering kent Toegangsspraak alleen als losse voorwaarde"),
    onvertaalbaar("Entiteit in een conditie", { aard: "conditie", vorm: "entiteit" }, "een vergelijking met een entiteit"),
    onvertaalbaar("Andere conditie", { aard: "conditie", vorm: "anders" }, "deze conditie (methode, extensie, rekenen, if) kent Toegangsspraak niet"),
    voorwaarde("==", "eq"),
    voorwaarde("!=", "neq"),
    voorwaarde("<", "lt"),
    voorwaarde("<=", "lteq"),
    voorwaarde(">", "gt"),
    voorwaarde(">=", "gteq"),
    voorwaarde("contains", "eq"),
    voorwaarde("containsAny", "isAnyOf"),
    voorwaarde("eenVan", "isAnyOf"),
    voorwaarde("has", "isBekend"),
    voorwaarde("!has", "isOnbekend"),
    voorwaarde("like", "begintMet", { likeSoort: "begin" }),
    voorwaarde("like", "eindigtOp", { likeSoort: "eind" }),
    voorwaarde("like", "bevat", { likeSoort: "in" }),
    { naam: "Of-groep", bij: "knoop", als: { aard: "conditiegroep" }, maak: { type: "voorwaardegroep", data: { logica: "{logica}" } } },

    ...VERBINDINGEN(["policy", "principal", "resource", "actie", "als", "lid"]),
  ],
};

export const TOEGANGSSPRAAK_NAAR_CEDAR = {
  id: "toegangsspraak-naar-cedar",
  versie: 1,
  titel: "Toegangsspraak → Cedar",
  bron: "toegangsspraak",
  doel: "cedar",
  regels: [
    { naam: "Beleid", bij: "knoop", als: { aard: "beleid" }, maak: { type: "beleid", data: { standaard: "{standaard}", conflict: "{conflict}" } } },
    { naam: "Grondslag", bij: "knoop", als: { aard: "grondslag" }, maak: { type: "vervalt", data: { reden: "de grondslag staat niet in Cedar" } } },
    { naam: "Doelbinding", bij: "knoop", als: { aard: "doel" }, maak: { type: "doel" } },

    { naam: "Toestemming", bij: "knoop", als: { aard: "regel", modaliteit: "mag" }, maak: { type: "policy", data: { effect: "permit", volgorde: "{volgorde}" } } },
    { naam: "Verbod", bij: "knoop", als: { aard: "regel", modaliteit: "mag-niet" }, maak: { type: "policy", data: { effect: "forbid", volgorde: "{volgorde}" } } },
    { naam: "Handeling", bij: "knoop", als: { aard: "handeling" }, maak: { type: "actie", data: { woord: "{actie}" } } },
    { naam: "Partij", bij: "knoop", als: { aard: "partij" }, maak: { type: "principal" } },
    { naam: "Registerdeel", bij: "knoop", als: { aard: "registerdeel" }, maak: { type: "resource", data: { pad: "{pad}" } } },
    { naam: "Gegevensbegrip", bij: "knoop", als: { aard: "gegevensbegrip" }, maak: { type: "begrip" } },

    onvertaalbaar("Voorwaarde over de betrokkene", { aard: "voorwaarde", anker: "betrokkene" }, "de betrokkene (over wie de gegevens gaan) is in Cedar geen principal, resource of context"),
    onvertaalbaar("Bestaansvraag", { aard: "voorwaarde", anker: "bestaat" }, "een bestaansvraag aan een informatiepunt kent Cedar niet"),
    onvertaalbaar("Voorwaarde op een veld in het register", { aard: "voorwaarde", anker: "veldwaarde" }, "een veld in het register (pad in het model) is in dit Cedar-model geen attribuut"),
    { naam: "Voorwaarde", bij: "knoop", als: { aard: "voorwaarde", anker: ["aanvrager", "gegevens", "aanvraag"] }, maak: { type: "conditie", data: { anker: "{anker}", subpad: "{subpad}", operator: "{operator}", waarde: "{waarde}", verwijzing: "{waardeVerwijzing}" } } },
    { naam: "Voorwaardegroep", bij: "knoop", als: { aard: "voorwaardegroep" }, maak: { type: "groep", data: { logica: "{logica}" } } },
    onvertaalbaar("Plicht", { aard: "plicht" }, "een plicht (waarbij: …) kent Cedar niet"),
    { naam: "Woordenschat", bij: "knoop", als: { aard: "term" }, negeer: true },

    ...VERBINDINGEN(["regel", "doet", "wie", "wat", "kenmerk", "als", "lid", "waarbij", "onderdeel-van", "afbakening", "waarde"]),
    { naam: "Grondslag en doel van het beleid", bij: "verbinding", als: { aard: ["grondslag", "doel"] }, negeer: true },
    { naam: "Woordenschat (zie ook, niveau)", bij: "verbinding", als: { aard: ["zie-ook", "niveau"] }, negeer: true },
  ],
};
