import { labelVoorDomein, safeArray } from "../../shared/schemaUtils";

export default function SchemaIndexControls({
  baseUrl,
  setBaseUrl,
  beschikbareDomeinen,
  geselecteerdDomein,
  setGeselecteerdDomein,
  domeinenError,
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
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <label>
            API base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value.trim())} placeholder="http://localhost:8080" />
          </label>

          <label>
            Domein
            <select value={geselecteerdDomein} onChange={(e) => setGeselecteerdDomein(e.target.value)}>
              <option value="">(alle)</option>
              {safeArray(beschikbareDomeinen).map((domein) => (
                <option key={`domein-${domein.naam || "__zonder_domein__"}`} value={domein.naam}>
                  {labelVoorDomein(domein.naam)}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <div style={{ gridColumn: "3 / 4", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={decrementRegistratieAndReload} disabled={loading || normaliseerNietNegatiefGeheelGetal(registratieId, 0) <= 0}>reg-id - 1</button>
          <button onClick={incrementRegistratieAndReload} disabled={loading}>reg-id + 1</button>
        </div>

        <div style={{ gridColumn: "4 / 5", display: "flex", gap: 8 }}>
          <button onClick={decrementTAndReload} disabled={loading || normaliseerNietNegatiefGeheelGetal(t, 0) <= 0}>t - 1</button>
          <button onClick={incrementTAndReload} disabled={loading}>t + 1</button>
        </div>

        <div style={{ gridColumn: "5 / 6" }}>
          <button onClick={() => loadData({ selecteerVanuitRegistratie: true })} disabled={loading || !entiteitType}>
            {loading ? "Bezig met ophalen..." : "Ophalen"}
          </button>
        </div>
      </div>

      {domeinenError && <p className="muted" style={{ color: "#b45309" }}>Domeinen laden lukte niet volledig: {domeinenError}</p>}
      {error && <p style={{ color: "#dc2626" }}>Fout: {error}</p>}
      {responseData?.has_more && <p className="muted">Let op: has_more=true, niet alle entiteiten zijn geladen.</p>}
    </div>
  );
}
