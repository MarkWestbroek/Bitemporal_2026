// oasNaarV3.test.js — OAS components.schemas → V3-model (canoniek-uml).
// Run met: npm test  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import { oasNaarV3, goTypeVoor, pascal } from "./oasNaarV3.js";
import { importeerV3 } from "./serialisatie.js";

/** Klein maar representatief document: identiteit, nesting, enum, arrays, refs. */
const DOC = {
  openapi: "3.1.0",
  info: { title: "Demo API", description: "Testdocument." },
  components: {
    schemas: {
      Persoon: {
        type: "object",
        description: "Een persoon.",
        properties: {
          id: { type: "integer", format: "int32" },
          achternaam: { type: "string" },
          geboortedatum: { type: "string", format: "date" },
          lengte: { type: "number" },
          geslacht: { type: "string", enum: ["man", "vrouw", "X"] },
          bijnamen: { type: "array", items: { type: "string" } },
          adres: { $ref: "#/components/schemas/Adres" },
          werkgever: { $ref: "#/components/schemas/Organisatie" },
        },
        required: ["id", "achternaam", "geslacht"],
      },
      // Alleen door Persoon ge-$ref'd en zonder identiteit → gegevenselement.
      Adres: {
        type: "object",
        description: "Woonadres.",
        properties: {
          straat: { type: "string" },
          huisnummer: { type: "integer" },
          postcode: { type: "string" },
        },
        required: ["straat", "huisnummer"],
      },
      // Eigen identiteit → entiteit, ook al wordt er naar verwezen.
      Organisatie: {
        type: "object",
        properties: {
          id: { type: "integer" },
          naam: { type: "string" },
          vestigingen: { type: "array", items: { $ref: "#/components/schemas/Vestiging" } },
        },
        required: ["id", "naam"],
      },
      Vestiging: {
        type: "object",
        properties: { plaats: { type: "string" } },
        required: ["plaats"],
      },
      // Top-level enum en primitief.
      Status: { type: "string", enum: ["concept", "actief"] },
      Postcode: { type: "string", format: "nl-postcode", description: "Nederlandse postcode." },
    },
  },
};

const V3 = oasNaarV3(DOC);
const ent = (naam) => V3.entiteiten.find((e) => e.typenaam === naam);

test("goTypeVoor volgt de register-conventies (Date, time.Time, pointers)", () => {
  assert.equal(goTypeVoor({ type: "string" }, true), "string");
  assert.equal(goTypeVoor({ type: "string" }, false), "*string");
  assert.equal(goTypeVoor({ type: "string", format: "date" }, true), "Date");
  assert.equal(goTypeVoor({ type: "string", format: "date-time" }, true), "time.Time");
  assert.equal(goTypeVoor({ type: "integer", format: "int64" }, true), "int64");
  assert.equal(goTypeVoor({ type: "integer" }, true), "int");
  assert.equal(goTypeVoor({ type: "number" }, true), "float64");
  assert.equal(goTypeVoor({ type: "boolean" }, false), "*bool");
  assert.equal(pascal("natuurlijk_persoon"), "NatuurlijkPersoon");
});

test("heuristiek: identiteit of zelfstandigheid → entiteit, genest → gegevenselement", () => {
  assert.deepEqual(
    V3.entiteiten.map((e) => e.typenaam).sort(),
    ["Organisatie", "Persoon"]
  );
  // Adres en Vestiging hangen als GE onder hun enige verwijzer.
  assert.ok(ent("Persoon").gegevenselementen.some((ge) => ge.naam === "Adres"));
  assert.ok(ent("Organisatie").gegevenselementen.some((ge) => ge.naam === "Vestiging"));
});

test("scalaire properties belanden in een <Entiteit>Gegevens-gegevenselement", () => {
  const ge = ent("Persoon").gegevenselementen.find((g) => g.naam === "PersoonGegevens");
  assert.ok(ge, "PersoonGegevens ontbreekt");
  assert.equal(ge.momentvoorkomen, "enkelvoudig");
  const namen = ge.velden.map((v) => v.naam);
  // `id` is een technisch veld en valt standaard af.
  assert.deepEqual(namen, ["achternaam", "geboortedatum", "lengte", "geslacht"]);

  const achternaam = ge.velden.find((v) => v.naam === "achternaam");
  assert.equal(achternaam.goType, "string");
  assert.equal(achternaam.verplicht, true);
  const geboorte = ge.velden.find((v) => v.naam === "geboortedatum");
  assert.equal(geboorte.goType, "*Date"); // niet in required → optioneel
  assert.equal(geboorte.format, "date");
});

test("required stuurt de optionaliteit, ook bij enum-velden", () => {
  const ge = ent("Persoon").gegevenselementen.find((g) => g.naam === "PersoonGegevens");
  const geslacht = ge.velden.find((v) => v.naam === "geslacht");
  assert.equal(geslacht.enum, "PersoonGeslacht");
  assert.equal(geslacht.goType, "PersoonGeslacht"); // verplicht → geen pointer
  const e = V3.enums.find((x) => x.goType === "PersoonGeslacht");
  assert.deepEqual(e.waarden.map((w) => w.waarde), ["man", "vrouw", "X"]);
  assert.deepEqual(e.waarden.map((w) => w.constNaam), ["PersoonGeslachtMan", "PersoonGeslachtVrouw", "PersoonGeslachtX"]);
});

test("arrays worden meervoudigheid, $ref naar een entiteit wordt een relatie", () => {
  const bijnamen = ent("Persoon").gegevenselementen.find((g) => g.naam === "PersoonBijnamen");
  assert.equal(bijnamen.momentvoorkomen, "meervoudig");
  assert.deepEqual(bijnamen.velden.map((v) => v.naam), ["bijnamen"]);

  const rel = ent("Persoon").relaties.find((r) => r.doelEntiteit === "Organisatie");
  assert.ok(rel, "relatie naar Organisatie ontbreekt");
  assert.equal(rel.momentvoorkomen, "enkelvoudig");

  const vestigingen = ent("Organisatie").gegevenselementen.find((g) => g.naam === "Vestiging");
  assert.equal(vestigingen.momentvoorkomen, "meervoudig");
});

test("top-level enums en primitieven worden enum respectievelijk gegevenstype", () => {
  assert.ok(V3.enums.some((e) => e.goType === "Status"));
  const dt = V3.datatypes.find((d) => d.naam === "Postcode");
  assert.equal(dt.basistype, "string");
  assert.equal(dt.format, "nl-postcode");
});

test("allOf wordt platgeslagen, met een diagnostic erbij", () => {
  const doc = {
    openapi: "3.0.3",
    info: { title: "AllOf" },
    components: {
      schemas: {
        Basis: { type: "object", properties: { id: { type: "integer" }, naam: { type: "string" } }, required: ["id"] },
        Uitgebreid: {
          allOf: [{ $ref: "#/components/schemas/Basis" }, { type: "object", properties: { extra: { type: "string" } } }],
        },
      },
    },
  };
  const v3 = oasNaarV3(doc);
  const uitgebreid = v3.entiteiten.find((e) => e.typenaam === "Uitgebreid");
  const velden = uitgebreid.gegevenselementen.find((g) => g.naam === "UitgebreidGegevens").velden.map((v) => v.naam);
  assert.deepEqual(velden, ["naam", "extra"]);
  assert.ok(v3.diagnostics.some((d) => /allOf is platgeslagen/.test(d.bericht)));
});

test("onbekende en externe $refs verdwijnen niet stil maar als diagnostic", () => {
  const doc = {
    openapi: "3.1.0",
    info: { title: "Refs" },
    components: {
      schemas: {
        A: {
          type: "object",
          properties: {
            weg: { $ref: "#/components/schemas/Bestaat niet" },
            extern: { $ref: "./ander.json#/Foo" },
            naam: { type: "string" },
          },
        },
      },
    },
  };
  const v3 = oasNaarV3(doc);
  const info = v3.diagnostics.find((d) => d.schema === "A");
  assert.match(info.bericht, /onbekende schema/);
  assert.match(info.bericht, /externe \$ref/);
});

test("een document zonder components.schemas levert een lege oogst plus melding", () => {
  const v3 = oasNaarV3({ openapi: "3.1.0", info: { title: "Leeg" } });
  assert.deepEqual(v3.entiteiten, []);
  assert.ok(v3.diagnostics.some((d) => d.severity === "warning"));
});

test("technischeVelden: true houdt id/rel_id wél in het model", () => {
  const v3 = oasNaarV3(DOC, { technischeVelden: true });
  const ge = v3.entiteiten
    .find((e) => e.typenaam === "Persoon")
    .gegevenselementen.find((g) => g.naam === "PersoonGegevens");
  assert.ok(ge.velden.some((v) => v.naam === "id"));
});

test("het resultaat gaat door importeerV3 heen tot een core-model", () => {
  // De hele route OAS → V3 → store → canoniek core-model moet lopen; dat is wat
  // de Studio-transformatie doet.
  const core = importeerV3({ model: V3 });
  const namen = Object.values(core.elements).map((el) => el.naam);
  assert.ok(namen.includes("Persoon"), "Persoon ontbreekt in het core-model");
  assert.ok(namen.includes("Organisatie"));
  const persoon = Object.values(core.elements).find((el) => el.naam === "Persoon");
  assert.equal(persoon.elementType, "entiteit");
});

// ── Verpakte verwijzingen (drf-spectacular-idioom) ───────────────────────────
// Gevonden op de OpenOrganisatie-OAS: generatoren verpakken een $ref in allOf
// (om er een beschrijving bij te zetten) en een optionele enum in
// `oneOf: [Enum, BlankEnum]`. Zonder afpellen verdwijnen echte relaties als
// tekstveld en blijft de enum onverbonden.
const VERPAKT = {
  openapi: "3.0.3",
  info: { title: "Verpakt" },
  components: {
    schemas: {
      Medewerker: {
        type: "object",
        properties: {
          uuid: { type: "string" },
          voornaam: { type: "string" },
          // allOf met één $ref = "deze verwijzing, plus een beschrijving".
          functieType: {
            allOf: [{ $ref: "#/components/schemas/FunctieType" }],
            readOnly: true,
            description: "Het type functie.",
          },
          // oneOf met een blanco-enum = "deze enum, of leeg".
          geslachtsaanduiding: {
            oneOf: [
              { $ref: "#/components/schemas/GeslachtsaanduidingEnum" },
              { $ref: "#/components/schemas/BlankEnum" },
            ],
          },
        },
        required: ["uuid", "voornaam"],
      },
      FunctieType: {
        type: "object",
        properties: { uuid: { type: "string" }, naam: { type: "string" } },
        required: ["uuid", "naam"],
      },
      GeslachtsaanduidingEnum: { type: "string", enum: ["M", "V", "X"] },
      BlankEnum: { enum: [""] },
    },
  },
};

test("allOf met één $ref op een property blijft een verwijzing, geen tekstveld", () => {
  const v3 = oasNaarV3(VERPAKT);
  const medewerker = v3.entiteiten.find((e) => e.typenaam === "Medewerker");
  const rel = medewerker.relaties.find((r) => r.doelEntiteit === "FunctieType");
  assert.ok(rel, `functieType moet een relatie zijn, relaties: ${JSON.stringify(medewerker.relaties)}`);
  assert.equal(rel.momentvoorkomen, "enkelvoudig");
  assert.equal(rel.description, "Het type functie.");
  // en dus níét als veld in het gegevens-GE
  const velden = medewerker.gegevenselementen.find((g) => g.naam === "MedewerkerGegevens").velden.map((v) => v.naam);
  assert.ok(!velden.includes("functieType"));
});

test("oneOf [Enum, BlankEnum] wordt het enum-veld; de blanco-enum verdwijnt", () => {
  const v3 = oasNaarV3(VERPAKT);
  const ge = v3.entiteiten.find((e) => e.typenaam === "Medewerker").gegevenselementen.find((g) => g.naam === "MedewerkerGegevens");
  const geslacht = ge.velden.find((v) => v.naam === "geslachtsaanduiding");
  assert.equal(geslacht.enum, "GeslachtsaanduidingEnum");
  assert.equal(geslacht.goType, "*GeslachtsaanduidingEnum"); // niet required → optioneel
  assert.deepEqual(v3.enums.map((e) => e.goType), ["GeslachtsaanduidingEnum"]);
  assert.ok(v3.diagnostics.some((d) => d.schema === "BlankEnum" && /mag leeg zijn/.test(d.bericht)));
});

test("oneOf met meerdere echte varianten kiest de eerste en meldt dat", () => {
  const doc = {
    openapi: "3.1.0",
    info: { title: "Keuze" },
    components: {
      schemas: {
        A: {
          type: "object",
          properties: { waarde: { oneOf: [{ type: "string" }, { type: "integer" }] } },
        },
      },
    },
  };
  const v3 = oasNaarV3(doc);
  const veld = v3.entiteiten[0].gegevenselementen[0].velden.find((v) => v.naam === "waarde");
  assert.equal(veld.type, "string");
  assert.ok(v3.diagnostics.some((d) => /oneOf met meerdere varianten/.test(d.bericht)));
});

test("een $ref naar een primitief schema wordt een veld met dat type/format", () => {
  const doc = {
    openapi: "3.1.0",
    info: { title: "Datatype" },
    components: {
      schemas: {
        A: { type: "object", properties: { postcode: { $ref: "#/components/schemas/Postcode" } } },
        Postcode: { type: "string", format: "nl-postcode" },
      },
    },
  };
  const v3 = oasNaarV3(doc);
  const veld = v3.entiteiten[0].gegevenselementen[0].velden.find((v) => v.naam === "postcode");
  assert.equal(veld.type, "string");
  assert.equal(veld.format, "nl-postcode");
  assert.equal(v3.entiteiten.length, 1, "een primitief schema mag geen entiteit worden");
});

test("een verwijzing binnen een gegevenselement verdwijnt niet stil", () => {
  const doc = {
    openapi: "3.1.0",
    info: { title: "GE" },
    components: {
      schemas: {
        Houder: { type: "object", properties: { id: { type: "integer" }, detail: { $ref: "#/components/schemas/Detail" } } },
        Detail: {
          type: "object",
          properties: { naam: { type: "string" }, extra: { $ref: "#/components/schemas/Los" } },
        },
        Los: { type: "object", properties: { id: { type: "integer" }, x: { type: "string" } } },
      },
    },
  };
  const v3 = oasNaarV3(doc);
  assert.ok(v3.diagnostics.some((d) => /detail\.extra valt weg/.test(d.bericht)));
});
