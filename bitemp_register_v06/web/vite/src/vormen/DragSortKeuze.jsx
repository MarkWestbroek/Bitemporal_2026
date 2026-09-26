import { useState } from "react";

/**
 * DragSortKeuze — de vorm `drag-sort`: dingen uit een voorraad naar manden slepen (kaartsorteren).
 * Zelfde inhoud en data als de matrix (rating-grid): per rij (ding) één keuze uit de kolommen
 * (manden); assen en rijen via matrix.js. Alleen de vorm verschilt.
 *
 * Bediening:
 *  - slepen (HTML5 drag & drop) van een kaart naar een mand of terug naar de voorraad;
 *  - zonder muis: klik/Enter op een kaart (die wordt "opgepakt"), dan op een mand;
 *    Escape laat los. Zo is het ook met toetsenbord en op touch te doen.
 *
 * Props: rows [{ value, label }], columns [{ value, label, color, description }],
 *        waarden { [rij]: kolom }, onChange(rij, kolom | ""), readOnly, labelId, config { stockLabel }
 */
export default function DragSortKeuze({ rows = [], columns = [], waarden = {}, onChange, readOnly = false, labelId, config = {} }) {
  const [opgepakt, setOpgepakt] = useState(null);
  const [boven, setBoven] = useState(null);
  const inMand = (kol) => rows.filter((r) => waarden[r.value] === kol);
  const voorraad = rows.filter((r) => !waarden[r.value] || !columns.some((c) => c.value === waarden[r.value]));

  const plaats = (rij, kol) => { if (!readOnly && rij != null) onChange(rij, kol); setOpgepakt(null); setBoven(null); };

  const kaart = (r) => {
    const actief = opgepakt === r.value;
    return (
      <button key={r.value} type="button" draggable={!readOnly} disabled={readOnly}
        aria-pressed={actief} aria-label={`${r.label}${waarden[r.value] ? `, in ${columns.find((c) => c.value === waarden[r.value])?.label || waarden[r.value]}` : ""}`}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.value); e.dataTransfer.effectAllowed = "move"; setOpgepakt(r.value); }}
        onDragEnd={() => { setOpgepakt(null); setBoven(null); }}
        onClick={() => setOpgepakt(actief ? null : r.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpgepakt(null); }}
        style={{
          padding: "0.35rem 0.7rem", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600, cursor: readOnly ? "default" : "grab",
          background: actief ? "#1d4ed8" : "#ffffff", color: actief ? "#ffffff" : "#0f172a",
          border: `1px solid ${actief ? "#1e40af" : "var(--cg-rand, #cbd5e1)"}`, boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
        }}>
        {r.label}
      </button>
    );
  };

  const vak = (kol, titel, leden, stijl = {}) => {
    const isBoven = boven === (kol ?? "__voorraad");
    return (
      <div role="group" aria-label={titel}
        onDragOver={(e) => { if (!readOnly) { e.preventDefault(); setBoven(kol ?? "__voorraad"); } }}
        onDragLeave={() => setBoven(null)}
        onDrop={(e) => { e.preventDefault(); plaats(e.dataTransfer.getData("text/plain"), kol ?? ""); }}
        onClick={(e) => { if (opgepakt && e.target === e.currentTarget) plaats(opgepakt, kol ?? ""); }}
        style={{ minHeight: 76, padding: 10, borderRadius: 12, display: "flex", flexDirection: "column", gap: 6,
          border: `2px ${opgepakt ? "dashed" : "solid"} ${isBoven ? "#2563eb" : "var(--cg-rand, #e2e8f0)"}`,
          background: isBoven ? "#eff6ff" : stijl.background || "#f8fafc", ...stijl }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", pointerEvents: "none" }}>
          <strong style={{ fontSize: "0.85rem" }}>{titel}</strong>
          <span style={{ fontSize: "0.75rem", color: "var(--cg-donkergrijs, #64748b)" }}>{leden.length}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          onClick={(e) => { if (opgepakt && e.target === e.currentTarget) plaats(opgepakt, kol ?? ""); }}>
          {leden.map(kaart)}
          {opgepakt && !leden.some((l) => l.value === opgepakt) && !readOnly && (
            <button type="button" onClick={() => plaats(opgepakt, kol ?? "")}
              style={{ padding: "0.35rem 0.7rem", borderRadius: 10, border: "1px dashed #2563eb", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.8rem", cursor: "pointer" }}>
              hierheen
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div aria-labelledby={labelId} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!readOnly && vak(null, config.stockLabel || "Nog te sorteren", voorraad, { background: "#ffffff" })}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(140, 520 / Math.max(1, columns.length))}px, 1fr))`, gap: 10 }}>
        {columns.map((c) => (
          <div key={c.value} style={{ borderTop: c.color ? `4px solid ${c.color}` : undefined, borderRadius: 12 }}>
            {vak(c.value, c.label, inMand(c.value))}
          </div>
        ))}
      </div>
      {opgepakt && <div aria-live="polite" style={{ fontSize: "0.8rem", color: "#1d4ed8" }}>Opgepakt: {rows.find((r) => r.value === opgepakt)?.label}. Kies een mand (Escape = loslaten).</div>}
    </div>
  );
}
