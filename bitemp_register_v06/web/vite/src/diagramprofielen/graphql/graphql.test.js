// graphql.test.js — het GraphQL-schema-profiel (M2): descriptor, type-expressies,
// SDL-parser/-serializer, adapter (heen en terug), afgeleide connectoren en
// de schema-validatie.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/graphql/graphql.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { registreerGraphql, graphqlDiagramType, maakElement, GRAPHQL_ID, gqlRijenPosities } from "./index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import {
  parseTypeExpressie,
  formatteerTypeExpressie,
  normaliseerTypeExpressie,
  basisNaam,
  kardinaliteit,
  isLijst,
  isNonNull,
} from "./typeExpressie.js";
import { parseSdl, naarSdl, parseArgumenten, formatteerArgumenten, schemaIsImpliciet, SdlFout } from "./sdl.js";
import {
  vanSdl,
  naarSdlTekst,
  vanSchemaDocument,
  naarSchemaDocument,
  leidVeldConnectorenAf,
  valideerSchema,
  SCHEMA_ID,
} from "./adapter.js";

// Het schema uit het GBO-voorbeeld (authz/gbo-voorbeeld/bundel/schema.graphql),
// precies zoals de serializer het schrijft.
const GBO_SDL = `type Query {
  persoon(bsn: String!): Persoon
}

type Persoon {
  naam: Naam
  adres: Adres
  inkomens(jaren: [Int!]): [Inkomen!]
}

type Naam {
  naam: String
}

type Adres {
  straat: String
  huisnummer: Int
  postcode: String
  plaats: String
}

type Inkomen {
  jaar: Int!
  bedrag: Float
}
`;

// Alle taalonderdelen in één schema: expliciete schema-definitie met
// beschrijving en directive, eigen scalar, directive-definitie, interfaces,
// union, enum, input, argumenten met standaardwaarden.
const RIJK_SDL = `"""
Het schema van de bron.
Tweede regel.
"""
schema @link(url: "https://x") {
  query: Vraag
  mutation: Mutatie
}

"Een datum"
scalar Datum @specifiedBy(url: "https://tools.ietf.org/html/rfc3339")

directive @betrokkene(soort: String = "bsn") repeatable on ARGUMENT_DEFINITION | FIELD_DEFINITION

interface Node {
  id: ID!
}

type Vraag {
  persoon(bsn: String! @betrokkene, taal: Taal = NL): Persoon
  zoek(filter: Filter = {naam: "a", jaren: [1, 2]}): [Resultaat!]!
}

type Mutatie {
  noop: Boolean
}

type Persoon implements Node & Benoemd @key(fields: "id") {
  id: ID!
  """
  De naam "zoals" bekend
  """
  naam: String @deprecated(reason: "gebruik namen")
  geboren: Datum
  inkomens(jaren: [Int!]): [Inkomen!]
}

interface Benoemd {
  naam: String
}

type Inkomen {
  jaar: Int!
  bedrag: Float
}

union Resultaat = Persoon | Inkomen

enum Taal {
  NL
  "Engels"
  EN @deprecated
}

input Filter {
  naam: String = "x"
  jaren: [Int!]
}
`;

const perId = () => Object.fromEntries(graphqlDiagramType.elementTypes.map((e) => [e.id, e]));
const connectoren = (elements, soort) =>
  Object.values(elements).filter((el) => el.source && el.target && (!soort || el.elementType === soort));

// ── Descriptor ───────────────────────────────────────────────────────────────

test("graphql: descriptor registreert zonder validatiefouten", () => {
  registreerGraphql();
  registreerGraphql(); // idempotent
  assert.equal(getDiagramType(GRAPHQL_ID)?.id, GRAPHQL_ID);
});

test("graphql: het M2 dekt het typesysteem van de spec", () => {
  const et = perId();
  for (const id of ["schema", "object", "interface", "union", "enum", "input", "scalar", "directive"]) {
    assert.ok(et[id], `elementtype ${id}`);
    assert.equal(et[id].shape, "class-box", "geen nieuwe shapes nodig");
  }
  assert.equal(et.object.stereotype, "«type»");
  assert.equal(et.schema.randDikte, 3, "het schema is het identiteits-element");
});

test("graphql: verbindingsregels volgen de spec", () => {
  const et = perId();
  assert.ok(et.veldtype.isConnector);
  assert.deepEqual(et.veldtype.bron.elementTypes, ["object", "interface"]);
  assert.ok(!et.veldtype.doel.elementTypes.includes("input"), "een veld geeft nooit een input-type terug");
  assert.deepEqual(et.argumenttype.doel.elementTypes, ["input", "enum"]);
  assert.deepEqual(et.implements.doel.elementTypes, ["interface"]);
  assert.equal(et.implements.edgePresentatie.markerEnd, "driehoek");
  assert.deepEqual(et.lid.bron.elementTypes, ["union"]);
  assert.deepEqual(et.lid.doel.elementTypes, ["object"], "union-leden zijn object-typen");
  assert.deepEqual(et.root.bron.elementTypes, ["schema"]);
  assert.equal(graphqlDiagramType.hierarchie, "veldtype");
});

test("graphql: veldtype toont veldnaam en kardinaliteit, root toont de rol", () => {
  const et = perId();
  const labels = et.veldtype.hooks.edgeLabels({ data: { rolnaam: "inkomens", typeLabel: "[Inkomen!]" } });
  assert.deepEqual(
    labels.kaal.map((l) => [l.zijde, l.delen[0].tekst]),
    [
      ["bron", "inkomens"],
      ["doel", "0..*"],
    ]
  );
  assert.equal(et.root.hooks.edgeLabels({ data: { rol: "mutation" } }).kaal[0].delen[0].tekst, "«mutation»");
  assert.equal(et.root.hooks.edgeLabels({ data: {} }).kaal[0].delen[0].tekst, "«query»");
});

test("graphql: een veld met argumenten krijgt een signatuur-weergave op de node", () => {
  const object = perId().object;
  const element = {
    compartimenten: [
      {
        compartmentType: "velden",
        velden: [
          { naam: "naam", fieldType: "veld", data: { typeLabel: "Naam" } },
          { naam: "inkomens", fieldType: "veld", data: { typeLabel: "[Inkomen!]", argumenten: "jaren: [Int!]" } },
        ],
      },
    ],
  };
  const extra = object.hooks.extraCompartimenten(element);
  assert.equal(extra[0].compartmentType, "signaturen");
  assert.deepEqual(extra[0].velden.map((v) => v.naam), ["inkomens(jaren: [Int!])"]);
  assert.deepEqual(object.hooks.extraCompartimenten({ compartimenten: [] }), []);
  const sig = object.compartments.find((c) => c.id === "signaturen");
  assert.ok(sig.alleenWeergave && sig.verbergInInspector);
});

test("graphql: typekandidaten in de vier gangbare vormen, per positie", () => {
  const elements = {
    a: { id: "a", naam: "Persoon", elementType: "object" },
    b: { id: "b", naam: "Taal", elementType: "enum" },
    c: { id: "c", naam: "Filter", elementType: "input" },
    d: { id: "d", naam: "Datum", elementType: "scalar" },
  };
  const r = graphqlDiagramType.referenceResolvers;
  const scalars = r["gql-scalar"]({ elements }).map((k) => k.waarde);
  for (const v of ["String", "String!", "[String!]", "[String!]!", "Datum", "ID!"]) assert.ok(scalars.includes(v), v);
  const uit = r["gql-uitvoertype"]({ elements }).map((k) => k.waarde);
  assert.ok(uit.includes("[Persoon!]") && uit.includes("Taal"));
  assert.ok(!uit.includes("Filter"), "een input is geen uitvoertype");
  const inv = r["gql-invoertype"]({ elements }).map((k) => k.waarde);
  assert.ok(inv.includes("Filter") && inv.includes("Taal!"));
  assert.ok(!inv.includes("Persoon"), "een object is geen invoertype");
});

test("graphql: maakElement geeft bruikbare startwaarden", () => {
  assert.equal(maakElement("object").naam, "NieuwType");
  assert.equal(maakElement("schema").naam, "schema");
  assert.equal(maakElement("directive").data.locaties, "FIELD_DEFINITION");
  assert.equal(maakElement("veldtype"), null, "connectoren maak je niet als element");
});

// ── Type-expressies ──────────────────────────────────────────────────────────

test("typeExpressie: ontleden, terugschrijven en normaliseren", () => {
  assert.deepEqual(parseTypeExpressie("Int"), { soort: "naam", naam: "Int", nonNull: false });
  const ast = parseTypeExpressie("[[Inkomen!]]!");
  assert.equal(formatteerTypeExpressie(ast), "[[Inkomen!]]!");
  assert.equal(normaliseerTypeExpressie(" [ Inkomen ! ] "), "[Inkomen!]");
  assert.equal(basisNaam("[[Int!]]!"), "Int");
  assert.ok(isLijst("[Int]") && !isLijst("Int!"));
  assert.ok(isNonNull("[Int]!") && !isNonNull("[Int!]"));
  for (const fout of ["", "Int!!", "[Int", "Int]", "1Int", "[ ]"]) assert.equal(parseTypeExpressie(fout), null, fout);
  assert.equal(normaliseerTypeExpressie(" rommel! ! "), "rommel! !", "ongeldige tekst blijft staan (getrimd)");
});

test("typeExpressie: kardinaliteit — een lijst kan altijd leeg zijn", () => {
  assert.equal(kardinaliteit("Naam"), "0..1");
  assert.equal(kardinaliteit("Naam!"), "1");
  assert.equal(kardinaliteit("[Inkomen]"), "0..*");
  assert.equal(kardinaliteit("[Inkomen!]!"), "0..*");
  assert.equal(kardinaliteit("???"), "");
});

// ── SDL ──────────────────────────────────────────────────────────────────────

test("sdl: het GBO-schema komt byte-gelijk terug", () => {
  const doc = parseSdl(GBO_SDL);
  assert.equal(doc.schema, null, "geen schema-definitie: de standaardnamen gelden");
  assert.deepEqual(doc.typen.map((t) => t.naam), ["Query", "Persoon", "Naam", "Adres", "Inkomen"]);
  assert.deepEqual(doc.typen[1].velden[2], {
    naam: "inkomens",
    type: "[Inkomen!]",
    argumenten: [{ naam: "jaren", type: "[Int!]" }],
  });
  assert.equal(naarSdl(doc), GBO_SDL);
});

test("sdl: het rijke schema doorstaat de roundtrip en is canoniek", () => {
  const doc = parseSdl(RIJK_SDL);
  assert.equal(naarSdl(doc), RIJK_SDL, "de tekst hierboven is de canonieke schrijfwijze");
  assert.deepEqual(parseSdl(naarSdl(doc)), doc);
  assert.equal(doc.beschrijving, "Het schema van de bron.\nTweede regel.");
  assert.deepEqual(doc.schema, { directives: '@link(url: "https://x")', query: "Vraag", mutation: "Mutatie" });
  const perNaam = Object.fromEntries(doc.typen.map((t) => [t.naam, t]));
  assert.deepEqual(perNaam.Persoon.implements, ["Node", "Benoemd"]);
  assert.equal(perNaam.Persoon.directives, '@key(fields: "id")');
  assert.equal(perNaam.Persoon.velden[1].beschrijving, 'De naam "zoals" bekend');
  assert.deepEqual(perNaam.Resultaat.leden, ["Persoon", "Inkomen"]);
  assert.deepEqual(perNaam.Taal.waarden[1], { naam: "EN", beschrijving: "Engels", directives: "@deprecated" });
  assert.deepEqual(perNaam.betrokkene, {
    soort: "directive",
    naam: "betrokkene",
    argumenten: [{ naam: "soort", type: "String", standaard: '"bsn"' }],
    herhaalbaar: true,
    locaties: ["ARGUMENT_DEFINITION", "FIELD_DEFINITION"],
  });
  assert.equal(perNaam.Vraag.velden[1].argumenten[0].standaard, '{naam: "a", jaren: [1, 2]}', "waarden blijven ruwe tekst");
});

test("sdl: vrije opmaak, commentaar en komma's worden canoniek", () => {
  const slordig = `# commentaar
    type   Query{a:Int,b(x:Int=1,y:[String!]!):String!}
    union U=|A|B  type A{x:ID} type B{x:ID}`;
  assert.equal(
    naarSdl(parseSdl(slordig)),
    `type Query {\n  a: Int\n  b(x: Int = 1, y: [String!]!): String!\n}\n\nunion U = A | B\n\ntype A {\n  x: ID\n}\n\ntype B {\n  x: ID\n}\n`
  );
});

test("sdl: fouten noemen regel en kolom in klare taal", () => {
  const gooit = (tekst, patroon) =>
    assert.throws(
      () => parseSdl(tekst),
      (e) => e instanceof SdlFout && patroon.test(e.message) && e.regel >= 1 && e.kolom >= 1,
      tekst
    );
  gooit("type X { a: }", /typenaam.*regel 1, kolom 13/);
  gooit("type X {\n  a: [Int\n}", /"\]".*regel 3, kolom 1/);
  gooit("extend type X { a: Int }", /extend wordt nog niet ondersteund/);
  gooit('type X { a: Int } "los', /String zonder afsluitend/);
  gooit("schema { query: Q } schema { query: Q }", /maar één schema/);
  gooit("soort X", /Hier hoort een definitie/);
});

test("sdl: argumenten als losse tekst, en de impliciete schema-definitie", () => {
  const args = parseArgumenten("jaren: [Int!] = [2024], bsn: String! @betrokkene");
  assert.deepEqual(args, [
    { naam: "jaren", type: "[Int!]", standaard: "[2024]" },
    { naam: "bsn", type: "String!", directives: "@betrokkene" },
  ]);
  assert.equal(formatteerArgumenten(args), "jaren: [Int!] = [2024], bsn: String! @betrokkene");
  assert.deepEqual(parseArgumenten("  "), []);
  assert.ok(schemaIsImpliciet({ schema: { query: "Query", mutation: "Mutation" } }));
  assert.ok(!schemaIsImpliciet({ schema: { query: "Vraag" } }));
  assert.ok(!schemaIsImpliciet({ schema: { query: "Query", directives: "@x" } }));
  assert.equal(naarSdl({ schema: { query: "Query" }, typen: [] }), "", "standaard-roots: geen schema-blok");
  assert.match(naarSdl({ schema: { query: "Query" }, typen: [] }, { altijdSchema: true }), /^schema \{\n {2}query: Query\n\}/);
});

// ── Adapter ──────────────────────────────────────────────────────────────────

test("adapter: het GBO-schema wordt elementen, velden en afgeleide lijnen", () => {
  const model = vanSdl(GBO_SDL);
  const { elements } = model;
  assert.deepEqual(
    Object.values(elements)
      .filter((el) => !el.source)
      .map((el) => `${el.elementType}:${el.naam}`),
    ["object:Query", "object:Persoon", "object:Naam", "object:Adres", "object:Inkomen", "schema:schema"]
  );
  const inkomens = elements.Persoon.compartimenten[0].velden[2];
  assert.deepEqual(inkomens, {
    naam: "inkomens",
    fieldType: "veld",
    data: { typeLabel: "[Inkomen!]", argumenten: "jaren: [Int!]" },
  });
  // Geen schema-definitie in de bron: het schema-element volgt uit de naam Query.
  assert.deepEqual(connectoren(elements, "root").map((c) => [c.source, c.target, c.data.rol]), [[SCHEMA_ID, "Query", "query"]]);
  assert.equal(model.meta.gqlSchemaExpliciet, false);
  assert.deepEqual(
    connectoren(elements, "veldtype").map((c) => `${c.source}.${c.data.rolnaam}→${c.target} ${c.data.typeLabel}`),
    ["Query.persoon→Persoon Persoon", "Persoon.naam→Naam Naam", "Persoon.adres→Adres Adres", "Persoon.inkomens→Inkomen [Inkomen!]"]
  );
  assert.equal(connectoren(elements).length, 5, "scalars krijgen geen lijn");
  // Eén diagram, elk element geplaatst, schema bovenaan en lagen eronder.
  const pos = Object.fromEntries(model.diagrams.schema.nodes.map((n) => [n.elementId, n.position]));
  assert.equal(Object.keys(pos).length, 6);
  assert.ok(pos[SCHEMA_ID].y < pos.Query.y && pos.Query.y < pos.Persoon.y && pos.Persoon.y < pos.Naam.y);
  assert.equal(pos.Naam.y, pos.Adres.y, "kinderen van Persoon op één rij");
});

test("adapter: SDL → diagram → SDL is byte-gelijk (GBO en rijk)", () => {
  assert.equal(naarSdlTekst(vanSdl(GBO_SDL)), GBO_SDL);
  assert.equal(naarSdlTekst(vanSdl(RIJK_SDL)), RIJK_SDL);
  const doc = parseSdl(RIJK_SDL);
  assert.deepEqual(naarSchemaDocument(vanSchemaDocument(doc)), doc);
});

test("adapter: het rijke schema — implements, leden, roots en argumenttypen", () => {
  const { elements, meta } = vanSdl(RIJK_SDL);
  assert.equal(meta.gqlSchemaExpliciet, true);
  assert.deepEqual(elements[SCHEMA_ID].data, { beschrijving: "Het schema van de bron.\nTweede regel.", directives: '@link(url: "https://x")' });
  assert.deepEqual(
    connectoren(elements, "root").map((c) => `${c.data.rol}:${c.target}`),
    ["query:Vraag", "mutation:Mutatie"]
  );
  assert.deepEqual(connectoren(elements, "implements").map((c) => `${c.source}▷${c.target}`), ["Persoon▷Node", "Persoon▷Benoemd"]);
  assert.deepEqual(connectoren(elements, "lid").map((c) => `${c.source}|${c.target}`), ["Resultaat|Persoon", "Resultaat|Inkomen"]);
  assert.deepEqual(
    connectoren(elements, "argumenttype").map((c) => `${c.source} ${c.data.rolnaam}→${c.target}`),
    ["Vraag zoek(filter)→Filter"],
    "alleen input-typen krijgen een argument-lijn; enums en scalars niet"
  );
  assert.ok(connectoren(elements, "veldtype").some((c) => c.target === "Resultaat" && c.data.typeLabel === "[Resultaat!]!"));
  assert.equal(elements["@betrokkene"].elementType, "directive");
  assert.deepEqual(elements["@betrokkene"].data, { locaties: "ARGUMENT_DEFINITION | FIELD_DEFINITION", herhaalbaar: true });
  assert.equal(elements.Taal.compartimenten[0].velden[1].data.directives, "@deprecated");
});

test("adapter: afgeleide lijnen volgen de velden; getekende lijnen blijven", () => {
  const { elements } = vanSdl(RIJK_SDL);
  // Wijzig het type van Persoon.inkomens en voeg een veld toe; verwijder er één.
  const persoon = structuredClone(elements.Persoon);
  const velden = persoon.compartimenten[0].velden;
  velden.find((v) => v.naam === "inkomens").data.typeLabel = "Resultaat";
  velden.push({ naam: "partner", fieldType: "veld", data: { typeLabel: "Persoon", argumenten: "f: Filter" } });
  const na = leidVeldConnectorenAf({ ...elements, Persoon: persoon });
  const lijnen = connectoren(na, "veldtype")
    .filter((c) => c.source === "Persoon")
    .map((c) => `${c.data.rolnaam}→${c.target}`);
  assert.deepEqual(lijnen, ["inkomens→Resultaat", "partner→Persoon"]);
  assert.ok(na["argumenttype__Persoon__partner__f"], "nieuw argument naar een input-type");
  assert.equal(connectoren(na, "implements").length, 2, "implements is getekend, niet afgeleid");
  assert.equal(na["veldtype__Persoon__inkomens"].id, "veldtype__Persoon__inkomens", "stabiele ids");
  // Idempotent.
  assert.deepEqual(leidVeldConnectorenAf(na), na);
});

test("adapter: de terugreis is streng over wat geen SDL kan worden", () => {
  const model = vanSdl(GBO_SDL);
  const kapot = structuredClone(model);
  kapot.elements.Naam.compartimenten[0].velden[0].data.typeLabel = "";
  assert.throws(() => naarSdlTekst(kapot), /Naam\.naam heeft geen geldig type/);
  const args = structuredClone(model);
  args.elements.Persoon.compartimenten[0].velden[2].data.argumenten = "jaren [Int!]";
  assert.throws(() => naarSdlTekst(args), /Persoon\.inkomens: de argumenten zijn geen geldige SDL/);
  assert.throws(() => vanSdl("type A { x: Int } type A { y: Int }"), /komt meer dan één keer voor/);
});

test("adapter: een getekend schema zonder afwijkende roots schrijft geen schema-blok", () => {
  const model = vanSdl(GBO_SDL);
  // Hernoem de root: nu is de definitie nodig.
  model.elements.Query.naam = "Vraag";
  assert.match(naarSdlTekst(model), /^schema \{\n {2}query: Vraag\n\}\n\ntype Vraag \{/);
});

// ── Validatie ────────────────────────────────────────────────────────────────

test("validatie: beide voorbeeldschema's zijn schoon", () => {
  assert.deepEqual(valideerSchema(vanSdl(GBO_SDL)), []);
  assert.deepEqual(valideerSchema(vanSdl(RIJK_SDL)), []);
});

test("validatie: onbekende typen en typen op de verkeerde positie", () => {
  const m = valideerSchema(
    vanSdl(`type Query { a: Onbekend  b(f: Query): Int  c: Filter }
            input Filter { x: Query  y: Int }`)
  );
  const berichten = m.map((x) => x.bericht).join("\n");
  assert.match(berichten, /Veld Query\.a verwijst naar het onbekende type "Onbekend"/);
  assert.match(berichten, /Argument Query\.b\(f\) gebruikt "Query" \(«object»\)/);
  assert.match(berichten, /Veld Query\.c gebruikt "Filter" \(«input»\)/);
  assert.match(berichten, /Invoerveld Filter\.x gebruikt "Query"/);
  assert.ok(m.every((x) => x.niveau === "fout" && x.elementId));
  assert.equal(m.find((x) => /Query\.a/.test(x.bericht)).veld, "a", "de melding wijst het veld aan");
});

test("validatie: interfaces, unions, namen en de query-root", () => {
  const m = valideerSchema(
    vanSdl(`interface Benoemd { naam: String  code: ID! }
            type Query implements Benoemd { naam: String! }
            union Leeg
            enum E
            scalar String
            type __Geheim { x: Int }`)
  );
  const berichten = m.map((x) => `${x.niveau}: ${x.bericht}`).join("\n");
  assert.match(berichten, /fout: Query implementeert Benoemd maar mist het veld "code"/);
  assert.match(berichten, /waarschuwing: Query\.naam heeft type String!, de interface Benoemd vraagt String/);
  assert.match(berichten, /fout: Leeg heeft geen leden/);
  assert.match(berichten, /fout: E heeft geen waarden/);
  assert.match(berichten, /fout: "String" is een ingebouwde scalar/);
  assert.match(berichten, /fout: Namen die met "__" beginnen zijn gereserveerd/);

  const geenRoot = valideerSchema(vanSdl("type Persoon { naam: String }"));
  assert.deepEqual(geenRoot.map((x) => x.niveau), ["waarschuwing"]);
  assert.match(geenRoot[0].bericht, /geen query-root/);

  const model = vanSdl(GBO_SDL);
  delete model.elements.root__query;
  assert.match(valideerSchema(model)[0].bericht, /Het schema heeft geen query-root/);
});

// ── Layout ───────────────────────────────────────────────────────────────────

test("layout: rijhoogte volgt het langste type, losse elementen onderaan", () => {
  const { elements } = vanSdl(RIJK_SDL);
  const ids = Object.values(elements)
    .filter((el) => !el.source)
    .map((el) => el.id);
  const edges = connectoren(elements).map((c) => ({ source: c.source, target: c.target }));
  const pos = gqlRijenPosities({ ids, elements, edges });
  assert.equal(Object.keys(pos).length, ids.length);
  assert.ok(pos[SCHEMA_ID].y < pos.Vraag.y);
  assert.equal(pos.Vraag.y, pos.Mutatie.y, "beide roots op één rij");
  assert.ok(pos.Persoon.y > pos.Vraag.y);
  const onderste = Math.max(...Object.values(pos).map((p) => p.y));
  assert.equal(pos.Datum.y, onderste, "een scalar hangt nergens aan");
  assert.equal(pos["@betrokkene"].y, onderste);
  // Geen twee elementen op dezelfde plek.
  const plekken = new Set(Object.values(pos).map((p) => `${p.x},${p.y}`));
  assert.equal(plekken.size, ids.length);
});
