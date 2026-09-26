/**
 * vormen.js — scheiding tussen INHOUD en VORM van een invoer (ontwerp:
 * docs/plans/2026-09-26 Invoersoort en vorm (ontwerp).md).
 *
 *  - invoersoort = de inhoud: wát wordt ingevoerd (tekst, datum, één uit een lijst, …).
 *                  Volgt uit het model; een formulierontwerper kiest hem niet.
 *                  Tegenhanger van de abstracte controls van XForms (input, select1, select, …).
 *  - vorm        = hoe de invoer eruitziet en zich gedraagt (keuzelijst, rondjes, combobox,
 *                  klikbare afbeelding, …). Kiest de ontwerper met `vorm` op een veld of lijst.
 *                  Tegenhanger van XForms `appearance`; in Imprint heet de sleutel `appearance`.
 *
 * De vormnamen zijn een GEDEELDE woordenlijst (Omnium, Imprint): Engelse kebab-case,
 * ontleend aan NL Design System / ARIA / HTML. Labels in de UI zijn Nederlands.
 * Een vorm verandert nooit de data: `image-map` op een meer-uit-lijst levert dezelfde
 * rijen op als `checkbox-group`.
 *
 * Puur (geen React) — testbaar met node --test (vormen.test.js).
 */

export const INVOERSOORT = Object.freeze({
  TEKST: "tekst",
  GETAL: "getal",
  DATUM: "datum",
  JA_NEE: "ja-nee",
  EEN_UIT_LIJST: "een-uit-lijst",
  MEER_UIT_LIJST: "meer-uit-lijst",
  /** Een vaste set rijen (bv. de drie bijdragen) met per rij één uit dezelfde lijst (schaal). */
  EEN_PER_RIJ: "een-uit-lijst-per-rij",
});

const { TEKST, GETAL, DATUM, JA_NEE, EEN_UIT_LIJST, MEER_UIT_LIJST, EEN_PER_RIJ } = INVOERSOORT;

/** XForms-control per invoersoort (voor de documentatie en een eventuele export). */
export const XFORMS_CONTROL = Object.freeze({
  [TEKST]: "input",
  [GETAL]: "input",
  [DATUM]: "input",
  [JA_NEE]: "select1",
  [EEN_UIT_LIJST]: "select1",
  [MEER_UIT_LIJST]: "select",
  [EEN_PER_RIJ]: "repeat + select1",
});

/**
 * De vormen. `invoersoorten` = welke inhoud de vorm kan bedienen; `xforms` = de
 * dichtstbijzijnde XForms-appearance; `config` = of de vorm een `vormConfig` vraagt.
 */
export const VORMEN = Object.freeze({
  "text-input":     { label: "Invoerveld",           invoersoorten: [TEKST, GETAL, DATUM], xforms: "input" },
  "text-area":      { label: "Tekstvak",             invoersoorten: [TEKST],               xforms: "textarea" },
  "json":           { label: "JSON-editor",          invoersoorten: [TEKST],               xforms: "textarea (eigen)" },
  "markdown":       { label: "Markdown-editor",      invoersoorten: [TEKST],               xforms: "textarea (eigen)" },
  "select":         { label: "Keuzelijst",           invoersoorten: [EEN_UIT_LIJST, JA_NEE], xforms: 'appearance="minimal"' },
  "radio-group":    { label: "Keuzerondjes",         invoersoorten: [EEN_UIT_LIJST, JA_NEE], xforms: 'appearance="full"' },
  "checkbox-group": { label: "Vinkjes",              invoersoorten: [MEER_UIT_LIJST],      xforms: 'appearance="full"' },
  "combobox":       { label: "Zoeken en kiezen",     invoersoorten: [EEN_UIT_LIJST, MEER_UIT_LIJST], xforms: 'appearance="minimal" + zoeken' },
  "image-map":      { label: "Klikbare afbeelding",  invoersoorten: [EEN_UIT_LIJST, MEER_UIT_LIJST], xforms: "eigen appearance", config: true },
  "button-group":   { label: "Knoppenvlak",          invoersoorten: [EEN_UIT_LIJST, MEER_UIT_LIJST], xforms: "eigen appearance (knoppen)" },
  "rating-grid":    { label: "Matrix",               invoersoorten: [EEN_PER_RIJ],         xforms: 'repeat + select1 appearance="full"', config: true },
});

/**
 * Oude `widget`-waarden → vorm. `meerkeuze` op een lijst zegt vooral iets over de
 * INHOUD (meer uit een lijst); de vorm volgt dan uit de keuzebron (zie standaardVorm).
 */
const WIDGET_ALIAS = Object.freeze({
  radio: "radio-group",
  textarea: "text-area",
  json: "json",
  markdown: "markdown",
});

/** Vormnaam normaliseren: oude widget-namen worden vormnamen; onbekend blijft onbekend. */
export function normaliseerVorm(naam) {
  if (!naam) return null;
  const n = String(naam).trim();
  return WIDGET_ALIAS[n] || n;
}

/** Kan deze vorm deze invoersoort bedienen? Onbekende vormen: nee. */
export function vormPastBij(vorm, invoersoort) {
  const v = VORMEN[normaliseerVorm(vorm)];
  return Boolean(v && v.invoersoorten.includes(invoersoort));
}

/** Vormen die een invoersoort kunnen bedienen (voor de keuzelijst in de Studio-inspector). */
export function vormenVoor(invoersoort) {
  return Object.entries(VORMEN)
    .filter(([, v]) => v.invoersoorten.includes(invoersoort))
    .map(([naam, v]) => ({ naam, label: v.label }));
}

/**
 * Invoersoort van één veld uit het model. `meervoudig` = het veld is het keuzeveld
 * van een lijst die als meer-uit-lijst getoond wordt (geen rijen-lijst).
 */
export function invoersoortVanVeld(veld, { meervoudig = false } = {}) {
  if (!veld) return null;
  const isLijstKeuze = (Array.isArray(veld.enum) && veld.enum.length > 0) || Boolean(veld.ref) || Boolean(veld.doelEntiteit);
  if (meervoudig) return isLijstKeuze ? MEER_UIT_LIJST : null;
  if (String(veld.type) === "boolean") return JA_NEE;
  if (isLijstKeuze) return EEN_UIT_LIJST;
  if (veld.type === "integer" || veld.type === "number") return GETAL;
  if (veld.format === "date" || veld.format === "date-time") return DATUM;
  return TEKST;
}

/**
 * De vorm van een lijst-element in de layout: null = gewone lijst met rijen (blokken);
 * anders een meer-uit-lijst-vorm, of `rating-grid` (één uit een lijst per rij). `vorm` wint van het oude `widget: "meerkeuze"`.
 */
export function lijstVorm(lijst) {
  if (!lijst) return null;
  if (lijst.vorm) return normaliseerVorm(lijst.vorm);
  if (lijst.widget === "meerkeuze") return "meerkeuze"; // standaardvorm volgt uit de keuzebron
  return null;
}

/**
 * Meer-uit-lijst → lijstrijen. Elke vorm (vinkjes, chips, image-map) levert alleen een
 * set gekozen sleutels; deze functie maakt daar de rijen van, zodat de DATA niet van de
 * vorm afhangt. Rijen van andere lijsten op dezelfde bron (buiten `eigenIdx`) blijven
 * ongemoeid; bestaande rijen die gekozen blijven, blijven dezelfde rij (geen afvoer+opvoer).
 *
 * @param {Array}    alle      alle rijen van de bron
 * @param {number[]} eigenIdx  indices van de rijen die bij deze lijst horen (vaste-waardenfilter)
 * @param {string}   veld      het keuzeveld (relatief), bv. "gemeente_id"
 * @param {Object}   vast      vaste waarden van de lijst, gaan mee in nieuwe rijen
 * @param {Array}    sleutels  de nieuwe keuze
 */
export function keuzesNaarRijen(alle, eigenIdx, veld, vast, sleutels) {
  const eigen = new Set(eigenIdx);
  const nieuw = [...new Set((sleutels || []).map(String).filter(Boolean))];
  const nieuwSet = new Set(nieuw);
  const huidig = new Set();
  const blijft = (alle || []).filter((r, j) => {
    if (!eigen.has(j)) return true;
    const k = String(r?.[veld] ?? "");
    huidig.add(k);
    return nieuwSet.has(k);
  });
  const erbij = nieuw.filter((k) => !huidig.has(k)).map((k) => ({ ...vast, [veld]: k }));
  return [...blijft, ...erbij];
}

/**
 * Standaardvorm voor een invoersoort + keuzebron, als de ontwerper niets kiest.
 * Dit is het huidige gedrag van SchemaFormField / CustomFormulierRenderer.
 */
export function standaardVorm(invoersoort, veld = {}) {
  const isRef = Boolean(veld.ref || veld.doelEntiteit);
  switch (invoersoort) {
    case EEN_UIT_LIJST: return isRef ? "combobox" : "select";
    case MEER_UIT_LIJST: return isRef ? "combobox" : "checkbox-group";
    case JA_NEE: return "radio-group";
    default: return "text-input";
  }
}

/**
 * Effectieve vorm voor een veld: expliciete vorm, anders de (oude) widget, anders de
 * weergave-hint van het datatype, anders de standaard. Een vorm die niet bij de
 * invoersoort past, valt terug op de standaard (een foute layout breekt het formulier niet).
 */
export function effectieveVorm({ vorm, widget, datatypeWidget } = {}, veld, opties = {}) {
  const soort = invoersoortVanVeld(veld, opties);
  const gekozen = normaliseerVorm(vorm) || normaliseerVorm(widget) || normaliseerVorm(datatypeWidget);
  if (gekozen && vormPastBij(gekozen, soort)) return gekozen;
  // Datatype-hints als "color"/"currency" zijn (nog) geen geregistreerde vormen; laat ze door.
  if (gekozen && !VORMEN[gekozen]) return gekozen;
  return standaardVorm(soort, veld);
}
