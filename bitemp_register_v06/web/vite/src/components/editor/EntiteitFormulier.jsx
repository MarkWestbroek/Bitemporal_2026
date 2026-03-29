import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import RepresentatieFormulier from "./RepresentatieFormulier";
import RepresentatieTabel from "./RepresentatieTabel";

/**
 * EntiteitFormulier — toont een volledige entiteit met geneste GE/relatie-secties.
 * Haalt de full entity op via /api/full/{padnaam}/{id} en rendert per onderliggend
 * type een formulier (enkelvoudig) of tabel (meervoudig).
 */
export default function EntiteitFormulier() {
  const { typePad, id } = useParams();
  const { baseUrl, typeMetaByPadnaam, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();

  const typeMeta = typeMetaByPadnaam[typePad];
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  const fetchEntity = useCallback(async () => {
    if (!apiPath || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/full/${apiPath}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntity(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiPath, id]);

  useEffect(() => { fetchEntity(); }, [fetchEntity]);

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  if (loading) {
    return <div style={{ padding: "1rem", color: "var(--cg-donkergrijs)" }}>Laden…</div>;
  }

  if (error) {
    return <div className="cg-feedback--fout">Fout: {error}</div>;
  }

  if (!entity) {
    return <div className="cg-feedback--fout">Record niet gevonden.</div>;
  }

  const onderliggende = safeArray(typeMeta.onderliggende);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => navigate(`/t/${typeMeta.padnaam || typeMeta.meervoud || typePad}`)}
        >
          ← Terug naar overzicht
        </button>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam} #{id}
        </h2>
      </div>

      {/* Hoofd-entiteit velden */}
      <RepresentatieFormulier
        typeMeta={typeMeta}
        initialData={entity}
        onSaved={fetchEntity}
      />

      {/* Onderliggende GE's en relaties */}
      {onderliggende.map((child) => {
        const childMeta = typeMetaByTypenaam[child.doeltype];
        if (!childMeta) return null;

        const childData = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
        const isEnkelvoudig = child.momentvoorkomen === "enkelvoudig";

        return (
          <div key={child.doeltype} className="cg-form-card" style={{ marginTop: "1rem" }}>
            <div className="cg-form-section__title">
              {child.rolnaam || child.doeltype}
              <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--cg-donkergrijs)", marginLeft: 8 }}>
                ({child.momentvoorkomen}) — {childData.length} record(s)
              </span>
            </div>

            {isEnkelvoudig && childData.length > 0 ? (
              <RepresentatieFormulier
                typeMeta={childMeta}
                initialData={childData[0]}
                onSaved={fetchEntity}
              />
            ) : !isEnkelvoudig && childData.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="utrecht-table__header-row">
                      {safeArray(childMeta.velden).map((v) => (
                        <th key={v.naam} className="utrecht-table__header-cell">{v.naam}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {childData.map((item, i) => (
                      <tr key={i} className="utrecht-table__row" style={{ background: i % 2 === 1 ? "var(--cg-lichtgrijs)" : undefined }}>
                        {safeArray(childMeta.velden).map((v) => (
                          <td key={v.naam} className="utrecht-table__cell" style={{ padding: "0.375rem 0.75rem" }}>
                            {item[v.naam] != null ? String(item[v.naam]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "var(--cg-donkergrijs)", fontSize: "0.875rem", padding: "0.5rem 0" }}>
                Geen records.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
