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

      {typeMeta.description && (
        <p style={{ color: "var(--cg-donkergrijs)", marginBottom: "1rem" }}>{typeMeta.description}</p>
      )}

      <RepresentatieTabel typeMeta={typeMeta} />
    </div>
  );
}
