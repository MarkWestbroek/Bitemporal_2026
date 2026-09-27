import { useState } from "react";

/**
 * RankingKeuze — de vorm `ranking`: een VOLGORDE uit een lijst (prioriteiten). Links wat nog
 * niet gerangschikt is, rechts de rangorde. Toevoegen met een klik, ordenen met slepen of met
 * de knoppen ↑ ↓ (toetsenbord), weghalen met ×. De waarde is de lijst sleutels IN VOLGORDE;
 * de opslag moet die volgorde bewaren (rijen met een volgnummer, of één veld "a;b;c" zonder
 * hersortering).
 *
 * Props: items [{ value, label, description? }], waarde (array, geordend), onChange(array),
 *        readOnly, labelId, config { max, poolLabel, rankLabel }
 */
export default function RankingKeuze({ items = [], waarde, onChange, readOnly = false, labelId, config = {} }) {
  const volgorde = [].concat(waarde ?? []).map(String).filter(Boolean);
  const perWaarde = Object.fromEntries(items.map((i) => [String(i.value), i]));
  const label = (v) => perWaarde[v]?.label || v;
  const pool = items.filter((i) => !volgorde.includes(String(i.value)));
  const vol = config.max != null && volgorde.length >= Number(config.max);
  const [sleep, setSleep] = useState(null);

  if (readOnly) {
    if (!volgorde.length) return <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>—</span>;
    return <ol style={{ margin: 0, paddingLeft: "1.4rem" }}>{volgorde.map((v) => <li key={v}>{label(v)}</li>)}</ol>;
  }

  const verplaats = (van, naar) => {
    if (naar < 0 || naar >= volgorde.length || van === naar) return;
    const n = [...volgorde];
    const [x] = n.splice(van, 1);
    n.splice(naar, 0, x);
    onChange(n);
  };
  const knop = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", padding: "0 7px", lineHeight: "22px" };
  const kolom = { flex: "1 1 220px", minWidth: 0, border: "1px dashed #cbd5e1", borderRadius: 10, padding: 8, background: "#f8fafc" };
  const kop = { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" };

  return (
    <div role="group" aria-labelledby={labelId} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={kolom}>
        <p style={kop}>{config.poolLabel || "Nog te rangschikken"}</p>
        {pool.length === 0 && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>Alles staat in de volgorde.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pool.map((i) => (
            <button key={i.value} type="button" disabled={vol} title={i.description || undefined}
              onClick={() => onChange([...volgorde, String(i.value)])}
              style={{ ...knop, padding: "4px 10px", lineHeight: 1.3, opacity: vol ? 0.5 : 1, cursor: vol ? "default" : "pointer" }}>
              + {i.label}
            </button>
          ))}
        </div>
        {vol && <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#64748b" }}>Maximaal {config.max}.</p>}
      </div>
      <div style={kolom}>
        <p style={kop}>{config.rankLabel || "Volgorde (belangrijkste eerst)"}</p>
        <ol aria-label={config.rankLabel || "Volgorde"} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}
          onDragOver={(e) => e.preventDefault()}>
          {volgorde.map((v, i) => (
            <li key={v} draggable
              onDragStart={() => setSleep(i)} onDragEnd={() => setSleep(null)}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (sleep != null) verplaats(sleep, i); setSleep(null); }}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 8px",
                opacity: sleep === i ? 0.5 : 1, cursor: "grab" }}>
              <span aria-hidden="true" style={{ fontWeight: 800, color: "#6366f1", minWidth: 18, textAlign: "right" }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{label(v)}</span>
              <button type="button" aria-label={`${label(v)} omhoog`} disabled={i === 0} onClick={() => verplaats(i, i - 1)} style={knop}>↑</button>
              <button type="button" aria-label={`${label(v)} omlaag`} disabled={i === volgorde.length - 1} onClick={() => verplaats(i, i + 1)} style={knop}>↓</button>
              <button type="button" aria-label={`${label(v)} weghalen`} onClick={() => onChange(volgorde.filter((x) => x !== v))} style={{ ...knop, color: "#b91c1c" }}>×</button>
            </li>
          ))}
        </ol>
        {volgorde.length === 0 && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>Klik links op wat het belangrijkst is.</p>}
      </div>
    </div>
  );
}
