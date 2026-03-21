import {
  ActionBodyCard,
  ActionTopFields,
  ActionInlineField,
  ActionGroupedSections,
} from "./ActionFormParts";

function isMeervoudigOptie(optie) {
  const mv = String(optie?.group?.typeMeta?.momentvoorkomen || optie?.group?.momentvoorkomen || "").toLowerCase();
  return mv === "meervoudig";
}

export default function EntiteitActieBox({
  accentColor,
  actieOpmerking,
  setActieOpmerking,
  voerEntiteitActieUit,
  actieBezig,
  gegevenselementGroepOpties,
  voegEntiteitGegevenRijToe,
  entiteitNieuweGegevens,
  updateEntiteitGegevenRijVeld,
  setEntiteitNieuweGegevens,
  relatieGroepOpties,
  voegEntiteitRelatieRijToe,
  entiteitNieuweRelaties,
  updateEntiteitRelatieRijVeld,
  relatieSecondaireOpties,
  setEntiteitNieuweRelaties,
  entiteitOpvoerPreview,
  actieResultaat,
  isMaterieel,
  entiteitAanvangDatum,
  setEntiteitAanvangDatum,
  entiteitEindeDatum,
  setEntiteitEindeDatum,
  entiteitOortjes,
}) {
  return (
    <ActionBodyCard accentColor={accentColor}>
      <ActionTopFields>
        <ActionInlineField label="Opmerking">
          <input style={{ flex: 1, minWidth: 0 }} value={actieOpmerking} onChange={(event) => setActieOpmerking(event.target.value)} placeholder="optioneel" />
        </ActionInlineField>
      </ActionTopFields>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => voerEntiteitActieUit("afvoer")} disabled={actieBezig} style={{ background: "#b91c1c" }}>
          {actieBezig ? "Bezig..." : "Entiteit afvoeren"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>Corrigeren van entiteit is niet toegestaan.</span>
      </div>

      <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: 10 }}>
        {/* Materiële tijd: aanvang/einde datumpickers, alleen zichtbaar als het entiteitstype materieel is. */}
        {isMaterieel && (
          <div style={{ display: "flex", gap: 16, marginBottom: 12, padding: "8px 10px", background: "#f0f9ff", borderRadius: 6, border: "1px solid #bae6fd" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>
                Aanvang {entiteitOortjes?.aanvang ? <span style={{ fontWeight: 400, color: "#64748b" }}>(huidig: {entiteitOortjes.aanvang.datum || "–"})</span> : null}
              </label>
              <input type="date" value={entiteitAanvangDatum} onChange={(e) => setEntiteitAanvangDatum(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>
                Einde {entiteitOortjes?.einde ? <span style={{ fontWeight: 400, color: "#64748b" }}>(huidig: {entiteitOortjes.einde.datum || "–"})</span> : null}
              </label>
              <input type="date" value={entiteitEindeDatum} onChange={(e) => setEntiteitEindeDatum(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
        )}

        <ActionGroupedSections
          opties={gegevenselementGroepOpties}
          rows={entiteitNieuweGegevens}
          titlePrefix="Gegevenselement"
          accentColor={accentColor}
          rowAccentColor={accentColor}
          onAddRow={voegEntiteitGegevenRijToe}
          onUpdateField={updateEntiteitGegevenRijVeld}
          onRemoveRow={(rowId) => setEntiteitNieuweGegevens((prev) => prev.filter((row) => row.id !== rowId))}
          busy={actieBezig}
          isMeervoudigOptie={isMeervoudigOptie}
        />

        <ActionGroupedSections
          opties={relatieGroepOpties}
          rows={entiteitNieuweRelaties}
          titlePrefix="Relatie"
          accentColor={accentColor}
          rowAccentColor={accentColor}
          onAddRow={voegEntiteitRelatieRijToe}
          onUpdateField={updateEntiteitRelatieRijVeld}
          onRemoveRow={(rowId) => setEntiteitNieuweRelaties((prev) => prev.filter((row) => row.id !== rowId))}
          busy={actieBezig}
          isMeervoudigOptie={isMeervoudigOptie}
          secondaryOptionsByGroupKey={relatieSecondaireOpties}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => voerEntiteitActieUit("opvoer")} disabled={actieBezig || (gegevenselementGroepOpties.length === 0 && relatieGroepOpties.length === 0 && !entiteitAanvangDatum && !entiteitEindeDatum) || (entiteitOpvoerPreview && !entiteitOpvoerPreview.ok)}>
            {actieBezig ? "Bezig..." : "Voer nieuwe GEs/relaties op"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Een registratie met opvoer onder de bestaande entiteit.</span>
        </div>

        {(entiteitNieuweGegevens.length > 0 || entiteitNieuweRelaties.length > 0 || entiteitAanvangDatum || entiteitEindeDatum) && entiteitOpvoerPreview && (
          <details style={{ margin: "10px 0", borderRadius: 6, overflow: "hidden", border: `1px solid ${accentColor}` }}>
            <summary style={{ cursor: "pointer", padding: "6px 10px", background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#475569" }}>
              Preview: te versturen payload (GE + relatie opvoer)
            </summary>
            {entiteitOpvoerPreview.ok
              ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", borderTop: `1px solid ${accentColor}` }}>{JSON.stringify(entiteitOpvoerPreview.payload, null, 2)}</pre>
              : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12, borderTop: `1px solid ${accentColor}` }}>{entiteitOpvoerPreview.fout}</p>}
          </details>
        )}
      </div>

      {actieResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: actieResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {actieResultaat.bericht}
        </p>
      )}
    </ActionBodyCard>
  );
}
