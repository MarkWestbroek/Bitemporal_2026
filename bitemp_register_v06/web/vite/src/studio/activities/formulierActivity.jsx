/**
 * formulierActivity — visuele FormulierDefinitie-editor als Studio-activiteit.
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker — velden uit het canoniek model kiezen (padadressering)
 *   Main      → FormulierCanvas — structuur-boom + live preview
 *   Inspector → FormulierInspector — eigenschappen van het geselecteerde element
 *
 * Zie docs/plans/2026-07-16 Formulier-editor Studio-activiteit (plan).md (F41).
 */
import React, { useCallback, useEffect, useState } from "react";
import { ModelPicker } from "../../modelpicker";
import { IconFormulier } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadJson } from "../studioUtils";
import { SchemaProvider } from "../../context/SchemaContext";
import { useFormulierEditorStore } from "../../formuliereditor/useFormulierEditorStore";
import { serializeLayout } from "../../formuliereditor/layoutModel";
import FormulierCanvas from "../../formuliereditor/FormulierCanvas";
import FormulierInspector from "../../formuliereditor/FormulierInspector";
import FormulierIndex from "../../formuliereditor/FormulierIndex";

function FormulierProvider({ children }) {
  // Menubalk-acties via de menuBus (de store is een module-singleton).
  useEffect(() => {
    const af = [
      menuBus.on("formulier:nieuw", () => useFormulierEditorStore.getState().reset()),
      menuBus.on("formulier:opslaan", () => useFormulierEditorStore.getState().saveNaarRegister(apiBase())),
      menuBus.on("formulier:export", () => {
        const st = useFormulierEditorStore.getState();
        const naam = (st.meta.naam || "formulierdefinitie").replace(/\s+/g, "_");
        downloadJson(serializeLayout(st.root), `${naam}.layout.json`);
      }),
      menuBus.on("formulier:kopieer", async () => {
        const st = useFormulierEditorStore.getState();
        try { await navigator.clipboard.writeText(st.json(true)); } catch { /* clipboard geweigerd */ }
      }),
      menuBus.on("formulier:importeer", () => {
        const tekst = window.prompt("Plak een layout-JSON:");
        if (tekst == null) return;
        const { fout } = useFormulierEditorStore.getState().laadLayout(tekst);
        if (fout) window.alert(fout);
      }),
    ];
    return () => af.forEach((off) => off());
  }, []);
  // SchemaProvider levert datatype-/typemetadata die SchemaFormField (in de
  // live-preview) nodig heeft; zonder deze context crasht de preview.
  return <SchemaProvider baseUrl={apiBase()}>{children}</SchemaProvider>;
}

function FormulierSidebar() {
  const voegVeldToe = useFormulierEditorStore((s) => s.voegVeldToe);
  const onPick = useCallback((ref) => voegVeldToe(ref), [voegVeldToe]);
  const [tab, setTab] = useState("formulieren"); // "formulieren" | "velden"

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: "6px 4px", fontSize: 12, cursor: "pointer", border: "none",
        borderBottom: "2px solid " + (tab === id ? "var(--s-accent, #6366f1)" : "transparent"),
        background: "transparent", color: tab === id ? "var(--s-fg, inherit)" : "var(--s-fg-muted, #94a3b8)",
        fontWeight: tab === id ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--s-border, #e2e8f0)" }}>
        {tabBtn("formulieren", "Formulieren")}
        {tabBtn("velden", "Velden")}
      </div>
      {tab === "formulieren" ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <FormulierIndex />
        </div>
      ) : (
        <>
          <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
            Kies (dubbelklik / +) een veld om het aan het formulier toe te voegen. Het komt in de
            geselecteerde groep terecht.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
          </div>
        </>
      )}
    </div>
  );
}

export default {
  id: "formulieren",
  label: "Formulieren",
  icon: <IconFormulier />,
  groep: "presentatie",
  Provider: FormulierProvider,
  Sidebar: FormulierSidebar,
  Main: FormulierCanvas,
  Inspector: FormulierInspector,
  sidebarLabel: "Canoniek model",
  inspectorLabel: "Eigenschappen",
  status: "preview",
  menus: [
    {
      id: "formulier",
      label: "Formulier",
      items: [
        { id: "formulier-nieuw", label: "Nieuw formulier", onClick: () => menuBus.emit("formulier:nieuw") },
        { id: "formulier-opslaan", label: "Opslaan naar register…", onClick: () => menuBus.emit("formulier:opslaan") },
        { type: "separator" },
        { id: "formulier-importeer", label: "Importeer layout-JSON…", onClick: () => menuBus.emit("formulier:importeer") },
        { id: "formulier-kopieer", label: "Kopieer layout-JSON", onClick: () => menuBus.emit("formulier:kopieer") },
        { id: "formulier-export", label: "Exporteer als JSON…", onClick: () => menuBus.emit("formulier:export") },
      ],
    },
  ],
};
