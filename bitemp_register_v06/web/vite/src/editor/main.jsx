import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router";
import { SchemaProvider } from "../context/SchemaContext";
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
  // Zelfde host als de pagina, maar altijd port 8082 (API)
  return `${loc.protocol}//${loc.hostname}:8082`;
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
              <Route
                path="*"
                element={
                  <div style={{ padding: "2rem", color: "var(--cg-donkergrijs)" }}>
                    <h2 className="utrecht-heading-2">Welkom bij de Inhoud Editor</h2>
                    <p>Kies een entiteittype in de zijbalk om de gegevens te bekijken en bewerken.</p>
                  </div>
                }
              />
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
