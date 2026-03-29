import { NavLink } from "react-router";
import { useSchema } from "../../context/SchemaContext";

/**
 * EditorNavigatie — zijbalk met dynamisch opgebouwde links naar entiteittypen.
 * Leest de schema-context en toont alle entiteittypen als navigatielinks.
 */
export default function EditorNavigatie() {
  const { entiteitTypes, loading } = useSchema();

  return (
    <nav className="cg-editor-sidebar" aria-label="Registerinhoud navigatie">
      <div className="cg-editor-sidebar__heading">Entiteiten</div>
      {loading && <div style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>Schema laden…</div>}
      {entiteitTypes.map((meta) => (
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
          {meta.klassenaam || meta.typenaam}
        </NavLink>
      ))}
    </nav>
  );
}
