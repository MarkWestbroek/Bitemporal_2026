// @ts-check
/**
 * m3 — het M3 (metametamodel) van Omnium als gegevens (plan docs/plans/2026-11-15 M3 en
 * projectmetamodel als modellen in Omnium; besluiten Mark 15-11).
 *
 * Bron voor het alleen-lezen model "Omnium M3" (puur-uml), dat `scripts/genereer-metamodellen.mjs`
 * hieruit maakt. De code blijft de implementatie; dit bestand beschrijft haar, en de controletests
 * houden beide gelijk:
 *   - `m3.test.js`: elke `@typedef` in schema.js is hier een metaklasse met precies dezelfde
 *     eigenschappen; optioneel ↔ ondergrens 0; een type `"a"|"b"` ↔ een enumeratie met die waarden;
 *     HookSoort = de hooks in handlerCatalogus.js;
 *   - `render-svc/m3Dekking.test.mjs`: elke sleutel die een echt profiel (alle 26) gebruikt, staat
 *     hier, en elke hook staat op de juiste metaklasse.
 *
 * Wat hier staat en wat niet:
 *   - **structuur**: pakket, type, kardinaliteit, en of een eigenschap een operatie is (code);
 *   - **uitleg** alleen voor wat géén typedef heeft; voor de rest leest de generator de
 *     beschrijving uit schema.js (leesTypedefs.js), zodat die op één plek blijft;
 *   - **enumeraties** komen uit de code waar die een lijst heeft (AARD_*, VORMBOOM_TAGS,
 *     LAYOUT_RENDERERS, SUPERPROFIEL_IDS, de hooks); anders uit de letterlijke typen van schema.js.
 *
 * Een eigenschap waarvan het type een metaklasse is, is in UML een **associatie** (Mark 15-11);
 * de generator tekent hem zo. Pakketten volgen de boundaries van het EA-Metametamodel ("Editor"):
 * Definitie, Stijl, Implementatie.
 */
import { AARD_CONNECTOR, AARD_ELEMENT, LAYOUT_RENDERERS } from "./layoutStijl.js";
import { VORMBOOM_TAGS } from "./shapeType.js";
import { SUPERPROFIEL_IDS } from "./superprofiel.js";
import { handlersVan } from "./handlerCatalogus.js";

/** @typedef {"Definitie"|"Stijl"|"Implementatie"} M3Pakket */
/**
 * @typedef {Object} M3Eigenschap
 * @property {string} naam
 * @property {string} type     - primitief (PRIMITIEVEN), een metaklasse of een enumeratie
 * @property {string} kard     - "1" | "0..1" | "*" | "1..*" | "0..9"
 * @property {boolean} [operatie] - code (een functie), geen gegevens; `kard` is dan die van het resultaat
 * @property {boolean} [optioneel] - bij een operatie: het profiel mag hem weglaten
 * @property {string} [params] - bij een operatie: de parameters, als tekst
 * @property {string} [sleutel] - een map: de sleutel (bv. "elementtype-id"); de waarde is `type`
 * @property {boolean} [samenstelling] - het geheel bezit de delen (UML-compositie)
 * @property {string} [uitleg] - alleen waar schema.js geen beschrijving heeft
 */
/**
 * @typedef {Object} M3Klasse
 * @property {string} naam
 * @property {M3Pakket} pakket
 * @property {"klasse"|"datatype"} soort - datatype = een waarde zonder eigen identiteit
 * @property {boolean|"functie"} typedef - true: komt uit een `@typedef {Object}` in schema.js met
 *   deze naam; "functie": een functie-typedef (geen eigenschappen); false: niet in schema.js
 * @property {string} [uitleg] - bij typedef false (anders uit schema.js)
 * @property {string} [bron]   - waar het in de code leeft, als dat niet schema.js is
 * @property {M3Eigenschap[]} eigenschappen
 */
/**
 * @typedef {Object} M3Enumeratie
 * @property {string} naam
 * @property {M3Pakket} pakket
 * @property {string[]} waarden
 * @property {Record<string, string>} [uitlegPerWaarde]
 * @property {string} uitleg
 * @property {string} [bron]
 */

export const M3_PAKKETTEN = /** @type {const} */ ([
  { naam: "Definitie", uitleg: "Wat een profiel zegt: de soorten elementen, velden, eigenschappen en verbindingen (betekenis)." },
  { naam: "Stijl", uitleg: "Hoe het eruitziet, als gegevens: vormen, gedaanten, lijnen en de layoutstijl." },
  { naam: "Implementatie", uitleg: "De code achter de gegevens: renderers, resolvers, editors en hooks; op id gekoppeld, nooit geserialiseerd." },
]);

/** Primitieve typen; al het andere is een metaklasse of enumeratie. */
export const PRIMITIEVEN = ["string", "boolean", "number", "any", "functie"];

/** Eigenschap: naam, type, kardinaliteit, extra's. */
const e = (naam, type, kard = "0..1", extra = {}) => ({ naam, type, kard, ...extra });
/** Operatie (code). */
const op = (naam, params, type, kard = "1", extra = {}) => ({ naam, type, kard, operatie: true, params, ...extra });
/** Samenstelling (het geheel bezit de delen). */
const deel = (naam, type, kard = "*") => ({ naam, type, kard, samenstelling: true });

/** @type {M3Klasse[]} */
export const M3_KLASSEN = [
  // ── Definitie ──────────────────────────────────────────────────────────────────────────────
  {
    naam: "DiagramType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string", "1"),
      e("versie", "string"),
      e("oudeBeschrijvingSleutels", "string", "*"),
      e("assistent", "AssistentAanwijzing"),
      e("style", "StyleType", "1"),
      deel("shapeTypes", "ShapeType"),
      deel("shapeSets", "ShapeSet"),
      e("hooks", "Hook", "*"),
      e("hierarchie", "HierarchieStap", "*"),
      e("typeWeergave", "TypeWeergave"),
      e("randAanhechting", "RandAanhechting"),
      deel("elementTypes", "ElementType", "1..*"),
      deel("fieldTypes", "FieldType"),
      deel("referenceTypes", "ReferenceType"),
      e("referenceResolvers", "ReferenceResolver", "*", { sleutel: "ReferenceType-id" }),
      deel("taakbalken", "TaskbarType"),
      deel("layouts", "LayoutStrategie"),
      e("leesvolgorde", "Leesvolgorde"),
      e("superprofiel", "SuperprofielKeuze", "*", { sleutel: "SuperprofielType" }),
      e("hernoemdeTypen", "string", "*", { sleutel: "oud elementtype-id" }),
      e("facetten", "Facet", "*"),
      deel("layoutStijlen", "LayoutStijl"),
      e("meerdereVoorkomens", "boolean"),
      e("serialisatie", "Serialisatie"),
      op("menus", "ctx", "any", "*", { optioneel: true }),
    ],
  },
  {
    naam: "ElementType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string", "1"),
      e("lidwoord", "Lidwoord"),
      e("erft", "ElementType"),
      e("verwijstNaar", "boolean"),
      e("beschrijving", "boolean"),
      e("isAbstract", "boolean"),
      e("omschrijving", "string"),
      e("shape", "ShapeType", "1"),
      e("stereotype", "string"),
      e("naamLabel", "NaamLabel"),
      e("kleur", "string"),
      e("randDikte", "number"),
      e("hoekRadius", "number"),
      e("hoekStijl", "HoekStijl"),
      e("icoon", "string"),
      e("randStijl", "RandStijl"),
      e("handleStijl", "HandleStijl"),
      e("omtrek", "Omtrek"),
      e("aanhechtpunten", "Aanhechtpunten"),
      e("randAanhechting", "RandAanhechting"),
      e("verwijderen", "Verwijderen"),
      e("inPalet", "boolean"),
      e("resizebaar", "boolean"),
      e("minBreedte", "number"),
      e("minHoogte", "number"),
      e("achtergrond", "boolean"),
      e("sleeptInhoudMee", "boolean"),
      e("meerdereVoorkomens", "boolean"),
      e("kort", "string"),
      e("taakbalkGroep", "string"),
      e("isConnector", "boolean"),
      e("aard", "Aard"),
      e("facetten", "string", "*", { sleutel: "facet-naam" }),
      e("containerVoor", "ElementType", "*"),
      e("afbakeningVoor", "ElementType", "*"),
      e("overbrugt", "ElementType", "*"),
      e("randElement", "RandElement"),
      e("gedragsVerwijzing", "boolean"),
      e("uitwerking", "boolean"),
      e("samentrekking", "Samentrekking"),
      e("opname", "Opname"),
      e("standaardDichtInBoom", "boolean"),
      deel("bron", "ConnectorEindpunt", "0..1"),
      deel("doel", "ConnectorEindpunt", "0..1"),
      deel("verbindingsregels", "Verbindingsregel"),
      e("layoutDimensie", "LayoutDimensie"),
      e("edgePresentatie", "EdgePresentatie"),
      deel("properties", "PropertyType"),
      deel("compartments", "CompartmentType", "0..9"),
      e("hooks", "Hook", "*"),
    ],
  },
  {
    naam: "ConnectorEindpunt",
    pakket: "Definitie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("elementTypes", "ElementType", "1..*"), e("kardinaliteiten", "string", "*")],
  },
  {
    naam: "Verbindingsregel",
    pakket: "Definitie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("bron", "ConnectorEindpunt", "1"), e("doel", "ConnectorEindpunt", "1")],
  },
  {
    naam: "CompartmentType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string"),
      e("fieldType", "FieldType", "1"),
      e("alleenWeergave", "boolean"),
      e("verbergInInspector", "boolean"),
    ],
  },
  {
    naam: "FieldType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("viewer", "FieldTypeViewer", "1"),
      deel("properties", "PropertyType"),
      e("afgeleid", "boolean"),
    ],
  },
  {
    naam: "PropertyType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("key", "string", "1"),
      e("label", "string"),
      e("datatype", "string"),
      e("opties", "KeuzeOptie", "*"),
      e("verplicht", "boolean"),
      e("placeholder", "string"),
      e("zichtbaarAls", "ZichtbaarAls"),
      e("referenceTypes", "ReferenceType", "*"),
      e("aard", "Aard"),
      e("koppelsoort", "string"),
      e("betekenis", "Betekenis"),
    ],
  },
  {
    naam: "ReferenceType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [e("id", "string", "1"), e("label", "string", "1"), e("icoon", "string")],
  },
  {
    naam: "ActionType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [e("id", "string", "1"), e("label", "string", "1"), e("icoon", "string"), e("shortcut", "string")],
  },
  {
    naam: "TaskbarType",
    pakket: "Definitie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string"),
      e("acties", "ActionType", "1..*", { uitleg: "Een expliciete lijst, of een afleidingsregel: \"elementTypes\", \"connectorTypes\" of \"layouts\"." }),
    ],
  },
  {
    naam: "RandElement",
    pakket: "Definitie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("ouderTypes", "ElementType", "1..*"), e("klem", "Klem")],
  },
  {
    naam: "Samentrekking",
    pakket: "Definitie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [
      e("gedaante", "string", "1"),
      e("relatieTypes", "ElementType", "1..*"),
      e("labelIngeklapt", "string"),
      e("labelUitgeklapt", "string"),
    ],
  },
  {
    naam: "Opname",
    pakket: "Definitie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [
      e("gedaante", "string", "1"),
      e("relatieTypes", "ElementType", "1..*"),
      e("compartiment", "CompartmentType"),
      e("labelIngebed", "string"),
      e("labelLos", "string"),
    ],
  },
  {
    naam: "KeuzeOptie",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Eén waarde van een eigenschap met datatype \"keuze\" (PropertyType.opties).",
    eigenschappen: [e("waarde", "string", "1"), e("label", "string", "1")],
  },
  {
    naam: "ZichtbaarAls",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Voorwaardelijk tonen in de inspector (M3, 27-10): pas zichtbaar als eigenschap `key` aan staat, of gelijk is aan `waarde`. Zie model/zichtbaarAls.js.",
    eigenschappen: [e("key", "string", "1"), e("waarde", "any")],
  },
  {
    naam: "HierarchieStap",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Eén connectortype dat de ouder-kindrelatie in de elementenboom vormt (DiagramType.hierarchie); `omgekeerd` als de pijl naar de ouder wijst. Een kale id is een stap zonder omkering.",
    eigenschappen: [e("type", "ElementType", "1"), e("omgekeerd", "boolean")],
  },
  {
    naam: "Facet",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Een indeling van de typen van een profiel met geordende waarden (DiagramType.facetten), bv. laag: motivatie, strategie, business, … (ArchiMate).",
    eigenschappen: [e("naam", "string", "1"), e("waarden", "string", "1..*")],
  },
  {
    naam: "SuperprofielKeuze",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Het superprofiel (notitie, constraint, notitielijn, diagramverwijzing) erft elk profiel; per type mag een profiel alleen het palet uitzetten. Zie types/superprofiel.js.",
    bron: "diagramcore/types/superprofiel.js",
    eigenschappen: [e("type", "SuperprofielType", "1"), e("inPalet", "boolean")],
  },
  {
    naam: "AssistentAanwijzing",
    pakket: "Definitie",
    soort: "datatype",
    typedef: false,
    uitleg: "Voor de AI-assistent (14-10): modelleerregels voor de prompt en de toegestane [bron, doel]-paren per connector. Zie studio/assistent/assistentKern.js.",
    eigenschappen: [e("aanwijzingen", "string", "*"), e("paren", "string", "*", { sleutel: "connector-id" })],
  },

  // ── Stijl ──────────────────────────────────────────────────────────────────────────────────
  {
    naam: "StyleType",
    pakket: "Stijl",
    soort: "klasse",
    typedef: false,
    uitleg: "De stijlfamilie van een profiel (DiagramType.style): het thema waarin de vormen en lijnen getekend worden. Nu alleen een id.",
    eigenschappen: [e("id", "string", "1")],
  },
  { naam: "ShapeType", pakket: "Stijl", soort: "klasse", typedef: true, bron: "diagramcore/types/shapeType.js",
    eigenschappen: [
      e("id", "string", "1"),
      e("renderer", "ShapeRenderer", "1"),
      e("parameters", "any"),
      e("minMaat", "Maat"),
      e("ankers", "Ankers"),
    ] },
  {
    naam: "ShapeSet",
    pakket: "Stijl",
    soort: "klasse",
    typedef: true,
    bron: "diagramcore/model/shapeSet.js",
    eigenschappen: [e("id", "string", "1"), e("label", "string", "1"), e("shapes", "ShapeType", "1..*", { sleutel: "elementtype-id" })],
  },
  {
    naam: "EdgePresentatie",
    pakket: "Stijl",
    soort: "datatype",
    typedef: true,
    eigenschappen: [
      e("lijn", "string"),
      e("vorm", "string"),
      e("kleur", "string"),
      e("dikte", "number"),
      e("markerStart", "string"),
      e("markerEnd", "string"),
      e("labels", "any"),
      e("labelsBoven", "boolean"),
      e("verbergBijNesting", "boolean"),
    ],
  },
  {
    naam: "LayoutStijl",
    pakket: "Stijl",
    soort: "klasse",
    typedef: true,
    bron: "diagramcore/types/layoutStijl.js",
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string"),
      e("renderer", "LayoutRenderer", "1"),
      e("richting", "Richting"),
      e("alleenStroom", "boolean"),
      e("rijen", "string"),
      e("kolommen", "string"),
      e("secundairAchteraan", "boolean"),
      e("secundairUit", "string"),
      e("maxPerRij", "number"),
      e("kaderKolommen", "number"),
      e("afstanden", "Afstanden"),
      deel("regels", "LayoutRegel"),
    ],
  },
  {
    naam: "LayoutRegel",
    pakket: "Stijl",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("selector", "LayoutSelector", "1"), e("opties", "LayoutOpties", "1")],
  },
  {
    naam: "LayoutSelector",
    pakket: "Stijl",
    soort: "datatype",
    typedef: false,
    uitleg: "Wat een LayoutRegel kiest, van algemeen (aard) naar specifiek (type-id), zoals CSS.",
    eigenschappen: [
      e("aard", "Aard"),
      e("elementType", "ElementType"),
      e("connectorType", "ElementType"),
      e("erft", "ElementType"),
      e("facet", "string", "*", { sleutel: "facet-naam" }),
    ],
  },
  {
    naam: "LayoutOpties",
    pakket: "Stijl",
    soort: "datatype",
    typedef: false,
    uitleg: "Wat een LayoutRegel zegt: voor connectoren de leesvolgorde, voor elementen begin/eind en baan.",
    eigenschappen: [e("volgorde", "Volgorde"), e("positie", "Positie"), e("baan", "boolean")],
  },
  {
    naam: "Afstanden",
    pakket: "Stijl",
    soort: "datatype",
    typedef: false,
    uitleg: "Afstanden van een LayoutStijl in px.",
    eigenschappen: [e("laag", "number"), e("dwars", "number"), e("baan", "number"), e("marge", "number")],
  },
  {
    naam: "Maat",
    pakket: "Stijl",
    soort: "datatype",
    typedef: false,
    uitleg: "Breedte en hoogte in px.",
    eigenschappen: [e("w", "number", "1"), e("h", "number", "1")],
  },

  // ── Implementatie ──────────────────────────────────────────────────────────────────────────
  {
    naam: "ShapeRenderer",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: true,
    bron: "diagramcore/types/shapeType.js",
    eigenschappen: [
      op("omtrek", "ctx: ShapeContext", "VormBoom"),
      op("inhoudsvak", "ctx: ShapeContext", "Vak", "0..1"),
      op("kindervak", "ctx: ShapeContext", "Vak", "1", { optioneel: true }),
      op("ornament", "ctx: ShapeContext", "VormBoom", "1", { optioneel: true }),
      op("rand", "ctx: ShapeContext, hoek: number", "Punt", "1", { optioneel: true }),
      op("maat", "p", "Maat", "0..1", { optioneel: true }),
      op("ondergrens", "p", "Maat", "0..1", { optioneel: true }),
      op("bovengrens", "p", "Maat", "0..1", { optioneel: true }),
      e("leestDiagram", "boolean"),
    ],
  },
  {
    naam: "ShapeContext",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [
      e("element", "any", "1"),
      e("elementType", "ElementType", "1"),
      e("shapeType", "ShapeType", "1"),
      e("maat", "Maat", "1"),
      e("stijl", "OpgelosteStijl", "1"),
      e("node", "any"),
      e("diagram", "any", "1"),
      e("elementen", "any"),
      e("thema", "any"),
      e("inhoud", "InhoudsMaat"),
      e("idPrefix", "string", "1"),
    ],
  },
  {
    naam: "OpgelosteStijl",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: false,
    uitleg: "De stijl zoals de motor hem oplost (losStijlOp): element wint van type, type van thema.",
    eigenschappen: [e("kleur", "string"), e("randDikte", "number"), e("hoekRadius", "number"), e("randStijl", "string")],
  },
  {
    naam: "InhoudsMaat",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: false,
    uitleg: "De door de motor gemeten inhoud: hoogte en de breedte die hij minimaal wil.",
    eigenschappen: [e("h", "number", "1"), e("minW", "number", "1")],
  },
  {
    naam: "Punt",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: false,
    uitleg: "Een punt in coördinaten van het element.",
    eigenschappen: [e("x", "number", "1"), e("y", "number", "1")],
  },
  {
    naam: "VormBoom",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("tag", "VormBoomTag", "1"), e("attrs", "string", "*", { sleutel: "attribuut" }), e("kinderen", "VormBoom", "*")],
  },
  {
    naam: "Vak",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [
      e("x", "number", "1"),
      e("y", "number", "1"),
      e("w", "number", "1"),
      e("h", "number", "1"),
      e("uitlijning", "Uitlijning"),
      e("rotatie", "number"),
      e("tekstAnker", "TekstAnker"),
    ],
  },
  {
    naam: "InhoudsRegel",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("delen", "InhoudsDeel", "1..*"), e("divider", "boolean"), e("anker", "TekstAnker"), e("grootte", "number")],
  },
  {
    naam: "InhoudsDeel",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: false,
    uitleg: "Een stuk van een InhoudsRegel; `veld` = de data-sleutel voor inline bewerken, `soort` bv. badge, mono, tekst.",
    eigenschappen: [e("tekst", "string", "1"), e("soort", "string"), e("kleur", "string"), e("veld", "string"), e("vet", "boolean")],
  },
  {
    naam: "VerwijzingsKandidaat",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    eigenschappen: [e("waarde", "string", "1"), e("label", "string", "1"), e("icoon", "string"), e("groep", "string"), e("pad", "string", "*")],
  },
  {
    naam: "ReferenceResolver",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: "functie",
    eigenschappen: [op("kandidaten", "ctx: {elements, element?, veld?}", "VerwijzingsKandidaat", "*", { uitleg: "Levert de keuzekandidaten voor een verwijzings-property (de resolver ís deze functie)." })],
  },
  {
    naam: "LayoutStrategie",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: true,
    eigenschappen: [
      e("id", "string", "1"),
      e("label", "string", "1"),
      e("kort", "string"),
      op("run", "invoer: {flowNodes, flowEdges, selectieIds, elements, diagram}", "any"),
      e("stijl", "LayoutStijl"),
    ],
  },
  {
    naam: "Leesvolgorde",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: true,
    bron: "diagramcore/layout/leesvolgorde.js",
    eigenschappen: [
      e("richting", "LeesRichting"),
      e("stroom", "ElementType", "*"),
      e("omgekeerd", "ElementType", "*"),
      e("negeer", "ElementType", "*"),
      e("start", "ElementType", "*"),
      e("eind", "ElementType", "*"),
      e("banen", "ElementType", "*"),
      e("lagen", "string", "*", { uitleg: "Vaste lagen: per laag een lijst element-typen." }),
      e("secundairAchteraan", "boolean"),
      e("kaderKolommen", "number"),
      e("maxPerRij", "number"),
      e("secundairUit", "string"),
      e("minimaal", "Maat", "*", { sleutel: "elementtype-id" }),
    ],
  },
  {
    naam: "Hook",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: false,
    uitleg: "Een functie van het profiel op een vaste plek in de motor (DiagramType.hooks, ElementType.hooks); op naam gekoppeld, nooit geserialiseerd. De soorten en hun uitleg: HookSoort (handlerCatalogus.js).",
    bron: "diagramcore/types/handlerCatalogus.js",
    eigenschappen: [e("soort", "HookSoort", "1")],
  },
  {
    naam: "PropertyTypeEditor",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: false,
    uitleg: "De invoer in de inspector voor een PropertyType-datatype (registry datatype → editor); profielen kunnen datatypes toevoegen (bv. \"cel-expressie\").",
    bron: "diagramcore/inspector/propertyTypeEditors.jsx",
    eigenschappen: [e("datatype", "string", "1")],
  },
  {
    naam: "ActionHook",
    pakket: "Implementatie",
    soort: "klasse",
    typedef: false,
    uitleg: "De uitvoering van een ActionType (frontend-code), gekoppeld op het id van de actie.",
    eigenschappen: [e("actie", "ActionType", "1")],
  },
  {
    naam: "Serialisatie",
    pakket: "Implementatie",
    soort: "datatype",
    typedef: false,
    uitleg: "Eigen lezen en schrijven van een profiel (DiagramType.serialisatie), bv. V3 voor canoniek-uml.",
    eigenschappen: [op("exporteer", "staat", "any", "1", { optioneel: true }), op("importeer", "bestand", "any", "1", { optioneel: true })],
  },
];

/** De hooks uit de catalogus, met hun plek en uitleg. */
const HOOKS = handlersVan("hook");

/** @type {M3Enumeratie[]} */
export const M3_ENUMERATIES = [
  // Definitie
  {
    naam: "Aard",
    pakket: "Definitie",
    waarden: [...AARD_ELEMENT, ...AARD_CONNECTOR],
    uitleg: "De betekenis van een type (M3, 18-10): voor een element " + AARD_ELEMENT.join(", ") + "; voor een connector " + AARD_CONNECTOR.join(", ") + ".",
    bron: "diagramcore/types/layoutStijl.js (AARD_ELEMENT, AARD_CONNECTOR)",
  },
  { naam: "Betekenis", pakket: "Definitie", waarden: ["afgeleid", "kardinaliteit", "standaardwaarde", "geordend", "nietUniek", "alleenLezen", "id", "zichtbaarheid", "beschrijving", "verwijzing"], uitleg: "Wat een PropertyType betekent voor de motor, los van zijn naam (UML 2.5.1 Property)." },
  { naam: "SuperprofielType", pakket: "Definitie", waarden: [...SUPERPROFIEL_IDS], uitleg: "De typen van het superprofiel, die elk profiel erft.", bron: "diagramcore/types/superprofiel.js (SUPERPROFIEL_IDS)" },
  { naam: "Lidwoord", pakket: "Definitie", waarden: ["de", "het"], uitleg: "Lidwoord bij het label; bepaalt de startnaam van een nieuw element." },
  { naam: "NaamLabel", pakket: "Definitie", waarden: ["binnen", "buiten", "geen"], uitleg: "Waar de naam van een element staat." },
  { naam: "Verwijderen", pakket: "Definitie", waarden: ["diagram", "model"], uitleg: "Wat Delete bij een connector doet." },
  { naam: "LayoutDimensie", pakket: "Definitie", waarden: ["x", "y", "xy"], uitleg: "In welke richting een element op het canvas beweegt." },
  { naam: "Klem", pakket: "Definitie", waarden: ["rand", "as"], uitleg: "Waar een rand-element vastklikt." },
  { naam: "TypeWeergave", pakket: "Definitie", waarden: ["geen", "icoon", "tekst"], uitleg: "Standaard voor de Typering-knop: alleen vorm, mini-icoon of stereotype-tekst." },
  // Stijl
  { naam: "RandAanhechting", pakket: "Stijl", waarden: ["zijden", "zwevend"], uitleg: "Waar een connector aan een element vastpakt." },
  { naam: "Omtrek", pakket: "Stijl", waarden: ["rechthoek", "ruit", "ellips"], uitleg: "De echte omtrek voor zwevende aanhechting." },
  { naam: "Aanhechtpunten", pakket: "Stijl", waarden: ["toppen", "snijpunt"], uitleg: "Waar een zwevende lijn een ellips of ruit raakt." },
  { naam: "RandStijl", pakket: "Stijl", waarden: ["dashed"], uitleg: "Gestippelde rand: inhoud elders beheerd." },
  { naam: "HoekStijl", pakket: "Stijl", waarden: ["afgeschuind"], uitleg: "Afgeschuinde hoeken (ArchiMate motivation)." },
  { naam: "HandleStijl", pakket: "Stijl", waarden: ["standaard", "onzichtbaar"], uitleg: "Aansluitpunten tonen of niet." },
  { naam: "Ankers", pakket: "Stijl", waarden: ["rechthoek", "rand"], uitleg: "Waar lijnen aan een ShapeType aanhechten." },
  { naam: "Richting", pakket: "Stijl", waarden: ["TB", "LR", "BT", "RL"], uitleg: "Leesrichting van een LayoutStijl." },
  { naam: "Volgorde", pakket: "Stijl", waarden: ["mee", "omgekeerd", "negeer"], uitleg: "Hoe een connector de leesvolgorde bepaalt." },
  { naam: "Positie", pakket: "Stijl", waarden: ["begin", "eind"], uitleg: "Een element vooraan of achteraan in de leesvolgorde." },
  // Implementatie
  {
    naam: "HookSoort",
    pakket: "Implementatie",
    waarden: HOOKS.map((h) => h.id),
    uitlegPerWaarde: Object.fromEntries(HOOKS.map((h) => [h.id, `${h.naam} (op ${h.plek || "ElementType"}). ${h.beschrijving}`])),
    uitleg: "De hooks die de motor kent, met hun plek; een profiel zet ze in `hooks`.",
    bron: "diagramcore/types/handlerCatalogus.js",
  },
  { naam: "FieldTypeViewer", pakket: "Implementatie", waarden: ["naam-type", "tekst", "waarde", "sub-vak"], uitleg: "De compacte rij-weergave van een veld op de node." },
  { naam: "LayoutRenderer", pakket: "Implementatie", waarden: [...LAYOUT_RENDERERS], uitleg: "Het algoritme achter een LayoutStijl.", bron: "diagramcore/types/layoutStijl.js (LAYOUT_RENDERERS)" },
  { naam: "LeesRichting", pakket: "Implementatie", waarden: ["TB", "LR"], uitleg: "Richting van het Leesvolgorde-formaat." },
  { naam: "VormBoomTag", pakket: "Implementatie", waarden: [...VORMBOOM_TAGS], uitleg: "De SVG-tags die een VormBoom mag gebruiken.", bron: "diagramcore/types/shapeType.js (VORMBOOM_TAGS)" },
  { naam: "Uitlijning", pakket: "Implementatie", waarden: ["boven", "midden"], uitleg: "Inhoud bovenaan of in het midden van een Vak." },
  { naam: "TekstAnker", pakket: "Implementatie", waarden: ["midden", "links"], uitleg: "Horizontale uitlijning van tekst." },
];

/** Opzoeken op naam. */
export const m3Klasse = (naam) => M3_KLASSEN.find((k) => k.naam === naam);
export const m3Enumeratie = (naam) => M3_ENUMERATIES.find((k) => k.naam === naam);
