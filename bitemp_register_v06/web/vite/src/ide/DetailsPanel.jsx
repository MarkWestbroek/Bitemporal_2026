/**
 * DetailsPanel — Toont properties van het geselecteerde element of edge.
 *
 * Leest selectedElementId / selectedEdgeId uit de UI store en toont
 * de bijbehorende data uit de model store.
 *
 * In Fase 1 is dit een read-only weergave. Later wordt dit een
 * volledig bewerkbaar formulier (met NodeEditPanel/EdgeEditPanel integratie).
 */
import useModelStore from "../store/useModelStore";
import useUIStore from "../store/useUIStore";

const LABELS = {
  entiteit: "Entiteit",
  gegevenselement: "Gegevenselement",
  relatie: "Relatie",
  enumeratie: "Enumeratie",
  gegevenstype: "Gegevenstype",
  referentielijstInstantie: "Referentielijst-instantie",
};

export default function DetailsPanel() {
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId);
  const elements = useModelStore((s) => s.elements);
  const diagrams = useModelStore((s) => s.diagrams);

  // ─── Geen selectie ──────────────────────────────
  if (!selectedElementId && !selectedEdgeId) {
    return (
      <div style={{ padding: 16, color: "#888", fontSize: 13 }}>
        Selecteer een element in de browser of op het diagram om de details te bekijken.
      </div>
    );
  }

  // ─── Edge geselecteerd ──────────────────────────
  if (selectedEdgeId) {
    // Zoek de edge in het actieve diagram
    let edgeData = null;
    for (const diag of Object.values(diagrams)) {
      const found = (diag.edges || []).find((e) => e.id === selectedEdgeId);
      if (found) {
        edgeData = found;
        break;
      }
    }
    if (!edgeData) {
      return (
        <div style={{ padding: 16, color: "#888", fontSize: 13 }}>
          Edge niet gevonden.
        </div>
      );
    }
    return (
      <div style={{ padding: 16, fontSize: 13 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>🔗 Edge</h3>
        <PropertyRow label="ID" value={edgeData.id} />
        <PropertyRow label="Bron" value={edgeData.source} />
        <PropertyRow label="Doel" value={edgeData.target} />
        {edgeData.data && (
          <>
            <PropertyRow label="Rolnaam" value={edgeData.data.rolnaam} />
            <PropertyRow label="JSON rolnaam" value={edgeData.data.jsonRolnaam} />
            <PropertyRow label="Momentvoorkomen" value={edgeData.data.momentvoorkomen} />
            <PropertyRow label="Kardinaliteit" value={edgeData.data.kardinaliteit} />
          </>
        )}
      </div>
    );
  }

  // ─── Element geselecteerd ───────────────────────
  const element = elements[selectedElementId];
  if (!element) {
    return (
      <div style={{ padding: 16, color: "#888", fontSize: 13 }}>
        Element "{selectedElementId}" niet gevonden in het model.
      </div>
    );
  }

  const data = element.data || {};

  return (
    <div style={{ padding: 16, fontSize: 13, overflowY: "auto", height: "100%" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>
        {LABELS[element.type] || element.type}: {element.naam}
      </h3>

      <PropertyRow label="ID" value={element.id} />
      <PropertyRow label="Domein" value={element.domein} />
      <PropertyRow label="Type" value={element.type} />

      {data.description && <PropertyRow label="Beschrijving" value={data.description} />}
      {data.meervoud && <PropertyRow label="Meervoud" value={data.meervoud} />}
      {data.isMaterieel && <PropertyRow label="Materieel" value="Ja" />}
      {data.entiteitSubtype && <PropertyRow label="Subtype" value={data.entiteitSubtype} />}
      {data.relatieSubtype && <PropertyRow label="Relatie-subtype" value={data.relatieSubtype} />}
      {data.doelEntiteit && <PropertyRow label="Doel-entiteit" value={data.doelEntiteit} />}

      {/* Velden */}
      {data.velden && data.velden.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Velden ({data.velden.length})</strong>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #555", textAlign: "left" }}>
                <th style={{ padding: "2px 4px" }}>Naam</th>
                <th style={{ padding: "2px 4px" }}>Type</th>
                <th style={{ padding: "2px 4px" }}>Verpl.</th>
              </tr>
            </thead>
            <tbody>
              {data.velden.map((v, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #3a3a3a" }}>
                  <td style={{ padding: "2px 4px" }}>{v.naam}</td>
                  <td style={{ padding: "2px 4px" }}>
                    {v.type}
                    {v.format ? ` (${v.format})` : ""}
                    {v.enumNaam ? ` [${v.enumNaam}]` : ""}
                    {v.datatypeNaam ? ` ‹${v.datatypeNaam}›` : ""}
                  </td>
                  <td style={{ padding: "2px 4px" }}>{v.verplicht ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Enum waarden */}
      {data.waarden && data.waarden.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Waarden ({data.waarden.length})</strong>
          <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
            {data.waarden.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Afgeleide velden */}
      {data.afgeleideVelden && data.afgeleideVelden.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Afgeleide velden ({data.afgeleideVelden.length})</strong>
          {data.afgeleideVelden.map((av, i) => (
            <div
              key={i}
              style={{
                marginTop: 4,
                padding: "4px 6px",
                background: "#2a2d2e",
                borderRadius: 3,
                fontSize: 12,
              }}
            >
              <b>{av.naam}</b> ({av.afleidingsregelTaal})
              <br />
              <code style={{ fontSize: 11 }}>{av.afleidingsregel}</code>
            </div>
          ))}
        </div>
      )}

      {/* Datatype specifiek */}
      {data.basistype && <PropertyRow label="Basistype" value={data.basistype} />}
      {data.format && <PropertyRow label="Format" value={data.format} />}
    </div>
  );
}

function PropertyRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 4, display: "flex", gap: 8 }}>
      <span style={{ color: "#999", minWidth: 90, flexShrink: 0 }}>{label}:</span>
      <span style={{ wordBreak: "break-word" }}>{String(value)}</span>
    </div>
  );
}
