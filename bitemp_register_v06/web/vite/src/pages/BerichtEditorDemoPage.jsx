/**
 * BerichtEditorDemoPage — demonstreert stap 3 van de "driehoek proces – regels –
 * data": een Berichttype als projectie over het canoniek model, exporteerbaar
 * naar Operaton/Valtimo, JSON Schema en BPMN extensionElements.
 *
 * Links: de ModelPicker (multi-select). Rechts: de Berichttype-editor.
 * Een veld kiezen (dubbelklik/knop) of slepen voegt het toe aan de projectie.
 *
 * Route: /bericht-demo (zie App.jsx)
 */
import { useState, useCallback } from "react";
import { ModelPicker } from "../modelpicker";
import { BerichttypeEditor, nieuwBerichttype, voegVeldToe, berichtVeldKey } from "../bericht";
import { apiBase } from "../shared/apiBase.js";

export default function BerichtEditorDemoPage() {
  const [bericht, setBericht] = useState(() => nieuwBerichttype("InwonerAanmelding"));

  // Een veld gekozen in de ModelPicker → toevoegen aan de projectie.
  const onPick = useCallback((ref) => {
    setBericht((b) => voegVeldToe(b, ref));
  }, []);

  // Reeds opgenomen velden markeren in de ModelPicker (multi-select weergave).
  const geselecteerd = bericht.velden.map((v) => ({ typenaam: v.ref.typenaam, veldnaam: v.ref.veldnaam }));

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 16,
        height: "100vh",
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ width: 380, minWidth: 300, display: "flex", flexDirection: "column" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Canoniek model</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
          Kies of sleep velden om het berichttype samen te stellen. Reeds gekozen velden zijn aangevinkt.
        </p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModelPicker baseUrl={apiBase()} onPick={onPick} multiSelect selected={geselecteerd} expandEntiteiten />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Berichttype-editor</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Een berichttype is een projectie over het canoniek model. De export-tabs leveren formaten die bruikbaar zijn
          vanuit Valtimo/Operaton: een message-correlatie-contract, een JSON Schema voor payload-validatie en BPMN{" "}
          <code>extensionElements</code>.
        </p>
        <BerichttypeEditor bericht={bericht} onChange={setBericht} />
      </div>
    </div>
  );
}
