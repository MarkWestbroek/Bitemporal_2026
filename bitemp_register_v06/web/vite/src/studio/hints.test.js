import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimale localStorage voor node.
const opslag = new Map();
globalThis.localStorage = {
  getItem: (k) => (opslag.has(k) ? opslag.get(k) : null),
  setItem: (k, v) => opslag.set(k, String(v)),
  removeItem: (k) => opslag.delete(k),
};

const { toonHint, useHintStore, resetHints, zetTipsUit, hintGezien, hintEersteRelatie, profielInhoud, opsomming } = await import("./hints.js");

beforeEach(() => {
  opslag.clear();
  useHintStore.setState({ hint: null });
});

test("een tip verschijnt één keer", () => {
  assert.equal(toonHint({ id: "a", tekst: "x" }), true);
  assert.equal(useHintStore.getState().hint.id, "a");
  useHintStore.getState().sluit();
  assert.equal(toonHint({ id: "a", tekst: "x" }), false);
  assert.ok(hintGezien("a"));
});

test("hooguit één tip tegelijk; de tweede wacht op een volgende trigger", () => {
  toonHint({ id: "a", tekst: "x" });
  assert.equal(toonHint({ id: "b", tekst: "y" }), false);
  assert.ok(!hintGezien("b"));
  useHintStore.getState().sluit();
  assert.equal(toonHint({ id: "b", tekst: "y" }), true);
});

test("geen tips meer, en opnieuw tonen", () => {
  zetTipsUit();
  assert.equal(toonHint({ id: "a", tekst: "x" }), false);
  resetHints();
  assert.equal(toonHint({ id: "a", tekst: "x" }), true);
});

test("afgeleid uit het profiel", () => {
  const d = { naam: "Use case", elementTypes: [
    { id: "actor", label: "Actor" }, { id: "uc", label: "Use case" }, { id: "intern", label: "X", verborgen: true },
    { id: "as", label: "Associatie", isConnector: true }, { id: "inc", label: "Include", isConnector: true },
  ] };
  const h = hintEersteRelatie(d, "usecase05");
  assert.equal(h.id, "eerste-relatie:usecase05");
  assert.match(h.tekst, /Use case kent 2 soorten relaties: Associatie, Include/);
  assert.deepEqual(profielInhoud(d), { elementen: ["Actor", "Use case"], relaties: ["Associatie", "Include"] });
  assert.equal(opsomming(["a", "b", "c"], 2), "a, b en nog 1");
});
