import { stapKleur } from "./schaal";

/**
 * ScaleBarsWeergave — de weergavevorm `scale-bars`: per rij een balk op de schaal met de
 * toelichting eronder (bv. de bijdragen: Wendbaarheid 3 van 4 — "…"). Zelfde data als de
 * matrix; dit is de weergavekant ervan, niet de matrix in alleen-lezen.
 *
 * Props: rows [{ value, label, description }], columns [{ value, label, color }],
 *        waarden { [rij]: kolom }, notities { [rij]: tekst }, config {}
 */
export default function ScaleBarsWeergave({ rows = [], columns = [], waarden = {}, notities = {} }) {
  const n = columns.length;
  const kleuren = columns.map((c, i) => c.color || stapKleur(["#bfdbfe", "#1d4ed8"], i, n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => {
        const idx = columns.findIndex((c) => c.value === waarden[r.value]);
        return (
          <div key={r.value}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong>{r.label}</strong>
              <span style={{ fontSize: "0.85rem", color: "var(--cg-donkergrijs, #475569)" }}>
                {idx >= 0 ? `${idx + 1} van ${n}${columns[idx].label && columns[idx].label !== String(idx + 1) ? ` · ${columns[idx].label.replace(/^\d+\s*·\s*/, "")}` : ""}` : "niet ingevuld"}
              </span>
            </div>
            <div role="img" aria-label={`${r.label}: ${idx >= 0 ? `${idx + 1} van ${n}` : "niet ingevuld"}`}
              style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 3, marginTop: 4 }}>
              {columns.map((c, i) => (
                <span key={c.value} style={{ height: 10, borderRadius: 3, background: i <= idx ? kleuren[i] : "var(--cg-lichtgrijs, #e2e8f0)" }} />
              ))}
            </div>
            {notities[r.value] && <div style={{ marginTop: 4, fontSize: "0.9rem", color: "var(--cg-donkergrijs, #334155)" }}>{notities[r.value]}</div>}
          </div>
        );
      })}
    </div>
  );
}
