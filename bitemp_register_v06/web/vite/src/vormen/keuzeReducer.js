/**
 * keuzeReducer — de pure toestandslogica achter useKeuze (een "altijd open" keuzelijst:
 * één of meer uit een lijst, zonder uitklapmenu). Bedoeld voor vormen als `image-map`,
 * en later knoppen of kaarten.
 *
 * Opzet en namen volgen downshift (useSelect / useMultipleSelection), zodat vormen
 * uitwisselbaar blijven met de downshift-combobox (RefCombobox):
 *  - props:   items, itemToKey, itemToString, isItemDisabled, multiple,
 *             selectedItem / selectedItems (gecontroleerd), stateReducer
 *  - toestand: { highlightedIndex, selectedItems }
 *  - acties:  stateChangeTypes, die ook in de `changes` van de callbacks meekomen.
 *
 * Puur — geen React (keuzeReducer.test.js).
 */

export const stateChangeTypes = Object.freeze({
  ItemClick: "__item_click__",
  ItemMouseMove: "__item_mouse_move__",
  MenuMouseLeave: "__menu_mouse_leave__",
  MenuFocus: "__menu_focus__",
  MenuBlur: "__menu_blur__",
  MenuKeyDownArrowDown: "__menu_keydown_arrow_down__",
  MenuKeyDownArrowUp: "__menu_keydown_arrow_up__",
  MenuKeyDownHome: "__menu_keydown_home__",
  MenuKeyDownEnd: "__menu_keydown_end__",
  MenuKeyDownEnter: "__menu_keydown_enter__",
  MenuKeyDownSpaceButton: "__menu_keydown_space_button__",
  MenuKeyDownEscape: "__menu_keydown_escape__",
  FunctionSelectItem: "__function_select_item__",
  FunctionRemoveSelectedItem: "__function_remove_selected_item__",
  FunctionSetHighlightedIndex: "__function_set_highlighted_index__",
  FunctionReset: "__function_reset__",
});

const T = stateChangeTypes;

/** Standaard-sleutel: een primitief is zijn eigen sleutel, anders `id` of `waarde`. */
export function standaardItemToKey(item) {
  if (item == null) return null;
  if (typeof item !== "object") return String(item);
  return String(item.id ?? item.waarde ?? item.value ?? "");
}

export function standaardItemToString(item) {
  if (item == null) return "";
  if (typeof item !== "object") return String(item);
  return String(item.label ?? item.naam ?? item.waarde ?? item.id ?? "");
}

function normProps(props) {
  return {
    items: props.items || [],
    itemToKey: props.itemToKey || standaardItemToKey,
    isItemDisabled: props.isItemDisabled || (() => false),
    multiple: Boolean(props.multiple),
  };
}

/** Beginstoestand; gecontroleerde selectie komt uit de props (zie huidigeToestand). */
export function beginToestand(props = {}) {
  const sel = props.multiple
    ? props.selectedItems ?? props.initialSelectedItems ?? []
    : [props.selectedItem ?? props.initialSelectedItem].filter((x) => x != null);
  return { highlightedIndex: props.initialHighlightedIndex ?? -1, selectedItems: sel };
}

/** Toestand met gecontroleerde props erover heen (zoals downshift getState). */
export function huidigeToestand(state, props = {}) {
  const uit = { ...state };
  if (props.multiple && props.selectedItems !== undefined) uit.selectedItems = props.selectedItems || [];
  if (!props.multiple && props.selectedItem !== undefined) uit.selectedItems = props.selectedItem == null ? [] : [props.selectedItem];
  if (props.highlightedIndex !== undefined) uit.highlightedIndex = props.highlightedIndex;
  return uit;
}

export function isGekozen(state, item, props = {}) {
  const { itemToKey } = normProps(props);
  const k = itemToKey(item);
  return state.selectedItems.some((s) => itemToKey(s) === k);
}

/** Volgende niet-uitgeschakelde index vanaf `start` in richting `stap` (met rondloop). */
function volgendeIndex(start, stap, props) {
  const { items, isItemDisabled } = normProps(props);
  const n = items.length;
  if (n === 0) return -1;
  let i = start;
  for (let poging = 0; poging < n; poging += 1) {
    i = (((i + stap) % n) + n) % n;
    if (!isItemDisabled(items[i], i)) return i;
  }
  return -1;
}

function eersteIndex(props, vanafEinde = false) {
  const n = normProps(props).items.length;
  return vanafEinde ? volgendeIndex(n, -1, props) : volgendeIndex(-1, 1, props);
}

/** Kies (één) of wissel (meer) een item. Uitgeschakelde items doen niets. */
function kies(state, item, props) {
  const { itemToKey, isItemDisabled, items, multiple } = normProps(props);
  if (item == null) return state;
  const idx = items.findIndex((it) => itemToKey(it) === itemToKey(item));
  if (idx >= 0 && isItemDisabled(items[idx], idx)) return state;
  const k = itemToKey(item);
  if (!multiple) {
    return { ...state, selectedItems: [item], highlightedIndex: idx >= 0 ? idx : state.highlightedIndex };
  }
  const al = state.selectedItems.some((s) => itemToKey(s) === k);
  return {
    ...state,
    selectedItems: al ? state.selectedItems.filter((s) => itemToKey(s) !== k) : [...state.selectedItems, item],
    highlightedIndex: idx >= 0 ? idx : state.highlightedIndex,
  };
}

/**
 * De reducer. `action` = { type, index?, item? }. Geeft de nieuwe toestand (changes);
 * de hook laat daarna nog de `stateReducer` van de gebruiker erover gaan.
 */
export function keuzeReducer(state, action, props = {}) {
  const { items } = normProps(props);
  const hi = state.highlightedIndex;
  switch (action.type) {
    case T.ItemClick:
      return kies(state, items[action.index], props);
    case T.ItemMouseMove:
    case T.FunctionSetHighlightedIndex:
      return { ...state, highlightedIndex: action.index ?? -1 };
    case T.MenuMouseLeave:
    case T.MenuBlur:
    case T.MenuKeyDownEscape:
      return { ...state, highlightedIndex: -1 };
    case T.MenuFocus: {
      // Focus: markeer de (eerste) gekozen optie, anders de eerste bruikbare.
      if (hi >= 0) return state;
      const { itemToKey } = normProps(props);
      const eerste = state.selectedItems[0];
      const idx = eerste != null ? items.findIndex((it) => itemToKey(it) === itemToKey(eerste)) : -1;
      return { ...state, highlightedIndex: idx >= 0 ? idx : eersteIndex(props) };
    }
    case T.MenuKeyDownArrowDown:
      return { ...state, highlightedIndex: volgendeIndex(hi, 1, props) };
    case T.MenuKeyDownArrowUp:
      return { ...state, highlightedIndex: hi < 0 ? eersteIndex(props, true) : volgendeIndex(hi, -1, props) };
    case T.MenuKeyDownHome:
      return { ...state, highlightedIndex: eersteIndex(props) };
    case T.MenuKeyDownEnd:
      return { ...state, highlightedIndex: eersteIndex(props, true) };
    case T.MenuKeyDownEnter:
    case T.MenuKeyDownSpaceButton:
      return hi >= 0 ? kies(state, items[hi], props) : state;
    case T.FunctionSelectItem:
      return kies(state, action.item, props);
    case T.FunctionRemoveSelectedItem: {
      const { itemToKey } = normProps(props);
      const k = itemToKey(action.item);
      return { ...state, selectedItems: state.selectedItems.filter((s) => itemToKey(s) !== k) };
    }
    case T.FunctionReset:
      return { highlightedIndex: -1, selectedItems: [] };
    default:
      return state;
  }
}

/** Toets → actietype (menu-niveau). Onbekende toetsen: null. */
export function toetsNaarActie(key) {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight": return T.MenuKeyDownArrowDown;
    case "ArrowUp":
    case "ArrowLeft": return T.MenuKeyDownArrowUp;
    case "Home": return T.MenuKeyDownHome;
    case "End": return T.MenuKeyDownEnd;
    case "Enter": return T.MenuKeyDownEnter;
    case " ": return T.MenuKeyDownSpaceButton;
    case "Escape": return T.MenuKeyDownEscape;
    default: return null;
  }
}
