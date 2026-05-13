import { useState, useEffect, useRef, useCallback } from "react";
import { useCombobox } from "downshift";
import { useSchema } from "../../context/SchemaContext";
import { evalueerCelExpressie } from "../../shared/celEvaluator";

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

function maakWeergavenaam(optie, weergaveRegel) {
  if (!optie?.velden) return String(optie?.id ?? "");
  if (weergaveRegel) {
    try {
      const ctx = { ...optie.velden };
      const result = evalueerCelExpressie(weergaveRegel, ctx);
      if (result != null && String(result).trim() !== "") return String(result);
    } catch {
      // val terug op concatenatie
    }
  }
  // Fallback: alle veldwaarden samenvoegen
  const vals = Object.values(optie.velden).filter(Boolean);
  return vals.length > 0 ? vals.join(" — ") : String(optie.id ?? "");
}

export default function RefCombobox({ refType, value, onChange, readOnly }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();

  const refMeta = typeMetaByTypenaam?.[refType];
  const itemCount = refMeta?.itemCount ?? null;
  const isKlein = itemCount !== null && itemCount <= DREMPEL_KLEIN;

  // Zoek de weergavenaam afleidingsregel
  const weergaveRegel = (() => {
    const avs = refMeta?.afgeleideVelden;
    if (!Array.isArray(avs)) return null;
    const wv = avs.find((av) => av.isWeergaveVeld || av.weergaveVeld);
    return wv?.afleidingsregelTaal === "cel" ? wv.afleidingsregel : null;
  })();

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
          if (match) setSelectedLabel(maakWeergavenaam(match, weergaveRegel));
        }
      }
    });
    return () => { cancelled = true; };
  }, [isKlein, fetchOpties, weergaveRegel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voor grote lijsten: haal label voor huidige waarde op bij mount
  useEffect(() => {
    if (isKlein || value == null || value === "") return;
    let cancelled = false;
    // Zoek de optie met het huidige ID
    fetchOpties(String(value), 5).then((items) => {
      if (cancelled) return;
      const match = items.find((o) => String(o.id) === String(value));
      if (match) {
        setSelectedLabel(maakWeergavenaam(match, weergaveRegel));
        // Voeg het item toe aan opties zodat Downshift selectedItem kan vinden
        // en de naam in het invoerveld toont (niet alleen in readOnly modus).
        setOpties((prev) =>
          prev.find((o) => String(o.id) === String(match.id)) ? prev : [match, ...prev]
        );
      }
    });
    return () => { cancelled = true; };
  }, [isKlein, value, fetchOpties, weergaveRegel]);

  function handleInputChange(inputValue) {
    if (isKlein && alleOpties) {
      // Client-side filter
      if (!inputValue) {
        setOpties(alleOpties);
      } else {
        const lower = inputValue.toLowerCase();
        setOpties(
          alleOpties.filter((o) =>
            maakWeergavenaam(o, weergaveRegel).toLowerCase().includes(lower)
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
    itemToString: (item) => (item ? maakWeergavenaam(item, weergaveRegel) : ""),
    selectedItem: opties.find((o) => String(o.id) === String(value)) || null,
    onInputValueChange: ({ inputValue }) => handleInputChange(inputValue),
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        onChange(selectedItem.id);
        setSelectedLabel(maakWeergavenaam(selectedItem, weergaveRegel));
      } else {
        onChange("");
        setSelectedLabel("");
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
              <span style={{ fontWeight: 500 }}>{maakWeergavenaam(item, weergaveRegel)}</span>
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
