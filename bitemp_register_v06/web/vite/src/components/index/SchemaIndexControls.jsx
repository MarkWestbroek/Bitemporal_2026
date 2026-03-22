export default function SchemaIndexControls({
  baseUrl,
  setBaseUrl,
  entiteitType,
  setEntiteitType,
  entiteitTypen,
  openNieuweEntiteitActieBox,
  loading,
  registratieId,
  setRegistratieId,
  t,
  setT,
  selectedEntiteitId,
  setSelectedEntiteitId,
  as,
  decrementRegistratieAndReload,
  incrementRegistratieAndReload,
  decrementTAndReload,
  incrementTAndReload,
  loadData,
  normaliseerNietNegatiefGeheelGetal,
  error,
  responseData,
}) {
  return (
    <div className="card">
      <div className="controls" style={{ gridTemplateColumns: "repeat(5, minmax(180px, 1fr))" }}>
        <label>
          API base URL
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value.trim())} placeholder="http://localhost:8080" />
        </label>

        <label>
          Entiteittype
          <select value={entiteitType} onChange={(e) => setEntiteitType(e.target.value)} disabled={entiteitTypen.length === 0}>
            {entiteitTypen.length === 0 && <option value="">Geen entiteittypen</option>}
            {entiteitTypen.map((meta) => (
              <option key={meta.typenaam} value={meta.typenaam}>{meta.klassenaam || meta.typenaam}</option>
            ))}
          </select>
        </label>

        <label>
          Registratie-id
          <input type="number" value={registratieId} onChange={(e) => setRegistratieId(e.target.value)} min="0" step="1" />
        </label>

        <label>
          Peilmoment (t)
          <input type="number" value={t} onChange={(e) => setT(e.target.value)} min="0" step="1" />
        </label>

        <label>
          Entiteit {entiteitType || "?"}
          <select value={selectedEntiteitId} onChange={(e) => setSelectedEntiteitId(e.target.value)} disabled={as.length === 0}>
            {as.length === 0 && <option value="">Geen resultaten</option>}
            {as.map((entiteit) => (
              <option key={entiteit.id} value={entiteit.id}>{entiteitType} #{entiteit.id}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 12, marginTop: 10, alignItems: "start" }}>
        {/* Kolom 2: nieuwe entiteit */}
        <div style={{ gridColumn: "2 / 3", display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={openNieuweEntiteitActieBox}
            disabled={loading || !entiteitType}
            style={{ background: "#0f766e" }}
          >
            + Nieuwe {entiteitType || "entiteit"} opvoeren
          </button>
        </div>

        {/* Kolom 3: door registratie-id lopen */}
        <div style={{ gridColumn: "3 / 4", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={decrementRegistratieAndReload} disabled={loading || normaliseerNietNegatiefGeheelGetal(registratieId, 0) <= 0}>reg-id - 1</button>
          <button onClick={incrementRegistratieAndReload} disabled={loading}>reg-id + 1</button>
        </div>

        {/* Kolom 4: door peilmoment lopen */}
        <div style={{ gridColumn: "4 / 5", display: "flex", gap: 8 }}>
          <button onClick={decrementTAndReload} disabled={loading || normaliseerNietNegatiefGeheelGetal(t, 0) <= 0}>t - 1</button>
          <button onClick={incrementTAndReload} disabled={loading}>t + 1</button>
        </div>

        {/* Kolom 5: ophalen */}
        <div style={{ gridColumn: "5 / 6" }}>
          <button onClick={() => loadData({ selecteerVanuitRegistratie: true })} disabled={loading || !entiteitType}>
            {loading ? "Bezig met ophalen..." : "Ophalen"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626" }}>Fout: {error}</p>}
      {responseData?.has_more && <p className="muted">Let op: has_more=true, niet alle entiteiten zijn geladen.</p>}
    </div>
  );
}
