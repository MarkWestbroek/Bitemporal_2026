import { useCallback, useId, useRef, useState } from "react";
import {
  stateChangeTypes, keuzeReducer, beginToestand, huidigeToestand, isGekozen,
  standaardItemToKey, standaardItemToString, toetsNaarActie,
} from "./keuzeReducer";

/** Acties die de selectie wijzigen; bij readOnly genegeerd. */
const KIEZEN = new Set([
  stateChangeTypes.ItemClick, stateChangeTypes.MenuKeyDownEnter, stateChangeTypes.MenuKeyDownSpaceButton,
  stateChangeTypes.FunctionSelectItem, stateChangeTypes.FunctionRemoveSelectedItem, stateChangeTypes.FunctionReset,
]);

/**
 * useKeuze — headless hook voor een "altijd open" keuze: één (select1) of meer (select)
 * uit een lijst. De vorm (image-map, knoppen, kaarten…) tekent zelf; de hook levert
 * toestand, toetsenbord en ARIA (listbox/option, aria-activedescendant).
 *
 * API bewust gelijk aan downshift, zodat een vorm met useKeuze en de combobox met
 * downshift's useCombobox dezelfde props en callbacks hebben:
 *
 *   const { getLabelProps, getMenuProps, getItemProps, highlightedIndex,
 *           selectedItem, selectedItems, isSelected, selectItem, removeSelectedItem,
 *           setHighlightedIndex, reset } = useKeuze({
 *     items, itemToKey, itemToString, isItemDisabled,
 *     multiple,                                    // false = select1, true = select
 *     selectedItem, onSelectedItemChange,          // select1 (als useSelect)
 *     selectedItems, onSelectedItemsChange,        // select  (als useMultipleSelection)
 *     onHighlightedIndexChange, onStateChange, stateReducer, readOnly, id,
 *   });
 *
 * Callbacks krijgen een changes-object { type, selectedItem | selectedItems, highlightedIndex },
 * met `type` uit useKeuze.stateChangeTypes — zoals in downshift.
 */
export default function useKeuze(props) {
  const {
    items = [],
    itemToKey = standaardItemToKey,
    itemToString = standaardItemToString,
    isItemDisabled = () => false,
    multiple = false,
    readOnly = false,
    stateReducer = (_state, { changes }) => changes,
    onSelectedItemChange, onSelectedItemsChange, onHighlightedIndexChange, onStateChange,
  } = props;

  const eigenId = useId();
  const id = props.id || `keuze-${eigenId.replace(/:/g, "")}`;
  const [intern, setIntern] = useState(() => beginToestand(props));
  const state = huidigeToestand(intern, props);

  // Laatste props/toestand in een ref, zodat de handlers stabiel kunnen blijven.
  const latest = useRef();
  latest.current = { props: { ...props, items, itemToKey, isItemDisabled, multiple }, state };

  const dispatch = useCallback((action) => {
    const { props: p, state: s } = latest.current;
    if (p.readOnly && KIEZEN.has(action.type)) return; // alleen-lezen: navigeren mag, kiezen niet
    const voorstel = keuzeReducer(s, action, p);
    const changes = (p.stateReducer || ((_st, { changes: c }) => c))(s, { ...action, changes: voorstel });
    if (!changes || changes === s) return;
    setIntern(changes);

    const selGewijzigd = changes.selectedItems !== s.selectedItems;
    if (selGewijzigd) {
      if (p.multiple) p.onSelectedItemsChange?.({ type: action.type, selectedItems: changes.selectedItems });
      else p.onSelectedItemChange?.({ type: action.type, selectedItem: changes.selectedItems[0] ?? null });
    }
    if (changes.highlightedIndex !== s.highlightedIndex) {
      p.onHighlightedIndexChange?.({ type: action.type, highlightedIndex: changes.highlightedIndex });
    }
    p.onStateChange?.({ type: action.type, ...changes });
  }, []);

  const itemId = (index) => `${id}-item-${index}`;

  const getLabelProps = (extra = {}) => ({ id: `${id}-label`, ...extra });

  const getMenuProps = ({ onKeyDown, onFocus, onBlur, onMouseLeave, ...rest } = {}) => ({
    id: `${id}-menu`,
    role: "listbox",
    tabIndex: 0,
    "aria-labelledby": `${id}-label`,
    "aria-multiselectable": multiple || undefined,
    "aria-readonly": readOnly || undefined,
    "aria-activedescendant": state.highlightedIndex >= 0 ? itemId(state.highlightedIndex) : undefined,
    onKeyDown: (e) => {
      onKeyDown?.(e);
      const type = toetsNaarActie(e.key);
      if (!type) return;
      e.preventDefault();
      dispatch({ type });
    },
    onFocus: (e) => { onFocus?.(e); dispatch({ type: stateChangeTypes.MenuFocus }); },
    onBlur: (e) => { onBlur?.(e); dispatch({ type: stateChangeTypes.MenuBlur }); },
    onMouseLeave: (e) => { onMouseLeave?.(e); dispatch({ type: stateChangeTypes.MenuMouseLeave }); },
    ...rest,
  });

  const getItemProps = ({ item, index, onClick, onMouseMove, ...rest } = {}) => {
    const i = index ?? items.findIndex((it) => itemToKey(it) === itemToKey(item));
    const uit = isItemDisabled(items[i], i);
    return {
      id: itemId(i),
      role: "option",
      "aria-selected": isGekozen(state, items[i], latest.current.props),
      "aria-disabled": uit || undefined,
      onClick: (e) => { onClick?.(e); if (!uit) dispatch({ type: stateChangeTypes.ItemClick, index: i }); },
      onMouseMove: (e) => { onMouseMove?.(e); if (state.highlightedIndex !== i) dispatch({ type: stateChangeTypes.ItemMouseMove, index: i }); },
      ...rest,
    };
  };

  return {
    getLabelProps,
    getMenuProps,
    getItemProps,
    highlightedIndex: state.highlightedIndex,
    selectedItems: state.selectedItems,
    selectedItem: state.selectedItems[0] ?? null,
    isSelected: (item) => isGekozen(state, item, latest.current.props),
    itemToString,
    selectItem: (item) => dispatch({ type: stateChangeTypes.FunctionSelectItem, item }),
    removeSelectedItem: (item) => dispatch({ type: stateChangeTypes.FunctionRemoveSelectedItem, item }),
    setHighlightedIndex: (index) => dispatch({ type: stateChangeTypes.FunctionSetHighlightedIndex, index }),
    reset: () => dispatch({ type: stateChangeTypes.FunctionReset }),
  };
}

useKeuze.stateChangeTypes = stateChangeTypes;
