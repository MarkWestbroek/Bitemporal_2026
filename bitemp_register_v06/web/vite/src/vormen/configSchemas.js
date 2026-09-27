/**
 * configSchemas.js — per vorm het schema van zijn `vormConfig` (JSON Schema, subset van
 * draft 2020-12). Dit is het "vormconfiguratietype" uit het ontwerp (§9b): wat een vorm aan
 * instellingen kent. Gebruikt door valideerVormConfig (schemaValidatie.js), en later door de
 * Studio-inspector (formulier uit het schema) en Imprint (appearanceConfig = widget-config).
 *
 * Sleutels zijn Engels: vormConfig is een met Imprint gedeeld contract.
 * `x-omschrijving` = Nederlandse uitleg voor de inspector.
 */

const kleur = { type: "string", pattern: "^(#[0-9A-Fa-f]{3,8}|var\\(--[a-z0-9-]+(, *[^)]+)?\\))$", "x-omschrijving": "hexkleur of CSS-variabele" };
const optieLijst = (extra = {}) => ({
  type: "array",
  items: {
    anyOf: [
      { type: "string" },
      { type: "object", required: ["value"], properties: { value: { type: "string" }, label: { type: "string" }, ...extra } },
    ],
  },
});

export const CONFIG_SCHEMAS = {
  "image-map": {
    type: "object",
    required: ["image", "areas"],
    properties: {
      image: { type: "string", minLength: 1, "x-omschrijving": "URL of pad van de afbeelding (svg/png)" },
      alt: { type: "string" },
      units: { enum: ["fraction", "px"], default: "fraction" },
      width: { type: "number", exclusiveMinimum: 0 },
      height: { type: "number", exclusiveMinimum: 0 },
      areas: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["value", "shape", "coords"],
          properties: {
            value: { type: ["string", "number"] },
            label: { type: "string" },
            shape: { enum: ["rect", "circle", "poly", "ellipse"] },
            coords: { type: "array", minItems: 3, items: { type: "number" } },
          },
        },
      },
      legend: { type: "boolean", default: true },
      accentColor: kleur,
      maxWidth: { type: ["string", "number"] },
    },
  },
  "rating-grid": {
    type: "object",
    properties: {
      rowField: { type: "string" },
      columnField: { type: "string" },
      rows: optieLijst({ description: { type: "string" } }),
      columns: optieLijst({ color: kleur }),
      required: { type: "boolean" },
    },
  },
  "button-group": {
    type: "object",
    properties: {
      sort: { enum: ["alpha", "order", "none"], default: "alpha" },
      sortToggle: { type: "boolean", default: false },
      orderLabel: { type: "string" },
      minWidth: { type: "integer", minimum: 40, maximum: 400, default: 104 },
    },
  },
  switch: {
    type: "object",
    properties: {
      onLabel: { type: "string", default: "Ja" },
      offLabel: { type: "string", default: "Nee" },
      accentColor: kleur,
    },
  },
  range: {
    type: "object",
    properties: {
      min: { type: "number" },
      max: { type: "number" },
      step: { type: "number", exclusiveMinimum: 0 },
      labels: { type: "object", "x-omschrijving": "waarde → label onder de schuif, bv. { \"1\": \"klein\" }" },
      colors: { type: "array", items: kleur, "x-omschrijving": "kleurverloop; één kleur per stap of twee (van–tot)" },
      showValue: { type: "boolean", default: true },
    },
  },
  rotary: {
    type: "object",
    properties: {
      min: { type: "number" },
      max: { type: "number" },
      step: { type: "number", exclusiveMinimum: 0 },
      sweep: { type: "number", minimum: 90, maximum: 330, default: 270, "x-omschrijving": "draaibereik in graden" },
      size: { type: "integer", minimum: 48, maximum: 240, default: 96 },
      accentColor: kleur,
    },
  },
  cards: {
    type: "object",
    properties: {
      items: {
        type: "object",
        "x-omschrijving": "per optiewaarde: { icon, title, description, image }",
        additionalProperties: {
          type: "object",
          properties: { icon: { type: "string" }, title: { type: "string" }, description: { type: "string" }, image: { type: "string" } },
        },
      },
      columns: { type: "integer", minimum: 1, maximum: 6 },
      minWidth: { type: "integer", minimum: 80, maximum: 480, default: 180 },
    },
  },
  "drag-sort": {
    type: "object",
    properties: {
      rowField: { type: "string", "x-omschrijving": "het veld van de dingen die gesorteerd worden (de voorraad)" },
      columnField: { type: "string", "x-omschrijving": "het veld dat de mand bepaalt" },
      rows: optieLijst(),
      columns: optieLijst({ color: kleur, description: { type: "string" } }),
      stockLabel: { type: "string", default: "Nog te sorteren" },
    },
  },
  period: {
    type: "object",
    required: ["startField", "endField"],
    properties: {
      startField: { type: "string", "x-omschrijving": "vol veldpad van de begindatum" },
      endField: { type: "string", "x-omschrijving": "vol veldpad van de einddatum" },
      startLabel: { type: "string" },
      endLabel: { type: "string" },
      today: { type: "boolean", default: true, "x-omschrijving": "vandaag markeren op de tijdlijn" },
    },
  },
  "address-search": {
    type: "object",
    required: ["fields"],
    properties: {
      fields: {
        type: "object",
        "x-omschrijving": "PDOK-veld → vol veldpad, bv. { \"straatnaam\": \"Locatie.adres.straatnaam\" }",
        additionalProperties: { type: "string" },
      },
      service: { type: "string", default: "https://api.pdok.nl/bzk/locatieserver/search/v3_1" },
      placeholder: { type: "string" },
    },
  },
  "nl-map": {
    type: "object",
    properties: {
      codeField: { type: "string", default: "code", "x-omschrijving": "veld van het referentielijst-item met de CBS-code (GM0344)" },
      provinces: { type: "boolean", default: true },
      places: { type: "boolean", default: true, "x-omschrijving": "woonplaatsen van de gemeente tonen" },
      maxWidth: { type: ["string", "number"] },
      accentColor: kleur,
    },
  },
  stepper: {
    type: "object",
    properties: {
      labels: { type: "object", "x-omschrijving": "waarde → korte stapnaam" },
      accentColor: kleur,
    },
  },
  "scale-bars": {
    type: "object",
    properties: {
      rowField: { type: "string" },
      columnField: { type: "string" },
      rows: optieLijst({ description: { type: "string" } }),
      columns: optieLijst({ color: kleur }),
      noteField: { type: "string", "x-omschrijving": "veld met de toelichting per rij" },
    },
  },
  chips: {
    type: "object",
    properties: { accentColor: kleur },
  },
  // Vormen die uit een datatype volgen (27-09).
  masked: {
    type: "object",
    properties: {
      mask: { type: "string", minLength: 1, "x-omschrijving": "0 = cijfer, A = letter (hoofdletter), a = letter, * = letter of cijfer, \ = volgende teken letterlijk; de rest letterlijk. Leeg = weergave.inputMask van het datatype" },
      keepLiterals: { type: "boolean", default: false, "x-omschrijving": "letterlijke tekens (spatie, koppelteken) mee opslaan" },
    },
  },
  "partial-date": {
    type: "object",
    properties: {
      unknownStyle: { enum: ["kort", "nullen"], default: "kort", "x-omschrijving": "onbekend weglaten (1975-06) of als 00 (1975-06-00)" },
      minYear: { type: "number" },
      maxYear: { type: "number" },
    },
  },
  duration: {
    type: "object",
    properties: {
      units: {
        type: "array", minItems: 1,
        items: { enum: ["jaren", "maanden", "weken", "dagen", "uren", "minuten", "seconden"] },
        "x-omschrijving": "welke eenheden als invoerveld (standaard jaren, maanden, dagen)",
      },
    },
  },
  "number-stepper": {
    type: "object",
    properties: {
      min: { type: "number" },
      max: { type: "number" },
      step: { type: "number", exclusiveMinimum: 0, default: 1 },
      unit: { type: "string", "x-omschrijving": "eenheid achter het getal, bv. 'personen'" },
    },
  },
};
