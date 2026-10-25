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
 */

const BESCHRIJVING = "{eigenschappen.beschrijving}";

export const CANONIEK_NAAR_OBJECTTYPE = {
  id: "canoniek-naar-objecttype",
  versie: "0.1.0",
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

    // ── Velden ──
    { naam: "Niet geselecteerd veld", bij: "knoop", als: { aard: "veld", geselecteerd: false }, negeer: true },
    {
      naam: "Veld → property",
      bij: "knoop",
      als: { aard: "veld" },
      maak: {
        type: "property",
        naam: "{tekst}",
        data: {
          type: "{eigenschappen.basistype}",
          format: "{eigenschappen.format}",
          pattern: "{eigenschappen.pattern}",
          minLength: "{eigenschappen.minLength}",
          maxLength: "{eigenschappen.maxLength}",
          enum: "{eigenschappen.enumWaarden}",
          description: BESCHRIJVING,
          verplicht: "{eigenschappen.verplicht}",
        },
      },
    },
  ],
};
