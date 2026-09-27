import { useState, useMemo, forwardRef } from "react";
import { useCombobox, useMultipleSelection } from "downshift";

/**
 * TagInvoer — de vorm `tag-input`: gekozen waarden als labels in het invoerveld, met typen om
 * aan te vullen. Op downshift (useMultipleSelection + useCombobox), zoals de adreszoeker.
 *
 *  - Met `items` (enum of referentielijst): kiezen uit de lijst. `allowNew` staat dan uit,
 *    want een nieuw referentielijst-item aanmaken is een registratie, geen invoer.
 *  - Zonder `items` (vrije tekst): elke getypte waarde wordt een label (Enter of komma).
 *
 * Toetsen: ↑/↓ en Enter in de suggesties; Backspace in een leeg veld haalt het laatste label
 * weg; ←/→ lopen over de labels, Delete/Backspace verwijdert het actieve label.
 *
 * Props: items [{ value, label }] | undefined, waarde (array van sleutels), onChange(array),
 *        readOnly, labelId, config { placeholder, max, accentColor }
 */
export default function TagInvoer(props) {
  // Alleen-lezen apart: dan draaien de downshift-hooks niet (die verwachten hun getters).
  return props.readOnly ? <TagWeergave {...props} /> : <TagBewerken {...props} />;
}

const gekozenUit = (waarde) => [].concat(waarde ?? []).map(String).filter(Boolean);
const labelVanIn = (items) => (v) => (Array.isArray(items) ? items.find((i) => i.value === v)?.label || v : v);

function TagWeergave({ items, waarde, config = {} }) {
  const gekozen = gekozenUit(waarde);
  const accent = config.accentColor || "#1d4ed8";
  const labelVan = labelVanIn(items);
  if (!gekozen.length) return <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>—</span>;
  return <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>{gekozen.map((v) => <Label key={v} accent={accent}>{labelVan(v)}</Label>)}</span>;
}

function TagBewerken({ items, waarde, onChange, labelId, config = {} }) {
  const gekozen = useMemo(() => gekozenUit(waarde), [waarde]);
  const vrij = !Array.isArray(items);
  const labelVan = labelVanIn(items);
  const accent = config.accentColor || "#1d4ed8";
  const [invoer, setInvoer] = useState("");
  const vol = config.max != null && gekozen.length >= Number(config.max);

  const suggesties = useMemo(() => {
    if (vrij) return [];
    const q = invoer.trim().toLowerCase();
    return items.filter((i) => !gekozen.includes(i.value) && (!q || String(i.label).toLowerCase().includes(q))).slice(0, 50);
  }, [items, vrij, invoer, gekozen]);

  const voegToe = (v) => {
    const s = String(v ?? "").trim();
    if (!s || gekozen.includes(s) || vol) return;
    onChange([...gekozen, s]);
  };

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } = useMultipleSelection({
    selectedItems: gekozen,
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems),
  });
  const { isOpen, highlightedIndex, getInputProps, getMenuProps, getItemProps } = useCombobox({
    items: suggesties,
    itemToString: (it) => (it ? String(it.label) : ""),
    inputValue: invoer,
    selectedItem: null,
    defaultHighlightedIndex: 0,
    onStateChange: ({ inputValue, type, selectedItem }) => {
      if (type === useCombobox.stateChangeTypes.InputChange) setInvoer(inputValue ?? "");
      if ((type === useCombobox.stateChangeTypes.InputKeyDownEnter || type === useCombobox.stateChangeTypes.ItemClick) && selectedItem) {
        voegToe(selectedItem.value);
        setInvoer("");
      }
    },
  });

  return (
    <div style={{ position: "relative", maxWidth: 640 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", border: "1px solid #94a3b8", borderRadius: 6, padding: "4px 6px", background: "#fff" }}>
        {gekozen.map((v, index) => (
          <Label key={v} accent={accent} {...getSelectedItemProps({ selectedItem: v, index })}>
            {labelVan(v)}
            <button type="button" aria-label={`${labelVan(v)} weghalen`} tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); removeSelectedItem(v); }}
              style={{ marginLeft: 4, border: "none", background: "none", color: accent, cursor: "pointer", padding: 0, fontWeight: 700 }}>×</button>
          </Label>
        ))}
        <input
          {...getInputProps(getDropdownProps({
            "aria-labelledby": labelId,
            disabled: vol,
            placeholder: vol ? `maximaal ${config.max}` : config.placeholder || (vrij ? "typ en druk op Enter" : "typ om te zoeken"),
            onKeyDown: (e) => {
              // Vrije tekst: Enter of komma maakt er een label van.
              if (vrij && (e.key === "Enter" || e.key === ",")) {
                e.preventDefault();
                voegToe(invoer);
                setInvoer("");
              }
            },
            onBlur: () => { if (vrij && invoer.trim()) { voegToe(invoer); setInvoer(""); } },
          }, { preventKeyAction: isOpen }))}
          style={{ flex: 1, minWidth: 140, border: "none", outline: "none", padding: "4px 2px", fontSize: "0.95rem", background: "transparent" }}
        />
      </div>
      <ul {...getMenuProps()} style={{ position: "absolute", zIndex: 20, left: 0, right: 0, margin: "2px 0 0", padding: 0, listStyle: "none",
        background: "#fff", border: isOpen && suggesties.length ? "1px solid #cbd5e1" : "none", borderRadius: 6, maxHeight: 240, overflowY: "auto",
        boxShadow: isOpen && suggesties.length ? "0 6px 18px rgba(15,23,42,0.12)" : "none" }}>
        {isOpen && suggesties.map((it, index) => (
          <li key={it.value} {...getItemProps({ item: it, index })}
            style={{ padding: "6px 10px", cursor: "pointer", background: highlightedIndex === index ? "#eff6ff" : undefined }}>
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const Label = forwardRef(function Label({ accent, children, ...rest }, ref) {
  return (
    <span ref={ref} {...rest} style={{ display: "inline-flex", alignItems: "center", padding: "0.1rem 0.55rem", borderRadius: 999, fontSize: "0.85rem", fontWeight: 600,
      background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 30%, white)` }}>
      {children}
    </span>
  );
});
