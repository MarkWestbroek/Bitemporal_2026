/**
 * Demo V3 Model — NatuurlijkPersoon/Locatie registermodel als fallback.
 *
 * Dit is het inhoudelijke V3-formaat (zoals /api/schema/model retourneert).
 * Geen plumbing: geen id, a_id, rel_id, b_id, versie, opvoer, afvoer.
 * Alleen inhoudelijke velden met Go-types.
 */
export const demoV3Model = {
  versie: "v3",
  naam: "Editor export",
  beschrijving:
    "V3 export vanuit UML editor (codegen-ready)",

  datatypes: [
    {
      naam: "NLPostcode",
      description: "Nederlandse postcode (4 cijfers + 2 letters)",
      domein: "register",
      basistype: "string",
      format: "nl-postcode",
      positie: { x: 585, y: 450 },
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
      },
    },
    {
      naam: "BSN",
      description: "Burgerservicenummer (9 cijfers, 11-proef)",
      domein: "register",
      basistype: "string",
      format: "bsn",
      positie: { x: -465, y: 90 },
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
          },
        ],
      },
      weergave: {
        placeholder: "123456782",
        inputMask: "000000000",
      },
    },
  ],

  enums: [
    {
      goType: "Bereikbaarheidssoort",
      domein: "np-loc",
      baseType: "string",
      positie: { x: 330, y: 45 },
      waarden: [
        { constNaam: "BereikbaarheidssoortWoonadres", waarde: "Woonadres" },
        { constNaam: "BereikbaarheidssoortBriefadres", waarde: "Briefadres" },
        { constNaam: "BereikbaarheidssoortCorrespondentieadres", waarde: "Correspondentieadres" },
      ],
    },
    {
      goType: "Naamgebruiksoort",
      domein: "np-loc",
      baseType: "string",
      positie: { x: 330, y: 375 },
      waarden: [
        { constNaam: "NaamgebruiksoortEigenNaam", waarde: "EigenNaam" },
        { constNaam: "NaamgebruiksoortPartnerNaam", waarde: "PartnerNaam" },
        { constNaam: "NaamgebruiksoortEigenNaamPartnerNaam", waarde: "EigenNaam-PartnerNaam" },
        { constNaam: "NaamgebruiksoortPartnerNaamEigenNaam", waarde: "PartnerNaam-EigenNaam" },
      ],
    },
  ],

  entiteiten: [
    {
      typenaam: "NatuurlijkPersoon",
      description:
        "Entiteit A met materiële tijdlijn en onderliggende representaties U, V, W en Rel_A_B.",
      isMaterieel: true,
      kleur: "#bfdbfe",
      meervoud: "natuurlijkpersoons",
      positie: { x: -90, y: -120 },
      gegevenselementen: [
        {
          naam: "PersoonsIdentificatie",
          description:
            "Enkelvoudig gegevenselement van A met formele tijdlijn.",
          meervoud: "a_us",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          positie: { x: -465, y: -30 },
          id: "NatuurlijkPersoon->NatuurlijkPersoon_PersoonsIdentificatie",
          sourceHandle: "left",
          velden: [
            { naam: "bsn", goType: "string" },
            { naam: "ingezetene", goType: "*bool" },
          ],
        },
        {
          naam: "Naam",
          description:
            "Meervoudig gegevenselement van A met onder andere een datumveld.",
          meervoud: "a_vs",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: true,
          positie: { x: -75, y: 240 },
          id: "NatuurlijkPersoon->NatuurlijkPersoon_Naam",
          velden: [
            { naam: "voorletters", goType: "string" },
            { naam: "roepnaam", goType: "*string" },
            { naam: "tussenvoegsel", goType: "*string" },
            { naam: "achternaam", goType: "string" },
          ],
        },
        {
          naam: "Burgerschap",
          description:
            "Meervoudig gegevenselement van A met numerieke waarden.",
          meervoud: "a_ws",
          momentvoorkomen: "meervoudig",
          isMaterieel: true,
          positie: { x: -315, y: 405 },
          id: "NatuurlijkPersoon->NatuurlijkPersoon_Burgerschap",
          velden: [
            { naam: "landcode", goType: "string" },
            { naam: "nationaliteit", goType: "string" },
          ],
        },
        {
          naam: "Partnernaam",
          meervoud: "partnernaams",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          positie: { x: 90, y: 435 },
          id: "edge_1774209110136_2",
          sourceHandle: "bottom",
          targetHandle: "top",
          velden: [{ naam: "achternaam", goType: "string" }],
        },
        {
          naam: "Naamgebruik",
          meervoud: "naamgebruiks",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          positie: { x: 240, y: 240 },
          id: "edge_1774209240752_5",
          sourceHandle: "bottom",
          targetHandle: "top",
          velden: [
            {
              naam: "naamgebruik",
              goType: "Naamgebruiksoort",
              enum: "Naamgebruiksoort",
            },
          ],
        },
      ],
      relaties: [
        {
          naam: "Bereikbaarheid",
          meervoud: "bereikbaarheids",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: true,
          doelEntiteit: "Locatie",
          positie: { x: 330, y: -105 },
          id: "edge_1774201942583_1",
          sourceHandle: "right",
          targetHandle: "left",
          doelId: "edge_1774201991984_2",
          doelSourceHandle: "right",
          doelTargetHandle: "left",
          velden: [
            {
              naam: "soort",
              goType: "Bereikbaarheidssoort",
              enum: "Bereikbaarheidssoort",
            },
          ],
        },
      ],
    },
    {
      typenaam: "Locatie",
      description:
        "Entiteit B met materiële tijdlijn en onderliggende representaties X en Y.",
      isMaterieel: true,
      kleur: "#fecaca",
      meervoud: "locaties",
      positie: { x: 720, y: -135 },
      gegevenselementen: [
        {
          naam: "Adres",
          description:
            "Enkelvoudig gegevenselement van B met twee tekstvelden.",
          meervoud: "b_xs",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          positie: { x: 585, y: 240 },
          id: "Locatie->Locatie_Adres",
          velden: [
            { naam: "straatnaam", goType: "string" },
            { naam: "huisnummer", goType: "string" },
            { naam: "postcode", goType: "string" },
            { naam: "plaats", goType: "string" },
          ],
        },
        {
          naam: "BAGlocatie",
          description:
            "Enkelvoudig gegevenselement van B met een tekstveld.",
          meervoud: "b_ys",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          positie: { x: 825, y: 240 },
          id: "Locatie->Locatie_BAG-locatie",
          velden: [{ naam: "adresaanduiding", goType: "string" }],
        },
      ],
      relaties: [],
    },
  ],
};
