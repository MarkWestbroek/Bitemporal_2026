import {
  ActionBodyCard,
  ActionTopFields,
  ActionInlineField,
  ActionFieldControl,
} from "./ActionFormParts";

export default function RepresentatieActieBox({
  accentColor,
  geselecteerdeRep,
  actieOpmerking,
  setActieOpmerking,
  actieFormVelden,
  setActieFormVelden,
  repActiePreview,
  voerActieUit,
  actieBezig,
  actieResultaat,
  secondaireEntiteitIDKolom,
  secondaireInfo,
  secondaireIds,
  isMaterieel,
  repAanvangDatum,
  setRepAanvangDatum,
  repEindeDatum,
  setRepEindeDatum,
  repOortjes,
}) {
  const effectieveSecondaireInfo = secondaireInfo || { ids: secondaireIds || [], loading: false, error: "" };

  return (
    <ActionBodyCard accentColor={accentColor}>
      <ActionTopFields>
        <ActionInlineField label="Opmerking">
          <input style={{ flex: 1, minWidth: 0 }} value={actieOpmerking} onChange={(event) => setActieOpmerking(event.target.value)} placeholder="optioneel" />
        </ActionInlineField>
        {Object.entries(actieFormVelden).map(([k, v]) => {
          const veldDef = Array.isArray(geselecteerdeRep?.group?.typeMeta?.velden)
            ? (geselecteerdeRep.group.typeMeta.velden.find((veld) => veld.naam === k) || { naam: k, type: typeof geselecteerdeRep?.item?.[k], format: "", description: "" })
            : { naam: k, type: typeof geselecteerdeRep?.item?.[k], format: "", description: "" };
          return (
          <ActionInlineField key={k} label={k} labelTitle={String(veldDef?.description || "")}>
            <ActionFieldControl
              veld={veldDef}
              value={String(v ?? "")}
              onChange={(waarde) => setActieFormVelden((prev) => ({ ...prev, [k]: waarde }))}
              secondaireInfo={effectieveSecondaireInfo}
              secondaireKolom={secondaireEntiteitIDKolom}
            />
          </ActionInlineField>
        );})}
      </ActionTopFields>

      {/* Materiële tijd: aanvang/einde datumpickers voor materiële hub-GE's en RELs */}
      {isMaterieel && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, padding: "8px 10px", background: "#f0f9ff", borderRadius: 6, border: "1px solid #bae6fd" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>
              Aanvang {repOortjes?.aanvangDatum ? <span style={{ fontWeight: 400, color: "#64748b" }}>(huidig: {repOortjes.aanvangDatum})</span> : null}
            </label>
            <input type="date" value={repAanvangDatum} onChange={(e) => setRepAanvangDatum(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>
              Einde {repOortjes?.eindeDatum ? <span style={{ fontWeight: 400, color: "#64748b" }}>(huidig: {repOortjes.eindeDatum})</span> : null}
            </label>
            <input type="date" value={repEindeDatum} onChange={(e) => setRepEindeDatum(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => voerActieUit("afvoer")} disabled={actieBezig} style={{ background: "#b91c1c" }}>
          {actieBezig ? "Bezig..." : "Afvoeren"}
        </button>
        <button onClick={() => voerActieUit("corrigeer")} disabled={actieBezig || !repActiePreview?.ok}>
          {actieBezig ? "Bezig..." : "Corrigeren"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>Corrigeren: alleen opvoer; API voert de oude representatie zelf af</span>
      </div>

      {repActiePreview && (
        <details style={{ margin: "10px 0 10px", borderRadius: 6, overflow: "hidden", border: `1px solid ${accentColor}` }}>
          <summary style={{ cursor: "pointer", padding: "6px 10px", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#475569" }}>
            Preview payloads
          </summary>
          <div style={{ background: "#f8fafc", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569", borderTop: `1px solid ${accentColor}` }}>Preview: Afvoeren</div>
          {repActiePreview.ok
            ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.afvoer, null, 2)}</pre>
            : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12 }}>{repActiePreview.fout}</p>}
          <div style={{ background: "#f8fafc", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569", borderTop: `1px solid ${accentColor}` }}>Preview: Corrigeren</div>
          {repActiePreview.ok ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.corrigeer, null, 2)}</pre> : null}
        </details>
      )}

      {actieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: actieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {actieResultaat.bericht}
        </p>
      )}
    </ActionBodyCard>
  );
}
