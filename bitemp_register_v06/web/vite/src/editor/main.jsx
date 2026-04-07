import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Link } from "react-router";
import { SchemaProvider, useSchema } from "../context/SchemaContext";
import EditorNavigatie from "../components/editor/EditorNavigatie";
import InhoudEditorPage from "../pages/InhoudEditorPage";
import EntiteitFormulier from "../components/editor/EntiteitFormulier";
import NieuwRecordFormulier from "../components/editor/NieuwRecordFormulier";

// Stijlen
import "@utrecht/component-library-css";
import "@utrecht/design-tokens/dist/index.css";
import "../styles/common-ground-theme.css";

// Logo: statisch bestand in public/ → base-pad /viz/react/
const logoUrl = import.meta.env.BASE_URL + "common-ground-logo.svg";

function detectBaseUrl() {
  if (typeof window === "undefined") return "";
  const loc = window.location;

  // Tijdens lokaal Vite-dev blijft de Go API op :8082 draaien.
  if (["5173", "5174", "5175"].includes(loc.port)) {
    return `${loc.protocol}//${loc.hostname}:8082`;
  }

  // Als de pagina door de API zelf of via Docker wordt geserveerd,
  // moet de inhoud-editor juist op dezelfde origin blijven zodat hij
  // de database van die eigen runtime-context gebruikt.
  return loc.origin;
}

function InhoudStartPage() {
  const { inhoudNavigatieGroepen, loading, error } = useSchema();

  if (loading) {
    return <div style={{ padding: "2rem", color: "var(--cg-donkergrijs)" }}>Schema laden…</div>;
  }

  if (error) {
    return <div className="cg-feedback--fout">Schema fout: {error}</div>;
  }

  return (
    <div style={{ padding: "0.5rem" }}>
      <h2 className="utrecht-heading-2">Welkom bij de Inhoud Editor</h2>
      <p style={{ color: "var(--cg-donkergrijs)", maxWidth: 760 }}>
        Kies links in de zijbalk of hieronder een domein. Per domein zie je zowel de ENT-en als de
        referentielijst-items.
      </p>

      {inhoudNavigatieGroepen.length === 0 ? (
        <div style={{ color: "var(--cg-donkergrijs)" }}>Geen inhoudstypen gevonden.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {inhoudNavigatieGroepen.map((groep) => (
            <section key={groep.domein} className="cg-form-card" style={{ marginBottom: 0 }}>
              <h3 className="utrecht-heading-3" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                {groep.domein}
              </h3>

              {groep.entiteiten.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--cg-donkergrijs)",
                    }}
                  >
                    ENT-en
                  </div>
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                    {groep.entiteiten.map((meta) => (
                      <li key={meta.typenaam} style={{ marginBottom: "0.25rem" }}>
                        <Link
                          to={`/t/${meta.padnaam || meta.meervoud || meta.veldnaam}`}
                          style={{ color: "var(--cg-blauw)", textDecoration: "none" }}
                        >
                          {meta.klassenaam || meta.typenaam}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {groep.referentielijstItems.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--cg-donkergrijs)",
                    }}
                  >
                    Referentielijst-items
                  </div>
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                    {groep.referentielijstItems.map((meta) => (
                      <li key={meta.typenaam} style={{ marginBottom: "0.25rem" }}>
                        <Link
                          to={`/t/${meta.padnaam || meta.meervoud || meta.veldnaam}`}
                          style={{ color: "var(--cg-blauw)", textDecoration: "none" }}
                        >
                          {meta.klassenaam || meta.typenaam}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorApp() {
  const baseUrl = detectBaseUrl();

  return (
    <SchemaProvider baseUrl={baseUrl}>
      <div className="common-ground-theme" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Top navigatiebalk */}
        <header className="cg-editor-nav">
          <img src={logoUrl} alt="Common Ground" className="cg-editor-nav__logo" />
          <span className="cg-editor-nav__title">Register — Inhoud Editor</span>
        </header>

        {/* Layout: sidebar + main */}
        <div className="cg-editor-layout">
          <EditorNavigatie />
          <main className="cg-editor-main">
            <Routes>
              <Route path="/t/:typePad" element={<InhoudEditorPage />} />
              <Route path="/t/:typePad/nieuw" element={<NieuwRecordFormulier />} />
              <Route path="/t/:typePad/:id" element={<EntiteitFormulier />} />
              <Route path="*" element={<InhoudStartPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </SchemaProvider>
  );
}

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error?.message || error) };
  }

  componentDidCatch(error, info) {
    console.error("[EditorErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
          <h1>Er ging iets mis</h1>
          <pre style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>{this.state.errorMessage}</pre>
          <button onClick={() => window.location.reload()}>Herlaad pagina</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <EditorErrorBoundary>
      <HashRouter>
        <EditorApp />
      </HashRouter>
    </EditorErrorBoundary>
  </React.StrictMode>
);
