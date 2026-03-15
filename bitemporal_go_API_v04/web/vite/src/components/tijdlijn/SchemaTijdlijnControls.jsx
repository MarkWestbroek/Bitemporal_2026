export default function SchemaTijdlijnControls({
  baseUrl,
  setBaseUrl,
  entityType,
  setEntityType,
  entityTypes,
  entityId,
  setEntityId,
  loadTimeline,
  loading,
  downloadTimelineAsPng,
  exporting,
  items,
  copyTimelineAsPng,
  copying,
  error,
}) {
  return (
    <div className="card">
      <div className="controls">
        <label>
          API base URL
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value.trim())} />
        </label>
        <label>
          Entiteittype
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {entityTypes.map((et) => <option key={et.typenaam} value={et.typenaam}>{et.typenaam}</option>)}
          </select>
        </label>
        <label>
          Entiteit-id
          <input type="number" min="0" step="1" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button onClick={loadTimeline} disabled={loading}>{loading ? "Bezig met ophalen..." : "Ophalen tijdslijn"}</button>
        </div>
        <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
          <button onClick={downloadTimelineAsPng} disabled={loading || exporting || items.length === 0}>
            {exporting ? "PNG maken..." : "Download PNG"}
          </button>
          <button onClick={copyTimelineAsPng} disabled={loading || exporting || copying || items.length === 0}>
            {copying ? "Kopie maken..." : "Kopieer PNG"}
          </button>
        </div>
      </div>
      {error && <p className="error-text">Fout: {error}</p>}
    </div>
  );
}
