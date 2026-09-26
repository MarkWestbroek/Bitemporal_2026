import { useId, useState } from "react";

/**
 * MatrixKeuze — de vorm `rating-grid`: rijen × kolommen, per rij één keuze (matrix / likert).
 * Assen en datalogica in matrix.js; dit component tekent alleen.
 *
 * Toegankelijk als een echte tabel: kolomkoppen (th scope=col), rijkoppen (th scope=row) en
 * per rij native radioknoppen met dezelfde `name`. Schermlezers noemen zo rij én kolom, en de
 * pijltjestoetsen lopen binnen een rij zoals bij elke radiogroep.
 *
 * Props:
 *  - rows:        [{ value, label, description? }]
 *  - columns:     [{ value, label, color? }]
 *  - waarden:     { [rijwaarde]: kolomwaarde }
 *  - onChange:    (rijwaarde, kolomwaarde | "") => void   — "" = wissen
 *  - hoekLabel:   kop boven de rijkoppen (bv. "Bijdrage"); kolomLabel: kop boven de kolommen (bv. "Schaal")
 *  - required:    geen wisknop; `toonFouten` markeert rijen zonder keuze
 *  - renderExtra: (rijwaarde) => ReactNode | null — extra velden per rij (uitklapbaar)
 *  - extraLabel:  tekst van de uitklapknop (bv. "Toelichting"); heeftExtra: (rijwaarde) => boolean (open bij waarde)
 *  - extraInklapbaar: false = extra velden altijd open en géén uitklapknop (bv. een verplichte
 *                 toelichting: dan zou de knop alleen het label herhalen)
 *  - readOnly, labelId
 */
export default function MatrixKeuze({
  rows, columns, waarden = {}, onChange, hoekLabel = "", kolomLabel = "", required = false, toonFouten = false,
  renderExtra = null, extraLabel = "Toelichting", heeftExtra = () => false, extraInklapbaar = true, readOnly = false, labelId,
}) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState({});
  const accent = "var(--cg-blauw, #2563eb)";
  const kolommenMetKleur = columns.some((c) => c.color);
  const aantalKolommen = columns.length + 1 + (required || readOnly ? 0 : 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <table aria-labelledby={labelId} style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 120 + columns.length * 90, fontSize: "0.9rem", tableLayout: "fixed" }}>
        {/* Rijkoppen 40%, de schaal gelijk verdeeld: een schaal moet er ook gelijkmatig uitzien. */}
        <colgroup>
          <col style={{ width: "40%" }} />
          {columns.map((c) => <col key={c.value} />)}
          {!required && !readOnly && <col style={{ width: 32 }} />}
        </colgroup>
        <thead>
          {kolomLabel && (
            <tr>
              <td />
              <th colSpan={columns.length} scope="colgroup" style={{ fontWeight: 600, textAlign: "center", padding: "0 0 0.25rem", color: "var(--cg-donkergrijs, #475569)" }}>{kolomLabel}</th>
            </tr>
          )}
          <tr>
            <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontWeight: 600 }}>{hoekLabel}</th>
            {columns.map((c) => (
              <th key={c.value} scope="col" style={{ padding: "0.4rem 0.25rem", fontWeight: 600, textAlign: "center", borderBottom: c.color ? `4px solid ${c.color}` : "1px solid var(--cg-rand, #e2e8f0)" }}>
                {c.label}
              </th>
            ))}
            {!required && !readOnly && <td />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const gekozen = waarden[r.value] ?? "";
            const ontbreekt = required && toonFouten && !gekozen;
            const rijKopId = `${id}-rij-${ri}`;
            const extra = renderExtra ? renderExtra(r.value) : null;
            const isOpen = !extraInklapbaar || (open[r.value] ?? heeftExtra(r.value));
            const zebra = ri % 2 === 0 ? "var(--cg-lichtgrijs-zacht, #f8fafc)" : "transparent";
            return [
              <tr key={r.value} style={{ background: zebra }}>
                <th id={rijKopId} scope="row" style={{ textAlign: "left", padding: "0.5rem", fontWeight: 500, borderLeft: ontbreekt ? "3px solid var(--cg-fout, #dc2626)" : "3px solid transparent" }}>
                  <div>{r.label}</div>
                  {r.description && <div style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--cg-donkergrijs, #64748b)" }}>{r.description}</div>}
                  {ontbreekt && <div role="alert" style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--cg-fout, #dc2626)" }}>Kies een waarde</div>}
                  {extra && extraInklapbaar && (
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [r.value]: !isOpen }))} aria-expanded={isOpen} aria-controls={`${id}-extra-${ri}`}
                      style={{ border: "none", background: "none", padding: 0, marginTop: 2, cursor: "pointer", color: accent, fontSize: "0.8rem" }}>
                      {isOpen ? "▾" : "▸"} {extraLabel}
                    </button>
                  )}
                </th>
                {columns.map((c) => {
                  const aan = gekozen === c.value;
                  return (
                    <td key={c.value} style={{ textAlign: "center", padding: 0 }}>
                      <label style={{
                        position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 40, margin: 2, borderRadius: 6,
                        cursor: readOnly ? "default" : "pointer",
                        background: aan ? (c.color || "var(--cg-lichtblauw, #dbeafe)") : kolommenMetKleur && c.color ? `color-mix(in srgb, ${c.color} 18%, transparent)` : "transparent",
                        outline: aan ? `2px solid ${accent}` : "none",
                      }}>
                        <input type="radio" name={`${id}-r${ri}`} value={c.value} checked={aan} disabled={readOnly}
                          onChange={() => onChange(r.value, c.value)} aria-invalid={ontbreekt || undefined}
                          style={{ width: 18, height: 18, accentColor: "#1d4ed8", cursor: "inherit" }} />
                        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{c.label}</span>
                      </label>
                    </td>
                  );
                })}
                {!required && !readOnly && (
                  <td style={{ width: 28, textAlign: "center" }}>
                    {gekozen && (
                      <button type="button" onClick={() => onChange(r.value, "")} aria-label={`Wis keuze voor ${r.label}`} title="Wis keuze"
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--cg-fout, #dc2626)" }}>✕</button>
                    )}
                  </td>
                )}
              </tr>,
              extra && isOpen && (
                <tr key={`${r.value}-extra`} id={`${id}-extra-${ri}`} style={{ background: zebra }}>
                  <td colSpan={aantalKolommen} aria-labelledby={rijKopId} style={{ padding: "0 0.5rem 0.5rem 1.25rem" }}>{extra}</td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
