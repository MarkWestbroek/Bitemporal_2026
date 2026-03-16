import {
  ActionBodyCard,
  ActionTopFields,
  ActionInlineField,
  ActionGroupedSections,
  ActionFieldControl,
} from "./ActionFormParts";

export default function NieuweEntiteitActieBox({
  nieuweEntiteitFormRef,
  accentColor,
  entiteitType,
  nieuweEntiteitID,
  setNieuweEntiteitID,
  nieuweEntiteitOpmerking,
  setNieuweEntiteitOpmerking,
  setNieuweEntiteitOpmerkingAangepast,
  nieuweEntiteitIDInfo,
  gegevenselementGroepOpties,
  relatieGroepOpties,
  nieuweEntiteitGegevens,
  setNieuweEntiteitGegevens,
  nieuweEntiteitRelaties,
  setNieuweEntiteitRelaties,
  voegNieuweEntiteitGegevenRijToe,
  updateNieuweEntiteitGegevenRijVeld,
  voegNieuweEntiteitRelatieRijToe,
  updateNieuweEntiteitRelatieRijVeld,
  relatieSecondaireOpties,
  isMeervoudigOptie,
  nieuweEntiteitOpvoerPreview,
  voerNieuweEntiteitActieUit,
  nieuweEntiteitBezig,
  nieuweEntiteitResultaat,
}) {
  return (
    <ActionBodyCard formRef={nieuweEntiteitFormRef} accentColor={accentColor}>
      <ActionTopFields>
        <ActionInlineField label={`Nieuwe ${entiteitType}-id`}>
          <ActionFieldControl
            veld={{ naam: "id", type: "integer", verplicht: true }}
            value={String(nieuweEntiteitID ?? "")}
            onChange={setNieuweEntiteitID}
          />
        </ActionInlineField>
        <ActionInlineField label="Opmerking">
          <input
            style={{ flex: 1, minWidth: 0 }}
            value={nieuweEntiteitOpmerking}
            onChange={(event) => {
              setNieuweEntiteitOpmerking(event.target.value);
              setNieuweEntiteitOpmerkingAangepast(true);
            }}
            placeholder={`Nieuwe ${entiteitType || "Entiteit"} = ${String(nieuweEntiteitID || "").trim() || "?"}`}
          />
        </ActionInlineField>
        <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
          <button
            onClick={() => {
              if (nieuweEntiteitIDInfo.nextId !== null && nieuweEntiteitIDInfo.nextId !== undefined) {
                setNieuweEntiteitID(String(nieuweEntiteitIDInfo.nextId));
              }
            }}
            disabled={nieuweEntiteitIDInfo.loading || !entiteitType || nieuweEntiteitIDInfo.nextId === null}
            style={{ background: "#0f766e" }}
          >
            {nieuweEntiteitIDInfo.loading ? "Zoeken..." : "Neem suggestie-id over"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            {nieuweEntiteitIDInfo.error
              ? `Fout: ${nieuweEntiteitIDInfo.error}`
              : (nieuweEntiteitIDInfo.nextId !== null
                ? `max=${nieuweEntiteitIDInfo.maxId ?? "-"} | suggestie=${nieuweEntiteitIDInfo.nextId}`
                : "Geen id-suggestie geladen")}
          </span>
        </div>
      </ActionTopFields>

      <div style={{ borderTop: `1px solid ${accentColor}`, paddingTop: 10 }}>
        <ActionGroupedSections
          opties={gegevenselementGroepOpties}
          rows={nieuweEntiteitGegevens}
          titlePrefix="Gegevenselement"
          accentColor={accentColor}
          rowAccentColor={accentColor}
          onAddRow={voegNieuweEntiteitGegevenRijToe}
          onUpdateField={updateNieuweEntiteitGegevenRijVeld}
          onRemoveRow={(rowId) => setNieuweEntiteitGegevens((prev) => prev.filter((row) => row.id !== rowId))}
          busy={nieuweEntiteitBezig}
          isMeervoudigOptie={isMeervoudigOptie}
        />

        <ActionGroupedSections
          opties={relatieGroepOpties}
          rows={nieuweEntiteitRelaties}
          titlePrefix="Relatie"
          accentColor={accentColor}
          rowAccentColor={accentColor}
          onAddRow={voegNieuweEntiteitRelatieRijToe}
          onUpdateField={updateNieuweEntiteitRelatieRijVeld}
          onRemoveRow={(rowId) => setNieuweEntiteitRelaties((prev) => prev.filter((row) => row.id !== rowId))}
          busy={nieuweEntiteitBezig}
          isMeervoudigOptie={isMeervoudigOptie}
          secondaryOptionsByGroupKey={relatieSecondaireOpties}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={voerNieuweEntiteitActieUit} disabled={nieuweEntiteitBezig || !nieuweEntiteitOpvoerPreview?.ok} style={{ background: "#0f766e" }}>
            {nieuweEntiteitBezig ? "Bezig..." : `Voer nieuwe ${entiteitType} op`}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Na succes wordt automatisch naar de nieuwe registratie gesprongen.</span>
        </div>

        {nieuweEntiteitOpvoerPreview && (
          <details style={{ margin: "10px 0", borderRadius: 6, overflow: "hidden", border: `1px solid ${accentColor}` }}>
            <summary style={{ cursor: "pointer", padding: "6px 10px", background: "#f0fdfa", fontSize: 12, fontWeight: 600, color: "#115e59" }}>
              Preview: te versturen payload (nieuwe entiteit + onderliggende opvoer)
            </summary>
            {nieuweEntiteitOpvoerPreview.ok
              ? <pre style={{ margin: 0, padding: "8px 10px", fontSize: 12, background: "#ffffff", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", borderTop: `1px solid ${accentColor}` }}>{JSON.stringify(nieuweEntiteitOpvoerPreview.payload, null, 2)}</pre>
              : <p style={{ margin: 0, padding: "6px 10px", color: "#dc2626", fontSize: 12, borderTop: `1px solid ${accentColor}` }}>{nieuweEntiteitOpvoerPreview.fout}</p>}
          </details>
        )}
      </div>

      {nieuweEntiteitResultaat && (
        <p style={{ marginTop: 8, marginBottom: 0, color: nieuweEntiteitResultaat.ok ? "#166534" : "#dc2626", fontWeight: 600 }}>
          {nieuweEntiteitResultaat.bericht}
        </p>
      )}
    </ActionBodyCard>
  );
}
