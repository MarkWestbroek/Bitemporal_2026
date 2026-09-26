import { useEffect, useRef, useState } from "react";
import { useCombobox } from "downshift";
import { suggestUrl, lookupUrl, suggesties, adresNaarVelden, adresRegel, PDOK } from "./adres";

/**
 * AddressSearch — de vorm `address-search` op een GROEP adresvelden: één zoekveld in plaats
 * van vijf vakjes. Typen → suggesties van de PDOK Locatieserver (open data, BAG); kiezen →
 * lookup → alle gekoppelde velden tegelijk gevuld (vormConfig.fields). De velden zelf blijven
 * bestaan en zijn daaronder na te kijken of te corrigeren (de vorm verandert de data niet).
 *
 * Gebouwd op downshift's useCombobox, net als RefCombobox: dezelfde toetsen en ARIA.
 * Externe dienst: de adresgegevens van de invuller gaan naar api.pdok.nl (overheid, geen
 * tracking), en alleen wat hij typt.
 *
 * Props: waarden { [vol pad]: waarde }, onChange({ [vol pad]: waarde }), readOnly, labelId,
 *        config { fields, service, placeholder }
 */
export default function AddressSearch(props) {
  // Alleen-lezen zonder combobox: downshift waarschuwt als zijn getters niet gebruikt worden.
  if (props.readOnly) return <div>{adresRegel(props.waarden || {}, props.config?.fields) || "—"}</div>;
  return <AdresZoeker {...props} />;
}

function AdresZoeker({ waarden = {}, onChange, labelId, config = {} }) {
  const service = config.service || PDOK;
  const [items, setItems] = useState([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [invoer, setInvoer] = useState("");
  const volgnr = useRef(0);
  const timer = useRef(null);
  const huidig = adresRegel(waarden, config.fields);

  useEffect(() => () => clearTimeout(timer.current), []);

  const zoek = (q) => {
    clearTimeout(timer.current);
    if (q.trim().length < 3) { setItems([]); return; }
    timer.current = setTimeout(async () => {
      const nr = ++volgnr.current;
      setBezig(true);
      try {
        const r = await fetch(suggestUrl(q, service));
        const lijst = suggesties(await r.json());
        if (nr === volgnr.current) { setItems(lijst); setFout(""); }
      } catch {
        if (nr === volgnr.current) setFout("Adressen zoeken lukt nu niet; vul de velden hieronder zelf in.");
      } finally {
        if (nr === volgnr.current) setBezig(false);
      }
    }, 250);
  };

  const kies = async (item) => {
    if (!item) return;
    try {
      const r = await fetch(lookupUrl(item.id, service));
      const doc = (await r.json())?.response?.docs?.[0];
      if (doc) onChange(adresNaarVelden(doc, config.fields));
      setInvoer("");
      setItems([]);
    } catch {
      setFout("Dit adres ophalen lukt nu niet; vul de velden hieronder zelf in.");
    }
  };

  const { isOpen, getInputProps, getMenuProps, getItemProps, highlightedIndex } = useCombobox({
    items,
    itemToString: (i) => i?.label ?? "",
    inputValue: invoer,
    onInputValueChange: ({ inputValue, type }) => {
      setInvoer(inputValue ?? "");
      if (type === useCombobox.stateChangeTypes.InputChange) zoek(inputValue ?? "");
    },
    onSelectedItemChange: ({ selectedItem }) => kies(selectedItem),
  });

  return (
    <div style={{ position: "relative", maxWidth: 520 }}>
      <input className="utrecht-textbox utrecht-textbox--html-input" style={{ width: "100%" }}
        placeholder={config.placeholder || "Zoek een adres: straat en huisnummer, of postcode en huisnummer…"}
        {...getInputProps({ "aria-labelledby": labelId })} />
      <ul {...getMenuProps()} style={{ position: "absolute", zIndex: 100, left: 0, right: 0, margin: 0, padding: 0, listStyle: "none", background: "#fff",
        border: isOpen && items.length ? "1px solid #cbd5e1" : "none", borderRadius: 6, boxShadow: isOpen && items.length ? "0 4px 12px rgba(0,0,0,0.12)" : "none", maxHeight: 280, overflowY: "auto" }}>
        {isOpen && items.map((item, index) => (
          <li key={item.id} {...getItemProps({ item, index })}
            style={{ padding: "7px 10px", cursor: "pointer", background: highlightedIndex === index ? "#e0f2fe" : "transparent", fontSize: "0.9rem" }}>
            📍 {item.label}
          </li>
        ))}
      </ul>
      <div aria-live="polite" style={{ marginTop: 4, fontSize: "0.8rem", color: fout ? "var(--cg-fout, #dc2626)" : "var(--cg-donkergrijs, #64748b)" }}>
        {fout || (bezig ? "Zoeken…" : huidig ? `Gekozen: ${huidig}` : "Bron: BAG via PDOK Locatieserver.")}
      </div>
    </div>
  );
}
