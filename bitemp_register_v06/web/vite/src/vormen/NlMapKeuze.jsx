import { useEffect, useId, useMemo, useRef, useState } from "react";
import useKeuze from "./useKeuze";
import { naarRichting, middelste, naarAlfabet, naarLetter, zoekOpKaart } from "./kaartNavigatie";

/**
 * NlMapKeuze — de vorm `nl-map`: gemeenten als stip op de kaart van Nederland. Hybride:
 *  - invoer: alle gemeenten zijn stippen; aanklikken kiest (één of meer uit een lijst), met
 *    toetsenbord en ARIA uit useKeuze (listbox, zoals image-map);
 *  - weergave (readOnly): alleen de gekozen gemeenten, groot, met naam.
 * Bij aanwijzen of focus: de gemeente en haar woonplaatsen. Na fusies en hernoemingen ken je
 * de gemeentenaam vaak niet, de plaatsen erin meestal wel.
 *
 * Toetsenbord (28-09, kaartNavigatie.js): een kaart is geen lijst.
 *  - pijltjes: naar de buurstip in die richting (grafisch wandelen), niet de volgende in het alfabet;
 *  - Shift+↑/↓: vorige/volgende beginletter; Shift+←/→: vorige/volgende in het alfabet;
 *  - typen: springt naar het zoekveld, dat zoekt op gemeente én woonplaats; Enter kiest.
 * Waar het druk is (Randstad, Zuid-Limburg) is zoeken sneller dan klikken.
 *
 * Kaartdata: src/vormen/data/nl-kaart.json (scripts/maak_nl_kaartdata.py, PDOK/CBS open data),
 * pas geladen als de vorm op de pagina staat. De koppeling loopt via de CBS-code (GM0344).
 * Caribisch Nederland (Bonaire GM9001, Sint Eustatius GM9002, Saba GM9003: de fictieve
 * CBS-codes) staat altijd in kaders linksboven; een stip alleen als de lijst die codes bevat.
 *
 * Props: items [{ value, label, code }], meervoudig, waarde, onChange, readOnly, labelId,
 *        groepen?: [{ label, color, waarden: [...] }] — alleen weergave: meerdere kleuren
 *                  (bv. Realiseert / Maakt gebruik van),
 *        config { provinces, places, maxWidth, accentColor }
 */
let kaartBelofte = null;
const ALLEEN_SCHERMLEZER = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };
const laadKaart = () => (kaartBelofte ||= import("./data/nl-kaart.json").then((m) => m.default || m));

export default function NlMapKeuze({ items = [], meervoudig = false, waarde, onChange = () => {}, readOnly = false, labelId, groepen = null, config = {} }) {
  const [kaart, setKaart] = useState(null);
  const [wijs, setWijs] = useState(null);
  const [zoek, setZoek] = useState("");
  const zoekRef = useRef(null);
  const resultatenRef = useRef(null);
  const hulpId = `nl-map-hulp-${useId().replace(/:/g, "")}`;
  useEffect(() => { let weg = false; laadKaart().then((k) => { if (!weg) setKaart(k); }); return () => { weg = true; }; }, []);

  const accent = config.accentColor || "#e11d48";
  const sleutels = meervoudig ? (Array.isArray(waarde) ? waarde.map(String) : []) : (waarde == null || waarde === "" ? [] : [String(waarde)]);
  const opKaart = useMemo(() => (kaart ? items.filter((i) => kaart.gemeenten[i.code]) : []), [kaart, items]);
  const nietOpKaart = kaart ? items.filter((i) => !kaart.gemeenten[i.code] && sleutels.includes(String(i.value))) : [];
  const gekozen = opKaart.filter((i) => sleutels.includes(String(i.value)));
  const groepenVan = (v) => (groepen || []).filter((g) => g.waarden.map(String).includes(String(v)));
  const kleurVan = (v) => groepenVan(v)[0]?.color || accent;
  // In twee groepen (bv. realiseert én gebruikt): ring in de kleur van de tweede groep.
  const ringVan = (v) => groepenVan(v)[1]?.color || null;
  // De stippen waarover je met het toetsenbord loopt (dezelfde volgorde als de items van useKeuze).
  const navLijst = readOnly ? gekozen : opKaart;
  const punten = kaart ? navLijst.map((i) => kaart.gemeenten[i.code]) : [];

  const { getMenuProps, getItemProps, highlightedIndex, isSelected, selectItem, setHighlightedIndex } = useKeuze({
    items: readOnly ? gekozen : opKaart,
    itemToKey: (i) => (i ? String(i.value) : null), itemToString: (i) => i?.label ?? "",
    multiple: meervoudig, readOnly,
    ...(meervoudig ? { selectedItems: gekozen } : { selectedItem: gekozen[0] ?? null }),
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem ? String(selectedItem.value) : ""),
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems.map((i) => String(i.value))),
    onHighlightedIndexChange: ({ highlightedIndex: h }) => setWijs((readOnly ? gekozen : opKaart)[h] || null),
    // Focus op de kaart zonder keuze: begin in het midden, niet bij de eerste in het alfabet.
    stateReducer: (_s, { type, changes }) => (type === useKeuze.stateChangeTypes.MenuFocus && gekozen.length === 0 && punten.length
      ? { ...changes, highlightedIndex: middelste(punten) } : changes),
  });

  const kaartToets = (e) => {
    if (!punten.length) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      if (highlightedIndex < 0) { setHighlightedIndex(middelste(punten)); return; }
      const labels = navLijst.map((i) => i.label);
      const verticaal = e.key === "ArrowUp" || e.key === "ArrowDown";
      const vooruit = e.key === "ArrowDown" || e.key === "ArrowRight";
      setHighlightedIndex(e.shiftKey
        ? (verticaal ? naarLetter(labels, highlightedIndex, vooruit ? 1 : -1) : naarAlfabet(labels, highlightedIndex, vooruit ? 1 : -1))
        : naarRichting(punten, highlightedIndex, e.key));
      return;
    }
    // Typen op de kaart: verder in het zoekveld.
    if (!readOnly && e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setZoek(e.key);
      zoekRef.current?.focus();
    }
  };

  const kandidaten = kaart ? opKaart.map((i) => ({ label: i.label, woonplaatsen: kaart.gemeenten[i.code]?.woonplaatsen })) : [];
  const resultaten = !readOnly && zoek ? zoekOpKaart(kandidaten, zoek) : [];
  const zoekWijzigt = (tekst) => {
    setZoek(tekst);
    const r = zoekOpKaart(kandidaten, tekst);
    setHighlightedIndex(r[0]?.index ?? -1);
  };
  const zoekToets = (e) => {
    if (e.key === "Enter" && resultaten[0]) { e.preventDefault(); selectItem(opKaart[resultaten[0].index]); setZoek(""); }
    else if (e.key === "ArrowDown" && resultaten.length) { e.preventDefault(); resultatenRef.current?.querySelector("button")?.focus(); }
    else if (e.key === "Escape") { setZoek(""); setHighlightedIndex(-1); }
  };
  const resultaatToets = (e) => {
    const knop = e.currentTarget;
    if (e.key === "ArrowDown") { e.preventDefault(); knop.nextElementSibling?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (knop.previousElementSibling || zoekRef.current)?.focus(); }
    else if (e.key === "Escape") { setZoek(""); zoekRef.current?.focus(); }
  };

  if (!kaart) return <div style={{ height: 120, color: "var(--cg-donkergrijs, #64748b)" }}>Kaart laden…</div>;
  const [, , vbB, vbH] = kaart.viewBox;
  const lijst = navLijst;
  const info = wijs && kaart.gemeenten[wijs.code];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <svg viewBox={`0 0 ${vbB} ${vbH}`} style={{ width: "100%", maxWidth: config.maxWidth || 360, height: "auto", flex: "0 1 auto" }}
        {...getMenuProps({ ...(labelId ? { "aria-labelledby": labelId } : { "aria-label": "Kaart van Nederland" }), onMouseLeave: () => setWijs(null), onKeyDown: kaartToets,
          "aria-describedby": hulpId })}>
        {config.provinces !== false && kaart.provincies.map((p) => (
          <path key={p.naam} d={p.pad} fill="#eef2f7" stroke="#cbd5e1" strokeWidth={0.5} vectorEffect="non-scaling-stroke" aria-hidden="true" />
        ))}
        {/* Caribisch Nederland in kaders linksboven (eigen schaal per kader). Altijd, ook zonder
            stip: ze horen bij Nederland. Uit met config.caribbean = false. */}
        {config.caribbean !== false && (kaart.kaders || []).map((k) => {
          const [x, y, b, h] = k.kader;
          return (
            <g key={k.titel} aria-hidden="true">
              <rect x={x} y={y} width={b} height={h} rx={2} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
              <text x={x + 3} y={y + 7} fontSize={6} fill="#64748b">
                {(k.regels || [k.titel]).map((r, i) => <tspan key={r} x={x + 3} dy={i ? 6.5 : 0}>{r}</tspan>)}
              </text>
              <path d={k.pad} fill="#eef2f7" stroke="#cbd5e1" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {lijst.map((item, index) => {
          const g = kaart.gemeenten[item.code];
          const aan = isSelected(item) || readOnly;
          const licht = highlightedIndex === index || wijs?.value === item.value;
          const r = aan ? 5 : licht ? 3.6 : 1.9;
          return (
            <circle key={item.value} cx={g.x} cy={g.y} r={r} {...getItemProps({ item, index, onMouseEnter: () => setWijs(item) })}
              fill={aan ? kleurVan(item.value) : licht ? "#1d4ed8" : "#94a3b8"} fillOpacity={aan ? 0.95 : 0.8}
              stroke={aan && ringVan(item.value) ? ringVan(item.value) : aan || licht ? "#ffffff" : "none"} strokeWidth={aan && ringVan(item.value) ? 2.4 : 1.2} style={{ cursor: readOnly ? "default" : "pointer", transition: "r 100ms" }}>
              <title>{`${item.label}${g.woonplaatsen.length ? ` — ${g.woonplaatsen.slice(0, 8).join(", ")}${g.woonplaatsen.length > 8 ? ", …" : ""}` : ""}`}</title>
            </circle>
          );
        })}
        {readOnly && gekozen.length <= 6 && gekozen.map((item) => {
          const g = kaart.gemeenten[item.code];
          return <text key={`t-${item.value}`} x={g.x + 7} y={g.y + 3.5} fontSize={10} fontWeight={700} fill="#0f172a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" aria-hidden="true">{item.label}</text>;
        })}
      </svg>

      <div style={{ flex: "1 1 200px", minWidth: 180, fontSize: "0.85rem" }}>
        {!readOnly && (
          <div style={{ marginBottom: 10 }}>
            <input ref={zoekRef} type="search" value={zoek} onChange={(e) => zoekWijzigt(e.target.value)} onKeyDown={zoekToets}
              placeholder="Zoek gemeente of plaats…" aria-label="Zoek een gemeente of woonplaats op de kaart" autoComplete="off"
              className="utrecht-textbox utrecht-textbox--html-input" style={{ width: "100%", boxSizing: "border-box", padding: "0.3rem 0.5rem", fontSize: "0.85rem" }} />
            {zoek && (
              <div ref={resultatenRef} role="group" aria-label="Gevonden gemeenten" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                {resultaten.length === 0 && <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>Niets gevonden.</span>}
                {resultaten.map(({ index, via }) => {
                  const item = opKaart[index];
                  const aan = isSelected(item);
                  return (
                    <button key={item.value} type="button" aria-pressed={aan} onKeyDown={resultaatToets}
                      onClick={() => { selectItem(item); setZoek(""); zoekRef.current?.focus(); }}
                      onMouseEnter={() => setHighlightedIndex(index)} onFocus={() => setHighlightedIndex(index)}
                      style={{ textAlign: "left", border: "1px solid var(--cg-rand, #e2e8f0)", borderRadius: 6, padding: "0.2rem 0.5rem", cursor: "pointer",
                        background: aan ? "#ffe4e6" : "var(--cg-wit, #fff)", color: "inherit", font: "inherit" }}>
                      {aan ? "✓ " : ""}<strong>{item.label}</strong>{via && <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}> · via {via}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {info ? (
          <div aria-live="polite">
            <strong style={{ fontSize: "0.95rem" }}>{wijs.label}</strong>
            {config.places !== false && info.woonplaatsen.length > 0 && (
              <div style={{ color: "var(--cg-donkergrijs, #475569)", marginTop: 2 }}>
                {info.woonplaatsen.length === 1 ? "Woonplaats: " : `${info.woonplaatsen.length} woonplaatsen: `}{info.woonplaatsen.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--cg-donkergrijs, #64748b)" }}>
            {readOnly ? "Wijs een stip aan voor de woonplaatsen." : meervoudig ? "Klik op de gemeenten, of zoek hierboven." : "Klik op een gemeente, of zoek hierboven."}
          </div>
        )}
        {/* In de weergave (bv. de iframe) alleen voor schermlezers: voor bezoekers is het ruis. */}
        <div id={hulpId} style={readOnly ? ALLEEN_SCHERMLEZER : { marginTop: 8, color: "var(--cg-donkergrijs, #64748b)", fontSize: "0.75rem", lineHeight: 1.4 }}>
          Toetsen op de kaart: pijltjes naar de buurstip, Shift+↑↓ per letter, Shift+←→ alfabetisch{readOnly ? "" : ", spatie kiest, typen zoekt"}.
        </div>
        {groepen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
            {groepen.filter((g) => g.waarden.length > 0).map((g) => (
              <span key={g.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.color }} />{g.label} ({g.waarden.length})
              </span>
            ))}
          </div>
        )}
        {!readOnly && gekozen.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {gekozen.map((i) => (
              <span key={i.value} style={{ padding: "0.1rem 0.5rem", borderRadius: 999, background: "#ffe4e6", color: "#9f1239", fontWeight: 600 }}>{i.label}</span>
            ))}
          </div>
        )}
        {nietOpKaart.length > 0 && (
          <div style={{ marginTop: 8, color: "var(--cg-donkergrijs, #64748b)" }}>Niet op de kaart (oude of onbekende code): {nietOpKaart.map((i) => i.label).join(", ")}</div>
        )}
      </div>
    </div>
  );
}
