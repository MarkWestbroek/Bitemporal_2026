/**
 * DmnEditorDemoPage — demonstreert stap 2 van de "driehoek proces – regels – data":
 * een DMN-beslistabel waarvan de input/output-kolommen binden aan velden uit het
 * canoniek model (FieldRef).
 *
 * Links: de ModelPicker (sleepbron + kiezer). Rechts: de beslistabel.
 *
 * Binden kan op twee manieren:
 *  - sleep een veld op een kolomkop, of
 *  - klik "bind…" in een kolomkop → de volgende keuze in de ModelPicker bindt
 *    aan die kolom (bind-modus).
 *
 * Route: /dmn-demo (zie App.jsx)
 */
import { useState, useCallback } from "react";
import { ModelPicker } from "../modelpicker";
import DmnTableEditor from "../dmn/DmnTableEditor";
import { nieuweBeslistabel, bindInput, bindOutput } from "../dmn/dmnModel";

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

export default function DmnEditorDemoPage() {
  const [table, setTable] = useState(() => {
    const t = nieuweBeslistabel("Bepaal ingezetene-status");
    return t;
  });
  // Bind-modus: {clauseId, kant} zodra de gebruiker "bind…" klikt.
  const [bindDoel, setBindDoel] = useState(null);
  const [afgeleidVoorstel, setAfgeleidVoorstel] = useState(null);

  const onRequestBind = useCallback((clauseId, kant) => {
    setBindDoel({ clauseId, kant });
  }, []);

  // Een veld gekozen in de ModelPicker.
  const onPick = useCallback(
    (ref) => {
      if (!bindDoel) return; // alleen binden als een kolom in bind-modus staat
      setTable((t) =>
        bindDoel.kant === "input"
          ? bindInput(t, bindDoel.clauseId, ref)
          : bindOutput(t, bindDoel.clauseId, ref)
      );
      setBindDoel(null);
    },
    [bindDoel]
  );

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, height: "100vh", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: 380, minWidth: 300, display: "flex", flexDirection: "column" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Canoniek model</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: bindDoel ? "#2563eb" : "#64748b" }}>
          {bindDoel
            ? `Bind-modus actief: kies een veld voor de ${bindDoel.kant}-kolom.`
            : "Sleep een veld op een kolomkop, of klik eerst \u201cbind\u2026\u201d in de tabel."}
        </p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>DMN-beslistabel</h2>
        <DmnTableEditor
          table={table}
          onChange={setTable}
          onRequestBind={onRequestBind}
          onPromoveerAdhoc={setAfgeleidVoorstel}
        />

        {afgeleidVoorstel && (
          <section>
            <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Voorstel afgeleid veld (uit ad-hoc output)</h3>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b" }}>
              Dit zou teruggeschreven worden naar het canoniek model, met de DMN als regelbron.
            </p>
            <pre style={{ margin: 0, background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(afgeleidVoorstel, null, 2)}
            </pre>
          </section>
        )}

        <section>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Tabel als JSON (FieldRef-binding zichtbaar)</h3>
          <pre style={{ margin: 0, background: "#f1f5f9", color: "#0f172a", padding: 12, borderRadius: 8, fontSize: 11, overflow: "auto", maxHeight: 260 }}>
            {JSON.stringify(table, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
