/**
 * Demo V3 Model — hetzelfde registermodel als demoData.js,
 * maar dan in het hiërarchische V3-formaat (zoals /api/schema/model retourneert).
 *
 * Geen plumbing: geen id, a_id, rel_id, b_id, versie, opvoer, afvoer.
 * Alleen inhoudelijke velden met Go-types.
 */
export const demoV3Model = {
  versie: "v3",
  naam: "Demo Register",
  beschrijving:
    "Demonstratiemodel met entiteiten A en B, gegevenselementen en een relatie.",

  enums: [
    {
      goType: "RelABSoort",
      baseType: "string",
      waarden: [
        { constNaam: "RelABSoortLTT", waarde: "LTT" },
        { constNaam: "RelABSoortLAT", waarde: "LAT" },
        { constNaam: "RelABSoortLTA", waarde: "LTA" },
      ],
    },
    {
      goType: "ABCEnum",
      baseType: "string",
      waarden: [
        { constNaam: "OptieA", waarde: "Optie A" },
        { constNaam: "OptieB", waarde: "Optie B" },
        { constNaam: "OptieC", waarde: "Optie C" },
      ],
    },
  ],

  datatypes: [
    {
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
      },
    },
    {
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
          },
        ],
      },
      normalisatie: "",
      weergave: {
        placeholder: "123456782",
        inputMask: "000000000",
      },
    },
  ],

  entiteiten: [
    {
      typenaam: "A",
      description:
        "Entiteit A met materiële tijdlijn en onderliggende representaties U, V, W en Rel_A_B.",
      isMaterieel: true,
      kleur: "#bfdbfe",
      meervoud: "as",
      gegevenselementen: [
        {
          naam: "U",
          description:
            "Enkelvoudig gegevenselement van A met formele tijdlijn.",
          meervoud: "a_us",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          velden: [
            { naam: "aaa", goType: "string" },
            { naam: "bbb", goType: "*bool" },
          ],
        },
        {
          naam: "V",
          description:
            "Meervoudig gegevenselement van A met onder andere een datumveld.",
          meervoud: "a_vs",
          momentvoorkomen: "meervoudig",
          isMaterieel: false,
          velden: [
            { naam: "ccc", goType: "string" },
            { naam: "ddd", goType: "*string" },
            { naam: "eee", goType: "*string" },
            { naam: "fff", goType: "float64" },
            { naam: "ggg", goType: "ABCEnum", enum: "ABCEnum" },
            { naam: "datum", goType: "Date" },
          ],
        },
        {
          naam: "W",
          description:
            "Meervoudig gegevenselement van A met numerieke waarden.",
          meervoud: "a_ws",
          momentvoorkomen: "meervoudig",
          isMaterieel: true,
          velden: [
            { naam: "float", goType: "float64" },
            { naam: "heel", goType: "int" },
          ],
        },
      ],
      relaties: [
        {
          naam: "Rel_A_B",
          description:
            "Relatie tussen A en B, meervoudig voorkomend per A.",
          meervoud: "rel_a_bs",
          momentvoorkomen: "meervoudig",
          isMaterieel: true,
          doelEntiteit: "B",
          velden: [
            { naam: "soort", goType: "RelABSoort", enum: "RelABSoort" },
          ],
        },
      ],
    },
    {
      typenaam: "B",
      description:
        "Entiteit B met materiële tijdlijn en onderliggende representaties X en Y.",
      isMaterieel: true,
      kleur: "#fecaca",
      meervoud: "bs",
      gegevenselementen: [
        {
          naam: "X",
          description:
            "Enkelvoudig gegevenselement van B met twee tekstvelden.",
          meervoud: "b_xs",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          velden: [
            { naam: "fff", goType: "string" },
            { naam: "ggg", goType: "string" },
          ],
        },
        {
          naam: "Y",
          description:
            "Enkelvoudig gegevenselement van B met een tekstveld.",
          meervoud: "b_ys",
          momentvoorkomen: "enkelvoudig",
          isMaterieel: false,
          velden: [{ naam: "hhh", goType: "string" }],
        },
      ],
    },
  ],
};
