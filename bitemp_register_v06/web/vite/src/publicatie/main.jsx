import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Link, useNavigate } from "react-router";
import { SchemaProvider, useSchema } from "../context/SchemaContext";

// Stijlen
import "@utrecht/component-library-css";
import "@utrecht/design-tokens/dist/index.css";
import "../styles/common-ground-theme.css";

import PublicatieTabel from "./PublicatieTabel";
import PublicatieDetail from "./PublicatieDetail";

const logoUrl = import.meta.env.BASE_URL + "common-ground-logo.svg";

function detectBaseUrl() {
  if (typeof window === "undefined") return "";
  const loc = window.location;
  if (["5173", "5174", "5175"].includes(loc.port)) {
    return `${loc.protocol}//${loc.hostname}:8082`;
  }
  return loc.origin;
}

/** Landingspagina: toon alle entiteitstypen waarvoor een WeergaveDefinitie beschikbaar is. */
function PublicatieLanding() {
  const { allTypes: types, loading, error } = useSchema();
  const navigate = useNavigate();

  if (loading) return <div style={{ padding: "2rem" }}>Schema laden…</div>;
  if (error) return <div className="cg-feedback--fout">Schema fout: {error}</div>;

  // Toon alle entiteitstypen (metatype === "entiteit") gegroepeerd per domein
  const entiteiten = (types || []).filter(
    (t) => t.metatype === "entiteit" && t.domein !== "configuratie"
  );

  const domeinen = {};
  for (const ent of entiteiten) {
    const domein = ent.domein || "Overig";
    if (!domeinen[domein]) domeinen[domein] = [];
    domeinen[domein].push(ent);
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h2 className="utrecht-heading-2">Publicatie — kies een entiteitstype</h2>
      <p style={{ color: "var(--cg-donkergrijs)", marginBottom: "1.5rem" }}>
        Selecteer hieronder een entiteitstype om de publicatieweergave te openen.
      </p>

      {Object.entries(domeinen)
        .sort(([a], [b]) => a.localeCompare(b, "nl"))
        .map(([domein, items]) => (
          <section key={domein} className="cg-form-card" style={{ marginBottom: "1rem" }}>
            <h3 className="utrecht-heading-3" style={{ marginTop: 0 }}>
              {domein}
            </h3>
            <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
              {items
                .sort((a, b) =>
                  (a.klassenaam || a.typenaam).localeCompare(b.klassenaam || b.typenaam, "nl")
                )
                .map((ent) => (
                  <li key={ent.typenaam} style={{ marginBottom: "0.35rem" }}>
                    <Link
                      to={`/t/${ent.padnaam || ent.meervoud || ent.veldnaam}`}
                      style={{ color: "var(--cg-blauw)", textDecoration: "none" }}
                    >
                      {ent.klassenaam || ent.typenaam}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}

      {entiteiten.length === 0 && (
        <div style={{ color: "var(--cg-donkergrijs)" }}>Geen entiteitstypen gevonden.</div>
      )}
    </div>
  );
}

function PublicatieApp() {
  const baseUrl = detectBaseUrl();

  return (
    <SchemaProvider baseUrl={baseUrl}>
      <div
        className="common-ground-theme"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="cg-editor-nav">
          <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src={logoUrl} alt="Common Ground" className="cg-editor-nav__logo" />
          </Link>
          <span className="cg-editor-nav__title">Register — Publicatie</span>
        </header>

        <main style={{ flex: 1, padding: "0.5rem 1rem" }}>
          <Routes>
            <Route path="/t/:typePad" element={<PublicatieTabel />} />
            <Route path="/t/:typePad/:id" element={<PublicatieDetail />} />
            <Route path="*" element={<PublicatieLanding />} />
          </Routes>
        </main>
      </div>
    </SchemaProvider>
  );
}

class PublicatieErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem" }}>
          <h2>Er ging iets mis</h2>
          <p>{this.state.error?.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Herlaad pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PublicatieErrorBoundary>
      <HashRouter>
        <PublicatieApp />
      </HashRouter>
    </PublicatieErrorBoundary>
  </React.StrictMode>
);
