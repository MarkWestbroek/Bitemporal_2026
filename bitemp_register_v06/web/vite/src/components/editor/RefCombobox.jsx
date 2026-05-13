import { useState, useEffect, useRef, useCallback } from "react";
import { useCombobox } from "downshift";
import { useSchema } from "../../context/SchemaContext";
import { bouwReflijstOptieLabel } from "../../shared/celEvaluator";

/**
 * RefCombobox — Downshift-gebaseerde combobox voor referentielijst-items.
 *
 * Kleine lijsten (≤ DREMPEL): alle opties worden bij mount opgehaald en
 *   client-side gefilterd (snelle UX, geen extra API-calls).
 * Grote lijsten (> DREMPEL): server-side zoeken via ?q= met debounce.
 *
 * Props:
 *  - refType:   typenaam van het referentielijst_item (bijv. "Gemeente")
 *  - value:     huidige ID-waarde
 *  - onChange:  (nieuweID) => void
 *  - readOnly:  boolean
 */

const DREMPEL_KLEIN = 30;
const DEBOUNCE_MS = 250;

export default function RefCombobox({ refType, value, onChange, readOnly }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();

  const refMeta = typeMetaByTypenaam?.[refType];
  const itemCount = refMeta?.itemCount ?? null;
  const isKlein = itemCount !== null && itemCount <= DREMPEL_KLEIN;

  // Helper die de label berekent voor een optie via de gedeelde celEvaluator-helper
  const maakLabel = useCallback(
    (optie) => bouwReflijstOptieLabel(optie, refMeta, typeMetaByTypenaam),
    [refMeta, typeMetaByTypenaam]
  );

  const [opties, setOpties] = useState([]);
  const [alleOpties, setAlleOpties] = useState(null); // alleen voor kleine lijsten
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // Haal de label op van de huidige waarde (voor weergave in gesloten staat)
  const [selectedLabel, setSelectedLabel] = useState("");

  const fetchOpties = useCallback(
    async (q = "", size = isKlein ? 200 : 50) => {
      if (!refType || !baseUrl) return [];
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("size", String(size));
      const url = `${baseUrl}/api/viz/reflijst/${encodeURIComponent(refType)}/opties?${params}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.opties) ? data.opties : [];
      } catch {
        return [];
      }
    },
    [refType, baseUrl, isKlein]
  );

  // Voor kleine lijsten: haal alle opties eenmalig op
  useEffect(() => {
    if (!isKlein) return;
    let cancelled = false;
    setLoading(true);
    fetchOpties("", 200).then((items) => {
      if (!cancelled) {
        setAlleOpties(items);
        setOpties(items);
        setLoading(false);
        // Zoek label voor huidige waarde
        if (value != null && value !== "") {
          const match = items.find((o) => String(o.id) === String(value));
          if (match) setSelectedLabel(maakLabel(match));
        }
      }
    });
    return () => { cancelled = true; };
  }, [isKlein, fetchOpties, maakLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voor grote lijsten: haal label voor huidige waarde op bij mount
  useEffect(() => {
    if (isKlein || value == null || value === "") return;
    let cancelled = false;
    // Zoek de optie met het huidige ID
    fetchOpties(String(value), 5).then((items) => {
      if (cancelled) return;
      const match = items.find((o) => String(o.id) === String(value));
      if (match) {
        setSelectedLabel(maakLabel(match));
        // Voeg het item toe aan opties zodat Downshift selectedItem kan vinden
        // en de naam in het invoerveld toont (niet alleen in readOnly modus).
        setOpties((prev) =>
          prev.find((o) => String(o.id) === String(match.id)) ? prev : [match, ...prev]
        );
      }
    });
    return () => { cancelled = true; };
  }, [isKlein, value, fetchOpties, maakLabel]);

  function handleInputChange(inputValue) {
    if (isKlein && alleOpties) {
      // Client-side filter
      if (!inputValue) {
        setOpties(alleOpties);
      } else {
        const lower = inputValue.toLowerCase();
        setOpties(
          alleOpties.filter((o) =>
            maakLabel(o).toLowerCase().includes(lower)
          )
        );
      }
    } else {
      // Server-side zoeken met debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const items = await fetchOpties(inputValue || "");
        setOpties(items);
        setLoading(false);
      }, DEBOUNCE_MS);
    }
  }

  // Gecontroleerde inputValue: synct met selectedLabel zolang gebruiker niet typt.
  const [inputValue, setInputValue] = useState("");
  const userTypingRef = useRef(false);

  // Sync inputValue vanuit selectedLabel wanneer gebruiker niet zelf typt
  // (bijv. bij eerste keer ophalen van label voor bestaande waarde).
  useEffect(() => {
    if (!userTypingRef.current) {
      setInputValue(selectedLabel || "");
    }
  }, [selectedLabel]);

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectItem,
  } = useCombobox({
    items: opties,
    itemToString: (item) => (item ? maakLabel(item) : ""),
    selectedItem: opties.find((o) => String(o.id) === String(value)) || null,
    inputValue,
    onInputValueChange: ({ inputValue: iv, type }) => {
      const next = iv ?? "";
      setInputValue(next);
      // Markeer als user-typing alleen bij echte invoerwijzigingen
      if (type === useCombobox.stateChangeTypes.InputChange) {
        userTypingRef.current = true;
        handleInputChange(next);
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      userTypingRef.current = false;
      if (selectedItem) {
        onChange(selectedItem.id);
        const label = maakLabel(selectedItem);
        setSelectedLabel(label);
        setInputValue(label);
      } else {
        onChange("");
        setSelectedLabel("");
        setInputValue("");
      }
    },
    onIsOpenChange: ({ isOpen }) => {
      // Bij sluiten zonder selectie: reset inputValue naar selectedLabel
      if (!isOpen) {
        userTypingRef.current = false;
        setInputValue(selectedLabel || "");
      }
    },
  });

  if (readOnly) {
    return (
      <input
        className="utrecht-textbox utrecht-textbox--html-input"
        value={selectedLabel || String(value ?? "")}
        readOnly
        disabled
      />
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 2 }}>
        <input
          className="utrecht-textbox utrecht-textbox--html-input"
          style={{ flex: 1 }}
          placeholder={loading ? "Laden..." : `Zoek ${refMeta?.klassenaam || refType}...`}
          {...getInputProps()}
        />
        <button
          type="button"
          className="utrecht-button utrecht-button--secondary-action"
          aria-label="toggle menu"
          style={{ padding: "0 8px", fontSize: 12 }}
          {...getToggleButtonProps()}
        >
          ▼
        </button>
        {value != null && value !== "" && (
          <button
            type="button"
            className="utrecht-button utrecht-button--secondary-action"
            aria-label="wis selectie"
            style={{ padding: "0 8px", fontSize: 12 }}
            onClick={() => {
              selectItem(null);
              onChange("");
              setSelectedLabel("");
              setInputValue("");
              userTypingRef.current = false;
            }}
          >
            ✕
          </button>
        )}
      </div>
      <ul
        {...getMenuProps()}
        style={{
          position: "absolute",
          zIndex: 100,
          width: "100%",
          maxHeight: 240,
          overflowY: "auto",
          margin: 0,
          padding: 0,
          listStyle: "none",
          background: "#fff",
          border: isOpen && opties.length > 0 ? "1px solid #ccc" : "none",
          borderRadius: 4,
          boxShadow: isOpen && opties.length > 0 ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {isOpen &&
          opties.map((item, index) => (
            <li
              key={`${item.id}-${index}`}
              {...getItemProps({ item, index })}
              style={{
                padding: "6px 10px",
                cursor: "pointer",
                background: highlightedIndex === index ? "#e0f2fe" : "transparent",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 500 }}>{maakLabel(item)}</span>
              <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 11 }}>ID: {item.id}</span>
            </li>
          ))}
        {isOpen && opties.length === 0 && !loading && (
          <li style={{ padding: "6px 10px", color: "#6b7280", fontSize: 13 }}>Geen resultaten</li>
        )}
        {isOpen && loading && (
          <li style={{ padding: "6px 10px", color: "#6b7280", fontSize: 13 }}>Zoeken...</li>
        )}
      </ul>
    </div>
  );
}
