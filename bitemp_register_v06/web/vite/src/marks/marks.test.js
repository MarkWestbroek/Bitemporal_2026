import test from "node:test";
import assert from "node:assert/strict";
import {
  leegMarks, doelSleutel, markId, normaliseerMarks, metLaag, zonderLaag, metContext, zetMark, wisMark,
  lagenVoorFilter, contextLagen, effectieveMarks, marksVoor, wezen, marksBijlage, diffMarks, patchMarks, heeftMarks,
} from "./marks.js";
import { registreerMarksoorten, getMarksoort, marksoortenVoor, valideerMark, naamruimteVan, REGISTER_MARKSOORTEN } from "./marksoorten.js";

const VELD = { soort: "veld", uuid: "u-kaartnummer" };
const TAAK = { soort: "element", profielId: "bpmnMotor05", elementId: "taak1" };

const basis = () => {
  let st = leegMarks();
  st = metLaag(st, { id: "algemeen", naam: "Algemeen" });
  st = metLaag(st, { id: "ws", naam: "Waterstede", labels: [{ soort: "gemeente", waarde: "Waterstede" }] });
  st = metLaag(st, { id: "test", naam: "cg-test", labels: [{ soort: "omgeving", waarde: "cg-test" }, { soort: "gemeente", waarde: "Waterstede" }] });
  st = zetMark(st, { laag: "algemeen", soort: "register.zoeksleutel", doel: VELD, waarde: true });
  st = zetMark(st, { laag: "algemeen", soort: "register.sorteerbaar", doel: VELD, waarde: true });
  st = zetMark(st, { laag: "ws", soort: "register.sorteerbaar", doel: VELD, waarde: null });
  st = zetMark(st, { laag: "test", soort: "gzac.kandidaatgroep", doel: TAAK, waarde: "ROLE_TEST" });
  return st;
};

test("doelSleutel: uuid wint; zonder uuid profiel en element; map op id", () => {
  assert.equal(doelSleutel(VELD), "u:u-kaartnummer");
  assert.equal(doelSleutel({ ...VELD, profielId: "x", elementId: "y" }), "u:u-kaartnummer");
  assert.equal(doelSleutel(TAAK), "e:bpmnMotor05::taak1");
  assert.equal(doelSleutel({ soort: "veld", profielId: "p", elementId: "e", veldNaam: "naam" }), "e:p::e#naam");
  assert.equal(doelSleutel({ soort: "map", mapId: "m1" }), "m:m1");
  assert.equal(doelSleutel({ soort: "element" }), "");
});

test("zetMark: één mark per laag, soort en doel; vaste id", () => {
  let st = basis();
  const n = st.marks.length;
  st = zetMark(st, { laag: "algemeen", soort: "register.zoeksleutel", doel: VELD, waarde: false });
  assert.equal(st.marks.length, n);
  assert.equal(st.marks.find((m) => m.id === markId("algemeen", "register.zoeksleutel", VELD)).waarde, false);
  assert.throws(() => zetMark(st, { laag: "bestaat-niet", soort: "x.y", doel: VELD, waarde: true }), /bestaat niet/);
  assert.throws(() => zetMark(st, { laag: "algemeen", soort: "x.y", doel: { soort: "veld" }, waarde: true }), /doel/);
});

test("effectieveMarks: de volgorde in de context beslist; null zet uit", () => {
  const st = basis();
  assert.deepEqual(marksVoor(st, VELD, ["algemeen"]), { "register.zoeksleutel": true, "register.sorteerbaar": true });
  // Waterstede zet sorteerbaar uit.
  assert.deepEqual(marksVoor(st, VELD, ["algemeen", "ws"]), { "register.zoeksleutel": true });
  // Andere volgorde, andere uitkomst: algemeen komt ná Waterstede en wint.
  assert.deepEqual(marksVoor(st, VELD, ["ws", "algemeen"]), { "register.zoeksleutel": true, "register.sorteerbaar": true });
  // Een laag buiten het filter doet niet mee.
  assert.deepEqual(marksVoor(st, TAAK, ["algemeen", "ws"]), {});
  assert.deepEqual(marksVoor(st, TAAK, ["algemeen", "test"]), { "gzac.kandidaatgroep": "ROLE_TEST" });
  const detail = effectieveMarks(st, ["algemeen", "ws"]).get(doelSleutel(VELD)).soorten["register.sorteerbaar"];
  assert.equal(detail.uit, true);
  assert.equal(detail.laag, "ws");
  assert.deepEqual(detail.overschreven, [{ laag: "algemeen", waarde: true }]);
});

test("context: op naam bewaard; onbekende en dubbele lagen vallen weg", () => {
  let st = basis();
  st = metContext(st, { id: "ws-test", naam: "Waterstede op cg-test", lagen: ["algemeen", "ws", "weg", "test", "ws"] });
  assert.deepEqual(st.contexten[0].lagen, ["algemeen", "ws", "test", "ws"]);
  assert.deepEqual(contextLagen(st, "ws-test"), ["algemeen", "ws", "test"]);
  assert.deepEqual(contextLagen(st, { lagen: ["test", "nee"] }), ["test"]);
  assert.deepEqual(contextLagen(st, null), []);
  assert.deepEqual(marksVoor(st, TAAK, "ws-test"), { "gzac.kandidaatgroep": "ROLE_TEST" });
});

test("lagenVoorFilter: elk gevraagd label moet op de laag staan", () => {
  const st = basis();
  assert.deepEqual(lagenVoorFilter(st.lagen).map((l) => l.id), ["algemeen", "ws", "test"]);
  assert.deepEqual(lagenVoorFilter(st.lagen, [{ soort: "gemeente", waarde: "Waterstede" }]).map((l) => l.id), ["ws", "test"]);
  assert.deepEqual(lagenVoorFilter(st.lagen, [{ soort: "gemeente", waarde: "Waterstede" }, { soort: "omgeving", waarde: "cg-test" }]).map((l) => l.id), ["test"]);
});

test("zonderLaag haalt marks en contextverwijzingen mee weg; wisMark laat de onderliggende weer gelden", () => {
  let st = metContext(basis(), { id: "c", lagen: ["algemeen", "ws"] });
  const uitzet = markId("ws", "register.sorteerbaar", VELD);
  assert.deepEqual(marksVoor(wisMark(st, uitzet), VELD, "c"), { "register.zoeksleutel": true, "register.sorteerbaar": true });
  st = zonderLaag(st, "ws");
  assert.deepEqual(st.contexten[0].lagen, ["algemeen"]);
  assert.equal(st.marks.some((m) => m.laag === "ws"), false);
});

test("wezen en bijlage: wat geldt, in vaste volgorde, zonder uitgezette marks en zonder wezen", () => {
  const st = basis();
  const bestaat = (d) => d.uuid === "u-kaartnummer";
  assert.deepEqual(wezen(st, bestaat).map((m) => m.soort), ["gzac.kandidaatgroep"]);
  const bijlage = marksBijlage(st, ["algemeen", "ws", "test"]);
  assert.deepEqual(bijlage.context, ["algemeen", "ws", "test"]);
  assert.deepEqual(bijlage.marks, [
    { doel: TAAK, soort: "gzac.kandidaatgroep", waarde: "ROLE_TEST" },
    { doel: VELD, soort: "register.zoeksleutel", waarde: true },
  ]);
  assert.deepEqual(marksBijlage(st, ["algemeen", "ws", "test"], { bestaat }).marks.map((m) => m.soort), ["register.zoeksleutel"]);
  assert.deepEqual(JSON.stringify(marksBijlage(st, ["algemeen"])), JSON.stringify(marksBijlage(normaliseerMarks(JSON.parse(JSON.stringify(st))), ["algemeen"])));
});

test("normaliseerMarks: onleesbaar valt weg, ids worden vast, dubbelen één keer", () => {
  const st = normaliseerMarks({
    lagen: [{ id: "a" }, { naam: "zonder id" }, null],
    contexten: [{ id: "c", lagen: ["a", "x"] }],
    marks: [
      { laag: "a", soort: "register.zoeksleutel", doel: VELD, waarde: true },
      { id: "anders", laag: "a", soort: "register.zoeksleutel", doel: VELD, waarde: false },
      { laag: "x", soort: "register.zoeksleutel", doel: VELD, waarde: true },
      { laag: "a", soort: "register.zoeksleutel", doel: { soort: "veld" } },
    ],
  });
  assert.deepEqual(st.lagen, [{ id: "a", naam: "a", labels: [] }]);
  assert.deepEqual(st.contexten, [{ id: "c", naam: "c", lagen: ["a"] }]);
  assert.equal(st.marks.length, 1);
  assert.equal(st.marks[0].id, markId("a", "register.zoeksleutel", VELD));
  assert.deepEqual(normaliseerMarks(undefined), leegMarks());
});

test("marksoorten: naamruimte verplicht, doelen en datatype getoetst", () => {
  registreerMarksoorten(REGISTER_MARKSOORTEN);
  registreerMarksoorten([{ id: "proef.vorm", datatype: "keuze", opties: [{ waarde: "kort" }, { waarde: "lang" }] }]);
  assert.throws(() => registreerMarksoorten([{ id: "zondernaamruimte" }]), /naamruimte/);
  assert.equal(getMarksoort("register.zoeksleutel").datatype, "boolean");
  assert.equal(naamruimteVan("register.zoeksleutel"), "register");
  const bij = { profiel: "canoniek-uml", elementType: "gegevenselement" };
  assert.deepEqual(marksoortenVoor(VELD, bij).map((s) => s.id), ["proef.vorm", "register.sorteerbaar", "register.tekstzoeken", "register.zoeksleutel"]);
  assert.deepEqual(marksoortenVoor(TAAK, { profiel: "bpmn" }).map((s) => s.id), ["proef.vorm"]);
  assert.deepEqual(valideerMark({ soort: "register.zoeksleutel", doel: VELD, waarde: true }, bij), []);
  assert.deepEqual(valideerMark({ soort: "register.zoeksleutel", doel: VELD, waarde: null }, bij), []);
  assert.equal(valideerMark({ soort: "register.zoeksleutel", doel: VELD, waarde: "ja" }, bij).length, 1);
  assert.equal(valideerMark({ soort: "register.zoeksleutel", doel: TAAK, waarde: true }, { profiel: "bpmn" }).length, 1);
  assert.equal(valideerMark({ soort: "proef.vorm", doel: VELD, waarde: "breed" }, bij).length, 1);
  assert.match(valideerMark({ soort: "onbekend.iets", doel: VELD, waarde: true })[0], /Onbekende marksoort/);
});

test("diffMarks en patchMarks: het verschil toepassen geeft de nieuwe stand", () => {
  const voor = basis();
  let na = zetMark(voor, { laag: "algemeen", soort: "register.zoeksleutel", doel: VELD, waarde: false });
  na = wisMark(na, markId("ws", "register.sorteerbaar", VELD));
  na = metLaag(na, { id: "nieuw", naam: "Nieuw" });
  na = zonderLaag(na, "test");
  na = metContext(na, { id: "c", lagen: ["algemeen", "nieuw"] });
  const patch = diffMarks(voor, na);
  assert.deepEqual(patch.lagen, { zet: [{ id: "nieuw", naam: "Nieuw", labels: [] }], wis: ["test"] });
  assert.equal(patch.marks.zet.length, 1);
  assert.equal(patch.marks.wis.length, 2); // de uitgezette mark en de mark van de verdwenen laag
  assert.deepEqual(patchMarks(voor, patch), na);
  assert.equal(diffMarks(na, JSON.parse(JSON.stringify(na))), null);
  // Een mark voor een laag die er niet is valt weg.
  assert.equal(patchMarks(leegMarks(), { marks: { zet: [{ id: "x", laag: "weg", soort: "a.b", doel: VELD, waarde: 1 }], wis: [] } }).marks.length, 0);
  assert.equal(heeftMarks(leegMarks()), false);
  assert.equal(heeftMarks(voor), true);
});

test("V3-bijlage: alleen wat geldt en in het model staat; zonder marks blijft het bestand gelijk", async () => {
  const { metMarksBijlage, uuidsIn } = await import("./v3Bijlage.js");
  const v3 = { model: { naam: "m", entiteiten: [{ uuid: "u-ent", gegevenselementen: [{ uuid: "u-ge", velden: [{ naam: "kaartnummer", uuid: "u-kaartnummer" }] }] }] } };
  assert.deepEqual([...uuidsIn(v3)].sort(), ["u-ent", "u-ge", "u-kaartnummer"]);
  const st = basis(); // mark op VELD (u-kaartnummer) en op een BPMN-taak
  const uit = metMarksBijlage(v3, st, ["algemeen", "test"]);
  assert.deepEqual(uit.marks, { context: ["algemeen", "test"], marks: [
    { doel: VELD, soort: "register.sorteerbaar", waarde: true },
    { doel: VELD, soort: "register.zoeksleutel", waarde: true },
  ] });
  assert.equal(uit.model, v3.model);
  // Zonder context: alle lagen in de volgorde van het project (Waterstede zet sorteerbaar uit).
  assert.deepEqual(metMarksBijlage(v3, st).marks.marks.map((m) => m.soort), ["register.zoeksleutel"]);
  assert.deepEqual(metMarksBijlage(v3, st).marks.context, ["algemeen", "ws", "test"]);
  // Niets wat geldt of niets in dit model: geen sleutel `marks`.
  assert.equal(metMarksBijlage(v3, leegMarks()), v3);
  assert.equal(metMarksBijlage({ model: { entiteiten: [] } }, st).marks, undefined);
});

test("eigen marksoorten van het project: maken, bijwerken, weghalen; mee in diff en patch", async () => {
  const { metSoort, zonderSoort, projectSoortId } = await import("./marks.js");
  const { zetProjectsoorten, getMarksoort, marksoortenVoor } = await import("./marksoorten.js");
  let st = basis();
  assert.equal(projectSoortId("Archiveren na 5 jaar", st.soorten), "project.Archiveren-na-5-jaar");
  st = metSoort(st, { id: "project.archief", label: "archiveren", datatype: "boolean", doelen: ["element", "relatie"] });
  st = metSoort(st, { id: "project.niveau", label: "niveau", datatype: "keuze", opties: [{ waarde: "laag" }, { waarde: "hoog" }, { waarde: "" }], doelen: ["bestaat-niet"] });
  assert.equal(projectSoortId("archief", st.soorten), "project.archief-2");
  assert.deepEqual(st.soorten[1], { id: "project.niveau", label: "niveau", datatype: "keuze", opties: [{ waarde: "laag" }, { waarde: "hoog" }], doelen: ["element"] });
  // Zonder de naamruimte van het project komt een soort er niet in.
  assert.equal(metSoort(st, { id: "register.eigen", label: "x" }), st);
  // In de registry gelden ze in elke taal, op de gekozen doelen.
  zetProjectsoorten(st.soorten);
  assert.equal(getMarksoort("project.archief").label, "archiveren");
  assert.ok(marksoortenVoor({ soort: "element" }, { profiel: "bpmn", elementType: "userTask" }).some((s) => s.id === "project.archief"));
  assert.equal(marksoortenVoor({ soort: "veld" }, { profiel: "bpmn" }).some((s) => s.id === "project.archief"), false);
  // Diff en patch nemen de soorten mee; weghalen laat de marks staan.
  const patch = diffMarks(basis(), st);
  assert.deepEqual(patch.soorten.zet.map((s) => s.id), ["project.archief", "project.niveau"]);
  assert.deepEqual(patchMarks(basis(), patch), st);
  const met = zetMark(st, { laag: "algemeen", soort: "project.archief", doel: TAAK, waarde: true });
  const zonder = zonderSoort(met, "project.archief");
  assert.equal(zonder.soorten.length, 1);
  assert.equal(zonder.marks.some((m) => m.soort === "project.archief"), true);
  assert.equal(heeftMarks({ ...leegMarks(), soorten: st.soorten }), true);
  zetProjectsoorten([]);
  assert.equal(getMarksoort("project.archief"), null);
});
