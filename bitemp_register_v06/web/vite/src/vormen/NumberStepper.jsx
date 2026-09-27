/**
 * NumberStepper — de vorm `number-stepper`: een getal met − en + knoppen (aantal personen,
 * aantal gemeenten). Typen mag ook. Blijft binnen min en max; de knoppen gaan uit aan de rand.
 * (Niet te verwarren met `stepper`, de stappenbalk van een geordende lijst.)
 *
 * Props: waarde, onChange, readOnly, labelId, config { min, max, step, unit }
 */
export default function NumberStepper({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  const step = Number(config.step) > 0 ? Number(config.step) : 1;
  const min = config.min != null ? Number(config.min) : -Infinity;
  const max = config.max != null ? Number(config.max) : Infinity;
  const leeg = waarde === "" || waarde == null;
  const n = leeg ? null : Number(waarde);
  const eenheid = config.unit ? ` ${config.unit}` : "";
  if (readOnly) return <span style={{ fontVariantNumeric: "tabular-nums" }}>{leeg ? "—" : `${waarde}${eenheid}`}</span>;

  const decimalen = (String(step).split(".")[1] || "").length;
  const binnen = (x) => Math.min(max, Math.max(min, Number(x.toFixed(decimalen))));
  const start = Number.isFinite(min) ? min : 0;
  const knop = (teken, label, naar, uit) => (
    <button type="button" aria-label={label} disabled={uit} onClick={() => onChange(String(naar))}
      style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #cbd5e1", background: uit ? "#f1f5f9" : "#fff",
        color: uit ? "#94a3b8" : "#0f172a", fontSize: "1.1rem", fontWeight: 700, cursor: uit ? "default" : "pointer", lineHeight: 1 }}>
      {teken}
    </button>
  );
  return (
    <div role="group" aria-labelledby={labelId} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {knop("−", "minder", leeg ? start : binnen(n - step), !leeg && n <= min)}
      <input type="number" className="utrecht-textbox utrecht-textbox--html-input" aria-labelledby={labelId}
        value={leeg ? "" : waarde} step={step} min={Number.isFinite(min) ? min : undefined} max={Number.isFinite(max) ? max : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => { if (e.target.value !== "") onChange(String(binnen(Number(e.target.value)))); }}
        style={{ width: "8ch", textAlign: "center", fontVariantNumeric: "tabular-nums" }} />
      {knop("+", "meer", leeg ? start : binnen(n + step), !leeg && n >= max)}
      {config.unit && <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>{config.unit}</span>}
    </div>
  );
}
