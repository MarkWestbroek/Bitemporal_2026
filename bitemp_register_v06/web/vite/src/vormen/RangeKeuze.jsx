import { maakSchaal, stapKleur } from "./schaal";

/**
 * RangeKeuze — de vorm `range`: een schuif over een schaal. Bedient een getal (min/max/step)
 * of één uit een GEORDENDE lijst (bv. Schaal 1–4). Gebouwd op de native <input type="range">,
 * dus toetsenbord en schermlezers werken zonder extra code; de kleurbalk en de stapnamen
 * eronder zijn opmaak. Leeg is een geldige toestand (nog niet gekozen): de knop is dan
 * vaag en de eerste aanraking zet een waarde.
 *
 * Props: items (geordend, voor een lijst), waarde, onChange, readOnly, labelId,
 *        config { min, max, step, labels, colors, showValue }
 */
export default function RangeKeuze({ items, waarde, onChange, readOnly = false, labelId, config = {} }) {
  const s = maakSchaal({ items, config });
  const idx = s.naarIndex(waarde);
  const leeg = idx < 0;
  const kleuren = Array.from({ length: s.n }, (_, i) => stapKleur(config.colors, i, s.n));
  const heeftKleur = kleuren.some(Boolean);
  const verloop = heeftKleur ? `linear-gradient(90deg, ${kleuren.map((k, i) => `${k} ${(i / Math.max(1, s.n - 1)) * 100}%`).join(", ")})` : "var(--cg-lichtgrijs, #e2e8f0)";
  const toonTicks = s.n <= 12;
  const huidigeKleur = !leeg && kleuren[idx];
  const pct = (i) => (s.n <= 1 ? 0 : (i / (s.n - 1)) * 100);

  // Weergave: geen uitgeschakelde schuif, maar een rustige balk met een markering.
  if (readOnly) {
    return (
      <div role="img" aria-label={leeg ? "niet ingevuld" : `${s.label(idx)} (${idx + 1} van ${s.n})`} style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 420 }}>
        <div style={{ position: "relative", flex: 1, height: 16 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 5, height: 6, borderRadius: 3, background: verloop, opacity: 0.45 }} />
          {!leeg && <div style={{ position: "absolute", left: 0, width: `${pct(idx)}%`, top: 5, height: 6, borderRadius: 3, background: huidigeKleur || "#1d4ed8" }} />}
          {!leeg && <div style={{ position: "absolute", left: `calc(${pct(idx)}% - 8px)`, top: 0, width: 16, height: 16, borderRadius: "50%", background: huidigeKleur || "#1d4ed8", border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />}
        </div>
        <span style={{ minWidth: 60, fontWeight: 700, fontSize: "0.9rem" }}>{leeg ? "—" : s.label(idx)}</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, height: 36 }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 9, right: 9, top: 14, height: 8, borderRadius: 4, background: verloop, opacity: leeg ? 0.5 : 1 }} />
          <input
            type="range"
            aria-labelledby={labelId}
            aria-valuetext={leeg ? "niet gekozen" : s.label(idx)}
            min={s.soort === "lijst" ? 0 : s.min}
            max={s.soort === "lijst" ? s.max : s.max}
            step={s.soort === "lijst" ? 1 : s.step}
            value={leeg ? (s.soort === "lijst" ? 0 : s.min) : s.soort === "lijst" ? idx : Number(waarde)}
            disabled={readOnly}
            onChange={(e) => onChange(s.soort === "lijst" ? s.naarWaarde(Number(e.target.value)) : s.naarWaarde((Number(e.target.value) - s.min) / s.step))}
            // Leeg + klik op de huidige plek geeft geen change-event: zet dan expliciet de waarde.
            onPointerUp={(e) => { if (leeg && !readOnly) onChange(s.soort === "lijst" ? s.naarWaarde(Number(e.currentTarget.value)) : String(e.currentTarget.value)); }}
            style={{ position: "absolute", inset: 0, width: "100%", margin: 0, background: "transparent", opacity: leeg ? 0.55 : 1, accentColor: huidigeKleur || "#1d4ed8", cursor: readOnly ? "default" : "pointer" }}
          />
        </div>
        {config.showValue !== false && (
          <span style={{ minWidth: 72, fontWeight: 700, fontSize: "0.95rem", padding: "0.15rem 0.5rem", borderRadius: 6, textAlign: "center",
            background: huidigeKleur || "var(--cg-lichtgrijs, #e2e8f0)", color: "#0f172a" }}>
            {leeg ? "—" : s.label(idx)}
          </span>
        )}
      </div>
      {toonTicks && (
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", padding: "0 2px", fontSize: "0.75rem", color: "var(--cg-donkergrijs, #64748b)" }}>
          {Array.from({ length: s.n }, (_, i) => (
            <span key={i} style={{ width: 0, display: "flex", justifyContent: i === 0 ? "flex-start" : i === s.n - 1 ? "flex-end" : "center", whiteSpace: "nowrap", fontWeight: i === idx ? 700 : 400, color: i === idx ? "#0f172a" : undefined }}>{s.label(i)}</span>
          ))}
        </div>
      )}
      {!leeg && !readOnly && (
        <button type="button" onClick={() => onChange("")} style={{ border: "none", background: "none", padding: 0, marginTop: 4, cursor: "pointer", color: "var(--cg-donkergrijs, #64748b)", fontSize: "0.75rem" }}>
          wissen
        </button>
      )}
    </div>
  );
}
