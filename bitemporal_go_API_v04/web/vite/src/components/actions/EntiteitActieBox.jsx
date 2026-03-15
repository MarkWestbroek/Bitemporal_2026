export default function EntiteitActieBox({
  entiteitType,
  selectedA,
  setEntiteitActieOpen,
  setActieResultaat,
  actieOpmerking,
  setActieOpmerking,
  voerEntiteitActieUit,
  actieBezig,
  gegevenselementGroepOpties,
  voegEntiteitGegevenToe,
  entiteitNieuweGegevens,
  veranderEntiteitGegevenRijType,
  updateEntiteitGegevenRijVeld,
  setEntiteitNieuweGegevens,
  relatieGroepOpties,
  voegEntiteitRelatieToe,
  entiteitNieuweRelaties,
  veranderEntiteitRelatieRijType,
  updateEntiteitRelatieRijVeld,
  relatieSecondaireOpties,
  setEntiteitNieuweRelaties,
  entiteitOpvoerPreview,
  actieResultaat,
  safeArray,
}) {
  return (
    <div style={{ marginTop: "14px", padding: "12px 16px", border: "1.5px dashed #94a3b8", borderRadius: 10, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>
          Entiteit {entiteitType} id={selectedA.id} - acties
        </strong>
        <button
          onClick={() => { setEntiteitActieOpen(false); setActieResultaat(null); }}
          style={{ background: "transparent", color: "#475569", border: "1px solid #cbd5e1", padding: "3px 10px", fontSize: 13 }}
        >x</button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", maxWidth: 460 }}>
          Opmerking
          <input value={actieOpmerking} onChange={(e) => setActieOpmerking(e.target.value)} placeholder="optioneel" />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button
          onClick={() => voerEntiteitActieUit("afvoer")}
          disabled={actieBezig}
          style={{ background: "#b91c1c" }}
        >
          {actieBezig ? "Bezig..." : "Entiteit afvoeren"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          Corrigeren van entiteit is niet toegestaan.
        </span>
      </div>

      <div style={{ borderTop: "1px solid #dbeafe", paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Gegevenselementen toevoegen (meerdere types/records)</strong>
          <button onClick={voegEntiteitGegevenToe} disabled={actieBezig || gegevenselementGroepOpties.length === 0}>+ GE-regel</button>
        </div>

        {gegevenselementGroepOpties.length === 0 && (
          <p className="muted" style={{ marginTop: 0 }}>Geen gegevenselementtypes beschikbaar in schema.</p>
        )}

        {entiteitNieuweGegevens.map((row) => (
          <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8, background: "#ffffff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 260px) 1fr auto", gap: 8, alignItems: "start" }}>
              <label>
                Type
                <select
                  value={row.groupKey}
                  onChange={(e) => veranderEntiteitGegevenRijType(row.id, e.target.value)}
                >
                  {gegevenselementGroepOpties.map((optie) => (
                    <option key={optie.groupKey} value={optie.groupKey}>{optie.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {(() => {
                  const optie = gegevenselementGroepOpties.find((o) => o.groupKey === row.groupKey);
                  const velden = safeArray(optie?.veldDefinities);
                  if (velden.length === 0) {
                    return <span className="muted" style={{ fontSize: 12 }}>Geen veldinformatie beschikbaar voor dit type.</span>;
                  }
                  return velden.map((veld) => {
                    const huidigeWaarde = row?.values?.[veld.naam] ?? "";
                    if (veld.type === "boolean") {
                      return (
                        <label key={`${row.id}-${veld.naam}`}>
                          {veld.naam}
                          <select
                            value={String(huidigeWaarde)}
                            onChange={(e) => updateEntiteitGegevenRijVeld(row.id, veld.naam, e.target.value)}
                          >
                            <option value="">(leeg)</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                      );
                    }
                    return (
                      <label key={`${row.id}-${veld.naam}`}>
                        {veld.naam}
                        <input
                          type={veld.type === "number" ? "number" : "text"}
                          step={veld.type === "number" ? "any" : undefined}
                          value={String(huidigeWaarde)}
                          onChange={(e) => updateEntiteitGegevenRijVeld(row.id, veld.naam, e.target.value)}
                        />
                      </label>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => setEntiteitNieuweGegevens((prev) => prev.filter((r) => r.id !== row.id))}
                disabled={actieBezig}
                style={{ background: "#475569", alignSelf: "end" }}
              >
                Verwijder
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 8px" }}>
          <strong style={{ fontSize: 14 }}>Relaties toevoegen</strong>
          <button onClick={voegEntiteitRelatieToe} disabled={actieBezig || relatieGroepOpties.length === 0}>+ Relatie-regel</button>
        </div>

        {relatieGroepOpties.length === 0 && (
          <p className="muted" style={{ marginTop: 0 }}>Geen relatietypes beschikbaar in schema.</p>
        )}

        {entiteitNieuweRelaties.map((row) => (
          <div key={`rel-${row.id}`} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8, background: "#ffffff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 260px) 1fr auto", gap: 8, alignItems: "start" }}>
              <label>
                Type
                <select
                  value={row.groupKey}
                  onChange={(e) => veranderEntiteitRelatieRijType(row.id, e.target.value)}
                >
                  {relatieGroepOpties.map((optie) => (
                    <option key={optie.groupKey} value={optie.groupKey}>{optie.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {(() => {
                  const optie = relatieGroepOpties.find((o) => o.groupKey === row.groupKey);
                  const velden = safeArray(optie?.veldDefinities);
                  if (velden.length === 0) {
                    return <span className="muted" style={{ fontSize: 12 }}>Geen veldinformatie beschikbaar voor dit relatietype.</span>;
                  }
                  const secondaireInfo = relatieSecondaireOpties[row.groupKey] || { loading: false, ids: [], error: "" };
                  return velden.map((veld) => {
                    const huidigeWaarde = row?.values?.[veld.naam] ?? "";
                    if (veld.naam === optie?.secondaireEntiteitIDKolom) {
                      if (secondaireInfo.loading) {
                        return (
                          <label key={`rel-${row.id}-${veld.naam}`}>
                            {veld.naam}
                            <input value="Laden..." readOnly />
                          </label>
                        );
                      }
                      if (safeArray(secondaireInfo.ids).length > 0) {
                        return (
                          <label key={`rel-${row.id}-${veld.naam}`}>
                            {veld.naam}
                            <select
                              value={String(huidigeWaarde)}
                              onChange={(e) => updateEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}
                            >
                              <option value="">(kies id)</option>
                              {safeArray(secondaireInfo.ids).map((idOptie) => (
                                <option key={`id-${row.id}-${idOptie}`} value={String(idOptie)}>{String(idOptie)}</option>
                              ))}
                            </select>
                            {secondaireInfo.error && <span className="muted" style={{ fontSize: 11 }}>{secondaireInfo.error}</span>}
                          </label>
                        );
                      }
                    }
                    if (veld.type === "boolean") {
                      return (
                        <label key={`rel-${row.id}-${veld.naam}`}>
                          {veld.naam}
                          <select
                            value={String(huidigeWaarde)}
                            onChange={(e) => updateEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}
                          >
                            <option value="">(leeg)</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                      );
                    }
                    return (
                      <label key={`rel-${row.id}-${veld.naam}`}>
                        {veld.naam}
                        <input
                          type={veld.type === "number" ? "number" : "text"}
                          step={veld.type === "number" ? "any" : undefined}
                          value={String(huidigeWaarde)}
                          onChange={(e) => updateEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}
                        />
                      </label>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => setEntiteitNieuweRelaties((prev) => prev.filter((r) => r.id !== row.id))}
                disabled={actieBezig}
                style={{ background: "#475569", alignSelf: "end" }}
              >
                Verwijder
              </button>
            </div>
          </div>
        ))}

        {(entiteitNieuweGegevens.length > 0 || entiteitNieuweRelaties.length > 0) && entiteitOpvoerPreview && (
          <div style={{ margin: "10px 0", borderRadius: 6, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <div style={{ background: "#f1f5f9", padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Preview: te versturen payload (GE + relatie opvoer)</div>
            {entiteitOpvoerPreview.ok
              ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#f8fafc", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(entiteitOpvoerPreview.payload, null, 2)}</pre>
              : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12 }}>{entiteitOpvoerPreview.fout}</p>
            }
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => voerEntiteitActieUit("opvoer")} disabled={actieBezig || (gegevenselementGroepOpties.length === 0 && relatieGroepOpties.length === 0)}>
            {actieBezig ? "Bezig..." : "Voer nieuwe GEs/relaties op"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Een registratie met opvoer onder de bestaande entiteit.
          </span>
        </div>
      </div>

      {actieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: actieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {actieResultaat.bericht}
        </p>
      )}
    </div>
  );
}
