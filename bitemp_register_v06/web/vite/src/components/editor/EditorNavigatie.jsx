import { NavLink } from "react-router";
import { useSchema } from "../../context/SchemaContext";

function NavigatieLink({ meta }) {
  const isReferentielijstItem = (meta.entiteitSubtype || "") === "referentielijst_item";

  return (
    <NavLink
      key={meta.typenaam}
      to={`/t/${meta.padnaam || meta.meervoud || meta.veldnaam}`}
      className={({ isActive }) =>
        `cg-editor-sidebar__item${isActive ? " cg-editor-sidebar__item--active" : ""}`
      }
      style={{ textDecoration: "none" }}
    >
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: meta.kleur || "#94a3b8",
          marginRight: 8,
          flexShrink: 0,
        }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span>{meta.klassenaam || meta.typenaam}</span>
        {isReferentielijstItem && (
          <span style={{ fontSize: "0.72rem", color: "var(--cg-donkergrijs)" }}>
            referentielijst-item
          </span>
        )}
      </span>
    </NavLink>
  );
}

/**
 * EditorNavigatie — zijbalk met dynamisch opgebouwde links per domein.
 * Per domein tonen we zowel ENT-en als referentielijst-items.
 */
export default function EditorNavigatie() {
  const { inhoudNavigatieGroepen, loading } = useSchema();

  return (
    <nav className="cg-editor-sidebar" aria-label="Registerinhoud navigatie">
      <div className="cg-editor-sidebar__heading">Inhoud per domein</div>
      {loading && <div style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>Schema laden…</div>}
      {!loading && inhoudNavigatieGroepen.length === 0 && (
        <div style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--cg-donkergrijs)" }}>
          Geen inhoudstypen gevonden.
        </div>
      )}

      {inhoudNavigatieGroepen.map((groep) => (
        <section key={groep.domein} style={{ paddingBottom: "0.5rem" }}>
          <div
            className="cg-editor-sidebar__heading"
            style={{ paddingTop: "0.5rem", color: "var(--cg-donkerblauw)" }}
          >
            {groep.domein}
          </div>

          {groep.entiteiten.length > 0 && (
            <>
              <div
                style={{
                  padding: "0.15rem 1rem 0.25rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--cg-donkergrijs)",
                }}
              >
                ENT-en ({groep.entiteiten.length})
              </div>
              {groep.entiteiten.map((meta) => <NavigatieLink key={meta.typenaam} meta={meta} />)}
            </>
          )}

          {groep.referentielijstItems.length > 0 && (
            <>
              <div
                style={{
                  padding: "0.15rem 1rem 0.25rem",
                  marginTop: groep.entiteiten.length > 0 ? 6 : 0,
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--cg-donkergrijs)",
                }}
              >
                Referentielijst-items ({groep.referentielijstItems.length})
              </div>
              {groep.referentielijstItems.map((meta) => <NavigatieLink key={meta.typenaam} meta={meta} />)}
            </>
          )}
        </section>
      ))}
    </nav>
  );
}
