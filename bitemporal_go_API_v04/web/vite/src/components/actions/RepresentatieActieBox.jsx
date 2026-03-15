export default function RepresentatieActieBox({
  geselecteerdeRep,
  setGeselecteerdeRep,
  setActieResultaat,
  actieOpmerking,
  setActieOpmerking,
  actieFormVelden,
  setActieFormVelden,
  repActiePreview,
  voerActieUit,
  actieBezig,
  actieResultaat,
}) {
  return (
    <div style={{ marginTop: "14px", padding: "12px 16px", border: "1.5px dashed #94a3b8", borderRadius: 10, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>
          {geselecteerdeRep.group.doeltype} - rel_id={geselecteerdeRep.item.rel_id ?? geselecteerdeRep.item.id ?? "?"}
        </strong>
        <button
          onClick={() => { setGeselecteerdeRep(null); setActieResultaat(null); }}
          style={{ background: "transparent", color: "#475569", border: "1px solid #cbd5e1", padding: "3px 10px", fontSize: 13 }}
        >x</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
        <label>
          Opmerking
          <input value={actieOpmerking} onChange={(e) => setActieOpmerking(e.target.value)} placeholder="optioneel" />
        </label>
        {Object.entries(actieFormVelden).map(([k, v]) => (
          <label key={k}>
            {k}
            <input
              value={String(v ?? "")}
              onChange={(e) => setActieFormVelden((prev) => ({ ...prev, [k]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      {repActiePreview && (
        <div style={{ margin: "2px 0 10px", borderRadius: 6, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <div style={{ background: "#f1f5f9", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Preview: Afvoeren</div>
          {repActiePreview.ok
            ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#f8fafc", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.afvoer, null, 2)}</pre>
            : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12 }}>{repActiePreview.fout}</p>
          }
          <div style={{ background: "#f1f5f9", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569", borderTop: "1px solid #e2e8f0" }}>Preview: Corrigeren</div>
          {repActiePreview.ok
            ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#f8fafc", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(repActiePreview.corrigeer, null, 2)}</pre>
            : null
          }
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => voerActieUit("afvoer")}
          disabled={actieBezig}
          style={{ background: "#b91c1c" }}
        >
          {actieBezig ? "Bezig..." : "Afvoeren"}
        </button>
        <button
          onClick={() => voerActieUit("corrigeer")}
          disabled={actieBezig}
        >
          {actieBezig ? "Bezig..." : "Corrigeren"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          Corrigeren: alleen opvoer; API voert de oude representatie zelf af
        </span>
      </div>

      {actieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: actieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {actieResultaat.bericht}
        </p>
      )}
    </div>
  );
}
