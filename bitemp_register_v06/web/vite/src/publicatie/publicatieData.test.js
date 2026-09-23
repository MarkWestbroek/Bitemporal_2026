import { test } from "node:test";
import assert from "node:assert/strict";
import {
  voerDocumentUit,
  eersteLijst,
  haalLijstViaDocument,
  haalDetailViaDocument,
  resolveVeldpad,
  geItems,
} from "./publicatieData.js";

/** Nep-fetch die per aanroep een antwoord uit `antwoorden` geeft en de bodies bewaart. */
function nepFetch(antwoorden) {
  const aanroepen = [];
  const fn = async (url, init) => {
    aanroepen.push({ url, body: JSON.parse(init.body) });
    const a = antwoorden[Math.min(aanroepen.length - 1, antwoorden.length - 1)];
    return { ok: a.status ? a.status < 400 : true, status: a.status || 200, json: async () => a.json };
  };
  fn.aanroepen = aanroepen;
  return fn;
}

test("voerDocumentUit stuurt documentId en variabelen, geeft data terug", async () => {
  const fetchFn = nepFetch([{ json: { data: { x: [1] } } }]);
  const data = await voerDocumentUit({ baseUrl: "http://b", documentId: "d", variables: { a: 1 }, fetchFn });
  assert.deepEqual(data, { x: [1] });
  assert.equal(fetchFn.aanroepen[0].url, "http://b/graphql/query");
  assert.deepEqual(fetchFn.aanroepen[0].body, { documentId: "d", variables: { a: 1 } });
});

test("voerDocumentUit: 410 met reden en GraphQL-fouten worden leesbare fouten", async () => {
  await assert.rejects(
    voerDocumentUit({ baseUrl: "b", documentId: "oud", fetchFn: nepFetch([{ status: 410, json: { error: "document ingetrokken", reden: "vervangen" } }]) }),
    /ingetrokken \(vervangen\)/
  );
  await assert.rejects(
    voerDocumentUit({ baseUrl: "b", documentId: "x", fetchFn: nepFetch([{ json: { data: null, errors: [{ message: "Cannot query field" }] } }]) }),
    /Cannot query field/
  );
  await assert.rejects(
    voerDocumentUit({ baseUrl: "b", documentId: "x", fetchFn: nepFetch([{ status: 404, json: null }]) }),
    /HTTP 404/
  );
});

test("eersteLijst vindt de lijst ongeacht de naam van het root-veld", () => {
  assert.deepEqual(eersteLijst({ full_initiatieven_list: [{ id: 1 }] }), [{ id: 1 }]);
  assert.deepEqual(eersteLijst({ iets: "x", rijen: [] }), []);
  assert.deepEqual(eersteLijst(null), []);
});

test("haalLijstViaDocument bladert tot een korte pagina en plakt alles aaneen", async () => {
  const rij = (n) => ({ id: n });
  const fetchFn = nepFetch([
    { json: { data: { l: Array.from({ length: 3 }, (_, i) => rij(i)) } } },
    { json: { data: { l: Array.from({ length: 3 }, (_, i) => rij(3 + i)) } } },
    { json: { data: { l: [rij(6)] } } },
  ]);
  const alles = await haalLijstViaDocument({ baseUrl: "b", documentId: "d", fetchFn, paginaGrootte: 3, extra: { id: { gte: 0 } } });
  assert.deepEqual(alles.map((r) => r.id), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(fetchFn.aanroepen.length, 3);
  assert.deepEqual(fetchFn.aanroepen[1].body.variables, { limit: 3, offset: 3, extra: { id: { gte: 0 } } });
});

test("haalLijstViaDocument: precies één volle pagina gevolgd door een lege stopt na twee aanroepen", async () => {
  const fetchFn = nepFetch([{ json: { data: { l: [{ id: 1 }, { id: 2 }] } } }, { json: { data: { l: [] } } }]);
  const alles = await haalLijstViaDocument({ baseUrl: "b", documentId: "d", fetchFn, paginaGrootte: 2 });
  assert.equal(alles.length, 2);
  assert.equal(fetchFn.aanroepen.length, 2);
});

test("haalDetailViaDocument geeft het eerste record of null, met $id als getal", async () => {
  const fetchFn = nepFetch([{ json: { data: { full_initiatieven_list: [{ id: 7, producten: { naam: "P" } }] } } }]);
  const rec = await haalDetailViaDocument({ baseUrl: "b", documentId: "det", id: "7", fetchFn });
  assert.equal(rec.producten.naam, "P");
  assert.deepEqual(fetchFn.aanroepen[0].body.variables, { id: 7 });
  const leeg = await haalDetailViaDocument({ baseUrl: "b", documentId: "det", id: 8, fetchFn: nepFetch([{ json: { data: { full_initiatieven_list: [] } } }]) });
  assert.equal(leeg, null);
});

// ── resolveVeldpad op beide vormen ──────────────────────────────────────────────

const typeMetaByTypenaam = {
  Initiatief_Product: { ge_subtype: "hub", klassenaam: "Product", onderliggende: [{ doeltype: "Initiatief_Product_Data", jsonRolnaam: "data" }] },
  Initiatief_Product_Data: { ge_subtype: "data", idKolom: "versie" },
  InitiatiefDomein: { ge_subtype: "hub", klassenaam: "InitiatiefDomein", onderliggende: [{ doeltype: "InitiatiefDomein_Data", jsonRolnaam: "data" }] },
  InitiatiefDomein_Data: { ge_subtype: "data", idKolom: "versie" },
};
const typeMeta = {
  onderliggende: [
    { doeltype: "Initiatief_Product", jsonRolnaam: "producten", rolnaam: "Producten", momentvoorkomen: "enkelvoudig" },
    { doeltype: "InitiatiefDomein", jsonRolnaam: "initiatief_domeinen", rolnaam: "InitiatiefDomeinen", momentvoorkomen: "meervoudig" },
  ],
};

const restRij = {
  id: 1,
  producten: [{ rel_id: 1, data: [{ versie: 1, naam: "Oud", afvoer: "2026-01-01" }, { versie: 2, naam: "Nieuw" }] }],
  initiatief_domeinen: [
    { rel_id: 1, weergavenaam: "Burgerzaken", data: [{ versie: 1 }] },
    { rel_id: 2, weergavenaam: "Bestuur", data: [{ versie: 1 }] },
  ],
};
const graphqlRij = {
  id: 1,
  producten: { rel_id: 1, naam: "Nieuw" }, // enkelvoudig: object, al platgeslagen
  initiatief_domeinen: [{ rel_id: 1, weergavenaam: "Burgerzaken" }, { rel_id: 2, weergavenaam: "Bestuur" }],
};

test("resolveVeldpad: REST-vorm (hub.data[]) — actuele dataversie, meervoudig gejoind", () => {
  assert.equal(resolveVeldpad(restRij, "id", typeMeta, typeMetaByTypenaam), 1);
  assert.equal(resolveVeldpad(restRij, "producten.data.naam", typeMeta, typeMetaByTypenaam), "Nieuw");
  assert.equal(resolveVeldpad(restRij, "initiatief_domeinen.weergavenaam", typeMeta, typeMetaByTypenaam), "Burgerzaken, Bestuur");
});

test("resolveVeldpad: GraphQL-vorm (platgeslagen; enkelvoudig als object) — zelfde paden, zelfde uitkomst", () => {
  assert.equal(resolveVeldpad(graphqlRij, "producten.data.naam", typeMeta, typeMetaByTypenaam), "Nieuw");
  assert.equal(resolveVeldpad(graphqlRij, "producten.naam", typeMeta, typeMetaByTypenaam), "Nieuw");
  assert.equal(resolveVeldpad(graphqlRij, "Product.naam", typeMeta, typeMetaByTypenaam), "Nieuw"); // klassenaam
  assert.equal(resolveVeldpad(graphqlRij, "initiatief_domeinen.weergavenaam", typeMeta, typeMetaByTypenaam), "Burgerzaken, Bestuur");
  assert.equal(resolveVeldpad({ id: 2, producten: null }, "producten.naam", typeMeta, typeMetaByTypenaam), null);
  assert.equal(resolveVeldpad(graphqlRij, "bestaat_niet.x", typeMeta, typeMetaByTypenaam), null);
});

test("geItems: object → [object], lijst → lijst, null → []", () => {
  const child = typeMeta.onderliggende[0];
  assert.equal(geItems({ producten: { naam: "a" } }, child, typeMetaByTypenaam.Initiatief_Product, typeMetaByTypenaam).length, 1);
  assert.equal(geItems({ producten: [{ naam: "a" }, { naam: "b" }] }, child, typeMetaByTypenaam.Initiatief_Product, typeMetaByTypenaam).length, 2);
  assert.deepEqual(geItems({}, child, typeMetaByTypenaam.Initiatief_Product, typeMetaByTypenaam), []);
});
