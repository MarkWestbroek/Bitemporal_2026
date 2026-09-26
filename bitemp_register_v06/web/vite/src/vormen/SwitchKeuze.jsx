/**
 * SwitchKeuze — de vorm `switch` voor ja/nee: een schuifschakelaar zoals op de modules van
 * MusicBrain (donkere sleuf, metalen knop). ARIA: role="switch" + aria-checked; spatie/Enter
 * schakelt (native <button>).
 *
 * Waarde als in de rest van de formulieren: "true" | "false" | "" (leeg = nog niet gekozen).
 * Props: waarde, onChange, readOnly, labelId, config { onLabel, offLabel, accentColor }
 */
export default function SwitchKeuze({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  const aan = String(waarde) === "true";
  const leeg = waarde === "" || waarde == null;
  const accent = config.accentColor || "#22c55e";
  const breed = 58, hoog = 30, knop = 24;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        role="switch"
        aria-checked={aan}
        aria-labelledby={labelId}
        disabled={readOnly}
        onClick={() => onChange(aan ? "false" : "true")}
        style={{
          position: "relative", width: breed, height: hoog, borderRadius: hoog / 2, border: "1px solid #0f172a",
          padding: 0, cursor: readOnly ? "default" : "pointer",
          background: aan ? `linear-gradient(180deg, ${accent}, ${accent}cc)` : "linear-gradient(180deg, #1e293b, #334155)",
          boxShadow: "inset 0 2px 5px rgba(0,0,0,0.55)", opacity: leeg ? 0.75 : 1, transition: "background 160ms",
        }}
      >
        <span aria-hidden="true" style={{
          position: "absolute", top: (hoog - knop) / 2 - 1, left: aan ? breed - knop - 4 : 3, width: knop, height: knop, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1 55%, #94a3b8)",
          boxShadow: "0 2px 3px rgba(0,0,0,0.5)", transition: "left 160ms",
        }} />
      </button>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: leeg ? "var(--cg-donkergrijs, #64748b)" : "inherit" }}>
        {leeg ? "—" : aan ? config.onLabel || "Ja" : config.offLabel || "Nee"}
      </span>
    </div>
  );
}
