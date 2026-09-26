import { useMemo, useState } from "react";
import useKeuze from "./useKeuze";
import { sorteerKnoppen } from "./buttonGroup";

/**
 * ButtonGroupKeuze — de vorm `button-group`: een vlak van afgeronde knoppen, klik-klik aan en
 * uit (zoals de akkoordknoppen van een accordeon). Bedient één uit een lijst (meervoudig =
 * false) en meer uit een lijst (true). Toestand, toetsenbord en ARIA uit useKeuze (API als
 * downshift); de opties worden aangereikt (keuzebron), deze vorm haalt niets op.
 *
 * Props:
 *  - items:      [{ value, label, order? }]   — order = volgorde voor sort "order" (bv. id)
 *  - config:     vormConfig — { sort: "alpha" | "order" | "none", sortToggle: bool,
 *                  orderLabel: "…", minWidth: px }
 *  - meervoudig, waarde (sleutel | sleutels), onChange, readOnly, labelId
 */
export default function ButtonGroupKeuze({ items: bron = [], config = {}, meervoudig = false, waarde, onChange, readOnly = false, labelId }) {
  const [sortering, setSortering] = useState(config.sort || "alpha");
  const items = useMemo(() => sorteerKnoppen(bron, sortering), [bron, sortering]);
  const sleutels = meervoudig ? (Array.isArray(waarde) ? waarde.map(String) : []) : (waarde == null || waarde === "" ? [] : [String(waarde)]);
  const gekozen = items.filter((it) => sleutels.includes(it.value));
  const [focus, setFocus] = useState(false);

  const { getMenuProps, getItemProps, highlightedIndex, isSelected, selectedItems } = useKeuze({
    items,
    itemToKey: (it) => it?.value ?? null,
    itemToString: (it) => it?.label ?? "",
    multiple: meervoudig,
    readOnly,
    ...(meervoudig ? { selectedItems: gekozen } : { selectedItem: gekozen[0] ?? null }),
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem?.value ?? ""),
    onSelectedItemsChange: ({ selectedItems: sel }) => {
      const bekend = new Set(items.map((it) => it.value));
      onChange([...sleutels.filter((k) => !bekend.has(k)), ...sel.map((it) => it.value)]);
    },
  });

  const accent = "var(--cg-blauw, #2563eb)";
  const sorteerKeuzes = [
    { v: "alpha", t: "A–Z" },
    { v: "order", t: config.orderLabel || "Volgorde van registratie" },
  ];

  return (
    <div className="cg-button-group">
      {config.sortToggle && (
        <div role="group" aria-label="Sortering" style={{ display: "inline-flex", gap: 0, marginBottom: "0.5rem", border: "1px solid var(--cg-rand, #cbd5e1)", borderRadius: 999, overflow: "hidden", fontSize: "0.8rem" }}>
          {sorteerKeuzes.map((s) => (
            <button key={s.v} type="button" aria-pressed={sortering === s.v} onClick={() => setSortering(s.v)}
              style={{ border: "none", padding: "0.2rem 0.75rem", cursor: "pointer", background: sortering === s.v ? "var(--cg-lichtgrijs, #e2e8f0)" : "transparent", fontWeight: sortering === s.v ? 600 : 400 }}>
              {s.t}
            </button>
          ))}
        </div>
      )}
      <div
        {...getMenuProps({ onFocus: () => setFocus(true), onBlur: () => setFocus(false), ...(labelId ? { "aria-labelledby": labelId } : {}) })}
        lang="nl" /* afbreken op lettergrepen: "Contact-momenten", niet "Contactmomen|ten" */
        style={{
          display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${config.minWidth || 104}px, 1fr))`, gap: 8,
          padding: 6, borderRadius: 14, outline: focus ? `2px solid ${accent}` : "none", outlineOffset: 2,
          background: "var(--cg-lichtgrijs-zacht, #f1f5f9)",
        }}
      >
        {items.map((item, index) => {
          const aan = isSelected(item);
          const licht = highlightedIndex === index;
          return (
            <div
              key={item.value}
              {...getItemProps({ item, index })}
              title={item.title || item.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 44,
                padding: "0.35rem 0.5rem", borderRadius: 10, userSelect: "none", fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.2,
                cursor: readOnly ? "default" : "pointer", hyphens: "auto", overflowWrap: "break-word",
                color: aan ? "#ffffff" : "var(--cg-tekst, #0f172a)",
                background: aan ? "linear-gradient(180deg, #3b82f6, #1d4ed8)" : "linear-gradient(180deg, #ffffff, #f1f5f9)",
                border: `1px solid ${aan ? "#1e40af" : "var(--cg-rand, #cbd5e1)"}`,
                // ingedrukt vs. uit, zoals een fysieke knop
                boxShadow: aan ? "inset 0 2px 4px rgba(0,0,0,0.25)" : licht ? `0 0 0 2px ${accent}` : "0 1px 0 rgba(15,23,42,0.12), 0 2px 3px rgba(15,23,42,0.06)",
                transform: aan ? "translateY(1px)" : "none",
                transition: "background 120ms, box-shadow 120ms, transform 80ms",
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>
      <div aria-live="polite" style={{ fontSize: "0.8rem", color: "var(--cg-donkergrijs, #64748b)", marginTop: 4 }}>
        {selectedItems.length === 0 ? (readOnly ? "Niets gekozen." : meervoudig ? "Klik op alles wat van toepassing is." : "Klik op één knop.") : `Gekozen: ${selectedItems.map((i) => i.label).join(", ")}`}
      </div>
    </div>
  );
}
