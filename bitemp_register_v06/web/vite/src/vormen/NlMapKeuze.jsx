import { useEffect, useMemo, useState } from "react";
import useKeuze from "./useKeuze";

/**
 * NlMapKeuze — de vorm `nl-map`: gemeenten als stip op de kaart van Nederland. Hybride:
 *  - invoer: alle gemeenten zijn stippen; aanklikken kiest (één of meer uit een lijst), met
 *    toetsenbord en ARIA uit useKeuze (listbox, zoals image-map);
 *  - weergave (readOnly): alleen de gekozen gemeenten, groot, met naam.
 * Bij aanwijzen of focus: de gemeente en haar woonplaatsen. Na fusies en hernoemingen ken je
 * de gemeentenaam vaak niet, de plaatsen erin meestal wel.
 *
 * Kaartdata: src/vormen/data/nl-kaart.json (scripts/maak_nl_kaartdata.py, PDOK/CBS open data),
 * pas geladen als de vorm op de pagina staat. De koppeling loopt via de CBS-code (GM0344).
 * Caribisch Nederland (Bonaire GM9001, Sint Eustatius GM9002, Saba GM9003: de fictieve
 * CBS-codes) staat in kaders linksboven, zodra de lijst die codes bevat.
 *
 * Props: items [{ value, label, code }], meervoudig, waarde, onChange, readOnly, labelId,
 *        groepen?: [{ label, color, waarden: [...] }] — alleen weergave: meerdere kleuren
 *                  (bv. Realiseert / Maakt gebruik van),
 *        config { provinces, places, maxWidth, accentColor }
 */
let kaartBelofte = null;
const laadKaart = () => (kaartBelofte ||= import("./data/nl-kaart.json").then((m) => m.default || m));

export default function NlMapKeuze({ items = [], meervoudig = false, waarde, onChange = () => {}, readOnly = false, labelId, groepen = null, config = {} }) {
  const [kaart, setKaart] = useState(null);
  const [wijs, setWijs] = useState(null);
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

  const { getMenuProps, getItemProps, highlightedIndex, isSelected } = useKeuze({
    items: readOnly ? gekozen : opKaart,
    itemToKey: (i) => (i ? String(i.value) : null), itemToString: (i) => i?.label ?? "",
    multiple: meervoudig, readOnly,
    ...(meervoudig ? { selectedItems: gekozen } : { selectedItem: gekozen[0] ?? null }),
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem ? String(selectedItem.value) : ""),
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems.map((i) => String(i.value))),
    onHighlightedIndexChange: ({ highlightedIndex: h }) => setWijs((readOnly ? gekozen : opKaart)[h] || null),
  });

  if (!kaart) return <div style={{ height: 120, color: "var(--cg-donkergrijs, #64748b)" }}>Kaart laden…</div>;
  const [, , vbB, vbH] = kaart.viewBox;
  const lijst = readOnly ? gekozen : opKaart;
  const info = wijs && kaart.gemeenten[wijs.code];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <svg viewBox={`0 0 ${vbB} ${vbH}`} style={{ width: "100%", maxWidth: config.maxWidth || 360, height: "auto", flex: "0 1 auto" }}
        {...getMenuProps({ ...(labelId ? { "aria-labelledby": labelId } : { "aria-label": "Kaart van Nederland" }), onMouseLeave: () => setWijs(null) })}>
        {config.provinces !== false && kaart.provincies.map((p) => (
          <path key={p.naam} d={p.pad} fill="#eef2f7" stroke="#cbd5e1" strokeWidth={0.5} vectorEffect="non-scaling-stroke" aria-hidden="true" />
        ))}
        {/* Caribisch Nederland in kaders linksboven (eigen schaal per kader), alleen als de
            keuzelijst eilanden bevat (GM9001–GM9003 in de referentielijst). */}
        {(kaart.kaders || []).filter((k) => opKaart.some((i) => kaart.gemeenten[i.code]?.kader === k.titel)).map((k) => {
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
            {readOnly ? "Wijs een stip aan voor de woonplaatsen." : meervoudig ? "Klik op de gemeenten (pijltjes en spatie werken ook)." : "Klik op een gemeente."}
          </div>
        )}
        {groepen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
            {groepen.map((g) => (
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
