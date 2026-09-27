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

import { CONFIG_SCHEMAS } from "./configSchemas.js";
import { valideerSchema } from "./schemaValidatie.js";

export const INVOERSOORT = Object.freeze({
  TEKST: "tekst",
  GETAL: "getal",
  DATUM: "datum",
  JA_NEE: "ja-nee",
  EEN_UIT_LIJST: "een-uit-lijst",
  MEER_UIT_LIJST: "meer-uit-lijst",
  /** Een vaste set rijen (bv. de drie bijdragen) met per rij één uit dezelfde lijst (schaal). */
  EEN_PER_RIJ: "een-uit-lijst-per-rij",
  /** Een groep velden die samen één ding zijn (periode: begin + einde; adres: straat, nummer, …). */
  SAMENGESTELD: "samengesteld",
});

const { TEKST, GETAL, DATUM, JA_NEE, EEN_UIT_LIJST, MEER_UIT_LIJST, EEN_PER_RIJ, SAMENGESTELD } = INVOERSOORT;

/** XForms-control per invoersoort (voor de documentatie en een eventuele export). */
export const XFORMS_CONTROL = Object.freeze({
  [TEKST]: "input",
  [GETAL]: "input",
  [DATUM]: "input",
  [JA_NEE]: "select1",
  [EEN_UIT_LIJST]: "select1",
  [MEER_UIT_LIJST]: "select",
  [EEN_PER_RIJ]: "repeat + select1",
  [SAMENGESTELD]: "group",
});

/**
 * De vormen (de bibliotheek). Per vorm:
 *  - invoersoorten: welke inhoud de vorm kan bedienen (de matrix inhoud × vorm);
 *  - modi: "invoer" en/of "weergave" (een invoervorm in alleen-lezen is ook een weergave);
 *  - xforms: de dichtstbijzijnde XForms-appearance;
 *  - version, help: zoals Imprint-widgets;
 *  - configSchema: het schema van vormConfig (configSchemas.js), of null.
 * Geordend = de vorm vraagt een lijst met een betekenisvolle volgorde (enum-volgorde of getal).
 */
const IO = ["invoer", "weergave"];
const W = ["weergave"];
const v = (label, invoersoorten, xforms, help, extra = {}) =>
  Object.freeze({ label, invoersoorten, xforms, help, modi: IO, version: "1.0.0", configSchema: CONFIG_SCHEMAS[extra.naam] || null, ...extra });

export const VORMEN = Object.freeze({
  "text-input":     v("Invoerveld", [TEKST, GETAL, DATUM], "input", "Eén regel tekst, een getal of een datum."),
  "text-area":      v("Tekstvak", [TEKST], "textarea", "Meerdere regels tekst."),
  "json":           v("JSON-editor", [TEKST], "textarea (eigen)", "Code-editor met JSON-controle."),
  "markdown":       v("Markdown-editor", [TEKST], "textarea (eigen)", "Code-editor voor markdown."),
  "select":         v("Keuzelijst", [EEN_UIT_LIJST, JA_NEE], 'appearance="minimal"', "Uitklaplijst."),
  "radio-group":    v("Keuzerondjes", [EEN_UIT_LIJST, JA_NEE], 'appearance="full"', "Alle opties zichtbaar, één kiezen."),
  "checkbox-group": v("Vinkjes", [MEER_UIT_LIJST], 'appearance="full"', "Alle opties zichtbaar, meerdere kiezen."),
  "combobox":       v("Zoeken en kiezen", [EEN_UIT_LIJST, MEER_UIT_LIJST], 'appearance="minimal" + zoeken', "Typen en filteren; voor lange lijsten."),
  "image-map":      v("Klikbare afbeelding", [EEN_UIT_LIJST, MEER_UIT_LIJST], "eigen appearance", "Gebieden op een afbeelding aanklikken.", { naam: "image-map" }),
  "button-group":   v("Knoppenvlak", [EEN_UIT_LIJST, MEER_UIT_LIJST], "eigen appearance (knoppen)", "Afgeronde knoppen, klik-klik aan en uit.", { naam: "button-group" }),
  "cards":          v("Keuzekaarten", [EEN_UIT_LIJST, MEER_UIT_LIJST], "eigen appearance (kaarten)", "Kaarten met icoon, titel en uitleg.", { naam: "cards" }),
  "nl-map":         v("Kaart van Nederland", [EEN_UIT_LIJST, MEER_UIT_LIJST], "eigen appearance (kaart)", "Gemeenten als stip op de kaart; aanklikken of tonen.", { naam: "nl-map" }),
  "switch":         v("Schuifschakelaar", [JA_NEE], 'appearance="full" (toggle)', "Aan/uit, zoals een schakelaar op een module.", { naam: "switch" }),
  "range":          v("Schuif", [GETAL, EEN_UIT_LIJST], "range", "Schuif over een schaal, eventueel met kleurverloop.", { naam: "range", geordend: true }),
  "rotary":         v("Draaiknop", [GETAL, EEN_UIT_LIJST], "range (eigen)", "Draaiknop met klikstanden.", { naam: "rotary", geordend: true }),
  "stepper":        v("Stappenbalk", [EEN_UIT_LIJST], "range (eigen)", "Stappen op een rij; de huidige gemarkeerd.", { naam: "stepper", geordend: true }),
  "rating-grid":    v("Matrix", [EEN_PER_RIJ], 'repeat + select1 appearance="full"', "Per rij één keuze uit dezelfde schaal.", { naam: "rating-grid" }),
  "drag-sort":      v("Sorteren in manden", [EEN_PER_RIJ], "repeat + select1 (slepen)", "Dingen uit een voorraad naar manden slepen.", { naam: "drag-sort" }),
  "period":         v("Periode", [SAMENGESTELD], "group (eigen)", "Begin en einde als balk op een tijdlijn.", { naam: "period" }),
  "address-search": v("Adres zoeken", [SAMENGESTELD], "group (eigen)", "Eén zoekveld (PDOK) dat alle adresvelden vult.", { naam: "address-search" }),
  "scale-bars":     v("Schaalbalken", [EEN_PER_RIJ], "output (eigen)", "Per rij een balk op de schaal, met toelichting.", { naam: "scale-bars", modi: W }),
  "chips":          v("Labels", [MEER_UIT_LIJST, EEN_UIT_LIJST], "output", "De gekozen waarden als labels.", { naam: "chips", modi: W }),
  // Vormen die uit een datatype volgen (27-09): het datatype zegt wat de inhoud is, de vorm hoe.
  "masked":         v("Invoermasker", [TEKST], "input (masker)", "Invoer volgens een masker (postcode 0000 AA); letterlijke tekens verschijnen vanzelf.", { naam: "masked" }),
  "partial-date":   v("Onvolledige datum", [TEKST, DATUM], "group (eigen)", "Jaar, maand en dag; maand en dag mogen onbekend zijn (DatumIncompleet).", { naam: "partial-date" }),
  "duration":       v("Tijdsduur", [TEKST], "group (eigen)", "Jaren, maanden, dagen … als losse getallen; opgeslagen als ISO 8601 (P1Y2M).", { naam: "duration" }),
  "number-stepper": v("Plus-min", [GETAL], "range (knoppen)", "Een getal met − en + knoppen, binnen min en max.", { naam: "number-stepper" }),
});

/**
 * De vorm die een DATATYPE zelf meebrengt, als de ontwerper niets kiest: het datatype zegt
 * wat de inhoud is, en voor sommige inhoud ligt de vorm vast (DatumIncompleet → partial-date,
 * Duur → duration). Een invoermasker niet: dat is een hulp, geen keuze (en een masker als
 * dat van IBAN is land-specifiek). Anders de weergave-hint van het datatype, of null.
 */
export function vormUitDatatype(datatype) {
  if (!datatype) return null;
  if (datatype.format === "date-incomplete" || datatype.naam === "DatumIncompleet") return "partial-date";
  if (datatype.format === "duration" || datatype.naam === "Duur") return "duration";
  return datatype.weergave?.widget || null;
}

/** Is de vorm (ook) een weergavevorm? */
export function isWeergaveVorm(naam) {
  return Boolean(VORMEN[normaliseerVorm(naam)]?.modi.includes("weergave"));
}

/** Fouten in een vormConfig volgens het configSchema van de vorm ([] = in orde of geen schema). */
export function valideerVormConfig(naam, config) {
  const vorm = VORMEN[normaliseerVorm(naam)];
  if (!vorm) return [`onbekende vorm: ${naam}`];
  if (!vorm.configSchema || config == null) return [];
  return valideerSchema(config, vorm.configSchema);
}

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

/** Kan deze vorm deze invoersoort bedienen, in deze modus ("invoer" of "weergave")? Onbekende vormen: nee. */
export function vormPastBij(vorm, invoersoort, modus = "invoer") {
  const v = VORMEN[normaliseerVorm(vorm)];
  return Boolean(v && v.invoersoorten.includes(invoersoort) && v.modi.includes(modus));
}

/** Vormen die een invoersoort kunnen bedienen in een modus (keuzelijst in de Studio-inspector). */
export function vormenVoor(invoersoort, modus = "invoer") {
  return Object.entries(VORMEN)
    .filter(([, v]) => v.invoersoorten.includes(invoersoort) && v.modi.includes(modus))
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
  // Opslag als lijst in één veld (datatype met scheiding, bv. EnumLijst: "Laag 1;Laag 2"):
  // de inhoud is meer uit een lijst, alleen de opslag verschilt van rijen.
  if (veld.lijstScheiding && isLijstKeuze) return MEER_UIT_LIJST;
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
 * Lijst in één veld (OPSLAG, de laag onder de inhoud): "Laag 1; Laag 2" ↔ ["Laag 1", "Laag 2"].
 * Spaties rond de delen en lege delen vallen weg, dubbele tellen één keer (zoals
 * model.SplitsLijstwaarde in Go).
 */
export function splitsLijst(waarde, scheiding = ";") {
  if (Array.isArray(waarde)) return [...new Set(waarde.map((w) => String(w).trim()).filter(Boolean))];
  if (waarde == null || waarde === "") return [];
  return [...new Set(String(waarde).split(scheiding).map((w) => w.trim()).filter(Boolean))];
}

/**
 * Sleutels → één veldwaarde. In de volgorde van `volgorde` (de enum), zodat dezelfde keuze
 * altijd dezelfde tekst oplevert, ongeacht de klikvolgorde; onbekende waarden achteraan.
 */
export function voegLijstSamen(sleutels, scheiding = ";", volgorde = []) {
  const set = splitsLijst(sleutels);
  const pos = (w) => { const i = volgorde.indexOf(w); return i < 0 ? Infinity : i; };
  return set.map((w, i) => [w, i]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(([w]) => w).join(scheiding);
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
