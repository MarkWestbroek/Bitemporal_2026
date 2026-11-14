import test from "node:test";
import assert from "node:assert/strict";
import { conditiesNaarCel, juelCondities } from "./conditiesNaarCel.js";

const flow = (id, conditie) => ({ id, naam: id, elementType: "sequence-flow", data: { conditie } });

test("conditiesNaarCel: JUEL wordt CEL, CEL blijft, onvertaalbaar blijft JUEL", () => {
  const elements = {
    a: flow("a", "${uitkomst == 'toegekend'}"),
    b: flow("b", "uitkomst == 'afgewezen'"),
    c: flow("c", "${empty bijlagen}"),
    d: { id: "d", elementType: "taak", data: { conditie: "${x}" } },
    e: flow("e", ""),
  };
  const { patches, omgezet, blijft } = conditiesNaarCel(elements);
  assert.deepEqual(patches, { a: { data: { conditie: "uitkomst == 'toegekend'" } } });
  assert.equal(omgezet, 1);
  assert.deepEqual(blijft.map((b) => b.id), ["c"]);
  assert.equal(juelCondities(elements), 2);
});
