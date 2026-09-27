import { test } from "node:test";
import assert from "node:assert/strict";
import { naarLijstDefinities, gekozenLijst } from "./lijstDefinities.js";

const ld = (id, meta, cfg, extra = {}) => ({
  id,
  ...extra,
  lijst_definitie_metas: [{ rel_id: 1, opvoer: "t1", data: [{ opvoer: "t1", ...meta }] }],
  lijst_definitie_lijstconfigs: cfg ? [{ rel_id: 1, opvoer: "t1", data: [{ opvoer: "t1", ...cfg }] }] : [],
});

const items = [
  ld(1, { naam: "Beheer", code: "fd-beheer", doeltype: "FormulierDefinitie", status: "actief", is_standaard: true },
     { lijst_config_json: JSON.stringify({ kolommen: [{ veldpad: "id" }] }), formulier: " fd-editor ", formulier_kiesbaar: false }),
  ld(2, { naam: "Alles", code: "fd-alles", doeltype: "FormulierDefinitie", status: "actief" }, { lijst_config_json: "{kapot" }),
  ld(3, { naam: "Concept", doeltype: "FormulierDefinitie", status: "concept" }, null),
  ld(4, { naam: "Ander type", doeltype: "Organisatie", status: "actief" }, null),
  ld(5, { naam: "Afgevoerd", doeltype: "FormulierDefinitie", status: "actief" }, null, { afvoer: "t9" }),
];

test("alleen actieve definities van het doeltype, standaard voorop", () => {
  const d = naarLijstDefinities(items, "FormulierDefinitie");
  assert.deepEqual(d.map((x) => x.id), [1, 2]);
  assert.equal(d[0].formulier, "fd-editor");
  assert.equal(d[0].formulierKiesbaar, false);
  assert.deepEqual(d[0].config.kolommen, [{ veldpad: "id" }]);
  assert.equal(d[1].config, null); // kapotte JSON = geen kolommen (automatisch overzicht)
});

test("gekozenLijst: ?lijst= (code of id), anders de standaard; 'automatisch' = geen", () => {
  const d = naarLijstDefinities(items, "FormulierDefinitie");
  assert.equal(gekozenLijst(d, null)?.id, 1);
  assert.equal(gekozenLijst(d, "fd-alles")?.id, 2);
  assert.equal(gekozenLijst(d, "2")?.id, 2);
  assert.equal(gekozenLijst(d, "automatisch"), null);
  assert.equal(gekozenLijst(d, "bestaat-niet"), null);
});
