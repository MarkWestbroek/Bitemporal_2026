import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stateChangeTypes as T, keuzeReducer, beginToestand, huidigeToestand, isGekozen, toetsNaarActie,
} from "./keuzeReducer.js";

const items = [{ waarde: "a" }, { waarde: "b" }, { waarde: "c" }];
const itemToKey = (it) => it?.waarde ?? null;
const een = { items, itemToKey };
const meer = { items, itemToKey, multiple: true };

test("select1: klikken kiest, opnieuw klikken houdt de keuze", () => {
  let s = beginToestand(een);
  s = keuzeReducer(s, { type: T.ItemClick, index: 1 }, een);
  assert.deepEqual(s.selectedItems, [items[1]]);
  assert.equal(s.highlightedIndex, 1);
  s = keuzeReducer(s, { type: T.ItemClick, index: 1 }, een);
  assert.deepEqual(s.selectedItems, [items[1]]);
  s = keuzeReducer(s, { type: T.ItemClick, index: 2 }, een);
  assert.deepEqual(s.selectedItems, [items[2]]);
});

test("select: klikken wisselt aan/uit", () => {
  let s = beginToestand(meer);
  s = keuzeReducer(s, { type: T.ItemClick, index: 0 }, meer);
  s = keuzeReducer(s, { type: T.ItemClick, index: 2 }, meer);
  assert.deepEqual(s.selectedItems.map(itemToKey), ["a", "c"]);
  s = keuzeReducer(s, { type: T.ItemClick, index: 0 }, meer);
  assert.deepEqual(s.selectedItems.map(itemToKey), ["c"]);
  s = keuzeReducer(s, { type: T.FunctionRemoveSelectedItem, item: { waarde: "c" } }, meer);
  assert.deepEqual(s.selectedItems, []);
});

test("toetsenbord: pijlen lopen rond en slaan uitgeschakelde items over; spatie kiest", () => {
  const props = { ...meer, isItemDisabled: (it) => it.waarde === "b" };
  let s = beginToestand(props);
  s = keuzeReducer(s, { type: T.MenuFocus }, props);
  assert.equal(s.highlightedIndex, 0);
  s = keuzeReducer(s, { type: T.MenuKeyDownArrowDown }, props);
  assert.equal(s.highlightedIndex, 2, "b is uitgeschakeld");
  s = keuzeReducer(s, { type: T.MenuKeyDownArrowDown }, props);
  assert.equal(s.highlightedIndex, 0, "rondloop");
  s = keuzeReducer(s, { type: T.MenuKeyDownEnd }, props);
  assert.equal(s.highlightedIndex, 2);
  s = keuzeReducer(s, { type: T.MenuKeyDownSpaceButton }, props);
  assert.deepEqual(s.selectedItems.map(itemToKey), ["c"]);
  s = keuzeReducer(s, { type: T.ItemClick, index: 1 }, props);
  assert.deepEqual(s.selectedItems.map(itemToKey), ["c"], "uitgeschakeld item is niet te kiezen");
  s = keuzeReducer(s, { type: T.MenuBlur }, props);
  assert.equal(s.highlightedIndex, -1);
});

test("focus markeert de gekozen optie", () => {
  const props = { ...een, selectedItem: items[2] };
  const s = keuzeReducer(huidigeToestand(beginToestand(props), props), { type: T.MenuFocus }, props);
  assert.equal(s.highlightedIndex, 2);
});

test("gecontroleerde selectie komt uit de props (zoals downshift)", () => {
  const props = { ...meer, selectedItems: [{ waarde: "b" }] };
  const s = huidigeToestand(beginToestand({ ...meer }), props);
  assert.ok(isGekozen(s, items[1], props), "op sleutel, niet op object-identiteit");
  assert.ok(!isGekozen(s, items[0], props));
});

test("toetsen → acties", () => {
  assert.equal(toetsNaarActie("ArrowRight"), T.MenuKeyDownArrowDown);
  assert.equal(toetsNaarActie(" "), T.MenuKeyDownSpaceButton);
  assert.equal(toetsNaarActie("x"), null);
});
