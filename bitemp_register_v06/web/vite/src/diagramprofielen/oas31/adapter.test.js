// adapter.test.js — OAS 3.1-document → diagramcore-model (oas31-profiel).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/oas31/adapter.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { vanOasDocument, naarOasDocument } from "./adapter.js";
import { oasRijenPosities } from "./index.js";

const doc = {
  openapi: "3.1.0",
  info: { title: "Personen-API", version: "1.0" },
  paths: {
    "/personen/{id}": {
      get: {
        operationId: "getPersoon",
        summary: "Haal één persoon op",
        responses: {
          200: { content: { "application/json": { schema: { $ref: "#/components/schemas/Persoon" } } } },
          404: { description: "niet gevonden" },
        },
      },
    },
    "/personen": {
      get: {
        operationId: "listPersonen",
        responses: {
          200: {
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Persoon" } },
              },
            },
          },
        },
      },
      post: {
        operationId: "createPersoon",
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Persoon" } } } },
        responses: { 201: { description: "aangemaakt" } },
      },
    },
  },
  components: {
    schemas: {
      Persoon: {
        type: "object",
        description: "Een natuurlijk persoon.",
        required: ["bsn"],
        properties: {
          bsn: { type: "string" },
          geboortedatum: { type: "string", format: "date" },
          adres: { $ref: "#/components/schemas/Adres" },
          hobbies: { type: "array", items: { type: "string" } },
          kleuren: { type: "array", items: { $ref: "#/components/schemas/Kleur" } },
        },
      },
      Adres: {
        type: "object",
        required: ["straat"],
        properties: { straat: { type: "string" }, postcode: { type: "string" } },
      },
      Werknemer: {
        allOf: [
          { $ref: "#/components/schemas/Persoon" },
          { type: "object", required: ["personeelsnummer"], properties: { personeelsnummer: { type: "integer" } } },
        ],
      },
      Kleur: { type: "string", enum: ["rood", "blauw"] },
    },
  },
};

test("oas-import: schemas worden elementen met properties, required en formats", () => {
  const { elements } = vanOasDocument(doc);
  const persoon = elements.Persoon;
  assert.equal(persoon.elementType, "schema");
  assert.equal(persoon.data.beschrijving, "Een natuurlijk persoon.");
  const velden = Object.fromEntries(persoon.compartimenten[0].velden.map((v) => [v.naam, v.data]));
  assert.equal(velden.bsn.verplicht, true);
  assert.equal(velden.geboortedatum.typeLabel, "string «date»");
  assert.equal(velden.geboortedatum.verplicht, false);
  assert.equal(velden.adres.typeLabel, "Adres");
  assert.equal(velden.hobbies.typeLabel, "string[]");
  assert.equal(velden.kleuren.typeLabel, "Kleur[]");
});

test("oas-import: $ref-properties en array-items worden connectoren met rolnaam", () => {
  const { elements } = vanOasDocument(doc);
  const conns = Object.values(elements).filter((el) => el.source);
  const adresRef = conns.find((c) => c.elementType === "ref" && c.source === "Persoon" && c.target === "Adres");
  assert.equal(adresRef.data.rolnaam, "adres");
  const kleurItems = conns.find((c) => c.elementType === "items" && c.source === "Persoon" && c.target === "Kleur");
  assert.equal(kleurItems.data.rolnaam, "kleuren");
});

test("oas-import: allOf wordt een allOf-connector plus eigen properties", () => {
  const { elements } = vanOasDocument(doc);
  const werknemer = elements.Werknemer;
  const velden = werknemer.compartimenten[0].velden;
  assert.deepEqual(velden.map((v) => v.naam), ["personeelsnummer"]);
  assert.equal(velden[0].data.verplicht, true);
  const allOf = Object.values(elements).find(
    (el) => el.elementType === "allOf" && el.source === "Werknemer" && el.target === "Persoon"
  );
  assert.ok(allOf, "Werknemer «allOf» Persoon");
});

test("oas-import: enum-schema wordt een enum-element met literals", () => {
  const { elements } = vanOasDocument(doc);
  assert.equal(elements.Kleur.elementType, "enum");
  assert.deepEqual(elements.Kleur.compartimenten[0].velden.map((v) => v.naam), ["rood", "blauw"]);
});

test("oas-import: paths worden operaties met request-/response-refs (ook array-responses)", () => {
  const { elements } = vanOasDocument(doc);
  const ops = Object.values(elements).filter((el) => el.elementType === "operatie");
  assert.deepEqual(ops.map((o) => o.naam).sort(), ["createPersoon", "getPersoon", "listPersonen"]);
  const get = ops.find((o) => o.naam === "getPersoon");
  assert.equal(get.data.method, "GET");
  assert.equal(get.data.pad, "/personen/{id}");
  assert.equal(get.data.samenvatting, "Haal één persoon op");

  const conns = Object.values(elements).filter((el) => el.source);
  assert.ok(conns.some((c) => c.source === get.id && c.target === "Persoon" && c.data.rolnaam === "response 200"));
  const list = ops.find((o) => o.naam === "listPersonen");
  assert.ok(conns.some((c) => c.source === list.id && c.target === "Persoon"), "array-response → ref");
  const create = ops.find((o) => o.naam === "createPersoon");
  assert.ok(conns.some((c) => c.source === create.id && c.data.rolnaam === "request"));
});

test("oas-import: één diagram met alle niet-connector-elementen in een grid", () => {
  const { diagrams, meta } = vanOasDocument(doc);
  const diag = diagrams.componenten;
  assert.equal(diag.naam, "Personen-API");
  const geplaatst = diag.nodes.map((n) => n.elementId).sort();
  assert.ok(geplaatst.includes("Persoon") && geplaatst.includes("Kleur"));
  assert.equal(diag.nodes.length, 8, "4 schemas/enums + 3 operaties + het api-element");
  assert.equal(meta.oasInfo.title, "Personen-API");
});

test("oas-import: oneOf-varianten worden connectoren; tags worden diagrammen", async () => {
  const { vanOasDocument: van } = await import("./adapter.js");
  const docMetTags = {
    openapi: "3.1.0",
    info: { title: "Tags-API", version: "1" },
    paths: {
      "/personen": { get: { operationId: "listPersonen", tags: ["personen"], responses: { 200: { content: { "application/json": { schema: { $ref: "#/components/schemas/Persoon" } } } } } } },
      "/orders": { get: { operationId: "listOrders", tags: ["orders"], responses: { 200: { content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } } } } },
    },
    components: {
      schemas: {
        Persoon: { type: "object", properties: { naam: { type: "string" } } },
        Order: { type: "object", properties: { regels: { type: "array", items: { $ref: "#/components/schemas/Orderregel" } } } },
        Orderregel: { type: "object", properties: { aantal: { type: "integer" } } },
        Betaalwijze: { oneOf: [{ $ref: "#/components/schemas/Persoon" }, { $ref: "#/components/schemas/Order" }] },
      },
    },
  };
  const { elements, diagrams } = van(docMetTags);
  const oneOfs = Object.values(elements).filter((el) => el.elementType === "oneOf");
  assert.equal(oneOfs.length, 2, "beide oneOf-varianten");
  assert.ok(oneOfs.every((c) => c.source === "Betaalwijze"));

  assert.ok(diagrams.tag_personen, "diagram per tag");
  assert.ok(diagrams.tag_orders);
  const ordersNodes = diagrams.tag_orders.nodes.map((n) => n.elementId);
  assert.ok(ordersNodes.includes("Order"), "direct geraakte schema");
  assert.ok(ordersNodes.includes("Orderregel"), "transitief (items) geraakte schema");
  assert.ok(!ordersNodes.includes("Persoon"), "andere tag blijft erbuiten");
});

test("oas-terugreis: naarOasDocument reconstrueert schemas, refs, allOf en paths", async () => {
  const { vanOasDocument: van, naarOasDocument: naar } = await import("./adapter.js");
  const core = van(doc);
  const terug = naar({ elements: core.elements, meta: core.meta });

  assert.equal(terug.openapi, "3.1.0");
  assert.equal(terug.info.title, "Personen-API");

  const persoon = terug.components.schemas.Persoon;
  assert.deepEqual(persoon.required, ["bsn"]);
  assert.deepEqual(persoon.properties.geboortedatum, { type: "string", format: "date" });
  assert.deepEqual(persoon.properties.adres, { $ref: "#/components/schemas/Adres" });
  assert.deepEqual(persoon.properties.kleuren, {
    type: "array",
    items: { $ref: "#/components/schemas/Kleur" },
  });

  const werknemer = terug.components.schemas.Werknemer;
  assert.ok(Array.isArray(werknemer.allOf), "allOf blijft");
  assert.deepEqual(werknemer.allOf[0], { $ref: "#/components/schemas/Persoon" });
  assert.deepEqual(werknemer.allOf[1].required, ["personeelsnummer"]);

  assert.deepEqual(terug.components.schemas.Kleur.enum, ["rood", "blauw"]);

  const get = terug.paths["/personen/{id}"].get;
  assert.equal(get.operationId, "getPersoon");
  assert.deepEqual(get.responses["200"].content["application/json"].schema, {
    $ref: "#/components/schemas/Persoon",
  });
  const post = terug.paths["/personen"].post;
  assert.deepEqual(post.requestBody.content["application/json"].schema, {
    $ref: "#/components/schemas/Persoon",
  });
});

test("oasRijenPosities: operaties op rij 0 in CRUD-volgorde, schemas eronder", () => {
  const elements = {
    opDel: { id: "opDel", elementType: "operatie", naam: "del", data: { method: "DELETE", pad: "/x" } },
    opPost: { id: "opPost", elementType: "operatie", naam: "post", data: { method: "POST", pad: "/x" } },
    sch: { id: "sch", elementType: "schema", naam: "S", data: {} },
  };
  const pos = oasRijenPosities({
    ids: ["opDel", "opPost", "sch"],
    elements,
    edges: [{ source: "opPost", target: "sch" }],
  });
  assert.equal(pos.opPost.y, pos.opDel.y, "operaties delen rij 0");
  assert.ok(pos.opPost.x < pos.opDel.x, "POST staat links van DELETE (CRUD)");
  assert.ok(pos.sch.y > pos.opPost.y, "schema staat onder de operaties");
});

test("vanOasDocument: operaties staan boven de schemas in het componenten-diagram", () => {
  const core = vanOasDocument(doc);
  const posities = Object.fromEntries(
    core.diagrams.componenten.nodes.map((n) => [n.elementId, n.position])
  );
  const opY = Math.max(
    ...Object.values(core.elements)
      .filter((el) => el.elementType === "operatie")
      .map((el) => posities[el.id].y)
  );
  const schemaMinY = Math.min(
    ...Object.values(core.elements)
      .filter((el) => el.elementType === "schema" && posities[el.id])
      .map((el) => posities[el.id].y)
  );
  assert.ok(opY < schemaMinY, `operaties (y<=${opY}) horen boven de schemas (y>=${schemaMinY})`);
});

// ── Volledige-spec-dekking: info/servers/tags, benoemde componenten,
// externe $refs, primitieve schemas en property-details ───────────────────
const volledigDoc = {
  openapi: "3.1.0",
  info: {
    title: "Logboek API",
    version: "1.1.0",
    description: "API voor het lezen van een logboek",
    license: { name: "CC4", url: "https://example.org/LICENSE" },
    contact: { name: "Beheer", email: "api@example.org" },
  },
  servers: [{ url: "https://example.org/lezenapi/v1", description: "productie" }],
  tags: [{ name: "Activiteiten", description: "Alles rond activiteiten." }],
  paths: {
    "/activiteiten": {
      post: {
        operationId: "zoekActiviteiten",
        summary: "Zoek activiteiten",
        description: "Alle activiteiten ophalen",
        tags: ["Activiteiten"],
        parameters: [
          { name: "expand", in: "query", schema: { type: "string" }, description: "extra velden" },
        ],
        requestBody: { $ref: "#/components/requestBodies/ZoekRequest" },
        responses: {
          200: { $ref: "#/components/responses/ActiviteitenResponse" },
          400: { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
  },
  components: {
    requestBodies: {
      ZoekRequest: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/ZoekVraag" } } },
      },
    },
    responses: {
      ActiviteitenResponse: {
        description: "OK",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Activiteit" } } },
      },
      BadRequest: {
        description: "Bad Request",
        content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Probleem" } } },
      },
    },
    schemas: {
      Probleem: { $ref: "./ProblemJson.schema.json" },
      TraceID: {
        type: "string",
        format: "uuid",
        description: "Unieke code van de trace",
        example: "ef4e77b9-b03b-585f-b613-5fcf8d8555fb",
      },
      ZoekVraag: {
        type: "object",
        minProperties: 1,
        description: "Minimaal één veld vullen",
        properties: { traceId: { $ref: "#/components/schemas/TraceID" } },
      },
      Activiteit: {
        type: "object",
        required: ["spanId"],
        properties: {
          traceId: { $ref: "#/components/schemas/TraceID" },
          spanId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{16}$",
            description: "Unieke code van de actie",
            examples: ["beb0291b5162d850"],
          },
          naam: { type: ["string", "null"], default: "onbekend" },
        },
      },
    },
  },
};

test("oas-import: info wordt een api-element, servers worden server-elementen", () => {
  const { elements } = vanOasDocument(volledigDoc);
  const api = Object.values(elements).find((el) => el.elementType === "api");
  assert.equal(api.naam, "Logboek API");
  assert.equal(api.data.versie, "1.1.0");
  assert.equal(api.data.beschrijving, "API voor het lezen van een logboek");
  assert.equal(api.data.licentie, "CC4");
  assert.equal(api.data.contact, "Beheer · api@example.org");

  const server = Object.values(elements).find((el) => el.elementType === "server");
  assert.equal(server.naam, "https://example.org/lezenapi/v1");
  assert.equal(server.data.beschrijving, "productie");
  const conn = Object.values(elements).find((el) => el.elementType === "servers");
  assert.equal(conn.source, api.id);
  assert.equal(conn.target, server.id);
});

test("oas-import: benoemde requestBodies/responses worden gevolgd, óók 4xx", () => {
  const { elements } = vanOasDocument(volledigDoc);
  const op = Object.values(elements).find((el) => el.elementType === "operatie");
  assert.equal(op.data.beschrijving, "Alle activiteiten ophalen");

  const conns = Object.values(elements).filter((el) => el.source === op.id && el.elementType === "ref");
  assert.ok(conns.some((c) => c.target === "ZoekVraag" && c.data.rolnaam === "request"), "$ref-requestBody gevolgd");
  assert.ok(conns.some((c) => c.target === "Activiteit" && c.data.rolnaam === "response 200"));
  assert.ok(conns.some((c) => c.target === "Probleem" && c.data.rolnaam === "response 400"), "ook fout-responses");

  const responses = op.compartimenten.find((c) => c.compartmentType === "responses").velden;
  assert.deepEqual(responses.map((v) => v.naam), ["200", "400"]);
  assert.equal(responses[1].data.beschrijving, "Bad Request");
  const parameters = op.compartimenten.find((c) => c.compartmentType === "parameters").velden;
  assert.equal(parameters[0].naam, "expand");
  assert.equal(parameters[0].data.in, "query");
  assert.equal(parameters[0].data.beschrijving, "extra velden");
});

test("oas-import: primitieve, externe en detailrijke schemas komen volledig mee", () => {
  const { elements } = vanOasDocument(volledigDoc);
  assert.equal(elements.TraceID.data.typeLabel, "string «uuid»");
  assert.equal(elements.TraceID.data.voorbeeld, "ef4e77b9-b03b-585f-b613-5fcf8d8555fb");
  assert.equal(elements.Probleem.data.externRef, "./ProblemJson.schema.json");

  const velden = Object.fromEntries(
    elements.Activiteit.compartimenten[0].velden.map((v) => [v.naam, v.data])
  );
  assert.equal(velden.spanId.beschrijving, "Unieke code van de actie");
  assert.equal(velden.spanId.patroon, "^[0-9a-fA-F]{16}$");
  assert.equal(velden.spanId.voorbeeld, "beb0291b5162d850", "3.1 examples-array");
  assert.equal(velden.naam.typeLabel, "string|null", "3.1 type-array");
  assert.equal(velden.naam.standaard, "onbekend");
});

test("oas-terugreis: info/servers/tags/componenten en details reizen mee terug", () => {
  const core = vanOasDocument(volledigDoc);
  const terug = naarOasDocument(core);

  assert.equal(terug.info.title, "Logboek API");
  assert.equal(terug.info.license.name, "CC4");
  assert.equal(terug.info.contact.email, "api@example.org", "contact pass-through via de bron");
  assert.deepEqual(terug.servers, [{ url: "https://example.org/lezenapi/v1", description: "productie" }]);
  assert.deepEqual(terug.tags, volledigDoc.tags);
  assert.deepEqual(terug.components.requestBodies, volledigDoc.components.requestBodies, "pass-through");
  assert.deepEqual(terug.components.responses, volledigDoc.components.responses, "pass-through");

  const op = terug.paths["/activiteiten"].post;
  assert.deepEqual(op.requestBody, { $ref: "#/components/requestBodies/ZoekRequest" }, "$ref blijft");
  assert.deepEqual(op.responses["400"], { $ref: "#/components/responses/BadRequest" }, "$ref blijft");
  assert.equal(op.parameters[0].name, "expand");
  assert.deepEqual(op.parameters[0].schema, { type: "string" });

  const traceId = terug.components.schemas.TraceID;
  assert.equal(traceId.type, "string");
  assert.equal(traceId.format, "uuid");
  assert.equal(traceId.example, "ef4e77b9-b03b-585f-b613-5fcf8d8555fb");
  assert.deepEqual(terug.components.schemas.Probleem, { $ref: "./ProblemJson.schema.json" });
  assert.equal(terug.components.schemas.ZoekVraag.minProperties, 1, "onbeheerde sleutels blijven");

  const spanId = terug.components.schemas.Activiteit.properties.spanId;
  assert.equal(spanId.pattern, "^[0-9a-fA-F]{16}$");
  assert.deepEqual(spanId.examples, ["beb0291b5162d850"], "examples blijft een array");
  const naam = terug.components.schemas.Activiteit.properties.naam;
  assert.deepEqual(naam.type, ["string", "null"], "3.1 type-array terug");
  assert.equal(naam.default, "onbekend");
});

// ── OAS 3.0-dialect: nullable ↔ type-arrays, oas-version stuurt de export ──
const doc30 = {
  openapi: "3.0.2",
  info: { title: "Oud-API", version: "1.0" },
  paths: {
    "/dingen": {
      get: {
        operationId: "listDingen",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Ding" } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Ding: {
        type: "object",
        required: ["naam"],
        properties: {
          naam: { type: "string" },
          bijnaam: { type: "string", nullable: true, description: "Roepnaam" },
        },
      },
      Maat: { type: "string", format: "uuid", nullable: true },
    },
  },
};

test("oas-3.0-import: nullable wordt |null en de oas-version komt op het api-element", () => {
  const { elements, meta } = vanOasDocument(doc30);
  const api = Object.values(elements).find((el) => el.elementType === "api");
  assert.equal(api.data.oasVersie, "3.0.2");
  assert.equal(meta.oasVersie, "3.0.2");
  const velden = Object.fromEntries(elements.Ding.compartimenten[0].velden.map((v) => [v.naam, v.data]));
  assert.equal(velden.bijnaam.typeLabel, "string|null");
  assert.equal(elements.Maat.data.typeLabel, "string|null «uuid»");
});

test("oas-3.0-terugreis: het 3.0-dialect vouwt |null terug naar nullable", () => {
  const core = vanOasDocument(doc30);
  const terug = naarOasDocument(core);
  assert.equal(terug.openapi, "3.0.2");
  assert.deepEqual(terug.components.schemas.Ding.properties.bijnaam, {
    type: "string",
    nullable: true,
    description: "Roepnaam",
  });
  assert.deepEqual(terug.components.schemas.Maat, { type: "string", format: "uuid", nullable: true });
});

test("oas-versiekeuze: 3.0-document geforceerd als 3.1 exporteert type-arrays zonder nullable", () => {
  const core = vanOasDocument(doc30, { oasVersie: "3.1" });
  const api = Object.values(core.elements).find((el) => el.elementType === "api");
  assert.equal(api.data.oasVersie, "3.1.0", "geforceerde keuze wint van het openapi-veld");
  const terug = naarOasDocument(core);
  assert.equal(terug.openapi, "3.1.0");
  assert.deepEqual(terug.components.schemas.Ding.properties.bijnaam, {
    type: ["string", "null"],
    description: "Roepnaam",
  });
  assert.deepEqual(terug.components.schemas.Maat, { type: ["string", "null"], format: "uuid" });
});

test("oas-versiekeuze: oas-version op het api-element omzetten transformeert de export", () => {
  const core = vanOasDocument(doc30);
  const api = Object.values(core.elements).find((el) => el.elementType === "api");
  api.data.oasVersie = "3.1.0"; // gebruiker zet de property om in de inspector
  const terug = naarOasDocument(core);
  assert.equal(terug.openapi, "3.1.0");
  assert.deepEqual(terug.components.schemas.Ding.properties.bijnaam.type, ["string", "null"]);
});

test("oasRijenPosities: api en servers staan op de rij bóven de operaties", () => {
  const elements = {
    api: { id: "api", elementType: "api", naam: "API", data: {} },
    srv: { id: "srv", elementType: "server", naam: "https://x", data: {} },
    op: { id: "op", elementType: "operatie", naam: "op", data: { method: "GET", pad: "/x" } },
    sch: { id: "sch", elementType: "schema", naam: "S", data: {} },
  };
  const pos = oasRijenPosities({
    ids: ["api", "srv", "op", "sch"],
    elements,
    edges: [
      { source: "api", target: "srv" },
      { source: "op", target: "sch" },
    ],
  });
  assert.equal(pos.api.y, pos.srv.y, "api en server delen de bovenste rij");
  assert.ok(pos.api.x < pos.srv.x, "api links van zijn servers");
  assert.ok(pos.api.y < pos.op.y, "boven de operaties");
  assert.ok(pos.op.y < pos.sch.y, "operaties boven de schemas");
});

test("oasRijenPosities: kinderen sorteren onder hun ouders (zwaartepunt)", () => {
  const elements = {
    opA: { id: "opA", elementType: "operatie", naam: "a", data: { method: "POST", pad: "/a" } },
    opB: { id: "opB", elementType: "operatie", naam: "b", data: { method: "GET", pad: "/b" } },
    sA: { id: "sA", elementType: "schema", naam: "Zebra", data: {} },
    sB: { id: "sB", elementType: "schema", naam: "Aap", data: {} },
  };
  const pos = oasRijenPosities({
    ids: ["opA", "opB", "sA", "sB"],
    elements,
    edges: [
      { source: "opA", target: "sA" },
      { source: "opB", target: "sB" },
    ],
  });
  assert.ok(pos.opA.x < pos.opB.x, "POST links van GET");
  // alfabetisch zou Aap eerst komen; het ouder-zwaartepunt zet Zebra (kind
  // van de linker operatie) links van Aap (kind van de rechter operatie)
  assert.ok(pos.sA.x < pos.sB.x, "kind volgt zijn ouder, niet het alfabet");
});
