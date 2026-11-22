/**
 * weergaveEditors — de editor voor het gegevenstype *svg* (profiel Weergave, plan 2026-11-21
 * Sidecar-project §3). De inhoud is het gegevenstype, dit is de vorm: een tekstvak met een
 * voorbeeld ernaast.
 *
 * Het voorbeeld toont de **geschoonde** SVG (`diagramcore/shapes/svgSchoon.js`): alleen wat de
 * tekenaar ook tekent, zonder scripts, gebeurtenissen of verwijzingen naar buiten. Wat er is
 * weggelaten staat eronder. De tekst zelf bewaren we zoals hij is getypt; geschoond wordt bij
 * elke lezing.
 */
import { useMemo } from "react";
import { getPropertyTypeEditor, registreerPropertyTypeEditor } from "../../diagramcore/inspector/propertyTypeEditors.jsx";
import { schoonSvg } from "../../diagramcore/shapes/svgSchoon.js";
import { SVG_DATATYPE } from "../../diagramprofielen/weergave/index.js";

const STIJL = { flex: 1, minWidth: 0, font: "inherit", fontFamily: "var(--s-mono, monospace)", fontSize: 11, padding: "3px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)", resize: "vertical" };

function SvgEditor({ regel, waarde, onChange }) {
  const tekst = typeof waarde === "string" ? waarde : "";
  const { svg, weg } = useMemo(() => schoonSvg(tekst), [tekst]);
  return (
    <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }} data-testid={`svg-editor-${regel.key}`}>
      <span style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <textarea
          rows={Math.min(10, Math.max(3, tekst.split("\n").length))}
          spellCheck={false}
          style={STIJL}
          value={tekst}
          placeholder='<svg viewBox="0 0 24 24">…</svg>'
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
        {tekst && (
          <span
            data-testid={`svg-voorbeeld-${regel.key}`}
            title="Voorbeeld (geschoond)"
            style={{ width: 48, height: 48, flex: "0 0 48px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, color: "var(--s-fg, #1e293b)" }}
            // Veilig: alleen de geschoonde VormBoom-elementen, zonder scripts, style of on…-attributen.
            dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.2" ') }}
          />
        )}
      </span>
      {weg.length > 0 && <span style={{ color: "#b45309", fontSize: 11 }}>Niet getekend: {weg.join(", ")}.</span>}
    </span>
  );
}

/** Idempotent (HMR). */
export function registreerWeergaveEditors() {
  if (!getPropertyTypeEditor(SVG_DATATYPE)) registreerPropertyTypeEditor(SVG_DATATYPE, SvgEditor);
}
