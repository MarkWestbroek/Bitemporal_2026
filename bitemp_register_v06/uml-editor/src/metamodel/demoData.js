/**
 * Demo data — het metamodel van het bitemporele register,
 * gemodelleerd als React Flow nodes en edges.
 *
 * Dit is exact het model uit de MetaRegistry:
 *   - Entiteiten: A, B
 *   - GE's: A_U (enkelvoudig), A_V (meervoudig), A_W (meervoudig), B_X, B_Y
 *   - Relatie: Rel_A_B (meervoudig, A→B)
 *
 * Posities zijn handmatig gekozen voor een overzichtelijke layout.
 */

export const demoNodes = [
  // === Entiteiten (bovenaan) ===
  {
    id: "A",
    type: "entiteit",
    position: { x: 100, y: 50 },
    data: {
      typenaam: "A",
      description:
        "Entiteit A met materiële tijdlijn en onderliggende representaties U, V, W en Rel_A_B.",
      metatype: "entiteit",
      isMaterieel: true,
      kleur: "#bfdbfe",
      velden: [
        {
          naam: "id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: false,
        },
      ],
    },
  },
  {
    id: "B",
    type: "entiteit",
    position: { x: 700, y: 50 },
    data: {
      typenaam: "B",
      description:
        "Entiteit B met materiële tijdlijn en onderliggende representaties X en Y.",
      metatype: "entiteit",
      isMaterieel: true,
      kleur: "#fecaca",
      velden: [
        {
          naam: "id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: false,
        },
      ],
    },
  },

  // === Gegevenselementen van A ===
  {
    id: "A_U",
    type: "gegevenselement",
    position: { x: -150, y: 330 },
    data: {
      typenaam: "A_U",
      description: "Enkelvoudig gegevenselement van A met formele tijdlijn.",
      metatype: "gegevenselement",
      isMaterieel: false,
      kleur: "#dbeafe",
      velden: [
        { naam: "a_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "aaa", type: "string", format: "", verplicht: true },
        { naam: "bbb", type: "boolean", format: "", verplicht: false },
      ],
    },
  },
  {
    id: "A_V",
    type: "gegevenselement",
    position: { x: 80, y: 330 },
    data: {
      typenaam: "A_V",
      description:
        "Meervoudig gegevenselement van A met onder andere een datumveld.",
      metatype: "gegevenselement",
      isMaterieel: false,
      kleur: "#c7f9cc",
      velden: [
        { naam: "a_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "ccc", type: "string", format: "", verplicht: true },
        { naam: "ddd", type: "string", format: "", verplicht: false },
        { naam: "eee", type: "string", format: "", verplicht: false },
        { naam: "fff", type: "number", format: "float64", verplicht: true },
        {
          naam: "ggg",
          type: "string",
          format: "",
          verplicht: true,
          enum: ["Optie A", "Optie B", "Optie C"],
        },
        { naam: "datum", type: "string", format: "date", verplicht: false },
      ],
    },
  },
  {
    id: "A_W",
    type: "gegevenselement",
    position: { x: 310, y: 330 },
    data: {
      typenaam: "A_W",
      description: "Meervoudig gegevenselement van A met numerieke waarden.",
      metatype: "gegevenselement",
      isMaterieel: true,
      kleur: "#bbf7d0",
      velden: [
        { naam: "a_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "float", type: "number", format: "float64", verplicht: true },
        { naam: "heel", type: "integer", format: "", verplicht: true },
      ],
    },
  },

  // === Relatie A↔B ===
  {
    id: "Rel_A_B",
    type: "relatie",
    position: { x: 420, y: 170 },
    data: {
      typenaam: "Rel_A_B",
      description:
        "Relatie tussen A en B, meervoudig voorkomend per A en met relatieve relatie-id.",
      metatype: "relatie",
      isMaterieel: true,
      kleur: "#ede9fe",
      velden: [
        { naam: "a_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "b_id", type: "integer", format: "", verplicht: true },
        {
          naam: "soort",
          type: "string",
          format: "",
          verplicht: true,
          enum: ["LTT", "LAT", "LTA"],
        },
      ],
    },
  },

  // === Gegevenselementen van B ===
  {
    id: "B_X",
    type: "gegevenselement",
    position: { x: 620, y: 330 },
    data: {
      typenaam: "B_X",
      description: "Enkelvoudig gegevenselement van B met twee tekstvelden.",
      metatype: "gegevenselement",
      isMaterieel: false,
      kleur: "#fdba74",
      velden: [
        { naam: "b_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "fff", type: "string", format: "", verplicht: true },
        { naam: "ggg", type: "string", format: "", verplicht: true },
      ],
    },
  },
  {
    id: "B_Y",
    type: "gegevenselement",
    position: { x: 860, y: 330 },
    data: {
      typenaam: "B_Y",
      description: "Enkelvoudig gegevenselement van B met een tekstveld.",
      metatype: "gegevenselement",
      isMaterieel: false,
      kleur: "#fde68a",
      velden: [
        { naam: "b_id", type: "integer", format: "", verplicht: true },
        {
          naam: "rel_id",
          type: "integer",
          format: "",
          verplicht: true,
          autoIncrement: true,
        },
        { naam: "hhh", type: "string", format: "", verplicht: true },
      ],
    },
  },

  // === Enumeraties ===
  {
    id: "enum_RelABSoort",
    type: "enumeratie",
    position: { x: 480, y: 450 },
    data: {
      naam: "RelABSoort",
      waarden: ["LTT", "LAT", "LTA"],
    },
  },
  {
    id: "enum_ABCEnum",
    type: "enumeratie",
    position: { x: 130, y: 600 },
    data: {
      naam: "ABCEnum",
      waarden: ["Optie A", "Optie B", "Optie C"],
    },
  },

  // === Gegevenstypen (custom datatypes) ===
  {
    id: "dt_NLPostcode",
    type: "gegevenstype",
    position: { x: 700, y: 550 },
    data: {
      naam: "NLPostcode",
      description: "Nederlandse postcode (4 cijfers + 2 letters)",
      basistype: "string",
      format: "nl-postcode",
      validatie: {
        pattern: "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
        minLength: 6,
        maxLength: 7,
        voorbeelden: ["1234 AB", "9999ZZ"],
        foutmelding: "Voer een geldige postcode in (bijv. 1234 AB)",
        regels: [],
      },
      normalisatie: "uppercase_letters",
      weergave: {
        placeholder: "1234 AB",
        inputMask: "0000 AA",
        prefix: "",
        suffix: "",
      },
    },
  },
  {
    id: "dt_BSN",
    type: "gegevenstype",
    position: { x: 970, y: 550 },
    data: {
      naam: "BSN",
      description: "Burgerservicenummer (9 cijfers, 11-proef)",
      basistype: "string",
      format: "bsn",
      validatie: {
        pattern: "^[0-9]{9}$",
        minLength: 9,
        maxLength: 9,
        voorbeelden: ["123456782"],
        foutmelding: "Voer een geldig BSN in (9 cijfers, 11-proef)",
        regels: [
          {
            naam: "11-proef",
            type: "checksum",
            expressie:
              "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0",
            description:
              "De gewogen som van alle cijfers moet deelbaar zijn door 11.",
          },
        ],
      },
      normalisatie: "",
      weergave: {
        placeholder: "123456782",
        inputMask: "000000000",
        prefix: "",
        suffix: "",
      },
    },
  },
  {
    id: "dt_IBAN",
    type: "gegevenstype",
    position: { x: 1240, y: 550 },
    data: {
      naam: "IBAN",
      description: "Internationaal bankrekeningnummer (ISO 13616)",
      basistype: "string",
      format: "iban",
      validatie: {
        pattern: "^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$",
        minLength: 15,
        maxLength: 34,
        voorbeelden: ["NL91ABNA0417164300"],
        foutmelding: "Voer een geldig IBAN in",
        regels: [
          {
            naam: "IBAN-checksum",
            type: "function",
            expressie: "iban_mod97_check",
            description:
              "IBAN mod-97 controle conform ISO 13616.",
          },
        ],
      },
      normalisatie: "strip_spaces,uppercase",
      weergave: {
        placeholder: "NL91ABNA0417164300",
        inputMask: "AA00 AAAA 0000 0000 00",
        prefix: "",
        suffix: "",
      },
    },
  },
];

export const demoEdges = [
  // A → A_U (enkelvoudig)
  {
    id: "A->A_U",
    source: "A",
    target: "A_U",
    type: "metamodel",
    data: {
      rolnaam: "Us",
      jsonRolnaam: "us",
      momentvoorkomen: "enkelvoudig",
      kardinaliteit: "0..1",
    },
  },
  // A → A_V (meervoudig)
  {
    id: "A->A_V",
    source: "A",
    target: "A_V",
    type: "metamodel",
    data: {
      rolnaam: "Vs",
      jsonRolnaam: "vs",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  },
  // A → A_W (meervoudig)
  {
    id: "A->A_W",
    source: "A",
    target: "A_W",
    type: "metamodel",
    data: {
      rolnaam: "Ws",
      jsonRolnaam: "ws",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  },
  // A → Rel_A_B (meervoudig)
  {
    id: "A->Rel_A_B",
    source: "A",
    target: "Rel_A_B",
    type: "metamodel",
    data: {
      rolnaam: "RelABs",
      jsonRolnaam: "rel_abs",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  },
  // Rel_A_B → B (secondaire relatie)
  {
    id: "Rel_A_B->B",
    source: "Rel_A_B",
    sourceHandle: "right",
    target: "B",
    targetHandle: "left",
    type: "metamodel",
    data: {
      rolnaam: "→ B",
      jsonRolnaam: "b_id",
      momentvoorkomen: "meervoudig",
      kardinaliteit: "0..*",
    },
  },
  // B → B_X (enkelvoudig)
  {
    id: "B->B_X",
    source: "B",
    target: "B_X",
    type: "metamodel",
    data: {
      rolnaam: "Xs",
      jsonRolnaam: "xs",
      momentvoorkomen: "enkelvoudig",
      kardinaliteit: "0..1",
    },
  },
  // B → B_Y (enkelvoudig)
  {
    id: "B->B_Y",
    source: "B",
    target: "B_Y",
    type: "metamodel",
    data: {
      rolnaam: "Ys",
      jsonRolnaam: "ys",
      momentvoorkomen: "enkelvoudig",
      kardinaliteit: "0..1",
    },
  },
];
