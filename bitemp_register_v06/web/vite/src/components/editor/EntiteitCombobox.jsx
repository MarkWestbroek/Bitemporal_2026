import { useEffect, useMemo, useState } from "react";
import { useCombobox } from "downshift";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { berekenWeergaveveld } from "../../shared/celEvaluator";
import { isNieuwWaarde } from "./nieuwFormulierMapping";
import NieuwSubFormulier from "./NieuwSubFormulier";

const PAGINA_GROOTTE = 100;
const MAX_PAGINAS = 20;
const NIEUW_ID = "$nieuw";

/**
 * EntiteitCombobox — keuze van een bestaande (gewone) entiteit als secundaire id van een
 * relatie, bv. `organisatie_id` → Organisatie. Zelfde combobox-patroon als RefCombobox
 * (Downshift `useCombobox`: één invoerveld met een keuzelijst die meefiltert), maar de
 * lijst komt uit `/full/<padnaam>` (gepagineerd) met labels via het weergaveveld, omdat
 * `/api/viz/reflijst/:type/opties` alleen referentielijst-items kent.
 *
 * Met `nieuwFormulier` (FD-id) en `diepte` 0 staat onderaan de lijst altijd
 * "＋ Nieuwe organisatie …" — met de zoekterm erin, want wie "Paratmos" typt en niets vindt,
 * wil die naam aanmaken (plan 2026-09-22 §5.3). De waarde wordt dan
 * `{ $nieuw: { volPad → waarde }, $formulier: <FD-id>, $naam: <zoekterm> }` en
 * NieuwSubFormulier verschijnt eronder (het vult de zoekterm in als naam). Op diepte ≥ 1
 * kan alleen gekozen worden (maak-diepte 1).
 *
 * Props: doelEntiteit (typenaam), value (id | $nieuw-object), onChange, readOnly, nieuwFormulier, diepte
 */
export default function EntiteitCombobox({ doelEntiteit, value, onChange, readOnly, nieuwFormulier = null, diepte = 0, toonValidatie }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const doelMeta = typeMetaByTypenaam?.[doelEntiteit];
  const klassenaam = (doelMeta?.klassenaam || doelEntiteit || "").toLowerCase();
  const [opties, setOpties] = useState([]);
  const [status, setStatus] = useState("idle");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!doelMeta?.padnaam || !baseUrl) return;
    let cancelled = false;
    setStatus("laden");
    (async () => {
      const items = [];
      try {
        for (let page = 1; page <= MAX_PAGINAS; page++) {
          const res = await fetch(`${baseUrl}/full/${doelMeta.padnaam}?page=${page}&size=${PAGINA_GROOTTE}`);
          if (!res.ok) break;
          const json = await res.json();
          const pagina = Array.isArray(json) ? json : safeArray(json?.[doelMeta.padnaam] || json?.items || json?.data);
          items.push(...pagina);
          if (pagina.length < PAGINA_GROOTTE) break;
        }
      } catch {
        if (!cancelled) setStatus("fout");
        return;
      }
      if (cancelled) return;
      const idKolom = doelMeta.idKolom || "id";
      const lijst = items
        .filter((it) => it && !it.afvoer)
        .map((it) => {
          const id = String(it[idKolom] ?? "");
          const naam = berekenWeergaveveld(it, doelMeta, typeMetaByTypenaam) || "";
          return { id, naam: naam || `#${id}`, zoek: `${naam} ${id}`.toLowerCase() };
        })
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
      setOpties(lijst);
      setStatus("klaar");
    })();
    return () => { cancelled = true; };
  }, [doelMeta, baseUrl, typeMetaByTypenaam]);

  const magNieuw = Boolean(nieuwFormulier) && diepte < 1;
  const isNieuw = isNieuwWaarde(value);
  const gekozen = !isNieuw && value != null && value !== "" ? opties.find((o) => o.id === String(value)) || null : null;

  // Zichtbare items: filter op de zoekterm; bij een gekozen waarde (label in het veld) de
  // hele lijst, zodat openen via ▼ niet tot één rij inklapt. Onderaan de "nieuw"-rij.
  const items = useMemo(() => {
    const f = inputValue.trim().toLowerCase();
    const filteren = f && !(gekozen && inputValue === gekozen.naam);
    const basis = filteren ? opties.filter((o) => o.zoek.includes(f)) : opties;
    return magNieuw ? [...basis, { id: NIEUW_ID, naam: f && filteren ? `＋ Nieuwe ${klassenaam} "${inputValue.trim()}"` : `＋ Nieuwe ${klassenaam}…` }] : basis;
  }, [opties, inputValue, magNieuw, klassenaam, gekozen]);

  // Label van de gekozen waarde in het veld zetten zodra de lijst er is.
  useEffect(() => {
    if (gekozen) setInputValue(gekozen.naam);
    else if (!isNieuw && (value == null || value === "")) setInputValue("");
  }, [gekozen, isNieuw, value]);

  const {
    isOpen, getToggleButtonProps, getMenuProps, getInputProps, highlightedIndex, getItemProps, selectItem,
  } = useCombobox({
    items,
    itemToString: (item) => (item ? (item.id === NIEUW_ID ? "" : item.naam) : ""),
    selectedItem: gekozen,
    inputValue,
    onInputValueChange: ({ inputValue: iv }) => setInputValue(iv ?? ""),
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) { onChange(""); return; }
      if (selectedItem.id === NIEUW_ID) {
        onChange({ $nieuw: {}, $formulier: String(nieuwFormulier), $naam: inputValue.trim() });
        setInputValue("");
        return;
      }
      onChange(selectedItem.id);
    },
    onIsOpenChange: ({ isOpen: open }) => {
      // Sluiten zonder keuze: veld terug naar het label van de gekozen waarde.
      if (!open) setInputValue(gekozen ? gekozen.naam : "");
    },
  });

  if (!doelMeta) return <span style={{ color: "var(--cg-fout, red)" }}>Onbekende doelentiteit: {doelEntiteit}</span>;

  if (isNieuw) {
    return (
      <div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span className="utrecht-textbox utrecht-textbox--html-input" style={{ flex: 1, minWidth: 0, background: "var(--cg-lichtgrijs, #f1f5f9)" }}>
            Nieuwe {klassenaam} (wordt in dezelfde registratie aangemaakt)
          </span>
          {!readOnly && (
            <button type="button" className="utrecht-button utrecht-button--secondary-action" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem", whiteSpace: "nowrap" }} onClick={() => onChange("")}>
              Toch bestaande kiezen
            </button>
          )}
        </div>
        <NieuwSubFormulier
          doelEntiteit={doelEntiteit}
          formulierId={value.$formulier || nieuwFormulier}
          values={value.$nieuw || {}}
          naam={value.$naam}
          onChange={(pad, w) => onChange({ ...value, $nieuw: { ...(value.$nieuw || {}), [pad]: w } })}
          readOnly={readOnly}
          diepte={diepte + 1}
          toonValidatie={toonValidatie}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minWidth: 300 }}>
      <div style={{ display: "flex", gap: 2 }}>
        <input
          className="utrecht-textbox utrecht-textbox--html-input"
          style={{ flex: 1 }}
          placeholder={status === "laden" ? "Laden…" : status === "fout" ? "Laden mislukt" : `Zoek ${klassenaam}${magNieuw ? " of typ een nieuwe naam" : ""}…`}
          disabled={readOnly}
          {...getInputProps()}
        />
        <button type="button" className="utrecht-button utrecht-button--secondary-action" aria-label="toggle menu" style={{ padding: "0 8px", fontSize: 12 }} disabled={readOnly} {...getToggleButtonProps()}>▼</button>
        {gekozen && !readOnly && (
          <button type="button" className="utrecht-button utrecht-button--secondary-action" aria-label="wis selectie" style={{ padding: "0 8px", fontSize: 12 }} onClick={() => { selectItem(null); onChange(""); setInputValue(""); }}>✕</button>
        )}
      </div>
      <ul
        {...getMenuProps()}
        style={{
          position: "absolute", zIndex: 100, width: "100%", minWidth: 280, maxHeight: 240, overflowY: "auto",
          margin: 0, padding: 0, listStyle: "none", background: "#fff",
          border: isOpen && items.length > 0 ? "1px solid #ccc" : "none", borderRadius: 4,
          boxShadow: isOpen && items.length > 0 ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {isOpen && items.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            {...getItemProps({ item, index })}
            style={{
              padding: "6px 10px", cursor: "pointer", fontSize: 13,
              background: highlightedIndex === index ? "#e0f2fe" : "transparent",
              ...(item.id === NIEUW_ID ? { borderTop: "1px solid #e5e7eb", color: "var(--cg-accent, #0f766e)", fontWeight: 600 } : {}),
            }}
          >
            <span style={{ fontWeight: item.id === NIEUW_ID ? 600 : 500 }}>{item.naam}</span>
            {item.id !== NIEUW_ID && <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 11 }}>ID: {item.id}</span>}
          </li>
        ))}
        {isOpen && items.length === 0 && status !== "laden" && (
          <li style={{ padding: "6px 10px", color: "#6b7280", fontSize: 13 }}>Geen resultaten</li>
        )}
      </ul>
    </div>
  );
}
