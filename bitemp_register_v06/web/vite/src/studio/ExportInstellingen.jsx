/**
 * ExportInstellingen — voorkeuren voor de diagram-afbeeldingsexport
 * (achtergrond, schaal, marge). Zet je hier één keer; het canvas-
 * contextmenu (Exporteren) gebruikt ze. Persistent via useExportInstellingen.
 */
import React from "react";
import { useExportInstellingen } from "./exportInstellingen.js";

const rij = { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13 };
const label = { width: 110, color: "var(--s-fg-muted, #64748b)", flex: "0 0 auto" };
const knop = (actief) => ({
  font: "inherit",
  fontSize: 12,
  padding: "3px 10px",
  borderRadius: 6,
  border: `1px solid ${actief ? "var(--s-accent, #4f46e5)" : "var(--s-border, #cbd5e1)"}`,
  background: actief ? "var(--s-hover)" : "transparent",
  color: "var(--s-fg)",
  fontWeight: actief ? 600 : 400,
  cursor: "pointer",
});

export default function ExportInstellingen() {
  const achtergrond = useExportInstellingen((s) => s.achtergrond);
  const schaal = useExportInstellingen((s) => s.schaal);
  const marge = useExportInstellingen((s) => s.marge);
  const zet = useExportInstellingen((s) => s.zet);

  return (
    <div style={{ maxWidth: 440 }}>
      <div style={rij}>
        <span style={label}>Achtergrond</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["canvas", "Canvas (thema)"],
            ["wit", "Wit"],
            ["transparant", "Transparant"],
          ].map(([id, lbl]) => (
            <button key={id} type="button" style={knop(achtergrond === id)} onClick={() => zet({ achtergrond: id })}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={rij}>
        <span style={label}>Schaal (PNG)</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" style={knop(schaal === n)} onClick={() => zet({ schaal: n })}>
              {n}×
            </button>
          ))}
          <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", alignSelf: "center" }}>hoger = scherper/groter</span>
        </div>
      </div>

      <div style={rij}>
        <span style={label}>Marge</span>
        <input
          type="number"
          min={0}
          max={200}
          value={marge}
          onChange={(e) => zet({ marge: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
          style={{ width: 70, font: "inherit", fontSize: 13, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--s-border, #cbd5e1)", background: "transparent", color: "var(--s-fg)" }}
        />
        <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>px rondom de inhoud</span>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>
        Gebruik: rechtsklik op de canvas → <em>Exporteren</em> → Kopieer / Download PNG / Download SVG.
        SVG is vector (transparant negeert de schaal). Transparant + donker thema geeft lichte tekst —
        kies dan liever <em>Wit</em> of <em>Canvas</em>.
      </p>
    </div>
  );
}
