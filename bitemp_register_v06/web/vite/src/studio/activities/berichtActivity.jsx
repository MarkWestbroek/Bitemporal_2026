/**
 * berichtActivity — berichtdefinities als activiteit (was: BerichtEditorDemoPage).
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker (multi-select) — velden kiezen voor de projectie
 *   Main      → BerichttypeEditor (projectie + export-tabs)
 *   Inspector → samenvatting van gekozen velden
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { ModelPicker } from "../../modelpicker";
import { BerichttypeEditor, nieuwBerichttype, voegVeldToe } from "../../bericht";
import { IconBericht } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadJson } from "../studioUtils";

const Ctx = createContext(null);

function BerichtProvider({ children }) {
  const [bericht, setBericht] = useState(() => nieuwBerichttype("InwonerAanmelding"));

  // Laatste bericht in een ref voor de menu-export.
  const berichtRef = useRef(bericht);
  berichtRef.current = bericht;

  // Menubalk-acties (activiteit-specifiek "Bericht"-menu) via de menuBus.
  useEffect(() => {
    const af = [
      menuBus.on("bericht:nieuw", () => setBericht(nieuwBerichttype("NieuwBerichttype"))),
      menuBus.on("bericht:export", () => {
        const b = berichtRef.current;
        downloadJson(b, `${(b?.naam || "berichttype").replace(/\s+/g, "_")}.json`);
      }),
    ];
    return () => af.forEach((off) => off());
  }, []);

  return <Ctx.Provider value={{ bericht, setBericht }}>{children}</Ctx.Provider>;
}

function BerichtSidebar() {
  const { bericht, setBericht } = useContext(Ctx);
  const onPick = useCallback((ref) => setBericht((b) => voegVeldToe(b, ref)), [setBericht]);
  const geselecteerd = bericht.velden.map((v) => ({ typenaam: v.ref.typenaam, veldnaam: v.ref.veldnaam }));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        Kies of sleep velden om het berichttype samen te stellen.
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ModelPicker baseUrl={apiBase()} onPick={onPick} multiSelect selected={geselecteerd} expandEntiteiten />
      </div>
    </div>
  );
}

function BerichtMain() {
  const { bericht, setBericht } = useContext(Ctx);
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <BerichttypeEditor bericht={bericht} onChange={setBericht} />
    </div>
  );
}

function BerichtInspector() {
  const { bericht } = useContext(Ctx);
  return (
    <div className="studio-inspector-pad">
      <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Berichttype</h3>
      <p style={{ margin: "0 0 8px", color: "var(--s-fg-muted)" }}>{bericht.naam}</p>
      <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Velden ({bericht.velden.length})</h3>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
        {bericht.velden.map((v) => (
          <li key={`${v.ref.typenaam}.${v.ref.veldnaam}`}>
            {v.ref.typenaam}.<b>{v.ref.veldnaam}</b>
          </li>
        ))}
        {bericht.velden.length === 0 && <li style={{ color: "var(--s-fg-muted)" }}>nog geen velden</li>}
      </ul>
    </div>
  );
}

export default {
  id: "bericht",
  label: "Berichtdefinities",
  icon: <IconBericht />,
  groep: "modelleren",
  Provider: BerichtProvider,
  Sidebar: BerichtSidebar,
  Main: BerichtMain,
  Inspector: BerichtInspector,
  sidebarLabel: "Canoniek model",
  inspectorLabel: "Berichttype",
  // Activiteit-specifiek "Bericht"-menu via de menuBus.
  menus: [
    {
      id: "bericht",
      label: "Bericht",
      items: [
        { id: "bericht-nieuw", label: "Nieuw berichttype", onClick: () => menuBus.emit("bericht:nieuw") },
        { type: "separator" },
        { id: "bericht-export", label: "Exporteer als JSON…", onClick: () => menuBus.emit("bericht:export") },
      ],
    },
  ],
};
