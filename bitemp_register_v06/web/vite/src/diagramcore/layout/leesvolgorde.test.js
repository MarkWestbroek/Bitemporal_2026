import { test } from "node:test";
import assert from "node:assert/strict";
import { legLeesvolgordeUit, leesvolgordeLayouts, invoerVanCanvas } from "./leesvolgorde.js";

const k = (id, type, x = 0, y = 0, extra = {}) => ({ id, type, x, y, w: 120, h: 50, ...extra });
const v = (bron, doel, soort = "stroom") => ({ bron, doel, soort });

test("activiteitendiagram: van boven naar beneden, begin bovenaan, eind onderaan, een fork naast elkaar", () => {
  const knopen = [k("eind", "eind", 0, 0), k("b", "actie", 300, 0), k("start", "begin", 0, 400), k("a", "actie"), k("c", "actie", 600, 0)];
  const verbindingen = [v("start", "a"), v("a", "b"), v("a", "c"), v("b", "eind"), v("c", "eind")];
  const { posities: p } = legLeesvolgordeUit({ knopen, verbindingen, regels: { richting: "TB", start: ["begin"], eind: ["eind"] } });
  assert.ok(p.start.y < p.a.y && p.a.y < p.b.y && p.b.y < p.eind.y, JSON.stringify(p));
  assert.equal(p.b.y, p.c.y, "b en c in dezelfde laag");
  assert.ok(p.b.x < p.c.x, "volgorde in de laag volgt de huidige plek (b stond links van c)");
});

test("deterministisch, en de linkerbovenhoek blijft waar het diagram begon", () => {
  const knopen = [k("a", "actie", 200, 100), k("b", "actie", 50, 300), k("c", "actie", 400, 300)];
  const verbindingen = [v("a", "b"), v("a", "c")];
  const een = legLeesvolgordeUit({ knopen, verbindingen });
  assert.deepEqual(legLeesvolgordeUit({ knopen, verbindingen }), een);
  const xs = Object.values(een.posities).map((p) => p.x), ys = Object.values(een.posities).map((p) => p.y);
  assert.equal(Math.min(...xs), 50);
  assert.equal(Math.min(...ys), 100);
});

test("richtingen: LR legt de lagen naast elkaar, BT en RL spiegelen", () => {
  const knopen = [k("a", "x"), k("b", "x"), k("c", "x")];
  const verbindingen = [v("a", "b"), v("b", "c")];
  const lr = legLeesvolgordeUit({ knopen, verbindingen, richting: "LR" }).posities;
  assert.ok(lr.a.x < lr.b.x && lr.b.x < lr.c.x && lr.a.y === lr.c.y);
  const bt = legLeesvolgordeUit({ knopen, verbindingen, richting: "BT" }).posities;
  assert.ok(bt.a.y > bt.b.y && bt.b.y > bt.c.y);
  const rl = legLeesvolgordeUit({ knopen, verbindingen, richting: "RL" }).posities;
  assert.ok(rl.a.x > rl.b.x && rl.b.x > rl.c.x);
});

test("cyclus: geen oneindige lus; het beginpunt blijft vooraan", () => {
  const knopen = [k("s", "begin"), k("a", "toestand"), k("b", "toestand")];
  const verbindingen = [v("s", "a"), v("a", "b"), v("b", "a")];
  const { posities: p } = legLeesvolgordeUit({ knopen, verbindingen, regels: { start: ["begin"] } });
  assert.ok(p.s.y < p.a.y && p.a.y < p.b.y);
});

test("omgekeerd: bij een generalisatie (kind → ouder) staat de ouder bovenaan", () => {
  const knopen = [k("kind", "klasse"), k("ouder", "klasse", 0, 500)];
  const { posities: p } = legLeesvolgordeUit({ knopen, verbindingen: [v("kind", "ouder", "generalisatie")] });
  assert.ok(p.ouder.y < p.kind.y);
});

test("container: inhoud opgesteld, het kader groeit mee en de leden liggen erin", () => {
  const knopen = [k("actor", "actor"), k("sys", "systeem", 300, 0, { w: 100, h: 100, container: true }), k("u1", "usecase", 0, 0, { ouder: "sys" }), k("u2", "usecase", 0, 100, { ouder: "sys" })];
  const verbindingen = [v("actor", "u1", "associatie"), v("actor", "u2", "associatie")];
  const { posities: p, maten } = legLeesvolgordeUit({ knopen, verbindingen, regels: { richting: "LR", start: ["actor"] } });
  assert.ok(p.actor.x < p.sys.x, "de actor links van het kader");
  for (const u of ["u1", "u2"]) {
    assert.ok(p[u].x >= p.sys.x && p[u].y >= p.sys.y, u);
    assert.ok(p[u].x + 120 <= p.sys.x + maten.sys.width && p[u].y + 50 <= p.sys.y + maten.sys.height, u);
  }
});

test("banen (BPMN): de stroom loopt van links naar rechts door de lanes; elke lane een eigen strook", () => {
  const knopen = [
    k("pool", "pool", 0, 0, { w: 600, h: 300, container: true }),
    k("l1", "lane", 0, 0, { w: 600, h: 150, container: true, ouder: "pool" }),
    k("l2", "lane", 0, 150, { w: 600, h: 150, container: true, ouder: "pool" }),
    k("s", "start-event", 0, 0, { ouder: "l1", w: 36, h: 36 }),
    k("t1", "taak", 0, 0, { ouder: "l1" }),
    k("t2", "taak", 0, 0, { ouder: "l2" }),
    k("e", "eind-event", 0, 0, { ouder: "l2", w: 36, h: 36 }),
  ];
  const verbindingen = [v("s", "t1", "sequence-flow"), v("t1", "t2", "sequence-flow"), v("t2", "e", "sequence-flow"), v("pool", "l1", "bevat")];
  const { posities: p, maten: m } = legLeesvolgordeUit({ knopen, verbindingen, regels: { richting: "LR", stroom: ["sequence-flow"], start: ["start-event"], eind: ["eind-event"], banen: ["lane"] } });
  assert.ok(p.s.x < p.t1.x && p.t1.x < p.t2.x && p.t2.x < p.e.x, "de stroom loopt door, over de lanes heen");
  assert.ok(p.l1.y < p.l2.y, "lanes onder elkaar");
  assert.equal(m.l1.width, m.l2.width, "alle lanes even lang");
  assert.ok(p.t1.y >= p.l1.y && p.t1.y + 50 <= p.l1.y + m.l1.height, "t1 in lane 1");
  assert.ok(p.t2.y >= p.l2.y && p.t2.y + 50 <= p.l2.y + m.l2.height, "t2 in lane 2");
  assert.ok(p.l1.x >= p.pool.x && p.l2.y + m.l2.height <= p.pool.y + m.pool.height, "lanes in de pool");
});

test("lagen (ArchiMate): business boven applicatie boven technologie, los van de pijlrichting", () => {
  const knopen = [k("node", "node"), k("app", "app-component"), k("proc", "business-proces")];
  const verbindingen = [v("node", "app", "bediening"), v("app", "proc", "bediening")];
  const { posities: p } = legLeesvolgordeUit({ knopen, verbindingen, regels: { lagen: [["business-proces"], ["app-component"], ["node"]] } });
  assert.ok(p.proc.y < p.app.y && p.app.y < p.node.y);
});

test("leesvolgordeLayouts: vier richtingen, de standaard van het profiel eerst; canvas-invoer met lidmaatschap en zonder rand-elementen", () => {
  // Sinds de M3-LayoutStijl (18-10): de regels komen uit de aard van de typen en de stijl.
  const descriptor = {
    id: "test",
    layoutStijlen: [{ id: "leesvolgorde", label: "Leesvolgorde", renderer: "leesvolgorde", richting: "LR", alleenStroom: true }],
    elementTypes: [
      { id: "start", aard: "begin" }, { id: "taak" }, { id: "kader", containerVoor: "bevat", minBreedte: 400, minHoogte: 50 }, { id: "rand", randElement: true },
      { id: "flow", isConnector: true, aard: "stroom" }, { id: "bevat", isConnector: true, aard: "insluiting" },
    ],
  };
  const l = leesvolgordeLayouts(descriptor);
  assert.deepEqual(l.map((x) => x.kort), ["→", "↓", "↑", "←"]);
  assert.match(l[0].label, /standaard/);
  const elements = {
    s: { id: "s", elementType: "start" }, t: { id: "t", elementType: "taak" }, kd: { id: "kd", elementType: "kader" }, r: { id: "r", elementType: "rand" },
    f: { id: "f", elementType: "flow", source: "s", target: "t" }, b: { id: "b", elementType: "bevat", source: "kd", target: "t" },
  };
  const node = (id, type) => ({ id, type, position: { x: 0, y: 0 }, measured: { width: 100, height: 40 } });
  const flowNodes = [node("s", "start"), node("t", "taak"), node("kd", "kader"), node("r", "rand")];
  const diagram = { nodes: ["s", "t", "kd", "r"].map((elementId) => ({ elementId })) };
  const typen = new Map(descriptor.elementTypes.map((t) => [t.id, t]));
  const invoer = invoerVanCanvas({ flowNodes, elements, diagram, typen });
  assert.deepEqual(invoer.knopen.map((x) => [x.id, x.ouder]), [["s", null], ["t", "kd"], ["kd", null]]);
  assert.deepEqual(invoer.verbindingen, [{ bron: "s", doel: "t", soort: "flow" }]);
  const uit = l[0].run({ flowNodes, selectieIds: null, elements, diagram });
  assert.ok(uit.posities.s.x < uit.posities.kd.x && !("r" in uit.posities));
  // De minimale maat van het type (minBreedte) geldt voor de container.
  assert.equal(uit.maten.kd.width, 400);
});

test("layoutStijlen: [] = geen layout; zonder stijlen de generieke standaard; afstanden uit de stijl", () => {
  assert.deepEqual(leesvolgordeLayouts({ id: "seq", layoutStijlen: [], elementTypes: [] }), []);
  const std = leesvolgordeLayouts({ id: "x", elementTypes: [{ id: "a" }, { id: "lijn", isConnector: true }] });
  assert.deepEqual(std.map((l) => l.id), ["leesvolgorde-tb", "leesvolgorde-lr", "leesvolgorde-bt", "leesvolgorde-rl"]);
  const knopen = [k("a", "x"), k("b", "x")];
  const dicht = legLeesvolgordeUit({ knopen, verbindingen: [v("a", "b")], afstanden: { laag: 10 } }).posities;
  const ruim = legLeesvolgordeUit({ knopen, verbindingen: [v("a", "b")], afstanden: { laag: 200 } }).posities;
  assert.equal(dicht.b.y - dicht.a.y, 60);
  assert.equal(ruim.b.y - ruim.a.y, 250);
});
