/**
 * FormulierCanvas — Main-slot van de Formulieren-activiteit.
 *
 * Links de structuur-boom (bewerkbaar: selecteren, schuiven, verwijderen,
 * containers toevoegen), rechts de live-preview via CustomFormulierRenderer.
 */
import React, { useMemo, useState } from "react";
import { useFormulierEditorStore } from "./useFormulierEditorStore";
import { kinderen, elementLabel, isContainer } from "./layoutModel";
import { bouwPreviewVelden, previewLayout } from "./preview";
import CustomFormulierRenderer from "../components/editor/CustomFormulierRenderer";

const TYPE_KLEUR = {
  formulier: "#64748b",
  groep: "#6366f1",
  rij: "#0ea5e9",
  veld: "#16a34a",
  conditioneel: "#d97706",
};

function BoomRij({ el, diepte }) {
  const selectieId = useFormulierEditorStore((s) => s.selectieId);
  const selecteer = useFormulierEditorStore((s) => s.selecteer);
  const schuif = useFormulierEditorStore((s) => s.schuif);
  const verwijderElement = useFormulierEditorStore((s) => s.verwijderElement);
  const isRoot = el.type === "formulier";
  const geselecteerd = selectieId === el._id;
  const kids = kinderen(el);

  return (
    <div>
      <div
        onClick={(e) => { e.stopPropagation(); selecteer(el._id); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 6px", marginLeft: diepte * 14,
          borderRadius: 5, cursor: "pointer",
          background: geselecteerd ? "var(--s-accent-bg, #e0e7ff)" : "transparent",
          borderLeft: `3px solid ${TYPE_KLEUR[el.type] || "#94a3b8"}`,
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {elementLabel(el)}
        </span>
        {!isRoot && (
          <span style={{ display: "flex", gap: 2, opacity: geselecteerd ? 1 : 0.35 }}>
            <button type="button" title="Omhoog" onClick={(e) => { e.stopPropagation(); schuif(el._id, -1); }} style={miniBtn}>↑</button>
            <button type="button" title="Omlaag" onClick={(e) => { e.stopPropagation(); schuif(el._id, +1); }} style={miniBtn}>↓</button>
            <button type="button" title="Verwijderen" onClick={(e) => { e.stopPropagation(); verwijderElement(el._id); }} style={{ ...miniBtn, color: "#dc2626" }}>✕</button>
          </span>
        )}
      </div>
      {kids.map((kind) => <BoomRij key={kind._id} el={kind} diepte={diepte + 1} />)}
      {isContainer(el) && kids.length === 0 && !isRoot && (
        <div style={{ marginLeft: (diepte + 1) * 14, padding: "2px 6px", fontSize: 11, color: "var(--s-fg-muted, #94a3b8)", fontStyle: "italic" }}>
          leeg — sleep/kies een veld of voeg een container toe
        </div>
      )}
    </div>
  );
}

const miniBtn = {
  border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-bg, #fff)",
  color: "var(--s-fg, #1e293b)",
  borderRadius: 4, width: 20, height: 20, lineHeight: "16px", padding: 0,
  cursor: "pointer", fontSize: 12,
};
const werkBtn = {
  border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-bg, #fff)",
  color: "var(--s-fg, #1e293b)",
  borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 12.5,
};

export default function FormulierCanvas() {
  const root = useFormulierEditorStore((s) => s.root);
  const veldInfo = useFormulierEditorStore((s) => s.veldInfo);
  const meta = useFormulierEditorStore((s) => s.meta);
  const voegContainerToe = useFormulierEditorStore((s) => s.voegContainerToe);
  const undo = useFormulierEditorStore((s) => s.undo);
  const redo = useFormulierEditorStore((s) => s.redo);
  const meldingen = useFormulierEditorStore((s) => s.meldingen);

  const [previewWaarden, setPreviewWaarden] = useState({});
  const previewVelden = useMemo(() => bouwPreviewVelden(veldInfo), [veldInfo]);
  const previewRoot = useMemo(() => previewLayout(root, veldInfo), [root, veldInfo]);
  const waarschuwingen = meldingen();

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Structuur */}
      <div style={{ flex: "0 0 42%", minWidth: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--s-border, #e2e8f0)" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 10, borderBottom: "1px solid var(--s-border, #e2e8f0)" }}>
          <button type="button" style={werkBtn} onClick={() => voegContainerToe("groep")}>+ Groep</button>
          <button type="button" style={werkBtn} onClick={() => voegContainerToe("rij")}>+ Rij</button>
          <button type="button" style={werkBtn} onClick={() => voegContainerToe("conditioneel")}>+ Conditioneel</button>
          <span style={{ flex: 1 }} />
          <button type="button" style={werkBtn} onClick={undo} title="Ongedaan maken">↶</button>
          <button type="button" style={werkBtn} onClick={redo} title="Opnieuw">↷</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 10 }} onClick={() => useFormulierEditorStore.getState().selecteer(null)}>
          <BoomRij el={root} diepte={0} />
        </div>
        {waarschuwingen.length > 0 && (
          <div style={{ borderTop: "1px solid var(--s-border, #e2e8f0)", padding: "6px 10px", fontSize: 11.5, maxHeight: 120, overflow: "auto" }}>
            {waarschuwingen.map((m, i) => (
              <div key={i} style={{ color: m.niveau === "fout" ? "#dc2626" : "#b45309" }}>⚠ {m.tekst}</div>
            ))}
          </div>
        )}
      </div>

      {/* Live preview */}
      <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 16, background: "var(--s-bg-subtle, #f8fafc)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--s-fg-muted, #94a3b8)", marginBottom: 8 }}>
          Live preview{meta.naam ? ` · ${meta.naam}` : ""}
        </div>
        {previewVelden.length === 0 ? (
          <div style={{ color: "var(--s-fg-muted, #94a3b8)", fontSize: 13 }}>
            Kies velden uit het canoniek model (links) om het formulier op te bouwen.
          </div>
        ) : (
          <div style={{ background: "var(--s-bg, #fff)", border: "1px solid var(--s-border, #e2e8f0)", borderRadius: 8, padding: 16 }}>
            <CustomFormulierRenderer
              layout={root}
              velden={previewVelden}
              values={previewWaarden}
              onChange={(veld, waarde) => setPreviewWaarden((p) => ({ ...p, [veld]: waarde }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
