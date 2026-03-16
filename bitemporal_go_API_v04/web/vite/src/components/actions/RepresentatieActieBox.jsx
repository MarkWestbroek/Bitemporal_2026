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
  secondaireIds,
}) {
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
              secondaireInfo={{ ids: secondaireIds || [], loading: false, error: "" }}
              secondaireKolom={secondaireEntiteitIDKolom}
            />
          </ActionInlineField>
        );})}
      </ActionTopFields>

      {repActiePreview && (
        <div style={{ margin: "2px 0 10px", borderRadius: 6, overflow: "hidden", border: `1px solid ${accentColor}` }}>
          <div style={{ background: "#f8fafc", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Preview: Afvoeren</div>
          {repActiePreview.ok
            ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.afvoer, null, 2)}</pre>
            : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12 }}>{repActiePreview.fout}</p>}
          <div style={{ background: "#f8fafc", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569", borderTop: `1px solid ${accentColor}` }}>Preview: Corrigeren</div>
          {repActiePreview.ok ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.corrigeer, null, 2)}</pre> : null}
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

      {actieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: actieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {actieResultaat.bericht}
        </p>
      )}
    </ActionBodyCard>
  );
}
