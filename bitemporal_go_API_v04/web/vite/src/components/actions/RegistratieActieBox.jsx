export default function RegistratieActieBox({
  registratieActieFormRef,
  selectedRegistratie,
  setRegistratieActieOpen,
  setRegistratieCorrigeerActief,
  setRegistratieOngedaanBevestiging,
  setRegistratieActieResultaat,
  registratieActieOpmerking,
  setRegistratieActieOpmerking,
  registratieOngedaanBevestiging,
  registratieActieBezig,
  voerRegistratieOngedaanMakingUit,
  registratieCorrigeerActief,
  openRegistratieCorrigeren,
  selectedRegistratieWijzigingen,
  zoekGroupEnItemVoorWijziging,
  plumbingVelden,
  registratieCorrigeerVelden,
  setRegistratieCorrigeerVelden,
  voerRegistratieCorrectieUit,
  registratieActieResultaat,
}) {
  return (
    <div ref={registratieActieFormRef} style={{ marginTop: "14px", padding: "12px 16px", border: "1.5px dashed #94a3b8", borderRadius: 10, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>Registratie {selectedRegistratie.id} - acties</strong>
        <button
          onClick={() => { setRegistratieActieOpen(false); setRegistratieCorrigeerActief(false); setRegistratieOngedaanBevestiging(false); setRegistratieActieResultaat(null); }}
          style={{ background: "transparent", color: "#475569", border: "1px solid #cbd5e1", padding: "3px 10px", fontSize: 13 }}
        >x</button>
      </div>

      {selectedRegistratie.is_ongedaangemaakt ? (
        <p className="muted">Deze registratie is al ongedaan gemaakt en kan niet opnieuw worden gewijzigd.</p>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block" }}>
              Opmerking (voor de nieuwe registratie)
              <input value={registratieActieOpmerking} onChange={(e) => setRegistratieActieOpmerking(e.target.value)} placeholder="optioneel" />
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            {!registratieOngedaanBevestiging ? (
              <button onClick={() => setRegistratieOngedaanBevestiging(true)} disabled={registratieActieBezig} style={{ background: "#b91c1c" }}>
                Ongedaan maken
              </button>
            ) : (
              <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                <p style={{ margin: "0 0 8px", color: "#b91c1c", fontWeight: 600 }}>&#9888; Let op! Deze actie kan (nog) niet ongedaan gemaakt worden :-)</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={voerRegistratieOngedaanMakingUit} disabled={registratieActieBezig} style={{ background: "#b91c1c" }}>
                    {registratieActieBezig ? "Bezig..." : "Bevestig ongedaan maken"}
                  </button>
                  <button
                    onClick={() => setRegistratieOngedaanBevestiging(false)}
                    disabled={registratieActieBezig}
                    style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#475569" }}
                  >Annuleren</button>
                </div>
              </div>
            )}
          </div>

          <div>
            {!registratieCorrigeerActief ? (
              <button onClick={openRegistratieCorrigeren} disabled={registratieActieBezig}>
                Corrigeren
              </button>
            ) : (
              <div style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <strong style={{ fontSize: 14 }}>Corrigeer velden</strong>
                {selectedRegistratieWijzigingen.filter((w) => w.wijzigingstype === "opvoer" && w.representatienaam && w.representatie_id).length === 0 && (
                  <p className="muted">Geen corrigeerbare opvoer-wijzigingen onder deze registratie.</p>
                )}
                {selectedRegistratieWijzigingen
                  .filter((w) => w.wijzigingstype === "opvoer" && w.representatienaam && w.representatie_id)
                  .map((w) => {
                    const match = zoekGroupEnItemVoorWijziging(w);
                    const afgevoerd = match ? (match.item.afvoer != null && match.item.afvoer !== "" && match.item.afvoer !== 0) : false;
                    const veldnamen = match && !afgevoerd ? Object.entries(match.item).filter(([k, v]) => (v === null || ["string", "number", "boolean"].includes(typeof v)) && !plumbingVelden.has(k)).map(([k]) => k) : [];
                    return (
                      <div key={`${w.representatienaam}_${w.representatie_id}`} style={{ marginTop: 8 }}>
                        <strong style={{ fontSize: 13 }}>{w.representatienaam} #{w.representatie_id}</strong>
                        {!match ? (
                          <p className="muted" style={{ margin: "2px 0 0" }}>Huidige representatie niet beschikbaar in geladen data (laad een peilmoment waarop de rep actief is).</p>
                        ) : afgevoerd ? (
                          <p style={{ margin: "2px 0 0", color: "#dc2626", fontSize: 12 }}>Afgevoerd - corrigeren niet mogelijk.</p>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, marginTop: 4 }}>
                            {veldnamen.map((k) => (
                              <label key={k} style={{ fontSize: 13 }}>
                                {k}
                                <input
                                  value={String(registratieCorrigeerVelden[String(w.representatie_id)]?.[k] ?? "")}
                                  onChange={(e) => setRegistratieCorrigeerVelden((prev) => ({
                                    ...prev,
                                    [String(w.representatie_id)]: { ...(prev[String(w.representatie_id)] || {}), [k]: e.target.value },
                                  }))}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={voerRegistratieCorrectieUit} disabled={registratieActieBezig}>
                    {registratieActieBezig ? "Bezig..." : "Verstuur correctie"}
                  </button>
                  <button
                    onClick={() => { setRegistratieCorrigeerActief(false); setRegistratieActieResultaat(null); }}
                    disabled={registratieActieBezig}
                    style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#475569" }}
                  >Annuleren</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {registratieActieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: registratieActieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {registratieActieResultaat.bericht}
        </p>
      )}
    </div>
  );
}
