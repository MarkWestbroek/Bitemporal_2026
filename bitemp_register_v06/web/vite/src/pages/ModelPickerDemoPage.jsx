/**
 * ModelPickerDemoPage — kleine standalone pagina om de ModelPicker te tonen.
 *
 * Toont links de ModelPicker (boom over het canoniek model) en rechts de
 * laatst gekozen / gesleepte FieldRef als JSON. Tevens een drop-zone die
 * bewijst dat drag-and-drop van een veld werkt (MIME application/x-canoniek-fieldref).
 *
 * Route: /modelpicker (zie App.jsx)
 */
import { useState } from "react";
import { ModelPicker, FIELDREF_MIME } from "../modelpicker";
import { apiBase } from "../shared/apiBase.js";

export default function ModelPickerDemoPage() {
  const [laatste, setLaatste] = useState(null);
  const [gedropt, setGedropt] = useState([]);

  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(FIELDREF_MIME) || e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const ref = JSON.parse(raw);
      setGedropt((prev) => [ref, ...prev].slice(0, 10));
    } catch {
      // text/plain fallback (alleen veldpad)
      setGedropt((prev) => [{ veldpad: raw }, ...prev].slice(0, 10));
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, height: "100vh", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: 420, minWidth: 320, display: "flex", flexDirection: "column" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>ModelPicker demo</h2>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
          Klik <b>kies</b> of dubbelklik een veld, of sleep een veld naar de drop-zone rechts.
        </p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModelPicker baseUrl={apiBase()} onPick={setLaatste} expandEntiteiten />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Laatst gekozen FieldRef</h3>
          <pre style={{ margin: 0, background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
            {laatste ? JSON.stringify(laatste, null, 2) : "— nog niets gekozen —"}
          </pre>
        </section>

        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            flex: 1,
            border: "2px dashed #94a3b8",
            borderRadius: 8,
            padding: 12,
            background: "#f8fafc",
            overflow: "auto",
          }}
        >
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Drop-zone (gesleepte velden)</h3>
          {gedropt.length === 0 ? (
            <div style={{ color: "#94a3b8", fontStyle: "italic" }}>Sleep hier een veld naartoe…</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {gedropt.map((ref, i) => (
                <li key={i}>
                  <code>{ref.veldpad}</code>
                  {ref.datatype ? <span style={{ color: "#6d28d9" }}> · {ref.datatype}</span> : null}
                  {ref.afgeleid ? <span style={{ color: "#c2410c" }}> · afgeleid</span> : null}
                  {ref.tDimensie ? <span style={{ color: "#0f766e" }}> · {ref.tDimensie}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
