// @ts-check
/**
 * umlEigenschappen — gedeelde PropertyTypes voor UML-achtige eigenschappen van
 * attributen en relaties (UML 2.5.1: §7.5 MultiplicityElement, §9.5 Property,
 * §11.5 Association), voor puur-uml, canoniek, MIM en SysML. Puur data: de
 * profielen nemen ze op in hun eigen `properties`, zodat de sleutels in alle
 * profielen hetzelfde heten.
 *
 * `betekenis: "afgeleid"` (M3, diagramcore/model/afgeleid.js) laat de motor de
 * UML-"/" tekenen, ook als een profiel de eigenschap anders noemt (MIM:
 * `indicatieAfleidbaar`).
 */

/** UML isDerived op een attribuut of relatie: berekend, niet vastgelegd. */
export const AFGELEID = { key: "afgeleid", label: "afgeleid (/)", datatype: "boolean", betekenis: "afgeleid" };

/**
 * De regel waarmee een afgeleide relatie/attribuut berekend wordt. Vrije tekst
 * (OCL, pseudocode); canoniek gebruikt zijn eigen CEL-variant.
 */
export const AFLEIDINGSREGEL = { key: "afleidingsregel", label: "afleidingsregel", datatype: "tekst", placeholder: "bijv. ouder.ouder" };

/** MIM 1.2: indicatie afleidbaar — telt voor de motor als afgeleid. */
export const MIM_AFLEIDBAAR = { key: "indicatieAfleidbaar", label: "afleidbaar", datatype: "boolean", betekenis: "afgeleid" };

// ── Kernset UML 2.5.1 Property (commit 2, 2026-10-10) ───────────────────────

/** Multipliciteit (§7.5): "1", "0..1", "0..*", "1..*". */
export const KARDINALITEIT = { key: "kardinaliteit", label: "kardinaliteit", datatype: "string", placeholder: "bijv. 0..*", betekenis: "kardinaliteit" };
/** isOrdered — {ordered}; default false. */
export const GEORDEND = { key: "geordend", label: "geordend {ordered}", datatype: "boolean", betekenis: "geordend" };
/** isUnique = false — {nonunique}; UML-default is uniek, dus alleen de uitzondering bewaren. */
export const NIET_UNIEK = { key: "nietUniek", label: "niet uniek {nonunique}", datatype: "boolean", betekenis: "nietUniek" };
/** isReadOnly — {readOnly}. */
export const ALLEEN_LEZEN = { key: "alleenLezen", label: "alleen lezen {readOnly}", datatype: "boolean", betekenis: "alleenLezen" };
/** isID — {id}: identificeert een instantie van de klasse (§9.5.3). */
export const IS_ID = { key: "isId", label: "identificerend {id}", datatype: "boolean", betekenis: "id" };
/** defaultValue — "= waarde". */
export const STANDAARDWAARDE = { key: "standaardwaarde", label: "standaardwaarde", datatype: "string", betekenis: "standaardwaarde" };
/** visibility — + - # ~ (de waarden zoals EA ze schrijft). */
export const ZICHTBAARHEID = {
  key: "zichtbaarheid",
  label: "zichtbaarheid",
  datatype: "keuze",
  betekenis: "zichtbaarheid",
  opties: [
    { waarde: "", label: "(niet getoond)" },
    { waarde: "Public", label: "+ public" },
    { waarde: "Private", label: "- private" },
    { waarde: "Protected", label: "# protected" },
    { waarde: "Package", label: "~ package" },
  ],
};

/** De volledige set voor een attribuut (naam en type staan in het profiel zelf). */
export const ATTRIBUUT_KERNSET = [KARDINALITEIT, STANDAARDWAARDE, ZICHTBAARHEID, GEORDEND, NIET_UNIEK, ALLEEN_LEZEN, IS_ID, AFGELEID];

// ── Associatie-uiteinden ─────────────────────────────────────────────────────

/** Navigeerbaarheid van een uiteinde: ja (pijl), nee (×), niet gespecificeerd (niets). */
const NAVIGEERBAAR_OPTIES = [
  { waarde: "", label: "(niet gespecificeerd)" },
  { waarde: "ja", label: "ja (pijl)" },
  { waarde: "nee", label: "nee (×)" },
];

/**
 * Properties van één associatie-uiteinde (UML: een Property dat eigendom is
 * van de associatie of de klasse). Platte sleutels per kant, zoals de rest van
 * de profielen: `bronRolNaam`, `doelKardinaliteit`, `doelNavigeerbaar`, ….
 * @param {"bron"|"doel"} kant
 */
export function uiteinde(kant) {
  const t = kant === "bron" ? "bron" : "doel";
  return [
    { key: `${t}RolNaam`, label: `rolnaam (${t})`, datatype: "string" },
    { key: `${t}Kardinaliteit`, label: `kardinaliteit (${t})`, datatype: "string", placeholder: "bijv. 0..*" },
    { key: `${t}Navigeerbaar`, label: `navigeerbaar (${t})`, datatype: "keuze", opties: NAVIGEERBAAR_OPTIES },
    { key: `${t}Geordend`, label: `geordend {ordered} (${t})`, datatype: "boolean" },
    { key: `${t}NietUniek`, label: `niet uniek {nonunique} (${t})`, datatype: "boolean" },
    { key: `${t}AlleenLezen`, label: `alleen lezen {readOnly} (${t})`, datatype: "boolean" },
  ];
}

/**
 * Navigeerbaarheid van een kant, met migratie van het oude `directioneel`
 * (gericht → doel): `directioneel: true` leest als doel "ja", bron niet
 * gespecificeerd. Een expliciete waarde wint altijd.
 * @param {Record<string, any>|null|undefined} data
 * @param {"bron"|"doel"} kant
 * @returns {""|"ja"|"nee"}
 */
export function navigeerbaar(data, kant) {
  const d = data || {};
  const expliciet = d[`${kant}Navigeerbaar`];
  if (expliciet === "ja" || expliciet === "nee") return expliciet;
  if (kant === "doel" && (d.directioneel === true || d.unidirectioneel === true)) return "ja";
  return "";
}

/**
 * Pijlpunten voor navigeerbaarheid: doel "ja" → open pijl, "nee" → ×; bron
 * idem aan het begin. Een vaste bron-marker van het connectortype (de ruit van
 * aggregatie/compositie) gaat voor: die zit op dezelfde plek.
 * @param {{data?: Record<string, any>}} conn
 * @param {{markerStart?: string|null}} [basis] - de statische edgePresentatie van het type
 */
export function navigatiePresentatie(conn, basis = {}) {
  const uit = {};
  const doel = navigeerbaar(conn?.data, "doel");
  const bron = navigeerbaar(conn?.data, "bron");
  if (doel === "ja") uit.markerEnd = "pijl-open";
  else if (doel === "nee") uit.markerEnd = "kruisje";
  if (!basis.markerStart) {
    if (bron === "ja") uit.markerStart = "pijl-open";
    else if (bron === "nee") uit.markerStart = "kruisje";
  }
  return uit;
}

/**
 * Labels aan de uiteinden: rolnaam, kardinaliteit en {ordered, nonunique,
 * readOnly}; voor de kale en de box-gedaante (bron/doel) gelijk.
 * @param {{data?: Record<string, any>}} conn
 */
export function uiteindeLabels(conn) {
  const d = conn?.data || {};
  const kaal = [];
  for (const kant of ["bron", "doel"]) {
    const delen = [];
    if (d[`${kant}RolNaam`]) delen.push({ tekst: d[`${kant}RolNaam`], soort: "rolnaam" });
    if (d[`${kant}Kardinaliteit`]) delen.push({ tekst: d[`${kant}Kardinaliteit`], soort: "kardinaliteit" });
    const eig = [
      d[`${kant}Geordend`] ? "ordered" : "",
      d[`${kant}NietUniek`] ? "nonunique" : "",
      d[`${kant}AlleenLezen`] ? "readOnly" : "",
    ].filter(Boolean);
    if (eig.length) delen.push({ tekst: `{${eig.join(", ")}}`, soort: "constraint" });
    if (delen.length) kaal.push({ zijde: kant, delen });
  }
  return { kaal, bron: kaal.filter((l) => l.zijde === "bron"), doel: kaal.filter((l) => l.zijde === "doel") };
}
