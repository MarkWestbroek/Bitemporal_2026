/**
 * ColorInvoer — de vorm `color`: een kleur (datatype Kleur: #RGB, #RRGGBB of #RRGGBBAA).
 * Native kleurkiezer plus een hex-veld, en eventueel vaste stalen (config.swatches). Voor
 * een veld met datatype Kleur is dit de vorm vanzelf (weergave.widget = "color").
 *
 * De native kiezer kent alleen #rrggbb: #RGB wordt daarvoor uitgeschreven, een alfakanaal
 * blijft in het hex-veld staan.
 *
 * Props: waarde, onChange, readOnly, labelId, config { swatches }
 */
import { HEX, naarNativeKleur } from "./kleur";

export default function ColorInvoer({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  const tekst = String(waarde ?? "");
  const native = naarNativeKleur(tekst);
  const staal = (kleur, groot = false) => (
    <span aria-hidden="true" style={{ display: "inline-block", width: groot ? 28 : 22, height: groot ? 28 : 22, borderRadius: 6,
      border: "1px solid rgba(15,23,42,0.25)", background: kleur || "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 50% / 10px 10px" }} />
  );
  if (readOnly) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{staal(HEX.test(tekst) ? tekst : null)}<code>{tekst || "—"}</code></span>;
  }
  const stalen = Array.isArray(config.swatches) ? config.swatches.filter((k) => HEX.test(k)) : [];
  return (
    <div role="group" aria-labelledby={labelId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input type="color" aria-label="Kleur kiezen" value={native || "#000000"} onChange={(e) => onChange(e.target.value)}
        style={{ width: 44, height: 34, padding: 2, border: "1px solid #94a3b8", borderRadius: 6, background: "#fff", cursor: "pointer" }} />
      <input type="text" aria-label="Hexcode" className="utrecht-textbox utrecht-textbox--html-input" value={tekst} placeholder="#1a2b3c"
        maxLength={9} spellCheck={false} onChange={(e) => onChange(e.target.value.trim())}
        style={{ width: "11ch", fontFamily: "ui-monospace, monospace" }} />
      {stalen.map((k) => (
        <button key={k} type="button" aria-label={k} aria-pressed={tekst.toLowerCase() === k.toLowerCase()} onClick={() => onChange(k)}
          style={{ padding: 0, border: tekst.toLowerCase() === k.toLowerCase() ? "2px solid #0f172a" : "2px solid transparent", borderRadius: 8, background: "none", cursor: "pointer", lineHeight: 0 }}>
          {staal(k)}
        </button>
      ))}
    </div>
  );
}
