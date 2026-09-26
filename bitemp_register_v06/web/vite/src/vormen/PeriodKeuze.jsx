import { periodeAs, duurTekst, datumNL } from "./periode";

/**
 * PeriodKeuze — de vorm `period` op een GROEP van twee datumvelden (begin + einde; bv. de
 * startdatum en "ready for use" van een planning, of aanvang en einde). Twee native
 * datumvelden (toegankelijk) met een tijdlijn eronder: de periode als balk, vandaag als streep,
 * de jaren als maatstreepjes. In alleen-lezen alleen de balk en de datums in woorden.
 *
 * Props: begin, einde, onChange({ begin, einde }), readOnly, labelId,
 *        config { startLabel, endLabel, today }
 */
export default function PeriodKeuze({ begin = "", einde = "", onChange, readOnly = false, labelId, config = {} }) {
  const as = periodeAs(begin, einde);
  const kleur = as?.omgekeerd ? "#dc2626" : "#2563eb";
  const invoer = (label, waarde, zet) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.85rem", fontWeight: 600 }}>
      {label}
      <input type="date" className="utrecht-textbox utrecht-textbox--html-input" value={String(waarde || "").slice(0, 10)} onChange={(e) => zet(e.target.value)} style={{ minWidth: 160 }} />
    </label>
  );
  return (
    <div role="group" aria-labelledby={labelId} style={{ maxWidth: 620 }}>
      {!readOnly && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          {invoer(config.startLabel || "Begin", begin, (b) => onChange({ begin: b, einde }))}
          {invoer(config.endLabel || "Einde", einde, (e) => onChange({ begin, einde: e }))}
        </div>
      )}
      {as ? (
        <div>
          <div aria-hidden="true" style={{ position: "relative", height: 34, borderRadius: 8, background: "var(--cg-lichtgrijs-zacht, #f1f5f9)", border: "1px solid var(--cg-rand, #e2e8f0)" }}>
            {as.jaren.map((j) => (
              <span key={j.jaar} style={{ position: "absolute", left: `${j.pos * 100}%`, top: 0, bottom: 0, borderLeft: "1px dashed #cbd5e1" }}>
                <span style={{ position: "absolute", top: -1, left: 3, fontSize: "0.65rem", color: "#94a3b8" }}>{j.jaar}</span>
              </span>
            ))}
            {as.begin != null && (
              <span style={{
                position: "absolute", top: 12, height: 12, borderRadius: 6, background: kleur,
                left: `${Math.min(as.begin, as.einde ?? 1) * 100}%`,
                width: `${Math.abs((as.einde ?? 0.985) - as.begin) * 100}%`,
                ...(as.open ? { background: `linear-gradient(90deg, ${kleur}, ${kleur}00)` } : {}),
              }} />
            )}
            {as.begin == null && as.einde != null && <span style={{ position: "absolute", top: 9, left: `${as.einde * 100}%`, width: 18, height: 18, marginLeft: -9, borderRadius: "50%", background: kleur }} />}
            {config.today !== false && as.vandaag != null && (
              <span title="vandaag" style={{ position: "absolute", left: `${as.vandaag * 100}%`, top: 3, bottom: 3, borderLeft: "2px solid #f59e0b" }} />
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 4, fontSize: "0.85rem" }}>
            <span>{begin ? datumNL(begin) : "begin onbekend"} → {einde ? datumNL(einde) : "open"}</span>
            <span style={{ color: as.omgekeerd ? "#dc2626" : "var(--cg-donkergrijs, #64748b)" }}>{as.omgekeerd ? "einde ligt vóór begin" : duurTekst(begin, einde)}</span>
          </div>
        </div>
      ) : readOnly ? <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>—</span> : null}
    </div>
  );
}
