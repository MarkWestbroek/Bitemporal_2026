import { useParams, useNavigate } from "react-router";
import { useSchema } from "../context/SchemaContext";
import RepresentatieTabel from "../components/editor/RepresentatieTabel";

/**
 * InhoudEditorPage — tabeloverzicht voor een specifiek entiteittype.
 * Wordt gerouteerd via /t/:typePad.
 */
export default function InhoudEditorPage() {
  const { typePad } = useParams();
  const { typeMetaByPadnaam, loading, error } = useSchema();
  const navigate = useNavigate();

  const infoBadgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.25rem 0.5rem",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "var(--cg-donkerblauw)",
    fontSize: "0.75rem",
    fontWeight: 600,
  };

  if (loading) {
    return <div style={{ padding: "1rem", color: "var(--cg-donkergrijs)" }}>Schema laden…</div>;
  }

  if (error) {
    return <div className="cg-feedback--fout">Schema fout: {error}</div>;
  }

  const typeMeta = typeMetaByPadnaam[typePad];
  if (!typeMeta) {
    return (
      <div style={{ padding: "1rem" }}>
        <div className="cg-feedback--fout">Onbekend type: {typePad}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam}
        </h2>
        <button
          className="utrecht-button utrecht-button--primary-action"
          onClick={() => navigate(`/t/${typePad}/nieuw`)}
        >
          + Nieuw
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {typeMeta.domein && <span style={infoBadgeStyle}>Domein: {typeMeta.domein}</span>}
        {typeMeta.entiteitSubtype === "referentielijst_item" && (
          <span style={infoBadgeStyle}>Referentielijst-item</span>
        )}
      </div>

      {typeMeta.description && (
        <p style={{ color: "var(--cg-donkergrijs)", marginBottom: "1rem" }}>{typeMeta.description}</p>
      )}

      <RepresentatieTabel typeMeta={typeMeta} />
    </div>
  );
}
