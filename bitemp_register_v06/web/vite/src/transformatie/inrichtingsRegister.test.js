// Lezen uit het inrichting-register: vorm van /full volgens FUNDAMENT (30-10).
import test from "node:test";
import assert from "node:assert/strict";

import { laatsteData, leesRegisterStand, vergelijkMetRegister, leesReferentielijst, haalAlles } from "./inrichtingsRegister.js";

const vk = (rel_id, data, extra = {}) => ({ rel_id, data, ...extra });

const FULL = {
  "full/artefactsoorten": { items: [{ id: 220, artefactsoort_gegevens: [vk(1, [{ versie: 1, code: "dossiertabbladen" }])] }, { id: 202, artefactsoort_gegevens: [vk(1, [{ versie: 1, code: "objecttype" }])] }], has_more: false },
  "full/ediensten": { items: [{ id: 2, edienst_namen: [vk(1, [{ versie: 1, naam: "Gehandicaptenparkeerkaart aanvragen" }])] }] },
  "full/edienstversies": { items: [{ id: 3, edienstversie_nummers: [vk(1, [{ versie: 1, versienummer: "0.1.0" }])], edienstversie_ediensten: [vk(1, [{ versie: 1 }], { edienst_id: 2 })] }] },
  "full/artefacten": {
    items: [
      {
        id: 9,
        artefact_identificaties: [vk(1, [{ versie: 1, soort: 220, identifier: "gehandicaptenparkeerkaart", versienummer: "0.1.0" }])],
        // eerst een afgevoerd voorkomen, dan het geldende met twee versies
        artefact_inhouden: [vk(1, [{ versie: 1, payloadHash: "oud" }], { afvoer: "2026-10-29T10:00:00Z" }), vk(2, [{ versie: 1, payloadHash: "tussen" }, { versie: 2, payloadHash: "e11b" }])],
        artefact_edienstversies: [vk(1, [{ versie: 1 }], { edienstversie_id: 3 })],
      },
      {
        id: 10,
        artefact_identificaties: [vk(1, [{ versie: 1, soort: 202, identifier: "gehandicaptenparkeerkaartaanvraag", versienummer: "0.1.0" }])],
        artefact_inhouden: [vk(1, [{ versie: 1, payloadHash: "abc" }])],
        artefact_edienstversies: [vk(1, [{ versie: 1 }], { edienstversie_id: 3 })],
      },
    ],
  },
  "full/aanvraagtypen": {
    items: [{ id: 1, aanvraagtype_gegevens: [vk(1, [{ versie: 1, code: "gehandicaptenparkeerkaart", omschrijving: "GPK", zaaktypeIdentificatie: "GPK" }])] }],
    has_more: false,
  },
};
const haalJson = async (pad) => FULL[pad.split("?")[0]];

test("laatsteData: laatste voorkomen zonder afvoer/einde, hoogste versie", () => {
  assert.equal(laatsteData(FULL["full/artefacten"].items[0].artefact_inhouden).payloadHash, "e11b");
  assert.equal(laatsteData([vk(1, [{ versie: 1, x: 1 }], { einde: [{ datum: "2026-01-01" }] })]), null);
  assert.equal(laatsteData([]), null);
});

test("haalAlles volgt has_more", async () => {
  const paginas = { 1: { items: [1, 2], has_more: true }, 2: { items: [3], has_more: false } };
  const gezien = [];
  const alle = await haalAlles(async (pad) => { gezien.push(pad); return paginas[new URL(pad, "http://x/").searchParams.get("page")]; }, "full/x");
  assert.deepEqual(alle, [1, 2, 3]);
  assert.deepEqual(gezien, ["full/x?size=500&page=1", "full/x?size=500&page=2"]);
});

test("stand + vergelijking: ongewijzigd, gewijzigd, nieuw", async () => {
  const stand = await leesRegisterStand(haalJson);
  assert.equal(stand.size, 2);
  const bundel = [
    { soort: "dossiertabbladen", identifier: "gehandicaptenparkeerkaart", artefact: { artefactInhoud: { payloadHash: "e11b" } } },
    { soort: "objecttype", identifier: "gehandicaptenparkeerkaartaanvraag", artefact: { artefactInhoud: { payloadHash: "def" } } },
    { soort: "zaaktype", identifier: "GPK", artefact: { artefactInhoud: { payloadHash: "123" } } },
    { soort: "formulier", identifier: "kapot", artefact: null, fout: "x" },
  ];
  const uit = vergelijkMetRegister(bundel, stand, { naam: "Gehandicaptenparkeerkaart aanvragen", versienummer: "0.1.0" });
  assert.deepEqual(uit.map((u) => u.status), ["ongewijzigd", "gewijzigd", "nieuw", "fout"]);
  assert.equal(uit[1].register.id, 10);
  // Andere e-dienstversie: alles nieuw.
  const anders = vergelijkMetRegister(bundel.slice(0, 1), stand, { naam: "Gehandicaptenparkeerkaart aanvragen", versienummer: "0.2.0" });
  assert.equal(anders[0].status, "nieuw");
});

test("referentielijst uit het register: de gegevens zonder versie", async () => {
  const items = await leesReferentielijst(haalJson, "register: /full/aanvraagtypen");
  assert.deepEqual(items, [{ code: "gehandicaptenparkeerkaart", omschrijving: "GPK", zaaktypeIdentificatie: "GPK" }]);
});
