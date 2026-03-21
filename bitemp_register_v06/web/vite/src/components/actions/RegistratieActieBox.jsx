import {
  ActionBodyCard,
  ActionTopFields,
  ActionInlineField,
  ActionSection,
  ActionRowCard,
  ActionFieldsGrid,
  ActionLabeledEditorField,
  ActionFieldControl,
} from "./ActionFormParts";

export default function RegistratieActieBox({
  registratieActieFormRef,
  accentColor,
  selectedRegistratie,
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
  registratieCorrigeerVelden,
  setRegistratieCorrigeerVelden,
  voerRegistratieCorrectieUit,
  registratieCorrectiePreview,
  registratieActieResultaat,
  relatieSecondaireOpties,
}) {
  const corrigeerbareWijzigingen = selectedRegistratieWijzigingen.filter((w) => w.wijzigingstype === "opvoer" && w.representatienaam && w.representatie_id);

  return (
    <ActionBodyCard formRef={registratieActieFormRef} accentColor={accentColor}>
      {selectedRegistratie.is_ongedaangemaakt ? (
        <p className="muted">Deze registratie is al ongedaan gemaakt en kan niet opnieuw worden gewijzigd.</p>
      ) : (
        <>
          <ActionTopFields>
            <ActionInlineField label="Opmerking (voor de nieuwe registratie)">
              <input style={{ flex: 1, minWidth: 0 }} value={registratieActieOpmerking} onChange={(event) => setRegistratieActieOpmerking(event.target.value)} placeholder="optioneel" />
            </ActionInlineField>
          </ActionTopFields>

          <ActionSection title="Ongedaan maken" accentColor={accentColor}>
            {!registratieOngedaanBevestiging ? (
              <button onClick={() => setRegistratieOngedaanBevestiging(true)} disabled={registratieActieBezig} style={{ background: "#b91c1c" }}>Ongedaan maken</button>
            ) : (
              <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                <p style={{ margin: "0 0 8px", color: "#b91c1c", fontWeight: 600 }}>&#9888; Let op! Deze actie kan (nog) niet ongedaan gemaakt worden :-)</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={voerRegistratieOngedaanMakingUit} disabled={registratieActieBezig} style={{ background: "#b91c1c" }}>
                    {registratieActieBezig ? "Bezig..." : "Bevestig ongedaan maken"}
                  </button>
                  <button onClick={() => setRegistratieOngedaanBevestiging(false)} disabled={registratieActieBezig} style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#475569" }}>Annuleren</button>
                </div>
              </div>
            )}
          </ActionSection>

          <ActionSection title="Corrigeer velden" accentColor={accentColor}>
            {!registratieCorrigeerActief ? (
              <button onClick={openRegistratieCorrigeren} disabled={registratieActieBezig}>Corrigeren</button>
            ) : (
              <>
                {corrigeerbareWijzigingen.length === 0 && <p className="muted">Geen corrigeerbare opvoer-wijzigingen onder deze registratie.</p>}
                {corrigeerbareWijzigingen.map((w) => {
                  const match = zoekGroupEnItemVoorWijziging(w);
                  const afgevoerd = match ? (match.item.afvoer != null && match.item.afvoer !== "" && match.item.afvoer !== 0) : false;
                  const secondaireKolom = String(match?.group?.typeMeta?.secondaireEntiteitIDKolom || "");
                  const groupKey = match ? `${match.group.rolnaam}__${match.group.doeltype}` : "";
                  const secondaireIds = Array.isArray(relatieSecondaireOpties?.[groupKey]?.ids) ? relatieSecondaireOpties[groupKey].ids : [];
                  const typeMeta = match?.group?.typeMeta;
                  const temporaal = new Set(["opvoer", "afvoer", "aanvang", "einde"]);
                  const entKolom = String(typeMeta?.entiteitIDKolom || "").toLowerCase();
                  const veldnamen = match && !afgevoerd ? Object.entries(match.item).filter(([k, v]) => {
                    if (!(v === null || ["string", "number", "boolean"].includes(typeof v))) return false;
                    const naam = k.toLowerCase();
                    if (temporaal.has(naam)) return false;
                    if (entKolom && naam === entKolom) return false;
                    const veldDef = Array.isArray(typeMeta?.velden) ? typeMeta.velden.find((f) => f.naam === k) : null;
                    if (veldDef?.autoIncrement) return false;
                    return true;
                  }).map(([k]) => k) : [];

                  return (
                    <ActionRowCard key={`${w.representatienaam}_${w.representatie_id}`} rowAccentColor={accentColor}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{w.representatienaam} #{w.representatie_id}</strong>
                        {!match ? (
                          <p className="muted" style={{ margin: "2px 0 0" }}>Huidige representatie niet beschikbaar in geladen data (laad een peilmoment waarop de rep actief is).</p>
                        ) : afgevoerd ? (
                          <p style={{ margin: "2px 0 0", color: "#dc2626", fontSize: 12 }}>Afgevoerd - corrigeren niet mogelijk.</p>
                        ) : (
                          <div style={{ marginTop: 8 }}>
                            <ActionFieldsGrid>
                              {veldnamen.map((k) => (
                                <ActionLabeledEditorField
                                  key={k}
                                  veldnaam={k}
                                  beschrijving={String((Array.isArray(typeMeta?.velden) ? typeMeta.velden.find((veld) => veld.naam === k)?.description : "") || "")}
                                >
                                  <ActionFieldControl
                                    veld={Array.isArray(typeMeta?.velden)
                                      ? (typeMeta.velden.find((veld) => veld.naam === k) || { naam: k, type: typeof match.item[k], format: "", description: "" })
                                      : { naam: k, type: typeof match.item[k], format: "", description: "" }}
                                    value={registratieCorrigeerVelden[String(w.representatie_id)]?.[k] ?? ""}
                                    onChange={(waarde) => setRegistratieCorrigeerVelden((prev) => ({
                                      ...prev,
                                      [String(w.representatie_id)]: { ...(prev[String(w.representatie_id)] || {}), [k]: waarde },
                                    }))}
                                    secondaireInfo={{ ids: secondaireIds, loading: false, error: "" }}
                                    secondaireKolom={secondaireKolom}
                                  />
                                </ActionLabeledEditorField>
                              ))}
                            </ActionFieldsGrid>
                          </div>
                        )}
                      </div>
                    </ActionRowCard>
                  );
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={voerRegistratieCorrectieUit} disabled={registratieActieBezig || !registratieCorrectiePreview?.ok}>{registratieActieBezig ? "Bezig..." : "Verstuur correctie"}</button>
                  <button onClick={() => { setRegistratieCorrigeerActief(false); setRegistratieActieResultaat(null); }} disabled={registratieActieBezig} style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#475569" }}>Annuleren</button>
                </div>

                {registratieCorrectiePreview && (
                  <details style={{ marginTop: 10, border: `1px solid ${accentColor}`, borderRadius: 8, background: "#ffffff", padding: "8px 10px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#334155" }}>
                      JSON request preview {registratieCorrectiePreview.ok && registratieCorrectiePreview?.payload?.wijzigingen
                        ? `(${registratieCorrectiePreview.payload.wijzigingen.length} wijziging${registratieCorrectiePreview.payload.wijzigingen.length === 1 ? "" : "en"})`
                        : ""}
                    </summary>
                    {registratieCorrectiePreview.ok ? (
                      <pre style={{ margin: "8px 0 0", padding: "8px 10px", fontSize: 12, background: "#ffffff", borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {JSON.stringify(registratieCorrectiePreview.payload, null, 2)}
                      </pre>
                    ) : (
                      <p style={{ margin: "8px 0 0", color: "#dc2626", fontSize: 12 }}>{registratieCorrectiePreview.fout}</p>
                    )}
                  </details>
                )}
              </>
            )}
          </ActionSection>
        </>
      )}

      {registratieActieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: registratieActieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {registratieActieResultaat.bericht}
        </p>
      )}
    </ActionBodyCard>
  );
}
