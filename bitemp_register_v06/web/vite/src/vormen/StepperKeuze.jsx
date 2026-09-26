import { useId } from "react";
import { maakSchaal } from "./schaal";

/**
 * StepperKeuze — de vorm `stepper`: de opties van een geordende lijst als stappen op een rij
 * (bv. de fase: Idee → Initiatie → Realisatie → Opschaling → Beheer). De huidige stap is
 * gemarkeerd, de stappen ervoor zijn "gehaald". Invoer: klik op een stap (native radio's,
 * dus pijltjes werken); weergave (readOnly): alleen de balk.
 *
 * Props: items (geordend), waarde, onChange, readOnly, labelId, config { labels, accentColor }
 */
export default function StepperKeuze({ items = [], waarde, onChange, readOnly = false, labelId, config = {} }) {
  const s = maakSchaal({ items, config });
  const idx = s.naarIndex(waarde);
  const accent = config.accentColor || "var(--cg-blauw, #2563eb)";
  const naam = `stepper-${useId().replace(/:/g, "")}`;
  return (
    <div role={readOnly ? "list" : "radiogroup"} aria-labelledby={labelId} style={{ display: "flex", alignItems: "flex-start", width: "100%", overflowX: "auto" }}>
      {items.map((it, i) => {
        const gehaald = idx >= 0 && i < idx;
        const huidig = i === idx;
        const kleur = huidig || gehaald ? accent : "var(--cg-rand, #cbd5e1)";
        const inhoud = (
          <>
            <span aria-hidden="true" style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <span style={{ flex: 1, height: 3, background: i === 0 ? "transparent" : gehaald || huidig ? accent : "var(--cg-rand, #cbd5e1)" }} />
              <span style={{
                width: huidig ? 22 : 16, height: huidig ? 22 : 16, borderRadius: "50%", flex: "none",
                background: huidig ? accent : gehaald ? accent : "#ffffff", border: `3px solid ${kleur}`,
                boxShadow: huidig ? "0 0 0 4px rgba(37,99,235,0.15)" : "none",
              }} />
              <span style={{ flex: 1, height: 3, background: i === items.length - 1 ? "transparent" : gehaald ? accent : "var(--cg-rand, #cbd5e1)" }} />
            </span>
            <span style={{ marginTop: 6, fontSize: "0.8rem", lineHeight: 1.25, textAlign: "center", fontWeight: huidig ? 700 : 400, color: huidig ? "#0f172a" : "var(--cg-donkergrijs, #64748b)", padding: "0 4px" }}>
              {s.label(i)}
            </span>
          </>
        );
        const stijl = { flex: "1 1 0", minWidth: 84, display: "flex", flexDirection: "column", alignItems: "center", cursor: readOnly ? "default" : "pointer" };
        if (readOnly) return <div key={it.value} role="listitem" aria-current={huidig ? "step" : undefined} style={stijl}>{inhoud}</div>;
        return (
          <label key={it.value} style={stijl}>
            <input type="radio" name={naam} value={it.value} checked={huidig} onChange={() => onChange(String(it.value))}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
            {inhoud}
          </label>
        );
      })}
    </div>
  );
}
