import { useState } from "react";
import useKeuze from "./useKeuze";

/**
 * CardsKeuze — de vorm `cards`: keuzekaarten met icoon, titel en uitleg (bv. het producttype
 * met wat het betekent). Eén of meer uit een lijst; toestand, toetsenbord en ARIA uit useKeuze
 * (API als downshift), net als image-map en button-group.
 *
 * Props: items [{ value, label }], meervoudig, waarde, onChange, readOnly, labelId,
 *        config { items: { [value]: { icon, title, description, image } }, columns, minWidth }
 */
export default function CardsKeuze({ items = [], meervoudig = false, waarde, onChange, readOnly = false, labelId, config = {} }) {
  const sleutels = meervoudig ? (Array.isArray(waarde) ? waarde.map(String) : []) : (waarde == null || waarde === "" ? [] : [String(waarde)]);
  const gekozen = items.filter((it) => sleutels.includes(String(it.value)));
  const [focus, setFocus] = useState(false);
  const { getMenuProps, getItemProps, highlightedIndex, isSelected } = useKeuze({
    items, itemToKey: (it) => (it ? String(it.value) : null), itemToString: (it) => it?.label ?? "",
    multiple: meervoudig, readOnly,
    ...(meervoudig ? { selectedItems: gekozen } : { selectedItem: gekozen[0] ?? null }),
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem ? String(selectedItem.value) : ""),
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems.map((i) => String(i.value))),
  });
  const accent = "var(--cg-blauw, #2563eb)";
  const kolommen = config.columns ? `repeat(${config.columns}, 1fr)` : `repeat(auto-fill, minmax(${config.minWidth || 180}px, 1fr))`;
  return (
    <div {...getMenuProps({ onFocus: () => setFocus(true), onBlur: () => setFocus(false), ...(labelId ? { "aria-labelledby": labelId } : {}) })}
      style={{ display: "grid", gridTemplateColumns: kolommen, gap: 10, padding: 4, borderRadius: 12, outline: focus ? `2px solid ${accent}` : "none", outlineOffset: 2 }}>
      {items.map((item, index) => {
        const kaart = config.items?.[item.value] || {};
        const aan = isSelected(item), licht = highlightedIndex === index;
        return (
          <div key={item.value} {...getItemProps({ item, index })}
            style={{
              position: "relative", display: "flex", flexDirection: "column", gap: 4, padding: "0.75rem 0.85rem", borderRadius: 12,
              cursor: readOnly ? "default" : "pointer", userSelect: "none",
              color: "#0f172a", // vaste tekstkleur: de kaart is altijd licht, ook in een donker thema
              background: aan ? "linear-gradient(180deg, #eff6ff, #dbeafe)" : "#ffffff",
              border: `2px solid ${aan ? "#2563eb" : licht ? "#93c5fd" : "var(--cg-rand, #e2e8f0)"}`,
              boxShadow: aan ? "0 4px 10px rgba(37,99,235,0.18)" : "0 1px 2px rgba(15,23,42,0.06)", transition: "all 120ms",
            }}>
            {aan && <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 10, color: "#2563eb", fontWeight: 700 }}>✓</span>}
            {kaart.image && <img src={kaart.image} alt="" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8 }} />}
            {kaart.icon && <span aria-hidden="true" style={{ fontSize: "1.6rem", lineHeight: 1 }}>{kaart.icon}</span>}
            <span style={{ fontWeight: 700 }}>{kaart.title || item.label}</span>
            {kaart.description && <span style={{ fontSize: "0.85rem", color: "var(--cg-donkergrijs, #475569)" }}>{kaart.description}</span>}
          </div>
        );
      })}
    </div>
  );
}
