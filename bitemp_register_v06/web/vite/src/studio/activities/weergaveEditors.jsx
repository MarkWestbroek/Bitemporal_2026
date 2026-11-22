/**
 * weergaveEditors — de editors van het profiel Weergave (plan 2026-11-21 Sidecar-project §3):
 *
 *   - *svg*: een tekstvak met een voorbeeld ernaast;
 *   - *weergave-koppeling* (stap 3): de regels van een koppeling als tabel, een rij per
 *     elementtype van het profiel: vorm, icoon, kleur en achtergrond; bij een relatie de lijn en de
 *     uiteinden. Vorm en icoon kiezen uit wat in dit project staat (of typ een id uit de code).
 *
 * Het voorbeeld toont de **geschoonde** SVG (`diagramcore/shapes/svgSchoon.js`): alleen wat de
 * tekenaar ook tekent, zonder scripts, gebeurtenissen of verwijzingen naar buiten. Wat er is
 * weggelaten staat eronder. De tekst zelf bewaren we zoals hij is getypt; geschoond wordt bij
 * elke lezing.
 */
import { useMemo, useId } from "react";
import { getPropertyTypeEditor, registreerPropertyTypeEditor } from "../../diagramcore/inspector/propertyTypeEditors.jsx";
import { schoonSvg } from "../../diagramcore/shapes/svgSchoon.js";
import { SVG_DATATYPE, KOPPELING_REGELS_DATATYPE, VORM_TYPE, ICOON_TYPE } from "../../diagramprofielen/weergave/index.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";

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

const CEL = { font: "inherit", fontSize: 11, padding: "1px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 4, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)", minWidth: 0, width: "100%", boxSizing: "border-box" };
const NODE_KOLOMMEN = [
  { key: "shape", label: "vorm", lijst: "vormen" },
  { key: "icoon", label: "icoon", lijst: "iconen" },
  { key: "kleur", label: "kleur" },
];
const LIJN_KOLOMMEN = [
  { key: "lijn", label: "lijn" },
  { key: "markerStart", label: "begin" },
  { key: "markerEnd", label: "eind" },
  { key: "kleur", label: "kleur" },
];

/** Een cel: leeg = de sleutel weg (dan geldt bij een set de standaard). */
function Cel({ waarde, onChange, lijst, testid }) {
  return <input style={CEL} value={waarde ?? ""} list={lijst} data-testid={testid} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />;
}

function KoppelingEditor({ regel, waarde, onChange, element, context }) {
  const id = useId();
  const regels = waarde && typeof waarde === "object" ? waarde : {};
  const descriptor = getDiagramType(element?.data?.profiel);
  const typen = new Map((descriptor?.elementTypes || []).map((et) => [et.id, et]));
  const namen = (type) => [...new Set(Object.values(context?.elements || {}).filter((e) => e.elementType === type).map((e) => e.naam))].sort();
  const zet = (etId, nieuw) => onChange({ ...regels, [etId]: nieuw });
  const zetSleutel = (etId, key, v) => {
    const oud = regels[etId];
    const basis = typeof oud === "string" ? { shape: oud } : { ...(oud || {}) };
    if (v === undefined) delete basis[key];
    else basis[key] = v;
    zet(etId, basis);
  };
  const rijen = Object.keys(regels);
  const lijn = (etId) => typen.get(etId)?.isConnector || (typeof regels[etId] === "object" && regels[etId] && !("shape" in regels[etId]) && ["lijn", "markerStart", "markerEnd"].some((k) => k in regels[etId]));
  return (
    <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }} data-testid={`koppeling-editor-${regel.key}`}>
      <datalist id={`${id}-vormen`}>{namen(VORM_TYPE).map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id={`${id}-iconen`}>{namen(ICOON_TYPE).map((n) => <option key={n} value={n} />)}</datalist>
      {!descriptor && element?.data?.profiel && <span style={{ color: "#b45309", fontSize: 11 }}>Profiel "{element.data.profiel}" is niet bekend in deze tool.</span>}
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11, tableLayout: "fixed" }}>
        <tbody>
          {rijen.map((etId) => {
            const r = regels[etId];
            const kolommen = lijn(etId) ? LIJN_KOLOMMEN : NODE_KOLOMMEN;
            const obj = typeof r === "string" ? { shape: r } : r || {};
            const et = typen.get(etId);
            return (
              <tr key={etId} data-testid={`koppeling-rij-${etId}`}>
                <td title={etId} style={{ width: "28%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: et ? undefined : "#b45309" }}>
                  {et?.label || etId}
                </td>
                {kolommen.map((k) => (
                  <td key={k.key} title={k.label}>
                    <Cel waarde={obj[k.key]} lijst={k.lijst ? `${id}-${k.lijst}` : undefined} testid={`koppeling-${etId}-${k.key}`} onChange={(v) => zetSleutel(etId, k.key, v)} />
                  </td>
                ))}
                {!lijn(etId) && (
                  <td style={{ width: 22, textAlign: "center" }} title="achtergrond (onder de andere elementen)">
                    <input type="checkbox" checked={!!obj.achtergrond} onChange={(e) => zetSleutel(etId, "achtergrond", e.target.checked ? true : undefined)} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <span style={{ fontSize: 10, opacity: 0.7 }}>Kolommen: vorm · icoon · kleur · achtergrond; bij een relatie lijn · begin · eind · kleur. Leeg = de waarde uit het profiel.</span>
    </span>
  );
}

/** Idempotent (HMR). */
export function registreerWeergaveEditors() {
  if (!getPropertyTypeEditor(SVG_DATATYPE)) registreerPropertyTypeEditor(SVG_DATATYPE, SvgEditor);
  if (!getPropertyTypeEditor(KOPPELING_REGELS_DATATYPE)) registreerPropertyTypeEditor(KOPPELING_REGELS_DATATYPE, KoppelingEditor);
}
