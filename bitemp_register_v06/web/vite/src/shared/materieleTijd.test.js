import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tijdprecisieVan, materieleKinderen, materieleTijdVan, sorteerOpAanvang, isGeldigOp,
  naarInvoer, vanInvoer, toonMoment, sleutelVanVoorkomen, bouwMaterieleTijd, materieleTijdGewijzigd,
} from "./materieleTijd.js";

// MeldingStatus zoals de schema-API hem levert (tijdstipprecisie, 27-10-2026).
const hubMeta = {
  typenaam: "Melding_MeldingStatus", ge_subtype: "hub", isMaterieel: true, tijdprecisie: "tijdstip",
  idKolom: "rel_id", entiteitIDKolom: "melding_id",
  onderliggende: [
    { doeltype: "Melding_MeldingStatus_Data", jsonRolnaam: "data" },
    { doeltype: "Melding_MeldingStatus_Aanvang", jsonRolnaam: "aanvang" },
    { doeltype: "Melding_MeldingStatus_Einde", jsonRolnaam: "einde" },
  ],
};
const typeMetaByTypenaam = {
  Melding_MeldingStatus_Data: { ge_subtype: "data" },
  Melding_MeldingStatus_Aanvang: { ge_subtype: "aanvang", veldnaam: "melding_meldingstatus_aanvang" },
  Melding_MeldingStatus_Einde: { ge_subtype: "einde", veldnaam: "melding_meldingstatus_einde" },
};
const kinderen = materieleKinderen(hubMeta, typeMetaByTypenaam);

test("tijdprecisie: tijdstip of standaard datum", () => {
  assert.equal(tijdprecisieVan(hubMeta), "tijdstip");
  assert.equal(tijdprecisieVan({}), "datum");
});

test("materieleTijdVan: actieve aanvang en einde, afgevoerde versies tellen niet", () => {
  const hub = {
    melding_id: 9201, rel_id: 1,
    aanvang: [
      { datum: "2026-10-27T08:00:00Z", opvoer: "t1", afvoer: "t2" },
      { datum: "2026-10-27T09:00:00Z", opvoer: "t2", afvoer: null },
    ],
    einde: [{ datum: "2026-10-27T10:00:00Z", opvoer: "t3", afvoer: null }],
  };
  assert.deepEqual(materieleTijdVan(hub, kinderen), { aanvang: "2026-10-27T09:00:00Z", einde: "2026-10-27T10:00:00Z" });
  assert.deepEqual(materieleTijdVan({}, kinderen), { aanvang: null, einde: null });
});

test("sorteerOpAanvang: zonder aanvang eerst, dan oplopend (datum en tijdstip gemengd)", () => {
  const v = [{ id: "c", tijd: { aanvang: "2026-10-27T10:30:00Z" } }, { id: "a", tijd: { aanvang: null } }, { id: "b", tijd: { aanvang: "2026-10-27" } }];
  assert.deepEqual(sorteerOpAanvang(v).map((x) => x.id), ["a", "b", "c"]);
});

test("isGeldigOp: tijdstip half-open, datum met inclusief einde", () => {
  const t = { aanvang: "2026-10-27T09:00:00Z", einde: "2026-10-27T10:00:00Z" };
  assert.equal(isGeldigOp(t, new Date("2026-10-27T09:30:00Z"), "tijdstip"), true);
  assert.equal(isGeldigOp(t, new Date("2026-10-27T10:00:00Z"), "tijdstip"), false);
  assert.equal(isGeldigOp({ aanvang: "2026-10-27T10:00:00Z", einde: null }, new Date("2026-10-27T10:00:00Z"), "tijdstip"), true);
  const d = { aanvang: "2026-03-21", einde: "2026-03-31" };
  assert.equal(isGeldigOp(d, new Date(2026, 2, 31, 23, 0), "datum"), true);
  assert.equal(isGeldigOp(d, new Date(2026, 3, 1, 0, 30), "datum"), false);
  assert.equal(isGeldigOp({ aanvang: null, einde: null }, new Date(), "datum"), true);
});

test("invoer heen en terug: datum ongewijzigd, tijdstip via lokale tijd naar RFC 3339 (UTC)", () => {
  assert.equal(naarInvoer("2026-10-27", "datum"), "2026-10-27");
  assert.equal(vanInvoer("2026-10-27", "datum"), "2026-10-27");
  const rfc = "2026-10-27T09:15:00Z";
  assert.equal(vanInvoer(naarInvoer(rfc, "tijdstip"), "tijdstip"), rfc);
  assert.match(naarInvoer(rfc, "tijdstip"), /^2026-10-27T\d{2}:15$/);
  assert.equal(vanInvoer("", "tijdstip"), null);
});

test("toonMoment: d-m-jjjj en bij tijdstip met uu:mm", () => {
  assert.equal(toonMoment("2026-03-21", "datum"), "21-3-2026");
  assert.match(toonMoment("2026-10-27T09:15:00Z", "tijdstip"), /^27-10-2026 \d{2}:15$/);
  assert.equal(toonMoment(null, "datum"), "—");
});

test("sleutelVanVoorkomen: entiteit-id plus rel_id van de hub", () => {
  assert.deepEqual(sleutelVanVoorkomen({ melding_id: 9201, rel_id: 2, status: "x" }, hubMeta), { melding_id: 9201, rel_id: 2 });
});

test("bouwMaterieleTijd nieuw: shorthand op de hub; aanvang verplicht na een voorganger", () => {
  const { hubVelden, wijzigingen } = bouwMaterieleTijd({
    invoer: { aanvang: "2026-10-27", einde: "" }, precisie: "datum", kinderen, isNieuw: true,
  });
  assert.deepEqual(hubVelden, { aanvang: "2026-10-27" });
  assert.deepEqual(wijzigingen, []);
  assert.throws(() => bouwMaterieleTijd({ invoer: { aanvang: "" }, precisie: "datum", kinderen, isNieuw: true, aanvangVerplicht: true }), /Aanvang is verplicht/);
  assert.throws(() => bouwMaterieleTijd({ invoer: { aanvang: "2026-10-27", einde: "2026-10-01" }, precisie: "datum", kinderen, isNieuw: true }), /vóór de aanvang/);
});

test("bouwMaterieleTijd bestaand: alleen gewijzigde aanvang/einde als eigen opvoer (scenario 22 stap 3)", () => {
  const sleutel = { melding_id: 9201, rel_id: 1 };
  const origineel = { aanvang: "2026-10-27T09:00:00Z", einde: null };
  const invoer = { aanvang: naarInvoer(origineel.aanvang, "tijdstip"), einde: naarInvoer("2026-10-27T11:00:00Z", "tijdstip") };
  const { hubVelden, wijzigingen } = bouwMaterieleTijd({ invoer, origineel, precisie: "tijdstip", kinderen, sleutel, isNieuw: false });
  assert.deepEqual(hubVelden, {});
  assert.deepEqual(wijzigingen, [{ opvoer: { melding_meldingstatus_einde: { melding_id: 9201, rel_id: 1, datum: "2026-10-27T11:00:00Z" } } }]);
  assert.equal(materieleTijdGewijzigd(invoer, origineel, "tijdstip"), true);
  assert.equal(materieleTijdGewijzigd({ aanvang: naarInvoer(origineel.aanvang, "tijdstip"), einde: "" }, origineel, "tijdstip"), false);
  assert.throws(() => bouwMaterieleTijd({ invoer: { aanvang: "" }, origineel, precisie: "tijdstip", kinderen, sleutel, isNieuw: false }), /weghalen/);
});
