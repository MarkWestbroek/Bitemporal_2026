// @ts-check
/**
 * objecttypeRegels — de **regelset** "canoniek model → objecttype (JSON Schema)".
 *
 * Bron: het graafbeeld van een V3-model met de keuzes van één e-dienst-
 * artefact (`transformatie/v3Graaf.js`): `aard` = wortel | ge |
 * relatie-ingebed | veld, `geselecteerd` en `meervoudig` als vlaggen, en de
 * opgeloste V3-feiten onder `eigenschappen`. Doel: het vocabulaire van de
 * JSON-schemaschrijver (`transformatie/jsonSchemaSchrijver.js`):
 * schema | object | array | property, met JSON-Schema-sleutelwoorden als data.
 *
 * Wat hier níét staat: welke velden een e-dienst kiest, hoe een relatie of een
 * referentielijst in het doel verschijnt, de metadata van het objecttype —
 * dat zijn keuzes van de e-dienst (aanvraag-edienst.json), niet van de taal.
 * Deze regelset geldt voor élk canoniek model (M2, §9.0).
 *
 * Een enkelvoudig GE is in het canonieke model een groepering, geen object in
 * het doel: de regel negeert de groep en de toepasser hangt de velden een
 * niveau hoger (regels.js, stap 4). Een meervoudig GE wordt een array van
 * objecten met de meervoudsnaam van het GE. De beschrijving van een GE gaat
 * níét mee: die beschrijft de groepering en de modelkeuze ("gegevenselement,
 * geen entiteit: …") en is voor de modelleur, niet voor wie het schema leest;
 * de beschrijvingen van velden en relaties zijn dat wel.
 *
 * 0.2.0 (27-10): overerving en relaties met velden.
 * - Een **ouder** (V3 `erft`) is, net als een enkelvoudig GE, geen object in
 *   het doel: de geërfde velden staan in het schema van het subtype. Eén
 *   objecttype per specialisatie (besluit Mark 27-10).
 * - Het **doel van een ingebedde relatie** wordt een eigen object (met de
 *   naam van de doel-entiteit, `partij`) als de relatie zelf velden heeft,
 *   zoals de rol bij AanvraagPartij: een item is dan {partijrol, partij}. Een
 *   relatie zonder velden houdt de vorm van 0.1.0: de velden van het doel
 *   staan in het relatie-object. De regelset kiest níét één partij op rol
 *   (bv. "de aanvrager"): dat is een keuze op M0-waarden, die hoort niet in
 *   een regelset die voor elk model geldt; een meervoudige relatie wordt een
 *   lijst.
 * - Een **veld binnen het doel** van een relatie is nooit `required`: V3 kent
 *   geen verplicht GE, en de GE's van een doel kunnen elkaar uitsluiten
 *   (precies één "is"-GE per Partij). Voor de eigen GE's van de bron blijft
 *   `verplicht` → `required`. Gevolg voor het oude aanvraag-v1-model: het
 *   ingebedde `aanvrager` verliest `required: ["naam"]`.
 *
 * 0.3.0: een **optioneel veld mag leeg zijn**. Een string die niet verplicht
 * is en een patroon, formaat, minimumlengte of enum heeft, krijgt
 * `anyOf: [{const: ""}, {…eisen…}]`. Open Formulieren (4.0.3, objects_api v2)
 * laat een leeg of verborgen gekoppeld veld niet weg maar stuurt "" (kenteken
 * bij soort ≠ bestuurder), en Open Object weigerde dat tegen het patroon.
 */

const BESCHRIJVING = "{eigenschappen.beschrijving}";

/** JSON-Schema-sleutelwoorden van een veld; de schrijver laat lege weg. */
const VELD_DATA = {
  type: "{eigenschappen.basistype}",
  format: "{eigenschappen.format}",
  pattern: "{eigenschappen.pattern}",
  minLength: "{eigenschappen.minLength}",
  maxLength: "{eigenschappen.maxLength}",
  enum: "{eigenschappen.enumWaarden}",
  description: BESCHRIJVING,
  // Optioneel = mag ook leeg (""); de schrijver doet dat alleen bij een veld
  // dat niet verplicht is en eisen heeft (0.3.0, besluit Mark 27-10).
  leegToegestaan: true,
};

export const CANONIEK_NAAR_OBJECTTYPE = {
  id: "canoniek-naar-objecttype",
  versie: "0.3.0",
  titel: "Canoniek model → objecttype (JSON Schema)",
  bron: "canoniek-uml (V3)",
  doel: "json-schema",
  regels: [
    // ── De bron-entiteit wordt het schema ──
    {
      naam: "Schema uit de bron-entiteit",
      bij: "groep",
      als: { aard: "wortel" },
      maak: { type: "schema", naam: "{tekst}", data: { $schema: "https://json-schema.org/draft/2020-12/schema", additionalProperties: false } },
    },

    // ── Overerving: de velden van de ouder in het schema van het subtype ──
    { naam: "Ouder (erft) → velden in het schema van het subtype", bij: "groep", als: { aard: "ouder" }, negeer: true },

    // ── Gegevenselementen ──
    { naam: "GE zonder geselecteerde velden", bij: "groep", als: { aard: "ge", geselecteerd: false }, negeer: true },
    {
      naam: "Meervoudig GE → array van objecten",
      bij: "groep",
      als: { aard: "ge", meervoudig: true },
      maak: { type: "array", naam: "{eigenschappen.meervoud}", data: { additionalProperties: false } },
    },
    { naam: "Enkelvoudig GE → velden in het omvattende object", bij: "groep", als: { aard: "ge" }, negeer: true },

    // ── Relaties die de e-dienst inbedt ──
    { naam: "Ingebedde relatie zonder geselecteerde velden", bij: "groep", als: { aard: "relatie-ingebed", geselecteerd: false }, negeer: true },
    {
      naam: "Meervoudige ingebedde relatie → array van objecten",
      bij: "groep",
      als: { aard: "relatie-ingebed", meervoudig: true },
      maak: { type: "array", naam: "{tekst}", data: { description: BESCHRIJVING, verplicht: "{eigenschappen.verplicht}", additionalProperties: false } },
    },
    {
      naam: "Ingebedde relatie → object",
      bij: "groep",
      als: { aard: "relatie-ingebed" },
      maak: { type: "object", naam: "{tekst}", data: { description: BESCHRIJVING, verplicht: "{eigenschappen.verplicht}", additionalProperties: false } },
    },

    { naam: "Doel zonder geselecteerde velden", bij: "groep", als: { aard: "doel", geselecteerd: false }, negeer: true },
    {
      naam: "Doel van een relatie met velden → object naast die velden",
      bij: "groep",
      als: { aard: "doel", metVelden: true },
      // Elk voorkomen van de relatie heeft precies één doel.
      maak: { type: "object", naam: "{tekst}", data: { verplicht: true, additionalProperties: false } },
    },
    { naam: "Doel van een relatie zonder velden → velden in het relatie-object", bij: "groep", als: { aard: "doel" }, negeer: true },

    // ── Velden ──
    { naam: "Niet geselecteerd veld", bij: "knoop", als: { aard: "veld", geselecteerd: false }, negeer: true },
    {
      // V3 kent geen verplicht GE: `verplicht` op een veld geldt binnen zijn
      // GE. Voor de eigen GE's van de bron is dat ook verplicht in het schema
      // (het objecttype gaat over die entiteit); binnen een ingebed doel niet:
      // de GE's daar kunnen elkaar uitsluiten (de "is"-GE's van een Partij).
      naam: "Veld van het doel van een relatie → property, niet verplicht",
      bij: "knoop",
      als: { aard: "veld", inDoel: true },
      maak: { type: "property", naam: "{tekst}", data: { ...VELD_DATA, verplicht: false } },
    },
    {
      naam: "Veld → property",
      bij: "knoop",
      als: { aard: "veld" },
      maak: { type: "property", naam: "{tekst}", data: { ...VELD_DATA, verplicht: "{eigenschappen.verplicht}" } },
    },
  ],
};
